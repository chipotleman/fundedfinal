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

const LIVE_GAMES_CACHE_DURATION = 60 * 1000;  // 60s cache - live scores come from inplay/fast endpoint
const NO_LIVE_GAMES_CACHE_DURATION = 120 * 1000;  // 2 min cache when no live games

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
      
      // Filter out completed games - they shouldn't be available for betting
      const activeGames = formattedGames.filter(game => !game.isCompleted);
      
      const response = {
        games: activeGames,
        sport: sport,
        sportName: SUPPORTED_SPORTS[sport].name,
        count: activeGames.length,
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

    // Deduplicate concurrent requests - reuse pending fetch if one exists
    if (pendingFetch) {
      console.log('[GAMES API] Waiting for pending fetch...');
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
    
    const fetchPromise = getAllGamesWithOdds();
    pendingFetch = fetchPromise;
    
    let allGames;
    try {
      allGames = await fetchPromise;
    } finally {
      pendingFetch = null;
    }
    let formattedGames = allGames.map(convertGoalserveToDisplayFormat);
    
    let hasLiveGames = false;
    const sportsWithLiveGames = new Set();
    
    for (const [sportKey] of Object.entries(SUPPORTED_SPORTS)) {
      try {
        const scores = await getScores(sportKey);
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
      } catch (e) {
        console.error(`[GAMES API] Error fetching scores for ${sportKey}:`, e.message);
      }
    }
    
    if (sportsWithLiveGames.size > 0) {
      console.log(`[GAMES API] Refreshing odds for live sports: ${Array.from(sportsWithLiveGames).join(', ')}`);
      for (const sportKey of sportsWithLiveGames) {
        try {
          const freshOdds = await getOdds(sportKey);
          const freshFormatted = freshOdds.map(convertGoalserveToDisplayFormat);
          
          freshFormatted.forEach(freshGame => {
            const existingIdx = formattedGames.findIndex(g => g.id === freshGame.id);
            if (existingIdx >= 0) {
              formattedGames[existingIdx].lines = freshGame.lines;
              formattedGames[existingIdx].allBookmakerOdds = freshGame.allBookmakerOdds;
            }
          });
        } catch (e) {
          console.error(`[GAMES API] Error refreshing odds for ${sportKey}:`, e.message);
        }
      }
    }
    
    // Filter out completed games - they shouldn't be available for betting
    formattedGames = formattedGames.filter(game => !game.isCompleted);
    
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
