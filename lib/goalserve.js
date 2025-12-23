const GOALSERVE_BASE_URL = 'https://www.goalserve.com/getfeed';

const CACHE_DURATION_MS = 5 * 1000;

function decimalToAmerican(decimal) {
  if (!decimal || decimal <= 1) return '0';
  if (decimal >= 2) {
    return '+' + Math.round((decimal - 1) * 100);
  } else {
    return '-' + Math.round(100 / (decimal - 1));
  }
}

const SUPPORTED_SPORTS = {
  basketball_nba: { 
    name: 'NBA', 
    category: 'Basketball', 
    priority: 1,
    endpoints: {
      scores: 'bsktbl/nba-scores',
      schedule: 'bsktbl/nba-shedule',
      playbyplay: 'bsktbl/nba-playbyplay',
      standings: 'bsktbl/nba-standings'
    }
  },
  americanfootball_nfl: { 
    name: 'NFL', 
    category: 'Football', 
    priority: 2,
    endpoints: {
      scores: 'football/nfl-scores',
      schedule: 'football/nfl-shedule',
      playbyplay: 'football/nfl-playbyplay-scores',
      standings: 'football/nfl-standings'
    }
  },
  basketball_ncaab: { 
    name: 'NCAAB', 
    category: 'Basketball', 
    priority: 3,
    endpoints: {
      scores: 'bsktbl/ncaa-scores',
      schedule: 'bsktbl/ncaa-shedule',
      playbyplay: 'bsktbl/ncaa-playbyplay',
      standings: 'bsktbl/ncaa-standings'
    }
  },
  americanfootball_ncaaf: { 
    name: 'NCAAF', 
    category: 'Football', 
    priority: 4,
    endpoints: {
      scores: 'football/fbs-scores',
      schedule: 'football/fbs-shedule',
      playbyplay: 'football/fbs-playbyplay-scores',
      standings: 'football/fbs-standings'
    }
  },
  baseball_mlb: { 
    name: 'MLB', 
    category: 'Baseball', 
    priority: 5,
    endpoints: {
      scores: 'baseball/mlb-scores',
      schedule: 'baseball/mlb_shedule',
      playbyplay: 'baseball/mlb-playbyplay',
      standings: 'baseball/mlb_standings'
    }
  },
  icehockey_nhl: { 
    name: 'NHL', 
    category: 'Hockey', 
    priority: 6,
    endpoints: {
      scores: 'hockey/nhl-scores',
      schedule: 'hockey/nhl-shedule',
      playbyplay: 'hockey/nhl-playbyplay',
      standings: 'hockey/nhl-standings'
    }
  }
};

let sportsCache = {};

function getApiKey() {
  const apiKey = process.env.GOALSERVE_API_KEY;
  if (!apiKey) {
    throw new Error('GOALSERVE_API_KEY not configured');
  }
  return apiKey;
}

