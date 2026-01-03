import { 
  getOdds,
  getScores,
  getAllGamesWithOdds,
  getSupportedSports,
  clearCache,
  SUPPORTED_SPORTS 
} from '../../../lib/goalserve';

let globalCache = null;
let globalCacheTimestamp = null;
let pendingFetch = null;

const LIVE_GAMES_CACHE_DURATION = 5 * 1000;  // 5s cache for live games
const NO_LIVE_GAMES_CACHE_DURATION = 30 * 1000;  // 30s cache when no live games
const ODDS_CACHE_DURATION = 5 * 1000;  // 5s cache for odds data
const STALE_CACHE_MAX_AGE = 10 * 60 * 1000;  // Serve stale cache up to 10 minutes old

function getGoalserveStatus() {
  return {
    used: 0,
    remaining: 'unlimited',
    budget: 'unlimited',
    percentUsed: 0,
    dataSource: 'Goalserve',
    unlimited: true
  };
}

function getAdaptiveCacheDuration() {
  if (globalCache?.freshness?.hasLiveGames) {
    return LIVE_GAMES_CACHE_DURATION;
  }
  return NO_LIVE_GAMES_CACHE_DURATION;
}

function convertGoalserveToDisplayFormat(game) {
  const odds = game.odds || {};
  
  const bet365ML = odds.moneyline?.find(b => b.name === 'bet365') || odds.moneyline?.[0];
  const bet365Spread = odds.spread?.find(b => b.name === 'bet365') || odds.spread?.[0];
  const bet365Total = odds.total?.find(b => b.name === 'bet365') || odds.total?.[0];
  
  const homeSpreadPoint = bet365Spread?.home_spread?.point;
  const awaySpreadPoint = bet365Spread?.away_spread?.point;
  const overPoint = bet365Total?.over?.point;
  const underPoint = bet365Total?.under?.point;
  
  return {
    id: game.id,
    gameId: game.id,
    sport: game.sport_key,
    sportName: game.sport_title,
    homeTeam: game.home_team_abbr,
    awayTeam: game.away_team_abbr,
    homeTeamFull: game.home_team,
    awayTeamFull: game.away_team,
    time: game.formatted_time,
    commenceTime: game.commence_time,
    status: game.status,
    isLive: game.isLive,
    isCompleted: game.isCompleted,
    scores: game.scores,
    lines: {
      moneyline: {
        home: parseInt(bet365ML?.home_ml?.us) || null,
        away: parseInt(bet365ML?.away_ml?.us) || null
      },
      spread: {
        home: homeSpreadPoint != null ? { point: homeSpreadPoint, odds: parseInt(bet365Spread?.home_spread?.us) || -110 } : null,
        away: awaySpreadPoint != null ? { point: awaySpreadPoint, odds: parseInt(bet365Spread?.away_spread?.us) || -110 } : null
      },
      total: {
        over: overPoint != null ? { point: overPoint, odds: parseInt(bet365Total?.over?.us) || -110 } : null,
        under: underPoint != null ? { point: underPoint, odds: parseInt(bet365Total?.under?.us) || -110 } : null
      }
    },
    dataSource: 'Goalserve'
  };
}

