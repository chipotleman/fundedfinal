// Shared Piks News data layer.
//
// Pulls real sports headlines from ESPN's public (keyless) news endpoints
// across many leagues, merges + de-dupes them, assigns a stable id/slug to
// each story, and caches the merged feed in-memory so we don't hammer ESPN on
// every page load. We only ever surface headlines, summaries, images and a
// link back to the source — never republished article bodies.

const LEAGUES = [
  { sport: 'basketball', league: 'nba', label: 'NBA' },
  { sport: 'football', league: 'nfl', label: 'NFL' },
  { sport: 'baseball', league: 'mlb', label: 'MLB' },
  { sport: 'hockey', league: 'nhl', label: 'NHL' },
  { sport: 'basketball', league: 'mens-college-basketball', label: 'CBB' },
  { sport: 'football', league: 'college-football', label: 'CFB' },
  { sport: 'soccer', league: 'eng.1', label: 'Soccer' },
  { sport: 'mma', league: 'ufc', label: 'UFC' },
  { sport: 'golf', league: 'pga', label: 'Golf' },
  { sport: 'tennis', league: 'atp', label: 'Tennis' },
];

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let cache = { at: 0, items: [] };

// Stable, URL-safe id derived from the source href so the reader page can look
// an article back up after a deep-link / refresh.
export function idFromHref(href) {
  return Buffer.from(String(href), 'utf8').toString('base64url');
}

export function hrefFromId(id) {
  try {
    return Buffer.from(String(id), 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'story';
}

async function fetchLeagueNews({ sport, league, label }) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/news`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Piks news fetcher)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles
      .map((a) => {
        const href =
          a?.links?.web?.href ||
          a?.links?.mobile?.href ||
          (Array.isArray(a?.links) ? a.links[0]?.href : null);
        const imageObj = Array.isArray(a?.images) ? a.images[0] : null;
        const image = imageObj?.url || null;
        const byline = a?.byline || null;
        const headline = a?.headline || a?.title || '';
        if (!href || !headline || !/^https:\/\//i.test(href)) return null;
        const id = idFromHref(href);
        return {
          id,
          slug: slugify(headline),
          headline,
          description: a?.description || '',
          published: a?.published || a?.lastModified || null,
          href,
          image,
          imageCaption: imageObj?.caption || null,
          byline,
          league: label,
          sport,
          source: 'ESPN',
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Returns the merged, de-duped, newest-first feed. Cached in-memory; a
// transient ESPN outage never blows away a good cached list.
export async function getFeed({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.items.length && now - cache.at < CACHE_TTL_MS) {
    return cache.items;
  }

  const results = await Promise.allSettled(LEAGUES.map(fetchLeagueNews));
  const merged = [];
  for (const r of results) {
    if (r.status === 'fulfilled') merged.push(...r.value);
  }

  const seen = new Set();
  const deduped = [];
  for (const a of merged) {
    const key = a.headline.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }
  deduped.sort((a, b) => {
    const ta = a.published ? new Date(a.published).getTime() : 0;
    const tb = b.published ? new Date(b.published).getTime() : 0;
    return tb - ta;
  });

  if (deduped.length) {
    cache = { at: now, items: deduped };
  }
  return deduped.length ? deduped : cache.items;
}

export async function getArticleById(id) {
  const feed = await getFeed();
  return feed.find((a) => a.id === id) || null;
}

export { LEAGUES };
