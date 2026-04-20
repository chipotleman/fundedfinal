import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { signObjectURL, resolvePrivateObjectPath } from '../../../lib/objectStorage';

// Per-kind upload size ceilings. Each kind is enforced independently so a
// larger banner allowance doesn't loosen avatar or voice-note limits.
const MAX_BYTES_BY_KIND = {
  avatar: 10 * 1024 * 1024,
  banner: 15 * 1024 * 1024,
  'voice-note': 10 * 1024 * 1024,
};
// Fallback ceiling when no kind is supplied. Uses the smallest per-kind
// cap so an omitted kind cannot be used to slip larger files past the
// stricter avatar/voice-note limits.
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_KINDS = new Set(Object.keys(MAX_BYTES_BY_KIND));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require an authenticated session so we don't hand out signed PUT URLs to
  // anonymous callers.
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { name, size, contentType, kind } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }
    if (kind && !ALLOWED_KINDS.has(kind)) {
      return res.status(400).json({ error: 'Invalid kind' });
    }
    const maxBytes = kind ? MAX_BYTES_BY_KIND[kind] : DEFAULT_MAX_UPLOAD_BYTES;
    if (typeof size === 'number' && size > maxBytes) {
      return res.status(413).json({ error: 'File too large' });
    }

    if (!process.env.PRIVATE_OBJECT_DIR) {
      console.error('Upload failed: PRIVATE_OBJECT_DIR is not set');
      return res.status(503).json({
        error:
          'Image uploads are temporarily unavailable. Please try again later.',
        code: 'storage_not_configured',
      });
    }

    const objectId = randomUUID();
    const ext = (name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const folder = kind === 'voice-note' ? 'uploads/voice-notes' : 'uploads/avatars';
    const subPath = `${folder}/${objectId}${ext ? '.' + ext : ''}`;

    const resolved = resolvePrivateObjectPath(subPath);
    if (!resolved) {
      return res.status(503).json({
        error:
          'Image uploads are temporarily unavailable. Please try again later.',
        code: 'storage_not_configured',
      });
    }

    const uploadURL = await signObjectURL({
      bucketName: resolved.bucketName,
      objectName: resolved.objectName,
      method: 'PUT',
      ttlSec: 900,
    });

    const objectPath = `/objects/${subPath}`;

    res.json({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
