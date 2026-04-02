import { 
  getOdds,
  getScores,
  getAllGamesWithOdds,
  getSupportedSports,
  clearCache,
  SUPPORTED_SPORTS 
} from '../../../lib/goalserve';
import { generateSimulatedGames } from '../../../lib/simulated-games';

let globalCache = null;
let globalCacheTimestamp = null;

const LIVE_GAMES_CACHE_DURATION = 5 * 1000;
const NO_LIVE_GAMES_CACHE_DURATION = 30 * 1000;

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
  
  const allBookmakerOdds = {};
  
  if (odds.moneyline) {
    odds.moneyline.forEach(bm => {
      if (!allBookmakerOdds[bm.name]) allBookmakerOdds[bm.name] = {};
      allBookmakerOdds[bm.name].moneyline = {
        home: parseInt(bm.home_ml?.us) || null,
        away: parseInt(bm.away_ml?.us) || null
      };
    });
  }
  
  if (odds.spread) {
    odds.spread.forEach(bm => {
      if (!allBookmakerOdds[bm.name]) allBookmakerOdds[bm.name] = {};
      allBookmakerOdds[bm.name].spreads = {
        home: {
          point: bm.home_spread?.point || null,
          odds: parseInt(bm.home_spread?.us) || null
        },
        away: {
          point: bm.away_spread?.point || null,
          odds: parseInt(bm.away_spread?.us) || null
        }
      };
    });
  }
  
  if (odds.total) {
    odds.total.forEach(bm => {
      if (!allBookmakerOdds[bm.name]) allBookmakerOdds[bm.name] = {};
      allBookmakerOdds[bm.name].totals = {
        over: {
          point: bm.over?.point || null,
          odds: parseInt(bm.over?.us) || null
        },
        under: {
          point: bm.under?.point || null,
          odds: parseInt(bm.under?.us) || null
        }
      };
    });
  }
  
  const homeSpreadPoint = bet365Spread?.home_spread?.point;
  const awaySpreadPoint = bet365Spread?.away_spread?.point;
  const overPoint = bet365Total?.over?.point;
  const underPoint = bet365Total?.under?.point;
  
  const lines = {
    moneyline: {
      home: parseInt(bet365ML?.home_ml?.us) || null,
      away: parseInt(bet365ML?.away_ml?.us) || null,
      homeSource: bet365ML?.name || 'Goalserve',
      awaySource: bet365ML?.name || 'Goalserve'
    },
    spread: {
      home: homeSpreadPoint != null ? {
        point: homeSpreadPoint,
        odds: parseInt(bet365Spread?.home_spread?.us) || -110,
        source: bet365Spread?.name || 'Goalserve'
      } : null,
      away: awaySpreadPoint != null ? {
        point: awaySpreadPoint,
        odds: parseInt(bet365Spread?.away_spread?.us) || -110,
        source: bet365Spread?.name || 'Goalserve'
      } : null
    },
    total: {
      over: overPoint != null ? {
        point: overPoint,
        odds: parseInt(bet365Total?.over?.us) || -110,
        source: bet365Total?.name || 'Goalserve'
      } : null,
      under: underPoint != null ? {
        point: underPoint,
        odds: parseInt(bet365Total?.under?.us) || -110,
        source: bet365Total?.name || 'Goalserve'
      } : null
    }
  };
  
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
    lines: lines,
    allBookmakerOdds: allBookmakerOdds,
    periodOdds: odds.periods || {},
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

    console.log('[GAMES API] Fetching all games from Goalserve...');
    
    const allGames = await getAllGamesWithOdds();
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
    
    if (formattedGames.length === 0) {
      console.log('[GAMES API] No games from Goalserve, falling back to simulated games');
      const simGames = generateSimulatedGames();
      const simBySport = {};
      simGames.forEach(game => {
        if (!simBySport[game.sportName]) simBySport[game.sportName] = [];
        simBySport[game.sportName].push(game);
      });
      return res.status(200).json({
        games: simGames,
        bySport: simBySport,
        count: simGames.length,
        fromCache: false,
        dataSource: 'Demo',
        isSimulated: true,
        creditStatus: getGoalserveStatus(),
        freshness: { hasLiveGames: simGames.some(g => g.isLive) },
        polling: { recommendedInterval: 60000, hasLiveGames: simGames.some(g => g.isLive) }
      });
    }

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
    
    console.log('[GAMES API] API error and no cache, falling back to simulated games');
    const simGames = generateSimulatedGames();
    const simBySport = {};
    simGames.forEach(game => {
      if (!simBySport[game.sportName]) simBySport[game.sportName] = [];
      simBySport[game.sportName].push(game);
    });
    return res.status(200).json({
      games: simGames,
      bySport: simBySport,
      count: simGames.length,
      fromCache: false,
      dataSource: 'Demo',
      isSimulated: true,
      creditStatus: getGoalserveStatus(),
      freshness: { hasLiveGames: simGames.some(g => g.isLive) },
      polling: { recommendedInterval: 60000, hasLiveGames: simGames.some(g => g.isLive) }
    });
  }
}
