const THE_ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';

const DAILY_CREDIT_BUDGET = 50;
const CACHE_DURATION_MS = 10 * 60 * 1000;

const SUPPORTED_SPORTS = {
  basketball_nba: { name: 'NBA', category: 'Basketball', priority: 1 },
  americanfootball_nfl: { name: 'NFL', category: 'Football', priority: 2 },
  basketball_ncaab: { name: 'NCAAB', category: 'Basketball', priority: 3 },
  americanfootball_ncaaf: { name: 'NCAAF', category: 'Football', priority: 4 },
  baseball_mlb: { name: 'MLB', category: 'Baseball', priority: 5 },
  icehockey_nhl: { name: 'NHL', category: 'Hockey', priority: 6 }
};

let creditUsage = {
  date: new Date().toISOString().split('T')[0],
  used: 0,
  remaining: DAILY_CREDIT_BUDGET,
  alerts: []
};

let sportsCache = {};

function getApiKey() {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('THE_ODDS_API_KEY not configured');
  }
  return apiKey;
}

function resetDailyBudgetIfNeeded() {
  const today = new Date().toISOString().split('T')[0];
  if (creditUsage.date !== today) {
    creditUsage = {
      date: today,
      used: 0,
      remaining: DAILY_CREDIT_BUDGET,
      alerts: []
    };
  }
}

function updateCreditUsage(requestsUsed) {
  resetDailyBudgetIfNeeded();
  creditUsage.used += requestsUsed;
  creditUsage.remaining = DAILY_CREDIT_BUDGET - creditUsage.used;
  
  const percentUsed = (creditUsage.used / DAILY_CREDIT_BUDGET) * 100;
  
  if (percentUsed >= 90 && !creditUsage.alerts.includes('90%')) {
    creditUsage.alerts.push('90%');
    console.warn(`[CREDIT ALERT] 90% of daily budget used (${creditUsage.used}/${DAILY_CREDIT_BUDGET})`);
  } else if (percentUsed >= 70 && !creditUsage.alerts.includes('70%')) {
    creditUsage.alerts.push('70%');
    console.warn(`[CREDIT ALERT] 70% of daily budget used (${creditUsage.used}/${DAILY_CREDIT_BUDGET})`);
  }
  
  return creditUsage;
}

function getCreditStatus() {
  resetDailyBudgetIfNeeded();
  return {
    ...creditUsage,
    budget: DAILY_CREDIT_BUDGET,
    percentUsed: Math.round((creditUsage.used / DAILY_CREDIT_BUDGET) * 100)
  };
}

function canMakeRequest(estimatedCost = 1) {
  resetDailyBudgetIfNeeded();
  return creditUsage.remaining >= estimatedCost;
}

function formatGameTime(dateTime) {
  if (!dateTime) return 'TBD';
  const date = new Date(dateTime);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    timeZone: 'America/New_York'
  }) + ' ET';
}

function getTeamAbbreviation(teamName, sport) {
  const abbreviations = {
    'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
    'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
    'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
    'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
    'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL',
    'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL',
    'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK',
    'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI',
    'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC',
    'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA',
    'Washington Wizards': 'WAS',
    'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL',
    'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI',
    'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL',
    'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
    'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX',
    'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
    'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN',
    'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
    'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT',
    'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB',
    'Tennessee Titans': 'TEN', 'Washington Commanders': 'WAS',
    'Anaheim Ducks': 'ANA', 'Boston Bruins': 'BOS', 'Buffalo Sabres': 'BUF',
    'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR', 'Chicago Blackhawks': 'CHI',
    'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ', 'Dallas Stars': 'DAL',
    'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM', 'Florida Panthers': 'FLA',
    'Los Angeles Kings': 'LAK', 'Minnesota Wild': 'MIN', 'Montreal Canadiens': 'MTL',
    'Nashville Predators': 'NSH', 'New Jersey Devils': 'NJD', 'New York Islanders': 'NYI',
    'New York Rangers': 'NYR', 'Ottawa Senators': 'OTT', 'Philadelphia Flyers': 'PHI',
    'Pittsburgh Penguins': 'PIT', 'San Jose Sharks': 'SJS', 'Seattle Kraken': 'SEA',
    'St. Louis Blues': 'STL', 'Tampa Bay Lightning': 'TBL', 'Toronto Maple Leafs': 'TOR',
    'Utah Hockey Club': 'UTA', 'Vancouver Canucks': 'VAN', 'Vegas Golden Knights': 'VGK',
    'Washington Capitals': 'WSH', 'Winnipeg Jets': 'WPG'
  };
  return abbreviations[teamName] || teamName.substring(0, 3).toUpperCase();
}

