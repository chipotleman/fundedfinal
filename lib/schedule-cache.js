import { getAllGamesWithOdds, SUPPORTED_SPORTS } from './goalserve';

let cachedGames = [];
let lastFetchTime = 0;
let isPolling = false;
let pollInterval = null;
let initialFetchPromise = null;

const CACHE_DURATION = 30 * 1000;
const POLL_INTERVAL = 60 * 1000;

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
    startTime: game.commence_time,
    time: game.formatted_time,
    commenceTime: game.commence_time,
    status: game.status,
    isLive: game.isLive || false,
    isCompleted: game.isCompleted || false,
    scores: game.scores,
    lines: lines,
    dataSource: 'Goalserve'
  };
}

async function fetchScheduledGames() {
  try {
    console.log('[Schedule Cache] Fetching scheduled games from Goalserve...');
    const startTime = Date.now();
    
    const games = await getAllGamesWithOdds();
    
    // Format all games, but mark which are live for filtering
    const formattedGames = (games || []).map(convertGoalserveToDisplayFormat);
    
    // IMPORTANT: Only cache non-live games for SSR
    // Live game scores come from inplay cache (2s polling) which is always fresher
    // This prevents stale scores from appearing on page refresh
    const scheduledOnly = formattedGames.filter(g => !g.isLive);
    
    cachedGames = formattedGames; // Keep all for backward compat
    lastFetchTime = Date.now();
    
    const elapsed = Date.now() - startTime;
    console.log(`[Schedule Cache] Cached ${formattedGames.length} games (${scheduledOnly.length} scheduled, ${formattedGames.length - scheduledOnly.length} live) in ${elapsed}ms`);
    
    return formattedGames;
  } catch (error) {
    console.error('[Schedule Cache] Error fetching games:', error.message);
    return cachedGames;
  }
}

export function startSchedulePolling() {
  if (isPolling) {
    return;
  }
  
  console.log('[Schedule Cache] Starting scheduled games polling...');
  isPolling = true;
  
  initialFetchPromise = fetchScheduledGames();
  
  pollInterval = setInterval(fetchScheduledGames, POLL_INTERVAL);
}

export function stopSchedulePolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  isPolling = false;
}

export async function waitForScheduleCache(maxWait = 20000) {
  if (cachedGames.length > 0) {
    return true;
  }
  
  if (!isPolling) {
    startSchedulePolling();
  }
  
  if (initialFetchPromise) {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), maxWait)
      );
      await Promise.race([initialFetchPromise, timeoutPromise]);
      return cachedGames.length > 0;
    } catch (e) {
      console.log('[Schedule Cache] Timeout waiting for initial fetch');
      return false;
    }
  }
  
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (cachedGames.length > 0) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('[Schedule Cache] Timeout waiting for cache - returning empty');
  return false;
}

export function getScheduledGamesForSSR() {
  // Only return non-live games for SSR
  // Live game data comes from inplay cache which is always fresher (2s polling)
  return cachedGames.filter(g => !g.isLive);
}

export function getCachedGames() {
  // Return all cached games for API use
  return cachedGames;
}

export function getScheduleCacheStatus() {
  return {
    gameCount: cachedGames.length,
    lastFetchTime,
    isPolling,
    isFresh: Date.now() - lastFetchTime < CACHE_DURATION
  };
}
