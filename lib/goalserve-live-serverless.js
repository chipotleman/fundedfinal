const GOALSERVE_API_KEY = process.env.GOALSERVE_API_KEY;
const BASE_URL = 'http://www.goalserve.com/getfeed';

const LIVE_ENDPOINTS = {
  basketball_nba: 'bsktbl/nba-scores',
  basketball_ncaab: 'bsktbl/ncaa-scores',
  americanfootball_nfl: 'football/nfl-scores',
  americanfootball_ncaaf: 'football/fbs-scores',
  baseball_mlb: 'baseball/mlb-scores',
  icehockey_nhl: 'hockey/nhl-scores'
};

const SPORT_DISPLAY_NAMES = {
  basketball_nba: 'NBA',
  basketball_ncaab: 'NCAAB',
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL'
};

const liveCache = new Map();
const CACHE_TTL = 5000;

function formatGameClock(timer, period, sport) {
  if (!timer && !period) return null;
  
  let clock = '';
  
  if (timer) {
    const totalSeconds = parseInt(timer, 10);
    if (!isNaN(totalSeconds)) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      clock = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      clock = timer;
    }
  }
  
  if (period) {
    const periodNum = parseInt(period, 10);
    let periodStr = period;
    
    if (!isNaN(periodNum)) {
      if (sport?.includes('basketball')) {
        periodStr = periodNum <= 4 ? `Q${periodNum}` : `OT${periodNum - 4}`;
      } else if (sport?.includes('football')) {
        periodStr = periodNum <= 4 ? `Q${periodNum}` : `OT`;
      } else if (sport?.includes('hockey')) {
        periodStr = periodNum <= 3 ? `P${periodNum}` : `OT`;
      } else if (sport?.includes('baseball')) {
        periodStr = `${periodNum}`;
      }
    }
    
    return clock ? `${periodStr} ${clock}` : periodStr;
  }
  
  return clock || null;
}

function parseOdds(match, sport) {
  const odds = {
    moneyline: null,
    spread: null,
    total: null
  };
  
  try {
    const bm = match.odds?.bookmaker || match.bm;
    if (!bm) return odds;
    
    const bet365 = Array.isArray(bm) 
      ? bm.find(b => b.name?.toLowerCase().includes('bet365') || b.id === '1')
      : bm;
    
    if (!bet365) return odds;
    
    if (bet365.moneyline?.odd) {
      const ml = bet365.moneyline.odd;
      if (Array.isArray(ml) && ml.length >= 2) {
        odds.moneyline = {
          home: ml[0]?.value || ml[0]?.odds,
          away: ml[1]?.value || ml[1]?.odds
        };
      } else if (ml.home !== undefined) {
        odds.moneyline = { home: ml.home, away: ml.away };
      }
    }
    
    if (bet365.handicap?.odd) {
      const hc = bet365.handicap.odd;
      if (Array.isArray(hc) && hc.length >= 2) {
        odds.spread = {
          home: { line: hc[0]?.handicap || hc[0]?.line, odds: hc[0]?.value || hc[0]?.odds },
          away: { line: hc[1]?.handicap || hc[1]?.line, odds: hc[1]?.value || hc[1]?.odds }
        };
      }
    }
    
    if (bet365.total?.odd) {
      const tot = bet365.total.odd;
      if (Array.isArray(tot) && tot.length >= 2) {
        odds.total = {
          line: tot[0]?.total || tot[0]?.line,
          over: tot[0]?.value || tot[0]?.odds,
          under: tot[1]?.value || tot[1]?.odds
        };
      }
    }
  } catch (e) {
    console.error('[LiveServerless] Odds parse error:', e.message);
  }
  
  return odds;
}

