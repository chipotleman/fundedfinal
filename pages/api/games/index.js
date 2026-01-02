import { 
  getOdds,
  getScores,
  getAllGamesWithOdds,
  getSupportedSports,
  clearCache,
  SUPPORTED_SPORTS 
} from '../../../lib/goalserve';
import { getAllLiveEvents, getStatus as getWsStatus, ensureConnected } from '../../../lib/goalserve-ws';

let globalCache = null;
let globalCacheTimestamp = null;

const LIVE_GAMES_CACHE_DURATION = 5 * 1000;
const NO_LIVE_GAMES_CACHE_DURATION = 30 * 1000;

function decimalToAmerican(decimal) {
  if (!decimal || decimal <= 1) return null;
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return -Math.round(100 / (decimal - 1));
  }
}

function mergeWebSocketLiveOdds(games) {
  const wsStatus = getWsStatus();
  // Only merge WebSocket data if connection is healthy and active
  // Skip merging when failed/disconnected to prevent stale data overwriting REST API
  if (wsStatus.connectionStatus !== 'connected' || wsStatus.liveEventCount === 0) {
    console.log(`[GAMES API] Skipping WebSocket merge - status: ${wsStatus.connectionStatus}, events: ${wsStatus.liveEventCount}`);
    return { games, wsActive: false, mergedCount: 0 };
  }

  const wsEvents = getAllLiveEvents();
  let mergedCount = 0;

  games.forEach(game => {
    if (!game.isLive) return;
    
    const homeTeamLower = (game.homeTeamFull || game.homeTeam || '').toLowerCase();
    const awayTeamLower = (game.awayTeamFull || game.awayTeam || '').toLowerCase();

    for (const [eventId, wsEvent] of Object.entries(wsEvents)) {
      const wsHome = (wsEvent.homeTeam || '').toLowerCase();
      const wsAway = (wsEvent.awayTeam || '').toLowerCase();

      const homeMatch = homeTeamLower.includes(wsHome) || wsHome.includes(homeTeamLower) ||
                        homeTeamLower.split(' ').some(w => wsHome.includes(w) && w.length > 3);
      const awayMatch = awayTeamLower.includes(wsAway) || wsAway.includes(awayTeamLower) ||
                        awayTeamLower.split(' ').some(w => wsAway.includes(w) && w.length > 3);

      if (homeMatch && awayMatch && wsEvent.odds) {
        const wsOdds = wsEvent.odds;

        if (wsOdds.moneyline?.home) {
          game.lines.moneyline.home = decimalToAmerican(wsOdds.moneyline.home) || game.lines.moneyline.home;
          game.lines.moneyline.homeSource = 'WebSocket Live';
        }
        if (wsOdds.moneyline?.away) {
          game.lines.moneyline.away = decimalToAmerican(wsOdds.moneyline.away) || game.lines.moneyline.away;
          game.lines.moneyline.awaySource = 'WebSocket Live';
        }

        if (wsOdds.spread?.home) {
          game.lines.spread.home = {
            point: wsOdds.spread.home.line,
            odds: decimalToAmerican(wsOdds.spread.home.odds) || -110,
            source: 'WebSocket Live'
          };
        }
        if (wsOdds.spread?.away) {
          game.lines.spread.away = {
            point: wsOdds.spread.away.line,
            odds: decimalToAmerican(wsOdds.spread.away.odds) || -110,
            source: 'WebSocket Live'
          };
        }

        if (wsOdds.total?.over) {
          game.lines.total.over = {
            point: wsOdds.total.line,
            odds: decimalToAmerican(wsOdds.total.over) || -110,
            source: 'WebSocket Live'
          };
        }
        if (wsOdds.total?.under) {
          game.lines.total.under = {
            point: wsOdds.total.line,
            odds: decimalToAmerican(wsOdds.total.under) || -110,
            source: 'WebSocket Live'
          };
        }

        // Only use WebSocket scores if they're non-zero and fresher than REST API
        // REST API scores are considered fresh (5-second cache), so only override if WS has higher scores
        const wsTimestamp = wsEvent.timestamp || 0;
        const isWsScoreFresh = (Date.now() - wsTimestamp) < 30000; // WS data less than 30s old
        
        if (isWsScoreFresh && wsEvent.homeScore !== undefined && wsEvent.awayScore !== undefined) {
          // Only override if WS has higher or equal scores (scores only go up in a game)
          const wsTotal = (wsEvent.homeScore || 0) + (wsEvent.awayScore || 0);
          const restTotal = (game.homeScore || 0) + (game.awayScore || 0);
          if (wsTotal >= restTotal) {
            game.homeScore = wsEvent.homeScore;
            game.awayScore = wsEvent.awayScore;
          }
        }

        game.liveOddsSource = 'WebSocket';
        game.liveOddsTimestamp = wsEvent.timestamp;
        mergedCount++;
        break;
      }
    }
  });

  console.log(`[GAMES API] Merged WebSocket live odds for ${mergedCount} games`);
  return { games, wsActive: true, mergedCount };
}

