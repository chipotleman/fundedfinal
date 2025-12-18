import { fetchNBAGames, fetchUpcomingNBAGames } from '../../../lib/mysportsfeeds';

let cachedGames = null;
let cachedDebugInfo = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { upcoming, debug } = req.query;
    const now = Date.now();

    if (cachedGames && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      const response = { 
        games: cachedGames, 
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000)
      };
      if (debug === 'true' && cachedDebugInfo) {
        response.debugInfo = cachedDebugInfo;
      }
      return res.status(200).json(response);
    }

    let games;
    let debugInfo = null;
    
    if (upcoming === 'true') {
      const result = await fetchUpcomingNBAGames(3);
      games = result.games;
      debugInfo = result.debugInfo;
    } else {
      games = await fetchNBAGames();
    }

    cachedGames = games;
    cachedDebugInfo = debugInfo;
    cacheTimestamp = now;

    const response = { 
      games, 
      cached: false,
      count: games.length 
    };
    
    if (debug === 'true' && debugInfo) {
      response.debugInfo = debugInfo;
    }

    return res.status(200).json(response);
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
