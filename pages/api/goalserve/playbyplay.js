import { getPlayByPlay, getHistoricalPlayByPlay, getSupportedSports, SUPPORTED_SPORTS } from '../../../lib/goalserve';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, gameId, date } = req.query;

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

    if (date) {
      const games = await getHistoricalPlayByPlay(sport, date);
      return res.status(200).json({
        success: true,
        sport,
        date,
        count: games.length,
        games
      });
    }

    if (gameId) {
      const game = await getPlayByPlay(sport, gameId);
      if (!game) {
        return res.status(404).json({ 
          error: 'Game not found',
          gameId 
        });
      }
      return res.status(200).json({
        success: true,
        game
      });
    }

    const games = await getPlayByPlay(sport);
    const gamesWithPlays = games.filter(g => g.plays && g.plays.length > 0);
    
    return res.status(200).json({
      success: true,
      sport,
      totalGames: games.length,
      gamesWithPlays: gamesWithPlays.length,
      games: gamesWithPlays
    });

  } catch (error) {
    console.error('[Goalserve PlayByPlay API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch play-by-play',
      message: error.message 
    });
  }
}