function normalizeGame(match, sport) {
  const homeTeam = match.hometeam || match.localteam || match.home?.name || '';
  const awayTeam = match.awayteam || match.visitorteam || match.away?.name || '';
  const homeScore = parseInt(match.homescore || match.localteam_score || match.home?.score || '0', 10);
  const awayScore = parseInt(match.awayscore || match.visitorteam_score || match.away?.score || '0', 10);
  
  const status = match.status || match.timer?.status || '';
  const isLive = ['In Progress', 'Live', 'Playing', '1', '2', '3', '4', 'Q1', 'Q2', 'Q3', 'Q4', 'P1', 'P2', 'P3', 'OT', 'HT']
    .some(s => status?.toLowerCase().includes(s.toLowerCase()) || status === s);
  
  const timer = match.timer?.time || match.timer || match.clock || '';
  const period = match.timer?.period || match.period || match.quarter || '';
  
  return {
    id: match.id || match.contestID || `${sport}_${homeTeam}_${awayTeam}`.replace(/\s+/g, '_'),
    sport,
    league: SPORT_DISPLAY_NAMES[sport] || sport.toUpperCase(),
    homeTeam,
    awayTeam,
    homeScore: isNaN(homeScore) ? 0 : homeScore,
    awayScore: isNaN(awayScore) ? 0 : awayScore,
    status,
    isLive,
    displayClock: formatGameClock(timer, period, sport),
    period,
    timer,
    odds: parseOdds(match, sport),
    startTime: match.time || match.datetime || null,
    venue: match.venue || null,
    lastUpdate: Date.now()
  };
}

export async function fetchLiveGames(sports = null) {
  const targetSports = sports || Object.keys(LIVE_ENDPOINTS);
  const results = {
    games: [],
    sports: {},
    errors: [],
    cached: false,
    timestamp: Date.now()
  };
  
  const now = Date.now();
  const allCached = targetSports.every(sport => {
    const cached = liveCache.get(sport);
    return cached && (now - cached.timestamp) < CACHE_TTL;
  });
  
  if (allCached) {
    targetSports.forEach(sport => {
      const cached = liveCache.get(sport);
      if (cached?.games) {
        results.games.push(...cached.games);
        results.sports[sport] = cached.games.length;
      }
    });
    results.cached = true;
    return results;
  }
  
  await Promise.allSettled(
    targetSports.map(async (sport) => {
      const endpoint = LIVE_ENDPOINTS[sport];
      if (!endpoint) return;
      
      try {
        const url = `${BASE_URL}/${GOALSERVE_API_KEY}/${endpoint}?json=1`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 5 }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const games = [];
        
        const categories = data.scores?.category || data.category || [];
        const categoryList = Array.isArray(categories) ? categories : [categories];
        
        for (const cat of categoryList) {
          if (!cat) continue;
          const matches = cat.match || cat.matches || [];
          const matchList = Array.isArray(matches) ? matches : [matches];
          
          for (const match of matchList) {
            if (!match) continue;
            const normalized = normalizeGame(match, sport);
            if (normalized.isLive) {
              games.push(normalized);
            }
          }
        }
        
        liveCache.set(sport, { games, timestamp: now });
        results.games.push(...games);
        results.sports[sport] = games.length;
      } catch (error) {
        console.error(`[LiveServerless] Error fetching ${sport}:`, error.message);
        results.errors.push({ sport, error: error.message });
        
        const cached = liveCache.get(sport);
        if (cached?.games) {
          results.games.push(...cached.games);
          results.sports[sport] = cached.games.length;
        }
      }
    })
  );
  
  return results;
}

export async function fetchLiveGame(gameId, sport = null) {
  const sports = sport ? [sport] : Object.keys(LIVE_ENDPOINTS);
  const results = await fetchLiveGames(sports);
  return results.games.find(g => g.id === gameId || g.id?.toString() === gameId?.toString()) || null;
}

export function getLiveStats() {
  const stats = {
    cachedSports: [],
    totalGames: 0,
    lastUpdates: {}
  };
  
  for (const [sport, data] of liveCache.entries()) {
    stats.cachedSports.push(sport);
    stats.totalGames += data.games?.length || 0;
    stats.lastUpdates[sport] = data.timestamp;
  }
  
  return stats;
}
