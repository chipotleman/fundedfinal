import { fetchNBAGames, fetchUpcomingNBAGames } from '../../../lib/mysportsfeeds';

let cachedGames = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { upcoming } = req.query;
    const now = Date.now();

    if (cachedGames && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.status(200).json({ 
        games: cachedGames, 
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000)
      });
    }

    let games;
    if (upcoming === 'true') {
      games = await fetchUpcomingNBAGames(3);
    } else {
      games = await fetchNBAGames();
    }

    cachedGames = games;
    cacheTimestamp = now;

    return res.status(200).json({ 
      games, 
      cached: false,
      count: games.length 
    });
  } catch (error) {
    console.error('Error in NBA games API:', error);
    
    if (cachedGames) {
      return res.status(200).json({ 
        games: cachedGames, 
        cached: true,
        stale: true,
        error: 'Using cached data due to API error'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch games',
      message: error.message 
    });
  }
}
