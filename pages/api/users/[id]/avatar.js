import { db } from '../../../../lib/db';
import { profiles } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';

// Serve a user's avatar as a regular http(s) resource, regardless of how it's
// stored. Many older accounts have their avatar as a `data:image/...;base64,…`
// blob in `profiles.avatar`, which is unusable in places that need a real URL
// (web push payloads, OG images, third-party embeds, etc.). This endpoint
// gives us a stable, cacheable URL — `/api/users/<id>/avatar` — that always
// returns a binary image, decoding base64 on the fly or redirecting to the
// stored http(s) URL.

const FIVE_MINUTES = 60 * 5;
const ONE_DAY = 60 * 60 * 24;

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

function fallbackRedirect(res, id) {
  // Deterministic DiceBear placeholder so the URL still resolves to *some*
  // recognizable image when the user has no avatar set.
  const seed = encodeURIComponent(String(id || 'piks-user'));
  res.setHeader('Cache-Control', `public, max-age=${FIVE_MINUTES}`);
  res.redirect(302, `/api/avatar/${seed}`);
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
      res.setHeader('Cache-Control', `public, max-age=${FIVE_MINUTES}`);
      return res.redirect(302, avatar);
    }

    if (/^data:/i.test(avatar)) {
      const parsed = parseDataUrl(avatar);
      if (!parsed) return fallbackRedirect(res, id);
      res.setHeader('Content-Type', parsed.mime);
      res.setHeader('Content-Length', parsed.buf.length);
      res.setHeader('Cache-Control', `public, max-age=${ONE_DAY}`);
      return res.status(200).send(parsed.buf);
    }

    return fallbackRedirect(res, id);
  } catch (err) {
    console.error('[api/users/[id]/avatar]', err?.message || err);
    return fallbackRedirect(res, id);
  }
}
