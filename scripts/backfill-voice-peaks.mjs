#!/usr/bin/env node
/*
 * One-shot backfill: populate `messages.attachment_peaks` for every legacy
 * voice note that pre-dates the waveform-persistence rollout.
 *
 * Why: voice notes sent before the persistence rollout still rely on a
 * low-priority background decode the first time someone opens an old thread,
 * with peaks getting persisted opportunistically only when a client actually
 * views the bubble (see `pages/api/messages/peaks.js`). Running this once
 * server-side fills in every NULL row in a single pass so old bubbles render
 * instantly with zero audio fetches from the client. After it completes the
 * client-side warm-up decode in `VoiceWaveform` becomes inert (it already
 * short-circuits when `storedPeaks` is present) and can be removed.
 *
 * Usage:
 *   node scripts/backfill-voice-peaks.mjs              # full run
 *   node scripts/backfill-voice-peaks.mjs --dry-run    # report counts only
 *   node scripts/backfill-voice-peaks.mjs --limit=100  # cap rows scanned
 *   node scripts/backfill-voice-peaks.mjs --batch=25   # tune fetch batch
 *   node scripts/backfill-voice-peaks.mjs --concurrency=4
 *
 * Requirements: DATABASE_URL, PRIVATE_OBJECT_DIR (and the Replit object
 * storage sidecar) must be configured in the shell that invokes this. The
 * `ffmpeg` binary must be on PATH — we shell out for decoding so any codec
 * the source clients used (webm/opus, m4a/aac, wav, ogg, mp3, ...) works
 * without bringing a JS audio decoder into the project.
 */

import { spawn } from 'node:child_process';
import { neon } from '@neondatabase/serverless';
import {
  getStorageClient,
  resolvePrivateObjectPath,
} from '../lib/objectStorage.js';

// Same shape the client visualizer uses. Kept in sync with WAVEFORM_BAR_COUNT
// in `components/messages/MessagesPanel.js` and the MAX_PEAK_BARS cap on the
// per-bubble peaks endpoint so a backfilled row is indistinguishable from a
// freshly-sent one when the bubble renders it.
const WAVEFORM_BAR_COUNT = 36;

// Decoding rate for the peaks computation. We don't need full fidelity — peaks
// are normalized magnitudes per visual bar, so 16 kHz mono is plenty and keeps
// each download's PCM buffer compact (a 60 s clip is ~1.9 MB instead of ~10 MB
// at 48 kHz stereo).
const TARGET_SAMPLE_RATE = 16000;

function parseArgs(argv) {
  const out = { dryRun: false, limit: null, batchSize: 50, concurrency: 4 };
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run') { out.dryRun = true; continue; }
    if (raw.startsWith('--limit=')) {
      const n = Number(raw.split('=')[1]);
      if (Number.isFinite(n) && n > 0) out.limit = Math.floor(n);
      continue;
    }
    if (raw.startsWith('--batch=')) {
      const n = Number(raw.split('=')[1]);
      if (Number.isFinite(n) && n > 0) out.batchSize = Math.floor(n);
      continue;
    }
    if (raw.startsWith('--concurrency=')) {
      const n = Number(raw.split('=')[1]);
      if (Number.isFinite(n) && n > 0) out.concurrency = Math.floor(n);
      continue;
    }
    if (raw === '--help' || raw === '-h') {
      console.log(
        'Usage: node scripts/backfill-voice-peaks.mjs ' +
          '[--dry-run] [--limit=N] [--batch=N] [--concurrency=N]'
      );
      process.exit(0);
    }
    console.error(`Unknown arg: ${raw}`);
    process.exit(2);
  }
  return out;
}

// Stream `buffer` through ffmpeg, ask for raw signed 16-bit little-endian PCM
// (mono, downsampled to TARGET_SAMPLE_RATE), and resolve with the resulting
// PCM bytes. ffmpeg auto-detects the input container/codec from the bytes,
// so callers don't need to know what format the source attachment is in.
function decodeToMonoPcm(buffer) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn',                       // ignore any video/album-art track
      '-ac', '1',                  // downmix to mono
      '-ar', String(TARGET_SAMPLE_RATE),
      '-f', 's16le',
      'pipe:1',
    ];
    let proc;
    try {
      proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      reject(err);
      return;
    }
    const chunks = [];
    let stderr = '';
    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    proc.stdout.on('data', (c) => chunks.push(c));
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', (err) => settle(reject, err));
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = stderr.trim().slice(0, 300) || `ffmpeg exited with ${code}`;
        const err = new Error(`ffmpeg decode failed: ${msg}`);
        err.code = 'ffmpeg_failed';
        return settle(reject, err);
      }
      settle(resolve, Buffer.concat(chunks));
    });
    proc.stdin.on('error', (err) => settle(reject, err));
    proc.stdin.end(buffer);
  });
}