function formatDateForApi(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatGameTime(timeStr, dateStr) {
  if (!timeStr) return 'TBD';
  return timeStr + ' ET';
}

function parseGoalserveDate(datetimeUtc) {
  if (!datetimeUtc) return null;
  try {
    const parts = datetimeUtc.split(' ');
    const dateParts = parts[0].split('.');
    const timeParts = parts[1] ? parts[1].split(':') : ['00', '00'];
    const day = dateParts[0].padStart(2, '0');
    const month = dateParts[1].padStart(2, '0');
    const year = dateParts[2];
    const hour = timeParts[0].padStart(2, '0');
    const minute = timeParts[1].padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
  } catch (error) {
    console.error('[Goalserve] Error parsing date:', datetimeUtc, error);
    return null;
  }
}

function getTeamAbbreviation(teamName) {
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

async function fetchFromGoalserve(endpoint, params = {}) {
  const apiKey = getApiKey();
  let url = `${GOALSERVE_BASE_URL}/${apiKey}/${endpoint}?json=1`;
  
  Object.entries(params).forEach(([key, value]) => {
    url += `&${key}=${encodeURIComponent(value)}`;
  });

  console.log(`[Goalserve] Fetching: ${endpoint}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Goalserve API error: ${response.status}`);
  }
  
  return response.json();
}

function parseGoalserveGame(match, sportKey) {
  const sportInfo = SUPPORTED_SPORTS[sportKey];
  const isLive = match.status && !['Not Started', 'Final', 'Postponed', 'Cancelled'].includes(match.status);
  const isCompleted = match.status === 'Final';
  
  const homeTeam = match.hometeam;
  const awayTeam = match.awayteam;
  
  return {
    id: match.id,
    sport_key: sportKey,
    sport_title: sportInfo.name,
    commence_time: parseGoalserveDate(match.datetime_utc),
    home_team: homeTeam.name,
    away_team: awayTeam.name,
    home_team_abbr: getTeamAbbreviation(homeTeam.name),
    away_team_abbr: getTeamAbbreviation(awayTeam.name),
    home_team_id: homeTeam.id,
    away_team_id: awayTeam.id,
    status: match.status || 'Not Started',
    isLive,
    isCompleted,
    timer: match.timer || null,
    venue: match.venue_name || null,
    scores: {
      home: {
        total: parseInt(homeTeam.totalscore) || 0,
        q1: parseInt(homeTeam.q1) || 0,
        q2: parseInt(homeTeam.q2) || 0,
        q3: parseInt(homeTeam.q3) || 0,
        q4: parseInt(homeTeam.q4) || 0,
        ot: parseInt(homeTeam.ot) || 0
      },
      away: {
        total: parseInt(awayTeam.totalscore) || 0,
        q1: parseInt(awayTeam.q1) || 0,
        q2: parseInt(awayTeam.q2) || 0,
        q3: parseInt(awayTeam.q3) || 0,
        q4: parseInt(awayTeam.q4) || 0,
        ot: parseInt(awayTeam.ot) || 0
      }
    },
    possession: {
      home: homeTeam.posession === 'True',
      away: awayTeam.posession === 'True'
    },
    formatted_time: formatGameTime(match.time, match.date)
  };
}

function parseGoalserveOdds(match, sportKey) {
  const game = parseGoalserveGame(match, sportKey);
  
  if (!match.odds || !match.odds.type) {
    return { ...game, odds: null };
  }
  
  const oddsData = {
    moneyline: null,
    spread: null,
    total: null,
    bookmakers: []
  };
  
  const types = Array.isArray(match.odds.type) ? match.odds.type : [match.odds.type];
  
  types.forEach(type => {
    const bookmakers = Array.isArray(type.bookmaker) ? type.bookmaker : [type.bookmaker];
    
    bookmakers.forEach(bm => {
      if (!bm) return;
      
      const bookmaker = {
        name: bm.name,
        id: bm.id
      };
      
      const odds = Array.isArray(bm.odd) ? bm.odd : [bm.odd];
      
      if (type.value === 'Home/Away' || type.id === '1') {
        odds.forEach(odd => {
          if (!odd) return;
          if (odd.name === '1') {
            bookmaker.home_ml = {
              price: parseFloat(odd.value),
              us: odd.us
            };
          } else if (odd.name === '2') {
            bookmaker.away_ml = {
              price: parseFloat(odd.value),
              us: odd.us
            };
          }
        });
        if (!oddsData.moneyline) oddsData.moneyline = [];
        oddsData.moneyline.push(bookmaker);
      }
      
      const isSpreadType = type.value === 'Asian Handicap' || type.value === 'Spread' || 
        type.value === 'Point Spread' || type.value === 'Puck Line' || type.value === 'Run Line' ||
        type.value === 'Handicap' || 
        type.id === '4' || type.id === '23679';
      
      if (isSpreadType) {
        const handicaps = type.handicap || bm.handicap;
        if (handicaps) {
          const handicapArr = Array.isArray(handicaps) ? handicaps : [handicaps];
          const mainHandicap = handicapArr.find(h => h && h.main === '1') || handicapArr[0];
          
          if (mainHandicap && mainHandicap.odd) {
            const oddArray = Array.isArray(mainHandicap.odd) ? mainHandicap.odd : [mainHandicap.odd];
            const spreadVal = parseFloat(mainHandicap.name?.match(/[+-]?\d+\.?\d*/)?.[0] || 0);
            
            oddArray.forEach(odd => {
              if (!odd) return;
              const oddName = odd.name || odd.handicap || '';
              const isHomeTeam = oddName.toLowerCase().includes('home') || 
                                 odd.name === '1' ||
                                 (match.hometeam?.name && oddName.includes(match.hometeam.name));
              const isAwayTeam = oddName.toLowerCase().includes('away') || 
                                 odd.name === '2' ||
                                 (match.awayteam?.name && oddName.includes(match.awayteam.name));
              
              const decimalOdds = parseFloat(odd.value) || null;
              const usOdds = odd.us || (decimalOdds ? decimalToAmerican(decimalOdds) : null);
              
              if (isHomeTeam) {
                bookmaker.home_spread = {
                  point: spreadVal,
                  price: decimalOdds,
                  us: usOdds
                };
              } else if (isAwayTeam) {
                bookmaker.away_spread = {
                  point: -spreadVal,
                  price: decimalOdds,
                  us: usOdds
                };
              } else if (!bookmaker.home_spread) {
                bookmaker.home_spread = {
                  point: spreadVal,
                  price: decimalOdds,
                  us: usOdds
                };
              } else if (!bookmaker.away_spread) {
                bookmaker.away_spread = {
                  point: -spreadVal,
                  price: decimalOdds,
                  us: usOdds
                };
              }
            });
          }
          
          if (bookmaker.home_spread || bookmaker.away_spread) {
            if (!oddsData.spread) oddsData.spread = [];
            oddsData.spread.push(bookmaker);
          }
        } else {
          odds.forEach(odd => {
            if (!odd) return;
            if (odd.name === '1' || odd.name === 'Home') {
              bookmaker.home_spread = {
                point: parseFloat(odd.handicap || 0),
                price: parseFloat(odd.value),
                us: odd.us
              };
            } else if (odd.name === '2' || odd.name === 'Away') {
              bookmaker.away_spread = {
                point: parseFloat(odd.handicap || 0) * -1,
                price: parseFloat(odd.value),
                us: odd.us
              };
            }
          });
          if (bookmaker.home_spread || bookmaker.away_spread) {
            if (!oddsData.spread) oddsData.spread = [];
            oddsData.spread.push(bookmaker);
          }
        }
      }
      
      const isTotalType = type.value === 'Over/Under' || type.value === 'Total' || 
        type.value === 'Total Goals' || type.value === 'Total Points' ||
        type.id === '3' || type.id === '5';
      
      if (isTotalType) {
        if (type.total || type.line) {
          const totals = type.total ? (Array.isArray(type.total) ? type.total : [type.total]) :
                         type.line ? (Array.isArray(type.line) ? type.line : [type.line]) : [];
          const mainLine = totals.find(t => t && t.ismain === '1') || totals[0];
          if (mainLine) {
            const lineOdds = Array.isArray(mainLine.odd) ? mainLine.odd : [mainLine.odd];
            lineOdds.forEach(odd => {
              if (!odd) return;
              if (odd.name === 'Over') {
                bookmaker.over = {
                  point: parseFloat(mainLine.name),
                  price: parseFloat(odd.value),
                  us: odd.us
                };
              } else if (odd.name === 'Under') {
                bookmaker.under = {
                  point: parseFloat(mainLine.name),
                  price: parseFloat(odd.value),
                  us: odd.us
                };
              }
            });
            if (!oddsData.total) oddsData.total = [];
            oddsData.total.push(bookmaker);
          }
        } else if (bm.total && typeof bm.total === 'object') {
          const totalLine = parseFloat(bm.total.name) || 0;
          const totalOdds = Array.isArray(bm.total.odd) ? bm.total.odd : [bm.total.odd];
          totalOdds.forEach(odd => {
            if (!odd) return;
            if (odd.name === 'Over') {
              bookmaker.over = {
                point: totalLine,
                price: parseFloat(odd.value),
                us: odd.us
              };
            } else if (odd.name === 'Under') {
              bookmaker.under = {
                point: totalLine,
                price: parseFloat(odd.value),
                us: odd.us
              };
            }
          });
          if (bookmaker.over || bookmaker.under) {
            if (!oddsData.total) oddsData.total = [];
            oddsData.total.push(bookmaker);
          }
        } else if (bm.total && (bm.o || bm.u)) {
          const totalLine = parseFloat(bm.total);
          if (bm.o) {
            bookmaker.over = {
              point: totalLine,
              price: parseFloat(bm.o),
              us: decimalToAmerican(parseFloat(bm.o))
            };
          }
          if (bm.u) {
            bookmaker.under = {
              point: totalLine,
              price: parseFloat(bm.u),
              us: decimalToAmerican(parseFloat(bm.u))
            };
          }
          if (bookmaker.over || bookmaker.under) {
            if (!oddsData.total) oddsData.total = [];
            oddsData.total.push(bookmaker);
          }
        } else {
          odds.forEach(odd => {
            if (!odd) return;
            if (odd.name === 'Over') {
              bookmaker.over = {
                point: parseFloat(odd.handicap || 0),
                price: parseFloat(odd.value),
                us: odd.us
              };
            } else if (odd.name === 'Under') {
              bookmaker.under = {
                point: parseFloat(odd.handicap || 0),
                price: parseFloat(odd.value),
                us: odd.us
              };
            }
          });
          if (bookmaker.over || bookmaker.under) {
            if (!oddsData.total) oddsData.total = [];
            oddsData.total.push(bookmaker);
          }
        }
      }
    });
  });
  
  return { ...game, odds: oddsData };
}

function parsePlayByPlay(match, sportKey) {
  const game = parseGoalserveGame(match, sportKey);
  
  if (!match.playbyplay || !match.playbyplay.play) {
    return { ...game, plays: [] };
  }
  
  const plays = Array.isArray(match.playbyplay.play) ? match.playbyplay.play : [match.playbyplay.play];
  
  const parsedPlays = plays.map(play => ({
    time: play.time,
    period: play.period,
    type: play.type,
    description: play.description,
    team: play.team,
    isScoring: play.isScoringPlay === 'True',
    isShooting: play.isShootingPlay === 'True',
    homeScore: parseInt(play.localscore) || 0,
    awayScore: parseInt(play.awayscore) || 0,
    playerId: play.pl_id1,
    assistPlayerId: play.pl_id2,
    x: play.x !== '-214748340' ? parseInt(play.x) : null,
    y: play.y !== '-214748365' ? parseInt(play.y) : null,
    timestamp: play.timestamp
  }));
  
  return { ...game, plays: parsedPlays };
}

async function getScores(sportKey) {
  const cacheKey = `scores_${sportKey}`;
  const cached = sportsCache[cacheKey];
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[Goalserve] Using cached scores for ${sportKey}`);
    return cached.data;
  }
  
  const sportInfo = SUPPORTED_SPORTS[sportKey];
  if (!sportInfo) {
    throw new Error(`Unsupported sport: ${sportKey}`);
  }
  
  try {
    const data = await fetchFromGoalserve(sportInfo.endpoints.scores);
    
    let matches = [];
    if (data.scores && data.scores.category) {
      const category = data.scores.category;
      matches = Array.isArray(category.match) ? category.match : [category.match];
    }
    
    const games = matches.filter(m => m).map(m => parseGoalserveGame(m, sportKey));
    
    sportsCache[cacheKey] = {
      timestamp: Date.now(),
      data: games
    };
    
    return games;
  } catch (error) {
    console.error(`[Goalserve] Error fetching scores for ${sportKey}:`, error);
    throw error;
  }
}

async function getOdds(sportKey, date1 = null, date2 = null) {
  const today = formatDateForApi(new Date());
  const tomorrow = formatDateForApi(new Date(Date.now() + 86400000));
  
  const startDate = date1 || today;
  const endDate = date2 || tomorrow;
  
  const cacheKey = `odds_${sportKey}_${startDate}_${endDate}`;
  const cached = sportsCache[cacheKey];
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[Goalserve] Using cached odds for ${sportKey}`);
    return cached.data;
  }
  
  const sportInfo = SUPPORTED_SPORTS[sportKey];
  if (!sportInfo) {
    throw new Error(`Unsupported sport: ${sportKey}`);
  }
  
  try {
    const data = await fetchFromGoalserve(sportInfo.endpoints.schedule, {
      date1: startDate,
      date2: endDate,
      showodds: '1'
    });
    
    let matches = [];
    if (data.shedules && data.shedules.matches) {
      const matchesData = data.shedules.matches;
      if (Array.isArray(matchesData)) {
        matchesData.forEach(md => {
          const dayMatches = Array.isArray(md.match) ? md.match : [md.match];
          matches.push(...dayMatches.filter(m => m));
        });
      } else {
        matches = Array.isArray(matchesData.match) ? matchesData.match : [matchesData.match];
        matches = matches.filter(m => m);
      }
    }
    
    const games = matches.map(m => parseGoalserveOdds(m, sportKey));
    
    sportsCache[cacheKey] = {
      timestamp: Date.now(),
      data: games
    };
    
    return games;
  } catch (error) {
    console.error(`[Goalserve] Error fetching odds for ${sportKey}:`, error);
    throw error;
  }
}

