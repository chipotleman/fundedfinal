import { 
  getOdds,
  getScores,
  getAllGamesWithOdds,
  getSupportedSports,
  clearCache,
  SUPPORTED_SPORTS 
} from '../../../lib/goalserve';
import { getInplayService } from '../../../lib/goalserve-inplay';

let globalCache = null;
let globalCacheTimestamp = null;

// HTTPS-only approach: 5-second cache for all data (REST API + inplay feeds)
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

// Merge inplay feed data for live timer and real-time updates (HTTPS-only approach)
async function mergeInplayLiveData(games) {
  try {
    const inplayService = getInplayService();
    
    // Fetch all inplay feeds (basketball, hockey, amfootball, baseball)
    await inplayService.fetchAllFeeds();
    const liveEvents = inplayService.getLiveEvents(); // Returns array
    
    if (!liveEvents || liveEvents.length === 0) {
      console.log('[GAMES API] No inplay live events available');
      return { games, mergedCount: 0 };
    }
    
    console.log(`[GAMES API] Found ${liveEvents.length} inplay live events`);
    let mergedCount = 0;
    
    games.forEach(game => {
      if (!game.isLive) return;
      
      const homeTeamLower = (game.homeTeamFull || game.homeTeam || '').toLowerCase();
      const awayTeamLower = (game.awayTeamFull || game.awayTeam || '').toLowerCase();
      
      // Find matching inplay event by team names
      for (const inplayEvent of liveEvents) {
        const inplayHome = (inplayEvent.homeTeam || '').toLowerCase();
        const inplayAway = (inplayEvent.awayTeam || '').toLowerCase();
        
        const homeMatch = homeTeamLower.includes(inplayHome) || inplayHome.includes(homeTeamLower) ||
                          homeTeamLower.split(' ').some(w => inplayHome.includes(w) && w.length > 3);
        const awayMatch = awayTeamLower.includes(inplayAway) || inplayAway.includes(awayTeamLower) ||
                          awayTeamLower.split(' ').some(w => inplayAway.includes(w) && w.length > 3);
        
        if (homeMatch && awayMatch) {
          // Update live timer/clock from inplay feed
          if (inplayEvent.displayClock) {
            game.timer = inplayEvent.displayClock;
          }
          
          // Update scores if inplay has higher (fresher) scores
          const inplayTotal = (inplayEvent.homeScore || 0) + (inplayEvent.awayScore || 0);
          const gameTotal = (game.homeScore || 0) + (game.awayScore || 0);
          if (inplayTotal >= gameTotal) {
            game.homeScore = inplayEvent.homeScore;
            game.awayScore = inplayEvent.awayScore;
          }
          
          // Merge inplay live odds if available
          if (inplayEvent.odds) {
            const odds = inplayEvent.odds;
            
            if (odds.moneyline?.home) {
              game.lines.moneyline.home = decimalToAmerican(odds.moneyline.home) || game.lines.moneyline.home;
              game.lines.moneyline.homeSource = 'Inplay Live';
            }
            if (odds.moneyline?.away) {
              game.lines.moneyline.away = decimalToAmerican(odds.moneyline.away) || game.lines.moneyline.away;
              game.lines.moneyline.awaySource = 'Inplay Live';
            }
            
            if (odds.spread?.home) {
              game.lines.spread.home = {
                point: odds.spread.home.line,
                odds: decimalToAmerican(odds.spread.home.odds) || -110,
                source: 'Inplay Live'
              };
            }
            if (odds.spread?.away) {
              game.lines.spread.away = {
                point: odds.spread.away.line,
                odds: decimalToAmerican(odds.spread.away.odds) || -110,
                source: 'Inplay Live'
              };
            }
            
            if (odds.total?.over) {
              game.lines.total.over = {
                point: odds.total.line,
                odds: decimalToAmerican(odds.total.over) || -110,
                source: 'Inplay Live'
              };
            }
            if (odds.total?.under) {
              game.lines.total.under = {
                point: odds.total.line,
                odds: decimalToAmerican(odds.total.under) || -110,
                source: 'Inplay Live'
              };
            }
          }
          
          game.liveOddsSource = 'Inplay HTTPS';
          game.liveDataTimestamp = Date.now();
          mergedCount++;
          break;
        }
      }
    });
    
    console.log(`[GAMES API] Merged inplay live data for ${mergedCount} games`);
    return { games, mergedCount };
  } catch (error) {
    console.error('[GAMES API] Error fetching inplay data:', error.message);
    return { games, mergedCount: 0 };
  }
}

