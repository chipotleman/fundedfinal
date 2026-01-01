import { fetchLiveGames, getLiveStats } from '../../../lib/goalserve-live-serverless';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { sport, stats } = req.query;

  try {
    if (stats === 'true') {
      const liveStats = getLiveStats();
      return res.status(200).json({
        success: true,
        stats: liveStats,
        timestamp: Date.now()
      });
    }

    const sports = sport ? sport.split(',') : null;
    const results = await fetchLiveGames(sports);

    return res.status(200).json({
      success: true,
      games: results.games,
      sports: results.sports,
      cached: results.cached,
      errors: results.errors,
      count: results.games.length,
      timestamp: results.timestamp
    });
  } catch (error) {
    console.error('[Live API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}