// Reduce a raw mono PCM buffer to `barCount` normalized peak amplitudes in
// [0, 1]. Mirrors `extractPeaksFromAudioBuffer` in MessagesPanel.js so a
// backfilled row visualizes identically to one decoded client-side.
function extractPeaksFromPcm(pcmBuffer, barCount = WAVEFORM_BAR_COUNT) {
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  if (sampleCount === 0) return new Array(barCount).fill(0);
  const samplesPerBar = Math.max(1, Math.floor(sampleCount / barCount));
  const out = new Array(barCount).fill(0);
  let max = 0;
  for (let b = 0; b < barCount; b++) {
    let peak = 0;
    const start = b * samplesPerBar;
    const end = Math.min(sampleCount, start + samplesPerBar);
    for (let i = start; i < end; i++) {
      const s = Math.abs(pcmBuffer.readInt16LE(i * 2)) / 32768;
      if (s > peak) peak = s;
    }
    out[b] = peak;
    if (peak > max) max = peak;
  }
  // Same headroom multiplier the client uses so quiet recordings still fill
  // the bar height — clamped at 1 so we never exceed the visualizer's range.
  return max > 0 ? out.map((v) => Math.min(1, (v / max) * 1.1)) : out;
}

// Resolve a stored `/objects/<subpath>` reference and download the raw bytes
// from object storage. Returns null when the URL is missing/malformed or the
// object no longer exists (orphaned attachment) so the caller can skip the
// row instead of crashing the whole pass.
async function fetchAttachmentBytes(attachmentUrl) {
  if (!attachmentUrl || typeof attachmentUrl !== 'string') return null;
  if (!attachmentUrl.startsWith('/objects/')) return null;
  const subPath = attachmentUrl.slice('/objects/'.length);
  const resolved = resolvePrivateObjectPath(subPath);
  if (!resolved) return null;
  const storage = getStorageClient();
  const file = storage.bucket(resolved.bucketName).file(resolved.objectName);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [contents] = await file.download();
  return contents;
}

