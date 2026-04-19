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
    res.status(200).send(svg);
  } catch (err) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(502).send('<!-- avatar upstream error -->');
  }
}
