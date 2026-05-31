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
import { put } from '@vercel/blob';

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';

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
    return true;
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
  const resp = await fetch(a);
  if (!resp.ok) throw new Error(`Failed to fetch avatar (${resp.status})`);
  const mimeType = resp.headers.get('content-type') || 'image/jpeg';
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
