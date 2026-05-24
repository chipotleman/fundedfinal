import { db } from './db';
import { gameOddsSnapshots } from '../shared/schema';
import { and, eq, gte, desc, lt } from 'drizzle-orm';

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

// Capture-side guards (per-process). Each entry tracks the last odds
// fingerprint and timestamp we wrote for a given gameId so we don't spam
// the table with identical or back-to-back rows. The fingerprint covers
// moneyline, total line, and spread — anything else (lines.source, etc.)
// is intentionally ignored so cosmetic re-orders don't trigger a write.
const MIN_INTERVAL_MS = 30 * 1000;
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

const lastByGame = new Map();
let lastPruneAt = 0;
let prunePromise = null;

function fingerprintOf(snap) {
  return [
    snap.homeMl ?? '',
    snap.awayMl ?? '',
    snap.totalLine ?? '',
    snap.homeSpread ?? '',
    snap.awaySpread ?? '',
  ].join('|');
}

// Convert American odds to implied probability (0..1, pre-vig).
export function americanToImplied(odds) {
  if (odds == null || Number.isNaN(odds)) return null;
  const n = Number(odds);
  if (!Number.isFinite(n) || n === 0) return null;
  if (n > 0) return 100 / (n + 100);
  return -n / (-n + 100);
}

// Given a home/away american pair, return de-vigged win probabilities
// summing to 1. Returns nulls if either side is missing.
export function devigPair(homeMl, awayMl) {
  const h = americanToImplied(homeMl);
  const a = americanToImplied(awayMl);
  if (h == null || a == null) return { home: null, away: null };
  const total = h + a;
  if (!total || total <= 0) return { home: null, away: null };
  return { home: h / total, away: a / total };
}

// Pull a normalized snapshot object out of the shape /api/games returns.
// Returns null when the game has no moneyline we'd want to chart.
export function snapshotFromGame(game) {
  if (!game || !game.id) return null;
  const lines = game.lines || {};
  const ml = lines.moneyline || {};
  const homeMl = Number.isFinite(Number(ml.home)) ? Number(ml.home) : null;
  const awayMl = Number.isFinite(Number(ml.away)) ? Number(ml.away) : null;
  if (homeMl == null && awayMl == null) return null;
  const totalLine = lines.total?.over?.point ?? lines.total?.under?.point ?? null;
  const homeSpread = lines.spread?.home?.point ?? null;
  const awaySpread = lines.spread?.away?.point ?? null;
  return {
    gameId: String(game.id),
    sport: game.sport || game.sportName || null,
    homeMl,
    awayMl,
    totalLine: totalLine != null ? String(totalLine) : null,
    homeSpread: homeSpread != null ? String(homeSpread) : null,
    awaySpread: awaySpread != null ? String(awaySpread) : null,
    source: ml.homeSource || ml.awaySource || 'Goalserve',
  };
}

async function pruneOldRowsIfDue() {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_EVERY_MS) return;
  if (prunePromise) return prunePromise;
  lastPruneAt = now;
  const cutoff = new Date(now - RETENTION_MS);
  prunePromise = db
    .delete(gameOddsSnapshots)
    .where(lt(gameOddsSnapshots.capturedAt, cutoff))
    .catch((err) => {
      console.error('[oddsHistory] prune failed:', err?.message || err);
    })
    .finally(() => {
      prunePromise = null;
    });
  return prunePromise;
}

// Fire-and-forget snapshot capture for a single game. Safe to call from
// hot paths — it dedup's both in-memory (fast path) and against the
// most recent persisted row (durable across restarts / multi-instance),
// and never throws to the caller.
export async function captureGameSnapshot(game) {
  try {
    const snap = snapshotFromGame(game);
    if (!snap) return false;
    const now = Date.now();
    const prev = lastByGame.get(snap.gameId);
    const fp = fingerprintOf(snap);
    if (prev && prev.fp === fp) return false;
    if (prev && now - prev.ts < MIN_INTERVAL_MS) return false;

    // Durable dedup: compare against whatever was last actually written
    // to the DB. This protects against process restarts and multiple
    // instances racing on the same game, where the in-memory map alone
    // would let an unchanged snapshot land twice.
    const [latest] = await db
      .select({
        capturedAt: gameOddsSnapshots.capturedAt,
        homeMl: gameOddsSnapshots.homeMl,
        awayMl: gameOddsSnapshots.awayMl,
        totalLine: gameOddsSnapshots.totalLine,
        homeSpread: gameOddsSnapshots.homeSpread,
        awaySpread: gameOddsSnapshots.awaySpread,
      })
      .from(gameOddsSnapshots)
      .where(eq(gameOddsSnapshots.gameId, snap.gameId))
      .orderBy(desc(gameOddsSnapshots.capturedAt))
      .limit(1);
    if (latest) {
      const latestFp = fingerprintOf({
        homeMl: latest.homeMl,
        awayMl: latest.awayMl,
        totalLine: latest.totalLine,
        homeSpread: latest.homeSpread,
        awaySpread: latest.awaySpread,
      });
      if (latestFp === fp) {
        // Sync in-memory state so we don't keep re-querying.
        lastByGame.set(snap.gameId, { fp, ts: new Date(latest.capturedAt).getTime() });
        return false;
      }
      const latestTs = new Date(latest.capturedAt).getTime();
      if (now - latestTs < MIN_INTERVAL_MS) {
        return false;
      }
    }
    await db.insert(gameOddsSnapshots).values({
      gameId: snap.gameId,
      sport: snap.sport,
      homeMl: snap.homeMl,
      awayMl: snap.awayMl,
      totalLine: snap.totalLine,
      homeSpread: snap.homeSpread,
      awaySpread: snap.awaySpread,
      source: snap.source,
    });
    // Only mark the in-memory dedup state after a successful insert —
    // otherwise a transient DB error would permanently swallow this
    // fingerprint until the odds happen to move again.
    lastByGame.set(snap.gameId, { fp, ts: now });
    pruneOldRowsIfDue();
    return true;
  } catch (err) {
    console.error('[oddsHistory] capture failed:', err?.message || err);
    return false;
  }
}

