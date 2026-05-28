import { handleUpload } from '@vercel/blob/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

// Server side of the Vercel Blob client-upload flow. The client calls
// `upload()` from `@vercel/blob/client` pointing at this endpoint; that
// SDK first POSTs `{type: 'blob.generate-client-token'}` here to mint a
// scoped token, then POSTs back with `{type: 'blob.upload-completed'}`
// after the file is uploaded. `handleUpload` dispatches both for us;
// our job is to authenticate the user and enforce per-kind size /
// content-type limits inside `onBeforeGenerateToken`.
//
// Why this changed: the previous implementation signed PUT URLs through
// the Replit Object Storage sidecar at 127.0.0.1:1106. That sidecar is
// only reachable inside Replit's runtime; on Vercel it does not exist,
// so every upload returned 503 "Image uploads are temporarily
// unavailable". Vercel Blob is the Vercel-native replacement and works
// out of the box once `BLOB_READ_WRITE_TOKEN` is set as a Vercel env var.

const UPLOAD_UNAVAILABLE_MESSAGE =
  'Image uploads are temporarily unavailable. Please try again later.';

const MAX_BYTES_BY_KIND = {
  avatar: 10 * 1024 * 1024,
  banner: 15 * 1024 * 1024,
  'voice-note': 10 * 1024 * 1024,
};
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_KINDS = new Set(Object.keys(MAX_BYTES_BY_KIND));

const IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];
const VOICE_CONTENT_TYPES = [
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      '[uploads/request-url] storage_not_configured — BLOB_READ_WRITE_TOKEN is not set. ' +
        'Create a Blob store from the Vercel dashboard (Storage tab) and add the ' +
        'BLOB_READ_WRITE_TOKEN env var to the deployment.'
    );
    return res.status(503).json({
      error: UPLOAD_UNAVAILABLE_MESSAGE,
      code: 'storage_not_configured',
    });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayloadStr) => {
        let payload = {};
        try {
          payload = clientPayloadStr ? JSON.parse(clientPayloadStr) : {};
        } catch (_e) {
          payload = {};
        }
        const kind = payload?.kind || null;
        if (kind && !ALLOWED_KINDS.has(kind)) {
          throw new Error('Invalid kind');
        }
        const maximumSizeInBytes = kind
          ? MAX_BYTES_BY_KIND[kind]
          : DEFAULT_MAX_UPLOAD_BYTES;
        const allowedContentTypes =
          kind === 'voice-note' ? VOICE_CONTENT_TYPES : IMAGE_CONTENT_TYPES;
        return {
          allowedContentTypes,
          maximumSizeInBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: session.user.id,
            kind: kind || 'unknown',
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Best-effort observability only. Vercel Blob handles persistence;
        // there's nothing we need to mutate here. Logged so we can confirm
        // in deployment logs that the round-trip is succeeding end-to-end.
        try {
          const parsed = tokenPayload ? JSON.parse(tokenPayload) : {};
          console.log(
            `[uploads/request-url] upload completed kind=${parsed.kind || 'unknown'} user=${parsed.userId || 'unknown'} url=${blob.url}`
          );
        } catch (_e) {
          console.log(
            `[uploads/request-url] upload completed url=${blob.url}`
          );
        }
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error(
      '[uploads/request-url] handleUpload failed:',
      err?.message || err
    );
    // Surface the SDK's validation errors (size too large, invalid
    // content type, invalid kind) as 400 so the client can show a
    // useful message; anything else is a 500.
    const message = err?.message || 'Upload failed';
    const status = /too large|content type|invalid kind|not allowed/i.test(
      message
    )
      ? 400
      : 500;
    return res.status(status).json({ error: message });
  }
}
