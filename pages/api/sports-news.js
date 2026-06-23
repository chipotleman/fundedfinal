// Top sports news for the desktop right-rail "Top Sports News" card.
// Pulls real headlines from ESPN's public (keyless) news endpoints across a
// handful of major leagues, merges + de-dupes them, and returns the most
// recent. Results are cached in-memory so we don't hammer ESPN on every page
// load.

const LEAGUES = [
  { sport: 'basketball', league: 'nba', label: 'NBA' },
  { sport: 'football', league: 'nfl', label: 'NFL' },
  { sport: 'baseball', league: 'mlb', label: 'MLB' },
  { sport: 'hockey', league: 'nhl', label: 'NHL' },
  { sport: 'basketball', league: 'mens-college-basketball', label: 'CBB' },
  { sport: 'football', league: 'college-football', label: 'CFB' },
];

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let cache = { at: 0, items: [] };

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
        const image = Array.isArray(a?.images) ? a.images[0]?.url : null;
        return {
          headline: a?.headline || a?.title || '',
          description: a?.description || '',
          published: a?.published || a?.lastModified || null,
          href: href || null,
          image: image || null,
          league: label,
          source: 'ESPN',
        };
      })
      .filter((a) => a.headline && a.href && /^https:\/\//i.test(a.href));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const now = Date.now();
  if (cache.items.length && now - cache.at < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).json({ items: cache.items, cached: true });
  }

  const results = await Promise.allSettled(LEAGUES.map(fetchLeagueNews));
  const merged = [];
  for (const r of results) {
    if (r.status === 'fulfilled') merged.push(...r.value);
  }

  // De-dupe by headline, then sort newest first.
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

  const items = deduped.slice(0, 8);

  // Only overwrite the cache when we actually got something, so a transient
  // ESPN outage doesn't blow away a good cached list.
  if (items.length) {
    cache = { at: now, items };
  }

  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).json({ items: items.length ? items : cache.items, cached: false });
}
