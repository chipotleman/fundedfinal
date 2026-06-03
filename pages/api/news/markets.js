// Polymarket sports markets for the Piks News "Market Movers" section.
//
// Pulls active, highest-volume markets from Polymarket's public Gamma API and
// keeps only sports-related ones, returning each with its outcomes + implied
// probabilities. Cached in-memory. Fully degradable — on any failure we return
// an empty list and the UI section just hides.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache = { at: 0, items: [] };

const SPORTS_KEYWORDS = [
  'nba', 'nfl', 'mlb', 'nhl', 'ncaa', 'college football', 'college basketball',
  'premier league', 'la liga', 'serie a', 'bundesliga', 'champions league',
  'soccer', 'football', 'basketball', 'baseball', 'hockey', 'ufc', 'mma',
  'boxing', 'tennis', 'golf', 'super bowl', 'world cup', 'playoff', 'finals',
  'masters', 'open', 'grand prix', 'f1', 'formula 1',
];

function looksSporty(text) {
  const t = String(text || '').toLowerCase();
  return SPORTS_KEYWORDS.some((k) => t.includes(k));
}

function parseJSONArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchPolymarket() {
  const url =
    'https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volume24hr&ascending=false&limit=120';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Piks news fetcher)', Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

    const items = [];
    for (const m of rows) {
      const question = m?.question || m?.title || '';
      if (!question || !looksSporty(question)) continue;

      const outcomes = parseJSONArray(m?.outcomes);
      const prices = parseJSONArray(m?.outcomePrices);
      if (!outcomes.length || outcomes.length !== prices.length) continue;

      const parsedOutcomes = outcomes
        .map((label, i) => ({
          label: String(label),
          prob: Math.round((Number(prices[i]) || 0) * 100),
        }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3);

      // Skip already-decided / runaway markets — a contested market (top
      // outcome under 95%) makes a far more interesting "market mover".
      const top = parsedOutcomes[0]?.prob ?? 0;
      if (top >= 95 || top <= 0) continue;

      items.push({
        id: m?.id || m?.conditionId || m?.slug || question,
        question,
        outcomes: parsedOutcomes,
        volume24hr: Number(m?.volume24hr) || Number(m?.volume) || 0,
        endDate: m?.endDate || null,
        url: m?.slug ? `https://polymarket.com/market/${m.slug}` : 'https://polymarket.com',
      });
      if (items.length >= 12) break;
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const now = Date.now();
  if (cache.items.length && now - cache.at < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    return res.status(200).json({ items: cache.items, cached: true });
  }

  const items = await fetchPolymarket();
  if (items.length) cache = { at: now, items };

  res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
  return res.status(200).json({ items: items.length ? items : cache.items });
}
