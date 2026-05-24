// Dynamic team logo resolver. When utils/getTeamLogo.js can't find a
// hardcoded entry for a team (e.g. Euroleague clubs, international
// hockey clubs, soccer minor leagues, smaller college programs), the
// TeamLogo component asks this endpoint for one. We resolve it from
// Wikipedia's REST `page/summary/<title>` API which returns a
// thumbnail URL for the page's lead image — that's almost always the
// team's crest/logo. Results are cached in-memory for the life of
// the server process and the response carries a long
// stale-while-revalidate so the CDN/browser caches it too.

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_MAX = 5000; // bound memory: roughly enough for every team we ever see
// Map preserves insertion order — we use that for a simple LRU.
const CACHE = new Map(); // key -> { url: string|null, expires: number }

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    CACHE.delete(key);
    return null;
  }
  // Refresh LRU position.
  CACHE.delete(key);
  CACHE.set(key, hit);
  return hit;
}

function cacheSet(key, value) {
  if (CACHE.has(key)) CACHE.delete(key);
  CACHE.set(key, value);
  while (CACHE.size > CACHE_MAX) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey === undefined) break;
    CACHE.delete(oldestKey);
  }
}

const ACCEPTED_LOGO_HOST = 'upload.wikimedia.org';

const SPORT_TITLE_HINTS = {
  basketball_euroleague: ['{name}', '{name} B.C.', 'BC {name}', '{name} (basketball)', '{name} S.K.', '{name} Basketball', 'KK {name}'],
  euroleague: ['{name}', '{name} B.C.', 'BC {name}', '{name} (basketball)'],
  basketball: ['{name}', '{name} B.C.', '{name} (basketball)', 'BC {name}'],
  icehockey_intl: ['{name} national ice hockey team', '{name} men\'s national ice hockey team', '{name}', '{name} (ice hockey)', 'HC {name}', '{name} HC'],
  hockey: ['{name} national ice hockey team', '{name}', '{name} (ice hockey)', 'HC {name}', '{name} HC'],
  soccer: ['{name} F.C.', 'FC {name}', '{name}', '{name} (football club)', '{name} football club'],
  ncaab: ['{name}', '{name} men\'s basketball', '{name} basketball'],
  ncaaf: ['{name}', '{name} football', '{name} Fighting Irish football'],
  nba: ['{name}', '{name} (basketball)'],
  nfl: ['{name}', '{name} (American football)'],
  nhl: ['{name}', '{name} (ice hockey)'],
  mlb: ['{name}', '{name} (baseball)'],
};

const DEFAULT_HINTS = ['{name}', '{name} (team)', '{name} F.C.', 'FC {name}', '{name} B.C.', '{name} HC'];

function normalizeSport(sport) {
  if (!sport) return '';
  return String(sport).toLowerCase().trim();
}

function pickHints(sport) {
  const key = normalizeSport(sport);
  if (SPORT_TITLE_HINTS[key]) return SPORT_TITLE_HINTS[key];
  if (key.startsWith('basketball_eur')) return SPORT_TITLE_HINTS.basketball_euroleague;
  if (key.startsWith('basketball')) return SPORT_TITLE_HINTS.basketball;
  if (key.startsWith('icehockey') || key.startsWith('hockey')) return SPORT_TITLE_HINTS.hockey;
  if (key.startsWith('soccer') || key === 'football') return SPORT_TITLE_HINTS.soccer;
  return DEFAULT_HINTS;
}

function titleFromTemplate(template, name) {
  return template.replace('{name}', name).replace(/\s+/g, '_');
}

async function fetchSummaryThumbnail(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PiksLogoResolver/1.0 (https://thepiks.com)' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Skip disambiguation pages and obvious miss results.
    if (json.type === 'disambiguation') return null;
    const thumb = json.thumbnail?.source || json.originalimage?.source || null;
    if (!thumb) return null;
    // Only accept Wikimedia-hosted image URLs — anything else is
    // either an SSRF risk or noise (e.g. a stray external embed).
    try {
      const host = new URL(thumb).host;
      if (host !== ACCEPTED_LOGO_HOST) return null;
    } catch {
      return null;
    }
    return thumb;
  } catch {
    return null;
  }
}

async function resolveLogo(name, sport) {
  const hints = pickHints(sport);
  for (const template of hints) {
    const title = titleFromTemplate(template, name);
    const hit = await fetchSummaryThumbnail(title);
    if (hit) return hit;
  }
  return null;
}

export default async function handler(req, res) {
  const name = (req.query.name || '').toString().trim();
  const sport = (req.query.sport || '').toString().trim();
  if (!name) {
    res.status(400).json({ error: 'Missing name' });
    return;
  }
  const cacheKey = `${normalizeSport(sport)}::${name.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  const now = Date.now();
  if (cached) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.status(200).json({ url: cached.url, cached: true });
    return;
  }
  const url = await resolveLogo(name, sport);
  cacheSet(cacheKey, { url, expires: now + TTL_MS });
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.status(200).json({ url, cached: false });
}
