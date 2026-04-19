import {
  getStorageClient,
  resolvePrivateObjectPath,
} from '../../../lib/objectStorage';

const DICEBEAR_STYLE = 'bottts-neutral';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const memoryCache = new Map();
const MAX_CACHE_ENTRIES = 500;

function rememberSvg(seed, svg) {
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey !== undefined) memoryCache.delete(firstKey);
  }
  memoryCache.set(seed, svg);
}

function storageObjectForSeed(seed) {
  const safe = encodeURIComponent(seed);
  return resolvePrivateObjectPath(`avatars/${DICEBEAR_STYLE}/${safe}.svg`);
}

async function readFromStorage(seed) {
  const resolved = storageObjectForSeed(seed);
  if (!resolved) return null;
  try {
    const storage = getStorageClient();
    const file = storage.bucket(resolved.bucketName).file(resolved.objectName);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return buf.toString('utf8');
  } catch (err) {
    console.error('avatar storage read failed:', err?.message || err);
    return null;
  }
}

async function writeToStorage(seed, svg) {
  const resolved = storageObjectForSeed(seed);
  if (!resolved) return false;
  try {
    const storage = getStorageClient();
    const file = storage.bucket(resolved.bucketName).file(resolved.objectName);
    await file.save(svg, {
      contentType: 'image/svg+xml; charset=utf-8',
      resumable: false,
      metadata: {
        cacheControl: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      },
    });
    return true;
  } catch (err) {
    console.error('avatar storage write failed:', err?.message || err);
    return false;
  }
}

export default async function handler(req, res) {
  const rawSeed = req.query.seed;
  let seed = Array.isArray(rawSeed) ? rawSeed[0] : rawSeed || 'piks-user';
  seed = String(seed).replace(/\.svg$/i, '').slice(0, 128) || 'piks-user';

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    `public, max-age=${ONE_YEAR_SECONDS}, s-maxage=${ONE_YEAR_SECONDS}, immutable`
  );

  const cached = memoryCache.get(seed);
  if (cached) {
    res.status(200).send(cached);
    return;
  }

  const stored = await readFromStorage(seed);
  if (stored) {
    rememberSvg(seed, stored);
    res.status(200).send(stored);
    return;
  }

  const upstream = `https://api.dicebear.com/7.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(seed)}`;

  try {
    const response = await fetch(upstream);
    if (!response.ok) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(response.status).send(`<!-- upstream ${response.status} -->`);
      return;
    }
    const svg = await response.text();
    rememberSvg(seed, svg);
    // Persist before responding so serverless invocations don't exit
    // before the write finishes; storage errors are swallowed inside.
    await writeToStorage(seed, svg);
    res.status(200).send(svg);
  } catch (err) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(502).send('<!-- avatar upstream error -->');
  }
}