function injectWebSocketOnlyEvents(games) {
  const wsStatus = getWsStatus();
  // Only inject WebSocket-only events (European games) when connection is healthy
  // Prevents stale European game data from persisting when connection fails
  if (wsStatus.connectionStatus !== 'connected' || wsStatus.liveEventCount === 0) {
    console.log(`[GAMES API] Skipping WebSocket injection - status: ${wsStatus.connectionStatus}`);
    return { games, injectedCount: 0 };
  }

  const wsEvents = getAllLiveEvents();
  const existingMatchups = new Set(games.map(g => 
    `${(g.homeTeamFull || g.homeTeam || '').toLowerCase()}-${(g.awayTeamFull || g.awayTeam || '').toLowerCase()}`
  ));

  let injectedCount = 0;
  const sportMapping = {
    'hockey': 'HOCKEY',
    'basket': 'BASKETBALL', 
    'amfootball': 'FOOTBALL',
    'baseball': 'BASEBALL',
    'soccer': 'SOCCER'
  };

  for (const [eventId, wsEvent] of Object.entries(wsEvents)) {
    const wsHome = (wsEvent.homeTeam || '').toLowerCase();
    const wsAway = (wsEvent.awayTeam || '').toLowerCase();
    const matchupKey = `${wsHome}-${wsAway}`;

    const hasMatch = Array.from(existingMatchups).some(existing => {
      const [exHome, exAway] = existing.split('-');
      const homeMatch = exHome.includes(wsHome) || wsHome.includes(exHome) ||
                        exHome.split(' ').some(w => wsHome.includes(w) && w.length > 3);
      const awayMatch = exAway.includes(wsAway) || wsAway.includes(exAway) ||
                        exAway.split(' ').some(w => wsAway.includes(w) && w.length > 3);
      return homeMatch && awayMatch;
    });

    if (!hasMatch) {
      const sportName = sportMapping[wsEvent.sport] || (wsEvent.sport || 'OTHER').toUpperCase();
      const league = wsEvent.league || wsEvent.competitionName || `${sportName} INTERNATIONAL`;
      
      const wsOdds = wsEvent.odds || {};
      const newGame = {
        id: `ws-${eventId}`,
        homeTeam: wsEvent.homeTeam,
        awayTeam: wsEvent.awayTeam,
        homeTeamFull: wsEvent.homeTeam,
        awayTeamFull: wsEvent.awayTeam,
        homeScore: wsEvent.homeScore || 0,
        awayScore: wsEvent.awayScore || 0,
        sportKey: wsEvent.sport || 'international',
        sportName: sportName,
        league: league,
        commenceTime: new Date().toISOString(),
        isLive: true,
        isCompleted: false,
        status: 'live',
        liveOddsSource: 'WebSocket',
        liveOddsTimestamp: wsEvent.timestamp,
        lines: {
          moneyline: {
            home: wsOdds.moneyline?.home ? decimalToAmerican(wsOdds.moneyline.home) : null,
            away: wsOdds.moneyline?.away ? decimalToAmerican(wsOdds.moneyline.away) : null
          },
          spread: {
            home: wsOdds.spread?.home ? {
              point: wsOdds.spread.home.line,
              odds: decimalToAmerican(wsOdds.spread.home.odds) || -110
            } : null,
            away: wsOdds.spread?.away ? {
              point: wsOdds.spread.away.line,
              odds: decimalToAmerican(wsOdds.spread.away.odds) || -110
            } : null
          },
          total: {
            over: wsOdds.total?.over ? {
              point: wsOdds.total.line,
              odds: decimalToAmerican(wsOdds.total.over) || -110
            } : null,
            under: wsOdds.total?.under ? {
              point: wsOdds.total.line,
              odds: decimalToAmerican(wsOdds.total.under) || -110
            } : null
          }
        }
      };
      
      games.push(newGame);
      injectedCount++;
    }
  }

  console.log(`[GAMES API] Injected ${injectedCount} WebSocket-only live events`);
  return { games, injectedCount };
}

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
    timer: game.timer || null,  // Live game clock (e.g., "5:32" or "12:00")
    scores: game.scores,
    homeScore: game.scores?.home?.total || 0,
    awayScore: game.scores?.away?.total || 0,
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
          game.homeScore = liveScore.scores?.home?.total ?? 0;
          game.awayScore = liveScore.scores?.away?.total ?? 0;
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
            game.homeScore = score.scores?.home?.total ?? 0;
            game.awayScore = score.scores?.away?.total ?? 0;
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
    
    const wsStatus = getWsStatus();
    const wsActive = wsStatus.connectionStatus === 'connected' && wsStatus.liveEventCount > 0;

    if (wsActive) {
      console.log(`[GAMES API] WebSocket connected with ${wsStatus.liveEventCount} live events - using WS for live odds`);
      const wsMergeResult = mergeWebSocketLiveOdds(formattedGames);
      formattedGames = wsMergeResult.games;
      
      const injectResult = injectWebSocketOnlyEvents(formattedGames);
      formattedGames = injectResult.games;
      if (injectResult.injectedCount > 0) {
        hasLiveGames = true;
      }
    } else if (sportsWithLiveGames.size > 0) {
      console.log(`[GAMES API] No WebSocket - refreshing odds via REST for live sports: ${Array.from(sportsWithLiveGames).join(', ')}`);
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
      dataSource: wsActive ? 'Goalserve WebSocket' : 'Goalserve REST',
      creditStatus: getGoalserveStatus(),
      freshness: { hasLiveGames },
      polling: {
        recommendedInterval: wsActive ? 1000 : recommendedInterval,
        hasLiveGames
      },
      websocket: {
        active: wsActive,
        status: wsStatus.connectionStatus,
        liveEventCount: wsStatus.liveEventCount,
        activeSports: wsStatus.activeSports
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
