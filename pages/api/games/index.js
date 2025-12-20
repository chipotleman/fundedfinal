import { 
  fetchUpcomingGames, 
  fetchSportOdds,
  getSupportedSports,
  getCreditStatus,
  getCacheStatus,
  clearCache,
  SUPPORTED_SPORTS 
} from '../../../lib/theoddsapi';

let globalCache = null;
let globalCacheTimestamp = null;

// Adaptive cache durations
const LIVE_GAMES_CACHE_DURATION = 12 * 1000; // 12 seconds when live games are happening
const NO_LIVE_GAMES_CACHE_DURATION = 60 * 1000; // 60 seconds when no live games

function getAdaptiveCacheDuration() {
  // If we have cached data with live games, use shorter cache
  if (globalCache?.freshness?.hasLiveGames) {
    return LIVE_GAMES_CACHE_DURATION;
  }
  return NO_LIVE_GAMES_CACHE_DURATION;
}

export default async function handler(req, res) {
  // Prevent browser caching to ensure fresh scores/odds
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, debug, refresh } = req.query;
    const now = Date.now();

    if (refresh === 'true') {
      clearCache(sport || null);
    }

    if (sport && SUPPORTED_SPORTS[sport]) {
      const result = await fetchSportOdds(sport);
      const response = {
        games: result.games,
        sport: sport,
        sportName: SUPPORTED_SPORTS[sport].name,
        count: result.games.length,
        fromCache: result.fromCache,
        creditStatus: getCreditStatus()
      };
      
      if (debug === 'true') {
        response.debugInfo = result.debugInfo;
        response.cacheStatus = getCacheStatus();
      }
      
      return res.status(200).json(response);
    }

    const cacheDuration = getAdaptiveCacheDuration();
    if (globalCache && globalCacheTimestamp && (now - globalCacheTimestamp) < cacheDuration && refresh !== 'true') {
      // Deep clone games to ensure React detects changes
      const clonedGames = globalCache.games.map(game => ({ ...game, lines: game.lines ? { ...game.lines } : null }));
      const response = {
        games: clonedGames,
        bySport: globalCache.bySport,
        count: globalCache.games.length,
        fromCache: true,
        cacheAge: Math.floor((now - globalCacheTimestamp) / 1000),
        creditStatus: getCreditStatus(),
        // Expose freshness metadata for adaptive polling
        freshness: globalCache.freshness || null,
        // Tell client how long to wait before next poll
        polling: {
          recommendedInterval: cacheDuration,
          hasLiveGames: globalCache?.freshness?.hasLiveGames || false
        }
      };
      
      if (debug === 'true') {
        response.debugInfo = globalCache.debugInfo;
        response.cacheStatus = getCacheStatus();
      }
      
      return res.status(200).json(response);
    }

    const result = await fetchUpcomingGames();
    
    globalCache = result;
    globalCacheTimestamp = now;

    // Determine polling interval based on fresh data
    const hasLiveGames = result.freshness?.hasLiveGames || false;
    const recommendedInterval = hasLiveGames ? LIVE_GAMES_CACHE_DURATION : NO_LIVE_GAMES_CACHE_DURATION;
    
    const response = {
      games: result.games,
      bySport: result.bySport,
      count: result.games.length,
      fromCache: false,
      creditStatus: result.creditStatus,
      // Expose freshness metadata for adaptive polling
      freshness: result.freshness || null,
      // Tell client how long to wait before next poll
      polling: {
        recommendedInterval,
        hasLiveGames
      }
    };
    
    if (debug === 'true') {
      response.debugInfo = result.debugInfo;
      response.cacheStatus = getCacheStatus();
      response.supportedSports = getSupportedSports();
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in games API:', error);
    
    if (globalCache) {
      const clonedGames = globalCache.games.map(game => ({ ...game, lines: game.lines ? { ...game.lines } : null }));
      return res.status(200).json({ 
        games: clonedGames, 
        bySport: globalCache.bySport,
        fromCache: true,
        stale: true,
        error: 'Using cached data due to API error',
        creditStatus: getCreditStatus(),
        freshness: globalCache.freshness || null
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch games',
      message: error.message 
    });
  }
}