// Process a single legacy row end-to-end: download the audio, decode it,
// compute peaks, and (unless --dry-run) write them back. Returns one of
// 'written' | 'raced' | 'would-write' | 'missing' | 'failed' so the caller
// can keep per-category stats and show the user honest counts.
async function processRow(row, sql, opts) {
  try {
    const bytes = await fetchAttachmentBytes(row.attachment_url);
    if (!bytes || bytes.length === 0) return 'missing';
    const pcm = await decodeToMonoPcm(bytes);
    const peaks = extractPeaksFromPcm(pcm);
    if (!peaks || peaks.length === 0) return 'failed';
    if (opts.dryRun) return 'would-write';
    // Re-check the NULL guard inside the UPDATE so a concurrent client-side
    // backfill (the legacy POST endpoint) can't be clobbered if it happens
    // to land first. Last-write-wins is harmless either way — both sides
    // produce the same shape — but skipping the write keeps the pass
    // idempotent. We `RETURNING id` so we can tell whether the guard kept
    // us from writing (concurrent race) and report it honestly instead of
    // double-counting it as a write.
    const updated = await sql`
      UPDATE messages
      SET attachment_peaks = ${JSON.stringify(peaks)}::jsonb
      WHERE id = ${row.id}
        AND message_type = 'voice'
        AND attachment_peaks IS NULL
      RETURNING id
    `;
    return updated.length > 0 ? 'written' : 'raced';
  } catch (err) {
    console.error(
      `[backfill-voice-peaks] failed id=${row.id} url=${row.attachment_url}: ` +
        (err && err.message ? err.message : err)
    );
    return 'failed';
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[backfill-voice-peaks] DATABASE_URL is not set');
    process.exit(1);
  }
  if (!process.env.PRIVATE_OBJECT_DIR) {
    console.error(
      '[backfill-voice-peaks] PRIVATE_OBJECT_DIR is not set — voice ' +
        'attachments live in the private object-storage bucket and cannot be ' +
        'fetched without it.'
    );
    process.exit(1);
  }

  const opts = parseArgs(process.argv);
  const sql = neon(process.env.DATABASE_URL);
  const startedAt = Date.now();

  // Sanity log so a long pass leaves a clear breadcrumb in CI / shell history.
  console.log(
    `[backfill-voice-peaks] starting (dryRun=${opts.dryRun}, batch=${opts.batchSize}, ` +
      `concurrency=${opts.concurrency}, limit=${opts.limit ?? 'none'})`
  );

  const stats = {
    scanned: 0,
    written: 0,
    wouldWrite: 0,
    raced: 0,
    missing: 0,
    failed: 0,
  };

  // Keyset pagination by (created_at, id) so failed rows still advance the
  // cursor and we never loop forever on the same broken row. We re-query
  // each batch so freshly-written rows drop out of the result set naturally
  // (the WHERE clause filters on attachment_peaks IS NULL).
  let cursor = null;
  let stop = false;

  // Allow Ctrl-C to drain in-flight work and print stats instead of leaving
  // the user wondering how far the pass got.
  process.on('SIGINT', () => {
    if (stop) return;
    console.log('\n[backfill-voice-peaks] received SIGINT — finishing batch then exiting');
    stop = true;
  });

  while (!stop) {
    if (opts.limit && stats.scanned >= opts.limit) break;
    const remaining = opts.limit ? opts.limit - stats.scanned : opts.batchSize;
    const fetchSize = Math.min(opts.batchSize, remaining);

    const rows = cursor
      ? await sql`
          SELECT id, attachment_url, created_at
          FROM messages
          WHERE message_type = 'voice'
            AND attachment_peaks IS NULL
            AND (
              created_at > ${cursor.createdAt}
              OR (created_at = ${cursor.createdAt} AND id > ${cursor.id})
            )
          ORDER BY created_at ASC, id ASC
          LIMIT ${fetchSize}
        `
      : await sql`
          SELECT id, attachment_url, created_at
          FROM messages
          WHERE message_type = 'voice'
            AND attachment_peaks IS NULL
          ORDER BY created_at ASC, id ASC
          LIMIT ${fetchSize}
        `;

    if (rows.length === 0) break;

    // Process the batch with a small concurrency window. Object-storage
    // downloads dominate wall-clock time, so a handful in flight at once
    // cuts the pass length without overwhelming the sidecar.
    const queue = rows.slice();
    const workers = new Array(Math.min(opts.concurrency, queue.length))
      .fill(0)
      .map(async () => {
        while (!stop) {
          const row = queue.shift();
          if (!row) return;
          stats.scanned += 1;
          const outcome = await processRow(row, sql, opts);
          if (outcome === 'written') stats.written += 1;
          else if (outcome === 'would-write') stats.wouldWrite += 1;
          else if (outcome === 'raced') stats.raced += 1;
          else if (outcome === 'missing') stats.missing += 1;
          else stats.failed += 1;
        }
      });
    await Promise.all(workers);

    const last = rows[rows.length - 1];
    cursor = { createdAt: last.created_at, id: last.id };

    console.log(
      `[backfill-voice-peaks] progress scanned=${stats.scanned} ` +
        `written=${stats.written} wouldWrite=${stats.wouldWrite} ` +
        `raced=${stats.raced} missing=${stats.missing} failed=${stats.failed}`
    );
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[backfill-voice-peaks] done in ${elapsed}s — scanned=${stats.scanned} ` +
      `written=${stats.written} wouldWrite=${stats.wouldWrite} ` +
      `raced=${stats.raced} missing=${stats.missing} failed=${stats.failed}`
  );

  // Non-zero exit when something failed so a CI invocation surfaces the
  // problem instead of silently moving on. Missing-attachment rows are
  // expected (orphaned uploads) and don't fail the run on their own.
  if (stats.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[backfill-voice-peaks] fatal:', err);
  process.exit(1);
});