// Capture many games at once; never throws.
export async function captureGamesSnapshots(games) {
  if (!Array.isArray(games) || games.length === 0) return 0;
  let written = 0;
  for (const g of games) {
    const ok = await captureGameSnapshot(g);
    if (ok) written++;
  }
  return written;
}

// Fixed lookback windows. ALL is intentionally absent — it bypasses
// the time filter entirely (don't fallback-coerce it to LIVE).
const RANGE_TO_MS = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
};

// Load snapshots for a single game, oldest -> newest. `range` is one of
// LIVE / 1H / 6H / 1D / ALL.
//
// LIVE semantics:
//   - For in-play games we want the last 2h of movement.
//   - For pre-game (no snapshots in the last 2h yet) we fall back to
//     "since-open" so the chart shows the full opening drift instead
//     of looking empty until the game tips off.
// ALL returns the entire retained history with no time filter.
export async function loadGameHistory(gameId, range = 'LIVE') {
  const id = String(gameId);
  const conds = [eq(gameOddsSnapshots.gameId, id)];
  if (range === 'LIVE') {
    const liveCutoff = new Date(Date.now() - LIVE_WINDOW_MS);
    // Probe for any in-play snapshot. If none, treat as pre-game and
    // return the full series (== since-open) so the chart isn't blank.
    const [inWindow] = await db
      .select({ capturedAt: gameOddsSnapshots.capturedAt })
      .from(gameOddsSnapshots)
      .where(and(
        eq(gameOddsSnapshots.gameId, id),
        gte(gameOddsSnapshots.capturedAt, liveCutoff),
      ))
      .limit(1);
    if (inWindow) {
      conds.push(gte(gameOddsSnapshots.capturedAt, liveCutoff));
    }
    // else: leave conds as gameId-only -> since-open behavior
  } else if (range !== 'ALL') {
    const since = RANGE_TO_MS[range];
    if (since != null) {
      conds.push(gte(gameOddsSnapshots.capturedAt, new Date(Date.now() - since)));
    }
  }
  const rows = await db
    .select({
      capturedAt: gameOddsSnapshots.capturedAt,
      homeMl: gameOddsSnapshots.homeMl,
      awayMl: gameOddsSnapshots.awayMl,
      totalLine: gameOddsSnapshots.totalLine,
      homeSpread: gameOddsSnapshots.homeSpread,
      awaySpread: gameOddsSnapshots.awaySpread,
    })
    .from(gameOddsSnapshots)
    .where(and(...conds))
    .orderBy(gameOddsSnapshots.capturedAt);

  const points = rows.map((r) => {
    const probs = devigPair(r.homeMl, r.awayMl);
    return {
      t: new Date(r.capturedAt).getTime(),
      homeML: r.homeMl,
      awayML: r.awayMl,
      homeImplied: probs.home,
      awayImplied: probs.away,
    };
  });
  return points;
}

// Earliest captured timestamp for a game (across all time), used as the
// "openedAt" hint for the LIVE range so pre-game charts don't look empty.
export async function loadOpenedAt(gameId) {
  const rows = await db
    .select({ capturedAt: gameOddsSnapshots.capturedAt })
    .from(gameOddsSnapshots)
    .where(eq(gameOddsSnapshots.gameId, String(gameId)))
    .orderBy(gameOddsSnapshots.capturedAt)
    .limit(1);
  return rows[0]?.capturedAt ? new Date(rows[0].capturedAt).getTime() : null;
}