function selectWorstJuice(bookmakers, marketKey, homeTeam, awayTeam) {
  const allOutcomes = { home: [], away: [], over: [], under: [] };
  
  for (const bookmaker of bookmakers || []) {
    const market = bookmaker.markets?.find(m => m.key === marketKey);
    if (!market?.outcomes) continue;
    
    for (const outcome of market.outcomes) {
      if (marketKey === 'spreads' || marketKey === 'h2h') {
        if (outcome.name === homeTeam) {
          allOutcomes.home.push({ ...outcome, bookmaker: bookmaker.title });
        } else if (outcome.name === awayTeam) {
          allOutcomes.away.push({ ...outcome, bookmaker: bookmaker.title });
        }
      } else if (marketKey === 'totals') {
        if (outcome.name === 'Over') {
          allOutcomes.over.push({ ...outcome, bookmaker: bookmaker.title });
        } else if (outcome.name === 'Under') {
          allOutcomes.under.push({ ...outcome, bookmaker: bookmaker.title });
        }
      }
    }
  }
  
  function getWorstOdds(outcomes) {
    if (outcomes.length === 0) return null;
    return outcomes.reduce((worst, current) => {
      if (current.price < worst.price) return current;
      return worst;
    });
  }
  
  return {
    home: getWorstOdds(allOutcomes.home),
    away: getWorstOdds(allOutcomes.away),
    over: getWorstOdds(allOutcomes.over),
    under: getWorstOdds(allOutcomes.under)
  };
}

function transformGame(game, sportKey) {
  const sportInfo = SUPPORTED_SPORTS[sportKey] || { name: sportKey, category: 'Other' };
  
  const spreads = selectWorstJuice(game.bookmakers, 'spreads', game.home_team, game.away_team);
  const totals = selectWorstJuice(game.bookmakers, 'totals', game.home_team, game.away_team);
  const moneylines = selectWorstJuice(game.bookmakers, 'h2h', game.home_team, game.away_team);

  const formatSpread = (point) => {
    if (point == null) return '+0';
    return point > 0 ? `+${point}` : `${point}`;
  };

  return {
    id: game.id,
    sport: sportKey,
    sportName: sportInfo.name,
    category: sportInfo.category,
    awayTeam: getTeamAbbreviation(game.away_team, sportKey),
    homeTeam: getTeamAbbreviation(game.home_team, sportKey),
    awayTeamFull: game.away_team,
    homeTeamFull: game.home_team,
    time: formatGameTime(game.commence_time),
    startTime: game.commence_time,
    awayScore: 0,
    homeScore: 0,
    quarter: '',
    isLive: false,
    isCompleted: false,
    status: 'SCHEDULED',
    lines: {
      spread: {
        away: { 
          point: formatSpread(spreads.away?.point), 
          odds: spreads.away?.price || -110,
          source: spreads.away?.bookmaker || 'default'
        },
        home: { 
          point: formatSpread(spreads.home?.point), 
          odds: spreads.home?.price || -110,
          source: spreads.home?.bookmaker || 'default'
        }
      },
      total: {
        over: { 
          point: totals.over?.point ? `O ${totals.over.point}` : 'O 220.5', 
          odds: totals.over?.price || -110,
          source: totals.over?.bookmaker || 'default'
        },
        under: { 
          point: totals.under?.point ? `U ${totals.under.point}` : 'U 220.5', 
          odds: totals.under?.price || -110,
          source: totals.under?.bookmaker || 'default'
        }
      },
      moneyline: { 
        away: moneylines.away?.price || 150,
        home: moneylines.home?.price || -170,
        awaySource: moneylines.away?.bookmaker || 'default',
        homeSource: moneylines.home?.bookmaker || 'default'
      }
    }
  };
}

