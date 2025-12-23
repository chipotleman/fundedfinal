import { getOdds, getSupportedSports, SUPPORTED_SPORTS } from '../../../lib/goalserve';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, date1, date2 } = req.query;

    if (!sport) {
      return res.status(400).json({ 
        error: 'Sport parameter required',
        supported: getSupportedSports()
      });
    }

    if (!SUPPORTED_SPORTS[sport]) {
      return res.status(400).json({ 
        error: `Unsupported sport: ${sport}`,
        supported: getSupportedSports()
      });
    }

    const games = await getOdds(sport, date1, date2);
    
    const gamesWithOdds = games.filter(g => g.odds && 
      (g.odds.moneyline?.length > 0 || g.odds.spread?.length > 0 || g.odds.total?.length > 0)
    );

    return res.status(200).json({
      success: true,
      sport,
      totalGames: games.length,
      gamesWithOdds: gamesWithOdds.length,
      games: gamesWithOdds
    });

  } catch (error) {
    console.error('[Goalserve Odds API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch odds',
      message: error.message 
    });
  }
}
