import { getScores, getOdds, getAllGamesWithOdds, getSupportedSports, SUPPORTED_SPORTS } from '../../../lib/goalserve';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, withOdds } = req.query;

    if (sport) {
      if (!SUPPORTED_SPORTS[sport]) {
        return res.status(400).json({ 
          error: `Unsupported sport: ${sport}`,
          supported: getSupportedSports()
        });
      }

      if (withOdds === 'true') {
        const games = await getOdds(sport);
        return res.status(200).json({
          success: true,
          sport,
          count: games.length,
          games
        });
      }

      const games = await getScores(sport);
      return res.status(200).json({
        success: true,
        sport,
        count: games.length,
        games
      });
    }

    const games = await getAllGamesWithOdds();
    return res.status(200).json({
      success: true,
      count: games.length,
      sports: getSupportedSports(),
      games
    });

  } catch (error) {
    console.error('[Goalserve Games API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch games',
      message: error.message 
    });
  }
}
