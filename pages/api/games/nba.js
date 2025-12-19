import { fetchNBAGames as fetchSportsradarGames, fetchUpcomingNBAGames as fetchSportsradarUpcoming } from '../../../lib/sportsradar';
import { fetchNBAGames as fetchMSFGames, fetchUpcomingNBAGames as fetchMSFUpcoming } from '../../../lib/mysportsfeeds';

let cachedGames = null;
let cachedDebugInfo = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

const USE_SPORTSRADAR = process.env.SPORTSRADAR_API_KEY ? true : false;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { upcoming, debug, source } = req.query;
    const now = Date.now();

    const forceSource = source === 'mysportsfeeds' ? 'msf' : source === 'sportsradar' ? 'sr' : null;
    const useSource = forceSource || (USE_SPORTSRADAR ? 'sr' : 'msf');

    if (cachedGames && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION && !forceSource) {
      const response = { 
        games: cachedGames, 
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000),
        source: cachedDebugInfo?.source || 'unknown'
      };
      if (debug === 'true' && cachedDebugInfo) {
        response.debugInfo = cachedDebugInfo;
      }
      return res.status(200).json(response);
    }

    let games;
    let debugInfo = null;
    
    if (useSource === 'sr') {
      console.log('Using Sportsradar NBA API');
      if (upcoming === 'true') {
        const result = await fetchSportsradarUpcoming(3);
        games = result.games;
        debugInfo = result.debugInfo;
      } else {
        games = await fetchSportsradarGames();
        debugInfo = { source: 'sportsradar' };
      }
    } else {
      console.log('Using MySportsFeeds NBA API');
      if (upcoming === 'true') {
        const result = await fetchMSFUpcoming(3);
        games = result.games;
        debugInfo = result.debugInfo;
      } else {
        games = await fetchMSFGames();
        debugInfo = { source: 'mysportsfeeds' };
      }
    }

    cachedGames = games;
    cachedDebugInfo = debugInfo;
    cacheTimestamp = now;

    const response = { 
      games, 
      cached: false,
      count: games.length,
      source: debugInfo?.source || useSource
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
