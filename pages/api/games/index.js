import { 
  getOdds,
  getScores,
  getAllGamesWithOdds,
  getSupportedSports,
  clearCache,
  SUPPORTED_SPORTS 
} from '../../../lib/goalserve';
import { getCachedGames, getScheduleCacheStatus } from '../../../lib/schedule-cache';
import { getInplayService } from '../../../lib/goalserve-inplay';

// Use schedule cache for instant responses - no more 100+ second waits
const CACHE_FALLBACK_DURATION = 60 * 1000;

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

    // Use pre-warmed schedule cache for instant responses
    // This avoids 100+ second waits for fresh Goalserve API calls
    const scheduledGames = getCachedGames();
    const cacheStatus = getScheduleCacheStatus();
    
    // Get live games from inplay service (2s polling)
    const inplayService = getInplayService();
    const liveEvents = inplayService.getEventsForSSR();
    
    // Merge live events with scheduled games
    // Live events take priority (fresher data)
    const liveEventIds = new Set(liveEvents.map(e => e.id));
    const nonLiveScheduled = scheduledGames.filter(g => !liveEventIds.has(g.id) && !g.isLive);
    
    // Convert live events to game format
    // Handle both string and object formats for team names
    const liveGames = liveEvents.map(event => {
      // homeTeam/awayTeam can be strings (from normalizeEvent) or objects
      const homeTeamName = typeof event.homeTeam === 'string' 
        ? event.homeTeam 
        : (event.homeTeam?.abbr || event.homeTeam?.name || '');
      const awayTeamName = typeof event.awayTeam === 'string' 
        ? event.awayTeam 
        : (event.awayTeam?.abbr || event.awayTeam?.name || '');
      
      return {
        id: event.id,
        gameId: event.id,
        sport: event.sport,
        sportName: event.leagueName || event.league || event.sport,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeTeamFull: homeTeamName,
        awayTeamFull: awayTeamName,
        time: event.displayClock || 'Live',
        commenceTime: event.startTime,
        status: event.status || 'inplay',
        isLive: true,
        isCompleted: false,
        scores: {
          home: event.homeScore ?? event.homeTeam?.score ?? 0,
          away: event.awayScore ?? event.awayTeam?.score ?? 0
        },
        lines: event.odds ? {
          moneyline: event.odds.moneyline || null,
          spread: event.odds.spread || null,
          total: event.odds.total || null
        } : null,
        dataSource: 'Goalserve-Inplay'
      };
    });
    
    // Filter out invalid games (no team names = untitled)
    const validLiveGames = liveGames.filter(g => g.homeTeam && g.awayTeam);
    
    const allGames = [...validLiveGames, ...nonLiveScheduled];
    const hasLiveGames = validLiveGames.length > 0;
    
    // Group by sport
    const bySport = {};
    allGames.forEach(game => {
      const sportName = game.sportName || game.sport || 'Other';
      if (!bySport[sportName]) {
        bySport[sportName] = [];
      }
      bySport[sportName].push(game);
    });
    
    console.log(`[GAMES API] Serving ${liveGames.length} live + ${nonLiveScheduled.length} scheduled from cache (instant)`);
    
    const response = {
      games: allGames,
      bySport,
      count: allGames.length,
      fromCache: true,
      cacheAge: cacheStatus.lastFetchTime ? Math.floor((now - cacheStatus.lastFetchTime) / 1000) : 0,
      dataSource: 'Goalserve',
      creditStatus: getGoalserveStatus(),
      freshness: { hasLiveGames },
      polling: {
        recommendedInterval: hasLiveGames ? 10000 : 30000,
        hasLiveGames
      }
    };
    
    if (debug === 'true') {
      response.debugInfo = {
        gameCount: allGames.length,
        liveCount: liveGames.length,
        scheduledCount: nonLiveScheduled.length,
        cacheStatus
      };
    }
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('[GAMES API] Error:', error);
    
    // Fallback to schedule cache on error
    const fallbackGames = getCachedGames();
    if (fallbackGames.length > 0) {
      return res.status(200).json({ 
        games: fallbackGames, 
        fromCache: true,
        stale: true,
        error: 'Using cached data due to API error',
        dataSource: 'Goalserve',
        creditStatus: getGoalserveStatus()
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch games',
      message: error.message 
    });
  }
}