export default async function handler(req, res) {
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
      clearCache();
      globalCache = null;
      globalCacheTimestamp = null;
    }

    if (sport && SUPPORTED_SPORTS[sport]) {
      const games = await getOdds(sport);
      const formattedGames = games.map(convertGoalserveToDisplayFormat);
      
      const scores = await getScores(sport);
      formattedGames.forEach(game => {
        const liveScore = scores.find(s => s.id === game.id);
        if (liveScore) {
          game.isLive = liveScore.isLive;
          game.isCompleted = liveScore.isCompleted;
          game.status = liveScore.status;
          game.scores = liveScore.scores;
        }
      });
      
      const response = {
        games: formattedGames,
        sport: sport,
        sportName: SUPPORTED_SPORTS[sport].name,
        count: formattedGames.length,
        fromCache: false,
        dataSource: 'Goalserve',
        creditStatus: getGoalserveStatus()
      };
      
      if (debug === 'true') {
        response.debugInfo = { raw: games.slice(0, 2) };
      }
      
      return res.status(200).json(response);
    }

    const cacheDuration = getAdaptiveCacheDuration();
    if (globalCache && globalCacheTimestamp && (now - globalCacheTimestamp) < cacheDuration && refresh !== 'true') {
      const clonedGames = globalCache.games.map(game => ({ ...game, lines: game.lines ? { ...game.lines } : null }));
      const response = {
        games: clonedGames,
        bySport: globalCache.bySport,
        count: globalCache.games.length,
        fromCache: true,
        cacheAge: Math.floor((now - globalCacheTimestamp) / 1000),
        dataSource: 'Goalserve',
        creditStatus: getGoalserveStatus(),
        freshness: globalCache.freshness || null,
        polling: {
          recommendedInterval: cacheDuration,
          hasLiveGames: globalCache?.freshness?.hasLiveGames || false
        }
      };
      
      if (debug === 'true') {
        response.debugInfo = globalCache.debugInfo;
      }
      
      return res.status(200).json(response);
    }

    // CRITICAL: Serve stale cache immediately if available (don't make users wait 100+ seconds)
    const hasStaleCache = globalCache && globalCacheTimestamp && (now - globalCacheTimestamp) < STALE_CACHE_MAX_AGE;
    
    // If there's a pending fetch, serve stale cache immediately instead of waiting
    if (pendingFetch && hasStaleCache) {
      console.log('[GAMES API] Serving stale cache while fetch in progress...');
      const clonedGames = globalCache.games.map(game => ({ ...game, lines: game.lines ? { ...game.lines } : null }));
      return res.status(200).json({
        games: clonedGames,
        bySport: globalCache.bySport,
        count: globalCache.games.length,
        fromCache: true,
        stale: true,
        cacheAge: Math.floor((now - globalCacheTimestamp) / 1000),
        dataSource: 'Goalserve',
        creditStatus: getGoalserveStatus(),
        freshness: globalCache.freshness || null,
        polling: {
          recommendedInterval: 5000,  // Poll again soon since data is stale
          hasLiveGames: globalCache?.freshness?.hasLiveGames || false
        }
      });
    }
    
    // Deduplicate concurrent requests - reuse pending fetch if one exists
    if (pendingFetch) {
      console.log('[GAMES API] Waiting for pending fetch (no stale cache available)...');
      try {
        await pendingFetch;
        // After pending fetch completes, cache should be populated
        if (globalCache && globalCacheTimestamp) {
          const clonedGames = globalCache.games.map(game => ({ ...game, lines: game.lines ? { ...game.lines } : null }));
          return res.status(200).json({
            games: clonedGames,
            bySport: globalCache.bySport,
            count: globalCache.games.length,
            fromCache: true,
            cacheAge: 0,
            dataSource: 'Goalserve',
            creditStatus: getGoalserveStatus(),
            freshness: globalCache.freshness || null,
            polling: {
              recommendedInterval: getAdaptiveCacheDuration(),
              hasLiveGames: globalCache?.freshness?.hasLiveGames || false
            }
          });
        }
      } catch (e) {
        console.error('[GAMES API] Pending fetch failed:', e.message);
      }
    }

    console.log('[GAMES API] Fetching all games from Goalserve...');
    
    // Add timeout to prevent indefinite blocking (30 second max)
    const FETCH_TIMEOUT = 30000;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Goalserve fetch timeout')), FETCH_TIMEOUT)
    );
    
    const fetchPromise = getAllGamesWithOdds();
    pendingFetch = fetchPromise;
    
    let allGames;
    try {
      allGames = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (timeoutError) {
      console.error('[GAMES API] Fetch timeout or error:', timeoutError.message);
      pendingFetch = null;
      
      // Return empty games on timeout rather than blocking forever
      if (hasStaleCache) {
        console.log('[GAMES API] Returning stale cache after timeout');
        const clonedGames = globalCache.games.map(game => ({ ...game, lines: game.lines ? { ...game.lines } : null }));
        return res.status(200).json({
          games: clonedGames,
          bySport: globalCache.bySport,
          count: globalCache.games.length,
          fromCache: true,
          stale: true,
          timeout: true,
          dataSource: 'Goalserve',
          creditStatus: getGoalserveStatus()
        });
      }
      
      return res.status(200).json({
        games: [],
        bySport: {},
        count: 0,
        error: 'Data fetch timed out, please refresh',
        timeout: true,
        dataSource: 'Goalserve',
        creditStatus: getGoalserveStatus()
      });
    } finally {
      pendingFetch = null;
    }
    let formattedGames = allGames.map(convertGoalserveToDisplayFormat);
    
    let hasLiveGames = false;
    const sportsWithLiveGames = new Set();
    
    // Fetch ALL scores in PARALLEL (not sequential!) - this is critical for speed
    const sportKeys = Object.keys(SUPPORTED_SPORTS);
    const scoresResults = await Promise.allSettled(
      sportKeys.map(async (sportKey) => {
        try {
          return { sportKey, scores: await getScores(sportKey) };
        } catch (e) {
          console.error(`[GAMES API] Error fetching scores for ${sportKey}:`, e.message);
          return { sportKey, scores: [] };
        }
      })
    );
    
    // Process all scores
    scoresResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.scores) {
        const { sportKey, scores } = result.value;
        scores.forEach(score => {
          const game = formattedGames.find(g => g.id === score.id);
          if (game) {
            game.isLive = score.isLive;
            game.isCompleted = score.isCompleted;
            game.status = score.status;
            game.scores = score.scores;
            if (score.isLive) {
              hasLiveGames = true;
              sportsWithLiveGames.add(sportKey);
            }
          }
        });
      }
    });
    
    // Skip odds refresh during initial load to speed things up - live scores endpoint handles this
    // if (sportsWithLiveGames.size > 0) { ... }
    
    const bySport = {};
    formattedGames.forEach(game => {
      if (!bySport[game.sportName]) {
        bySport[game.sportName] = [];
      }
      bySport[game.sportName].push(game);
    });
    
    globalCache = {
      games: formattedGames,
      bySport,
      freshness: { hasLiveGames },
      debugInfo: { gameCount: formattedGames.length, sports: Object.keys(bySport) }
    };
    globalCacheTimestamp = now;

    const recommendedInterval = hasLiveGames ? LIVE_GAMES_CACHE_DURATION : NO_LIVE_GAMES_CACHE_DURATION;
    
    const response = {
      games: formattedGames,
      bySport,
      count: formattedGames.length,
      fromCache: false,
      dataSource: 'Goalserve',
      creditStatus: getGoalserveStatus(),
      freshness: { hasLiveGames },
      polling: {
        recommendedInterval,
        hasLiveGames
      }
    };
    
    if (debug === 'true') {
      response.debugInfo = globalCache.debugInfo;
      response.supportedSports = getSupportedSports();
    }

    console.log(`[GAMES API] Returning ${formattedGames.length} games from Goalserve`);
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
        dataSource: 'Goalserve',
        creditStatus: getGoalserveStatus(),
        freshness: globalCache.freshness || null
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch games',
      message: error.message 
    });
  }
}
