import { fetchNBAGames as fetchTheOddsGames, fetchUpcomingNBAGames as fetchTheOddsUpcoming } from '../../../lib/theoddsapi';
import { fetchNBAGames as fetchSportsradarGames, fetchUpcomingNBAGames as fetchSportsradarUpcoming } from '../../../lib/sportsradar';
import { fetchNBAGames as fetchMSFGames, fetchUpcomingNBAGames as fetchMSFUpcoming } from '../../../lib/mysportsfeeds';

let cachedGames = null;
let cachedDebugInfo = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

const PRIMARY_SOURCE = 'theodds';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { upcoming, debug, source } = req.query;
    const now = Date.now();

    const forceSource = source === 'mysportsfeeds' ? 'msf' : source === 'sportsradar' ? 'sr' : source === 'theodds' ? 'theodds' : null;
    const useSource = forceSource || PRIMARY_SOURCE;

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

    let games = [];
    let debugInfo = null;
    let actualSource = useSource;
    
    async function tryTheOddsApi() {
      console.log('Trying The Odds API...');
      if (upcoming === 'true') {
        const result = await fetchTheOddsUpcoming();
        return { games: result.games, debugInfo: result.debugInfo };
      } else {
        const g = await fetchTheOddsGames();
        return { games: g, debugInfo: { source: 'the-odds-api' } };
      }
    }
    
    async function tryMySportsFeeds() {
      console.log('Trying MySportsFeeds NBA API...');
      if (upcoming === 'true') {
        const result = await fetchMSFUpcoming(3);
        return { games: result.games, debugInfo: { ...result.debugInfo, source: 'mysportsfeeds' } };
      } else {
        const g = await fetchMSFGames();
        return { games: g, debugInfo: { source: 'mysportsfeeds' } };
      }
    }
    
    async function trySportsradar() {
      console.log('Trying Sportsradar NBA API...');
      if (upcoming === 'true') {
        const result = await fetchSportsradarUpcoming(1);
        return { games: result.games, debugInfo: { ...result.debugInfo, source: 'sportsradar' } };
      } else {
        const g = await fetchSportsradarGames();
        return { games: g, debugInfo: { source: 'sportsradar' } };
      }
    }
    
    if (useSource === 'theodds') {
      try {
        const result = await tryTheOddsApi();
        games = result.games;
        debugInfo = result.debugInfo;
        actualSource = 'theodds';
      } catch (error) {
        console.log('The Odds API failed:', error.message);
        if (!forceSource) {
          try {
            const srResult = await trySportsradar();
            games = srResult.games;
            debugInfo = srResult.debugInfo;
            actualSource = 'sr';
          } catch (srError) {
            console.log('Sportsradar also failed:', srError.message);
          }
        }
      }
    } else if (useSource === 'msf') {
      try {
        const result = await tryMySportsFeeds();
        games = result.games;
        debugInfo = result.debugInfo;
        actualSource = 'msf';
      } catch (msfError) {
        console.log('MySportsFeeds failed:', msfError.message);
      }
    } else if (useSource === 'sr') {
      try {
        const result = await trySportsradar();
        games = result.games;
        debugInfo = result.debugInfo;
        actualSource = 'sr';
      } catch (srError) {
        console.log('Sportsradar failed:', srError.message);
      }
    }

    cachedGames = games;
    cachedDebugInfo = debugInfo;
    cacheTimestamp = now;

    const response = { 
      games, 
      cached: false,
      count: games.length,
      source: debugInfo?.source || (actualSource === 'msf' ? 'mysportsfeeds' : 'sportsradar')
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
