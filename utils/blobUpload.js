// Client-side helper for uploading files directly to Vercel Blob using
// the `@vercel/blob/client` `upload()` flow.
//
// Replaces the old "request a signed PUT URL, then PUT the file" pattern
// that used to talk to the Replit Object Storage sidecar at 127.0.0.1:1106.
// That sidecar only exists inside Replit's runtime — on Vercel functions
// it's unreachable, which is why production uploads were returning the
// "Image uploads are temporarily unavailable" 503.
//
// The server side lives at `/api/uploads/request-url`, which now wraps
// `handleUpload` from `@vercel/blob/client` (auth + size + content-type
// + kind enforcement happens there before a client token is issued).
//
// Return shape mirrors what the old code already cared about:
//   { url, pathname }
// `url` is the fully-qualified `https://<store>.public.blob.vercel-storage.com/...`
// public URL that should be stored in the DB (avatars, banners, voice notes).

import { upload } from '@vercel/blob/client';

const FOLDER_BY_KIND = {
  avatar: 'uploads/avatars',
  banner: 'uploads/banners',
  'voice-note': 'uploads/voice-notes',
};

function safeExt(name) {
  const raw = String(name || '').split('.').pop() || '';
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
}

export async function uploadToBlob(file, { kind, pathname } = {}) {
  if (!file) throw new Error('No file provided');
  const folder = FOLDER_BY_KIND[kind] || 'uploads/misc';
  const ext = safeExt(file.name);
  const finalPath =
    pathname || `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`;

  const blob = await upload(finalPath, file, {
    access: 'public',
    handleUploadUrl: '/api/uploads/request-url',
    clientPayload: JSON.stringify({ kind: kind || null }),
    contentType: file.type || undefined,
  });
  return { url: blob.url, pathname: blob.pathname };
}