async function getPlayByPlay(sportKey, gameId = null) {
  const sportInfo = SUPPORTED_SPORTS[sportKey];
  if (!sportInfo) {
    throw new Error(`Unsupported sport: ${sportKey}`);
  }
  
  try {
    const data = await fetchFromGoalserve(sportInfo.endpoints.playbyplay);
    
    let matches = [];
    if (data.scores && data.scores.category) {
      const category = data.scores.category;
      matches = Array.isArray(category.match) ? category.match : [category.match];
    }
    
    if (gameId) {
      const match = matches.find(m => m && m.id === gameId);
      if (match) {
        return parsePlayByPlay(match, sportKey);
      }
      return null;
    }
    
    return matches.filter(m => m).map(m => parsePlayByPlay(m, sportKey));
  } catch (error) {
    console.error(`[Goalserve] Error fetching play-by-play for ${sportKey}:`, error);
    throw error;
  }
}

async function getHistoricalPlayByPlay(sportKey, date) {
  const sportInfo = SUPPORTED_SPORTS[sportKey];
  if (!sportInfo) {
    throw new Error(`Unsupported sport: ${sportKey}`);
  }
  
  const formattedDate = formatDateForApi(new Date(date));
  
  try {
    const data = await fetchFromGoalserve(sportInfo.endpoints.scores, {
      date: `${formattedDate}_pbp`
    });
    
    let matches = [];
    if (data.scores && data.scores.category) {
      const category = data.scores.category;
      matches = Array.isArray(category.match) ? category.match : [category.match];
    }
    
    return matches.filter(m => m).map(m => parsePlayByPlay(m, sportKey));
  } catch (error) {
    console.error(`[Goalserve] Error fetching historical play-by-play:`, error);
    throw error;
  }
}

