import { loadGameHistory, loadOpenedAt } from '../../../../lib/oddsHistory';

const VALID_RANGES = new Set(['LIVE', '1H', '6H', '1D', 'ALL']);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const rangeRaw = (req.query.range || 'LIVE').toString().toUpperCase();
  const range = VALID_RANGES.has(rangeRaw) ? rangeRaw : 'LIVE';

  try {
    const [points, openedAt] = await Promise.all([
      loadGameHistory(id, range),
      loadOpenedAt(id),
    ]);
    const current = points.length > 0 ? points[points.length - 1] : null;

    // Short edge cache so chart polling at 10-30s doesn't hit the DB on
    // every tick. The capture path is the only writer, so a brief lag
    // here is fine.
    res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=20');
    return res.status(200).json({
      gameId: String(id),
      range,
      points,
      current,
      openedAt,
      count: points.length,
    });
  } catch (err) {
    console.error('[odds-history] failed:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load odds history' });
  }
}
