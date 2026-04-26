import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import {
  signObjectURL,
  resolvePrivateObjectPath,
  describeObjectStorageMisconfig,
  describeStorageEnvSnapshot,
} from '../../../lib/objectStorage';

// Single user-facing string so callers don't see internal codes. Internal
// `code` discriminators differ so the client can react when needed and so
// server logs make the root cause obvious.
const UPLOAD_UNAVAILABLE_MESSAGE =
  'Image uploads are temporarily unavailable. Please try again later.';

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

    const misconfig = describeObjectStorageMisconfig();
    const envSnapshot = describeStorageEnvSnapshot();
    if (misconfig.warnings.length > 0) {
      // Non-blocking: signing only needs PRIVATE_OBJECT_DIR + a reachable
      // sidecar, but other Object Storage env vars look misconfigured too.
      // Surface them as warnings so a partial misconfiguration is visible.
      // The redacted env snapshot is appended so the warning is enough to
      // diagnose without needing a separate env dump.
      console.warn(
        '[uploads/request-url] object storage env warnings: ' +
          misconfig.warnings.join('; ') +
          ' | ' +
          envSnapshot
      );
    }
    if (misconfig.blocking.length > 0) {
      console.error(
        '[uploads/request-url] storage_not_configured — ' +
          misconfig.blocking.join('; ') +
          ' | kind=' + (kind || 'unknown') +
          ' | ' + envSnapshot
      );
      return res.status(503).json({
        error: UPLOAD_UNAVAILABLE_MESSAGE,
        code: 'storage_not_configured',
      });
    }

    const objectId = randomUUID();
    const ext = (name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const folder = kind === 'voice-note' ? 'uploads/voice-notes' : 'uploads/avatars';
    const subPath = `${folder}/${objectId}${ext ? '.' + ext : ''}`;

    const resolved = resolvePrivateObjectPath(subPath);
    if (!resolved) {
      // Belt-and-braces: env vars passed the check above but the resolver
      // still couldn't produce a bucket/object pair. Log enough detail to
      // diagnose without leaking secrets — the redacted snapshot already
      // includes PRIVATE_OBJECT_DIR's length so we just append it.
      console.error(
        '[uploads/request-url] storage_not_configured — resolvePrivateObjectPath returned null. ' +
          `subPath="${subPath}" | ${envSnapshot}`
      );
      return res.status(503).json({
        error: UPLOAD_UNAVAILABLE_MESSAGE,
        code: 'storage_not_configured',
      });
    }

    let uploadURL;
    try {
      uploadURL = await signObjectURL({
        bucketName: resolved.bucketName,
        objectName: resolved.objectName,
        method: 'PUT',
        ttlSec: 900,
      });
    } catch (signErr) {
      // Distinct from "not configured": env vars look fine, but the sidecar
      // either is unreachable or rejected the signing request. Log the full
      // error AND the redacted env snapshot (which carries the resolved
      // sidecar host + env-var presence) so the next regression can be
      // diagnosed from this single line without a code read.
      console.error(
        '[uploads/request-url] sign_failed — bucket=' +
          resolved.bucketName +
          ' object=' +
          resolved.objectName +
          ' code=' +
          (signErr?.code || 'unknown') +
          ' status=' +
          (signErr?.status || 'n/a') +
          ': ' +
          (signErr?.message || signErr) +
          ' | ' +
          envSnapshot
      );
      return res.status(503).json({
        error: UPLOAD_UNAVAILABLE_MESSAGE,
        code:
          signErr?.code === 'sidecar_unreachable'
            ? 'storage_sidecar_unreachable'
            : 'storage_sign_failed',
      });
    }

    const objectPath = `/objects/${subPath}`;

    res.json({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    });
  } catch (error) {
    console.error('[uploads/request-url] unexpected error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
