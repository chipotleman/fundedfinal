import { createHash } from 'crypto';
import { db } from '../../../../lib/db';
import { profiles } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import {
  getStorageClient,
  resolvePrivateObjectPath,
  describeObjectStorageMisconfig,
} from '../../../../lib/objectStorage';

// Serve a user's avatar as a regular http(s) resource, regardless of how it's
// stored. Many older accounts have their avatar as a `data:image/...;base64,…`
// blob in `profiles.avatar`, which is unusable in places that need a real URL
// (web push payloads, OG images, third-party embeds, etc.). This endpoint
// gives us a stable, cacheable URL — `/api/users/<id>/avatar` — that always
// returns a binary image, decoding base64 on the fly or redirecting to the
// stored http(s) URL.
//
// Caching strategy:
//   - When the caller pins a version with `?v=<token>` (push payloads include
//     the profile's updatedAt), the redirect is treated as immutable so the
//     CDN can hold the target URL for a year.
//   - Without `?v`, the redirect itself has a modest `s-maxage` so when the
//     user changes their avatar the edge re-resolves to the new target within
//     ~5 minutes (the underlying `/objects/<path>` response is itself
//     immutable, so the bytes still live on the edge for an hour).
//   - On first hit to a base64 avatar we promote it to object storage and
//     rewrite `profiles.avatar` to the new `/objects/...` path so subsequent
//     requests redirect instead of re-decoding base64.

const FIVE_MINUTES = 60 * 5;
const ONE_HOUR = 60 * 60;
const ONE_DAY = 60 * 60 * 24;
const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_YEAR = 60 * 60 * 24 * 365;

const REDIRECT_CACHE_VERSIONED = `public, max-age=${ONE_DAY}, s-maxage=${ONE_YEAR}, stale-while-revalidate=${ONE_WEEK}, immutable`;
const REDIRECT_CACHE_UNVERSIONED = `public, max-age=${FIVE_MINUTES}, s-maxage=${FIVE_MINUTES}, stale-while-revalidate=${ONE_WEEK}`;
const INLINE_BASE64_CACHE = `public, max-age=${ONE_HOUR}, s-maxage=${ONE_HOUR}, stale-while-revalidate=${ONE_DAY}`;
const FALLBACK_CACHE = `public, max-age=${FIVE_MINUTES}, s-maxage=${ONE_DAY}, stale-while-revalidate=${ONE_WEEK}`;

function redirectCacheControl(req) {
  return req?.query?.v ? REDIRECT_CACHE_VERSIONED : REDIRECT_CACHE_UNVERSIONED;
}

function parseDataUrl(value) {
  // data:[<mediatype>][;base64],<data>
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(value || '');
  if (!m) return null;
  const mime = (m[1] || 'image/png').toLowerCase();
  const isB64 = !!m[2];
  const raw = m[3] || '';
  try {
    const buf = isB64
      ? Buffer.from(raw, 'base64')
      : Buffer.from(decodeURIComponent(raw), 'utf8');
    return { mime, buf };
  } catch {
    return null;
  }
}

function extFromMime(mime) {
  switch ((mime || '').toLowerCase()) {
    case 'image/png': return 'png';
    case 'image/jpeg':
    case 'image/jpg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/svg+xml': return 'svg';
    default: return 'png';
  }
}

function fallbackRedirect(res, id) {
  // Deterministic DiceBear placeholder so the URL still resolves to *some*
  // recognizable image when the user has no avatar set.
  const seed = encodeURIComponent(String(id || 'piks-user'));
  res.setHeader('Cache-Control', FALLBACK_CACHE);
  res.redirect(302, `/api/avatar/${seed}`);
}

// Promote a base64 avatar into object storage once, returning the
// `/objects/<subPath>` URL. The object name is keyed by user id + content
// hash so concurrent hits converge on the same object and re-uploads are
// skipped when the bytes are already there.
async function promoteBase64ToObjectStorage(id, parsed) {
  const misconfig = describeObjectStorageMisconfig();
  if (misconfig.blocking.length > 0) return null;

  const ext = extFromMime(parsed.mime);
  const hash = createHash('sha1').update(parsed.buf).digest('hex').slice(0, 16);
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  const subPath = `uploads/avatars/cache/${safeId}-${hash}.${ext}`;
  const resolved = resolvePrivateObjectPath(subPath);
  if (!resolved) return null;

  try {
    const storage = getStorageClient();
    const file = storage.bucket(resolved.bucketName).file(resolved.objectName);
    const [exists] = await file.exists();
    if (!exists) {
      await file.save(parsed.buf, {
        resumable: false,
        contentType: parsed.mime,
        metadata: {
          contentType: parsed.mime,
          cacheControl: REDIRECT_CACHE_VERSIONED,
        },
      });
    }
    return `/objects/${subPath}`;
  } catch (err) {
    console.error(
      '[api/users/[id]/avatar] cache upload failed for ' + safeId + ': ' +
        (err?.message || err)
    );
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const rawId = req.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'id required' });
  }

  try {
    const rows = await db
      .select({ avatar: profiles.avatar })
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    const avatar = rows[0]?.avatar || null;

    if (!avatar) return fallbackRedirect(res, id);

    if (/^https?:\/\//i.test(avatar)) {
      res.setHeader('Cache-Control', redirectCacheControl(req));
      return res.redirect(302, avatar);
    }

    // Already promoted to object storage (or any other internal absolute
    // path) — just hand the caller off there so the edge can cache the
    // immutable `/objects/...` response.
    if (avatar.startsWith('/objects/') || avatar.startsWith('/api/')) {
      res.setHeader('Cache-Control', redirectCacheControl(req));
      return res.redirect(302, avatar);
    }

    if (/^data:/i.test(avatar)) {
      const parsed = parseDataUrl(avatar);
      if (!parsed) return fallbackRedirect(res, id);

      const cachedPath = await promoteBase64ToObjectStorage(id, parsed);
      if (cachedPath) {
        // Best-effort: persist the promoted URL so the next request skips
        // the storage round-trip entirely. We deliberately don't bump
        // updatedAt — this is a transparent storage swap, not a profile
        // edit, and updatedAt is used elsewhere as a cache-bust token.
        try {
          await db
            .update(profiles)
            .set({ avatar: cachedPath })
            .where(eq(profiles.id, id));
        } catch (err) {
          console.error(
            '[api/users/[id]/avatar] persist cached path failed: ' +
              (err?.message || err)
          );
        }
        res.setHeader('Cache-Control', redirectCacheControl(req));
        return res.redirect(302, cachedPath);
      }

      // Object storage unavailable — fall back to inline decode with a
      // shorter cache so the next request can try to promote again.
      res.setHeader('Content-Type', parsed.mime);
      res.setHeader('Content-Length', parsed.buf.length);
      res.setHeader('Cache-Control', INLINE_BASE64_CACHE);
      return res.status(200).send(parsed.buf);
    }

    return fallbackRedirect(res, id);
  } catch (err) {
    console.error('[api/users/[id]/avatar]', err?.message || err);
    return fallbackRedirect(res, id);
  }
}