async function getAllGamesWithOdds() {
  const today = formatDateForApi(new Date());
  const tomorrow = formatDateForApi(new Date(Date.now() + 86400000));
  
  // Fetch all sports in parallel for much faster loading
  const sportEntries = Object.entries(SUPPORTED_SPORTS);
  const results = await Promise.allSettled(
    sportEntries.map(async ([sportKey]) => {
      try {
        return await getOdds(sportKey, today, tomorrow);
      } catch (error) {
        console.error(`[Goalserve] Error fetching ${sportKey}:`, error.message);
        return [];
      }
    })
  );
  
  // Combine all successful results
  const allGames = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value || []);
  
  return allGames.sort((a, b) => {
    const aPriority = SUPPORTED_SPORTS[a.sport_key]?.priority || 99;
    const bPriority = SUPPORTED_SPORTS[b.sport_key]?.priority || 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(a.commence_time) - new Date(b.commence_time);
  });
}

async function getLiveGames() {
  // Fetch all sports in parallel for faster loading
  const sportKeys = Object.keys(SUPPORTED_SPORTS);
  const results = await Promise.allSettled(
    sportKeys.map(async (sportKey) => {
      try {
        const games = await getScores(sportKey);
        return games.filter(g => g.isLive);
      } catch (error) {
        console.error(`[Goalserve] Error fetching live ${sportKey}:`, error.message);
        return [];
      }
    })
  );
  
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value || []);
}

function clearCache() {
  sportsCache = {};
  console.log('[Goalserve] Cache cleared');
}

function getSupportedSports() {
  return Object.entries(SUPPORTED_SPORTS).map(([key, info]) => ({
    key,
    name: info.name,
    category: info.category,
    priority: info.priority
  }));
}

module.exports = {
  getScores,
  getOdds,
  getPlayByPlay,
  getHistoricalPlayByPlay,
  getAllGamesWithOdds,
  getLiveGames,
  getSupportedSports,
  clearCache,
  SUPPORTED_SPORTS
};
