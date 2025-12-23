import { getLiveGames, getPlayByPlay, SUPPORTED_SPORTS } from '../../../lib/goalserve';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { withPlayByPlay } = req.query;
    
    const liveGames = await getLiveGames();
    
    if (withPlayByPlay === 'true' && liveGames.length > 0) {
      const gamesWithPlays = await Promise.all(
        liveGames.map(async (game) => {
          try {
            const pbpData = await getPlayByPlay(game.sport_key, game.id);
            return {
              ...game,
              plays: pbpData?.plays || []
            };
          } catch (error) {
            return {
              ...game,
              plays: []
            };
          }
        })
      );
      
      return res.status(200).json({
        success: true,
        count: gamesWithPlays.length,
        games: gamesWithPlays
      });
    }

    return res.status(200).json({
      success: true,
      count: liveGames.length,
      games: liveGames
    });

  } catch (error) {
    console.error('[Goalserve Live API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch live games',
      message: error.message 
    });
  }
}
