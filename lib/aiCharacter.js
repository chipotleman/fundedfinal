// Server-side AI "battle character" generation.
//
// Turns a user's profile photo into a premium e-sports hero character that
// matches the style of the static default characters in /public/characters.
// The generated PNG is uploaded to Vercel Blob and its URL + a hash of the
// source avatar are persisted on the profile so we only ever regenerate when
// the user actually changes their photo.
//
// Generation uses Google's Gemini image model ("Nano Banana"), called via the
// public Generative Language REST API with GEMINI_API_KEY. If anything fails
// (missing key, model error, timeout) the caller marks the character 'failed'
// and the UI gracefully falls back to the generic default character — so a
// generation outage never breaks the battle-mode screen.

import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import { put } from '@vercel/blob';

// SSRF defense: avatars are user-controlled strings, so before fetching one we
// only allow http(s) hosts on trusted storage domains (where our uploads live),
// resolve the hostname, and reject any private / loopback / link-local IP.
const TRUSTED_AVATAR_HOST_SUFFIXES = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
];

function isTrustedAvatarHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return TRUSTED_AVATAR_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

function isBlockedIp(ip) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
  if (v.startsWith('::ffff:')) return isBlockedIp(v.slice(7)); // IPv4-mapped
  return false;
}

async function assertSafeAvatarUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid avatar URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Unsupported avatar URL protocol');
  }
  if (!isTrustedAvatarHost(parsed.hostname)) {
    throw new Error('Avatar host is not an allowed storage domain');
  }
  // Defense in depth: resolve and reject private/loopback/link-local targets.
  const records = await dns.lookup(parsed.hostname, { all: true });
  if (!records.length) throw new Error('Avatar host did not resolve');
  for (const { address } of records) {
    if (isBlockedIp(address)) throw new Error('Avatar host resolves to a blocked address');
  }
}

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const CHARACTER_PROMPT =
  'Transform the person in this photo into a premium e-sports hero character ' +
  'for a competitive sports-betting battle game character-select screen. ' +
  'Keep their likeness recognizable — same face, skin tone, hair style and ' +
  'any distinctive features — but render them as a polished, ultra-detailed 3D ' +
  'game character. Dress them in a sharp, stylish outfit. Upper body facing the ' +
  'camera, confident winning expression, dramatic cinematic blue rim lighting, ' +
  'glowing blue energy with a blurred stadium arena background, vibrant and high ' +
  'contrast. Portrait composition. No text, no watermark, no logos, no purple.';

// Stable hash of the source avatar so we can detect changes cheaply.
export function hashAvatarSource(avatar) {
  return crypto.createHash('sha256').update(String(avatar || '')).digest('hex').slice(0, 64);
}

// An avatar is "generatable" only when it's a real uploaded image (http(s) URL
// or a data: URL). Null / generated-SVG fallbacks are not real photos.
export function isGeneratableAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') return false;
  const a = avatar.trim();
  if (a.startsWith('data:image/')) return true;
  if (/^https?:\/\//i.test(a)) {
    // The deterministic initials SVG endpoint is not a real photo.
    if (a.includes('/api/avatar/')) return false;
    // Only real uploads on our trusted storage domain are generatable; this
    // also keeps the avatar fetch off arbitrary user-supplied hosts (SSRF).
    try {
      return isTrustedAvatarHost(new URL(a).hostname);
    } catch {
      return false;
    }
  }
  return false;
}

// Fetch the source avatar and return { base64, mimeType }.
async function loadAvatarBytes(avatar) {
  const a = avatar.trim();
  if (a.startsWith('data:')) {
    const match = a.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Unsupported data URL avatar');
    return { base64: match[2], mimeType: match[1] };
  }
  await assertSafeAvatarUrl(a);
  // `redirect: 'error'` prevents a trusted host from bouncing us to an
  // internal target after the pre-flight check (SSRF via redirect).
  const resp = await fetch(a, { redirect: 'error' });
  if (!resp.ok) throw new Error(`Failed to fetch avatar (${resp.status})`);
  const mimeType = resp.headers.get('content-type') || 'image/jpeg';
  if (!/^image\//i.test(mimeType)) throw new Error('Avatar is not an image');
  const buf = Buffer.from(await resp.arrayBuffer());
  return { base64: buf.toString('base64'), mimeType };
}

// Call Gemini and return a PNG Buffer of the generated character.
async function callGemini(base64, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: CHARACTER_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { responseModalities: ['Image'] },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gemini error ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return Buffer.from(inline.data, 'base64');
    }
  }
  throw new Error('Gemini response contained no image');
}

// Full pipeline: generate a character from the avatar and upload it to Blob.
// Returns the public URL of the uploaded PNG.
export async function generateCharacter(userId, avatar) {
  const { base64, mimeType } = await loadAvatarBytes(avatar);
  const pngBuffer = await callGemini(base64, mimeType);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  const hash = hashAvatarSource(avatar);
  const blob = await put(`uploads/characters/${userId}-${hash}.png`, pngBuffer, {
    access: 'public',
    contentType: 'image/png',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  });
  return blob.url;
}