// Inject international/European games from inplay feeds (HTTPS-only)
function injectInplayOnlyEvents(games) {
  const inplayService = getInplayService();
  const liveEvents = inplayService.getLiveEvents(); // Returns array
  
  if (!liveEvents || liveEvents.length === 0) {
    return { games, injectedCount: 0 };
  }
  
  const existingMatchups = new Set(games.map(g => 
    `${(g.homeTeamFull || g.homeTeam || '').toLowerCase()}-${(g.awayTeamFull || g.awayTeam || '').toLowerCase()}`
  ));

  let injectedCount = 0;
  const sportMapping = {
    'hockey': 'HOCKEY',
    'basket': 'BASKETBALL',
    'basketball': 'BASKETBALL',
    'amfootball': 'FOOTBALL',
    'baseball': 'BASEBALL',
    'soccer': 'SOCCER'
  };

  for (const inplayEvent of liveEvents) {
    const inplayHome = (inplayEvent.homeTeam || '').toLowerCase();
    const inplayAway = (inplayEvent.awayTeam || '').toLowerCase();

    const hasMatch = Array.from(existingMatchups).some(existing => {
      const [exHome, exAway] = existing.split('-');
      const homeMatch = exHome.includes(inplayHome) || inplayHome.includes(exHome) ||
                        exHome.split(' ').some(w => inplayHome.includes(w) && w.length > 3);
      const awayMatch = exAway.includes(inplayAway) || inplayAway.includes(exAway) ||
                        exAway.split(' ').some(w => inplayAway.includes(w) && w.length > 3);
      return homeMatch && awayMatch;
    });

    if (!hasMatch && (inplayEvent.status === 'live' || inplayEvent.status === 'paused')) {
      const sportName = sportMapping[inplayEvent.sport] || (inplayEvent.sport || 'OTHER').toUpperCase();
      const league = inplayEvent.league || `${sportName} INTERNATIONAL`;
      
      const odds = inplayEvent.odds || {};
      const newGame = {
        id: `inplay-${inplayEvent.id}`,
        homeTeam: inplayEvent.homeTeam,
        awayTeam: inplayEvent.awayTeam,
        homeTeamFull: inplayEvent.homeTeam,
        awayTeamFull: inplayEvent.awayTeam,
        homeScore: inplayEvent.homeScore || 0,
        awayScore: inplayEvent.awayScore || 0,
        timer: inplayEvent.displayClock || null,
        sportKey: inplayEvent.sport || 'international',
        sportName: sportName,
        league: league,
        commenceTime: new Date().toISOString(),
        isLive: true,
        isCompleted: false,
        status: 'live',
        liveOddsSource: 'Inplay HTTPS',
        liveDataTimestamp: Date.now(),
        lines: {
          moneyline: {
            home: odds.moneyline?.home ? decimalToAmerican(odds.moneyline.home) : null,
            away: odds.moneyline?.away ? decimalToAmerican(odds.moneyline.away) : null
          },
          spread: {
            home: odds.spread?.home ? {
              point: odds.spread.home.line,
              odds: decimalToAmerican(odds.spread.home.odds) || -110
            } : null,
            away: odds.spread?.away ? {
              point: odds.spread.away.line,
              odds: decimalToAmerican(odds.spread.away.odds) || -110
            } : null
          },
          total: {
            over: odds.total?.over ? {
              point: odds.total.line,
              odds: decimalToAmerican(odds.total.over) || -110
            } : null,
            under: odds.total?.under ? {
              point: odds.total.line,
              odds: decimalToAmerican(odds.total.under) || -110
            } : null
          }
        }
      };
      
      games.push(newGame);
      injectedCount++;
    }
  }

  console.log(`[GAMES API] Injected ${injectedCount} inplay-only live events (international/European)`);
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
    
    // HTTPS-only approach: Always fetch inplay feeds for timers and international games
    console.log(`[GAMES API] Fetching inplay data...`);
    try {
      const inplayService = getInplayService();
      await inplayService.fetchAllFeeds();
      
      // Merge inplay data for live US games (timers, scores, odds)
      if (hasLiveGames) {
        const inplayMergeResult = await mergeInplayLiveData(formattedGames);
        formattedGames = inplayMergeResult.games;
      }
      
      // Always inject international/European games from inplay feeds
      const injectResult = injectInplayOnlyEvents(formattedGames);
      formattedGames = injectResult.games;
      if (injectResult.injectedCount > 0) {
        hasLiveGames = true;
      }
    } catch (e) {
      console.error(`[GAMES API] Error fetching inplay data:`, e.message);
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
      dataSource: 'Goalserve HTTPS',
      creditStatus: getGoalserveStatus(),
      freshness: { hasLiveGames },
      polling: {
        recommendedInterval: recommendedInterval,
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