async function fetchSportOdds(sportKey) {
  const cacheKey = sportKey;
  const cached = sportsCache[cacheKey];
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
    console.log(`[CACHE HIT] ${sportKey} - ${Math.round((Date.now() - cached.timestamp) / 1000)}s old`);
    return { games: cached.games, fromCache: true, debugInfo: cached.debugInfo };
  }
  
  if (!canMakeRequest(1)) {
    console.warn(`[BUDGET EXCEEDED] Cannot fetch ${sportKey} - daily budget exhausted`);
    if (cached) {
      return { games: cached.games, fromCache: true, budgetExceeded: true, debugInfo: cached.debugInfo };
    }
    return { games: [], fromCache: false, budgetExceeded: true, debugInfo: { error: 'Daily budget exceeded' } };
  }
  
  const apiKey = getApiKey();
  const url = `${THE_ODDS_API_BASE_URL}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us&markets=spreads,totals,h2h&oddsFormat=american`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`The Odds API error for ${sportKey}:`, response.status, errorText);
      if (cached) {
        return { games: cached.games, fromCache: true, error: `API error: ${response.status}`, debugInfo: cached.debugInfo };
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const remainingRequests = parseInt(response.headers.get('x-requests-remaining') || '0');
    const usedRequests = parseInt(response.headers.get('x-requests-used') || '0');
    console.log(`[API] ${sportKey}: ${remainingRequests} requests remaining, ${usedRequests} used total`);
    
    updateCreditUsage(1);
    
    const data = await response.json();
    
    const now = new Date();
    const upcomingGames = data.filter(game => {
      const gameTime = new Date(game.commence_time);
      return gameTime > now;
    });
    
    upcomingGames.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));
    
    const games = upcomingGames.map(game => transformGame(game, sportKey));
    
    const debugInfo = {
      source: 'the-odds-api',
      sport: sportKey,
      totalGames: data.length,
      upcomingGames: upcomingGames.length,
      bookmakersSample: data[0]?.bookmakers?.map(b => b.title) || [],
      fetchedAt: new Date().toISOString()
    };
    
    sportsCache[cacheKey] = {
      games,
      timestamp: Date.now(),
      debugInfo
    };
    
    return { games, fromCache: false, debugInfo };
  } catch (error) {
    console.error(`Error fetching ${sportKey}:`, error);
    if (cached) {
      return { games: cached.games, fromCache: true, error: error.message, debugInfo: cached.debugInfo };
    }
    throw error;
  }
}

async function fetchAllSportsOdds() {
  const results = {};
  const allGames = [];
  let totalFromCache = 0;
  let totalFresh = 0;
  
  for (const sportKey of Object.keys(SUPPORTED_SPORTS)) {
    try {
      const result = await fetchSportOdds(sportKey);
      results[sportKey] = {
        games: result.games,
        fromCache: result.fromCache,
        count: result.games.length
      };
      allGames.push(...result.games);
      
      if (result.fromCache) totalFromCache++;
      else totalFresh++;
      
      if (!result.fromCache && !result.budgetExceeded) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Failed to fetch ${sportKey}:`, error.message);
      results[sportKey] = { games: [], error: error.message, count: 0 };
    }
  }
  
  allGames.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  
  return {
    games: allGames,
    bySport: results,
    creditStatus: getCreditStatus(),
    debugInfo: {
      source: 'the-odds-api',
      totalGames: allGames.length,
      sportsFromCache: totalFromCache,
      sportsFreshFetch: totalFresh,
      fetchedAt: new Date().toISOString()
    }
  };
}

async function fetchUpcomingGames(sportKey = null) {
  if (sportKey && SUPPORTED_SPORTS[sportKey]) {
    return await fetchSportOdds(sportKey);
  }
  return await fetchAllSportsOdds();
}

function getSupportedSports() {
  return SUPPORTED_SPORTS;
}

function getCacheStatus() {
  const status = {};
  for (const [key, cached] of Object.entries(sportsCache)) {
    status[key] = {
      cached: true,
      age: Math.round((Date.now() - cached.timestamp) / 1000),
      gamesCount: cached.games.length,
      expiresIn: Math.max(0, Math.round((CACHE_DURATION_MS - (Date.now() - cached.timestamp)) / 1000))
    };
  }
  return status;
}

function clearCache(sportKey = null) {
  if (sportKey) {
    delete sportsCache[sportKey];
  } else {
    sportsCache = {};
  }
}

module.exports = {
  fetchSportOdds,
  fetchAllSportsOdds,
  fetchUpcomingGames,
  getSupportedSports,
  getCreditStatus,
  getCacheStatus,
  clearCache,
  canMakeRequest,
  SUPPORTED_SPORTS,
  DAILY_CREDIT_BUDGET,
  CACHE_DURATION_MS
};
