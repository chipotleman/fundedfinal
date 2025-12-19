const THE_ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';

function getApiKey() {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('THE_ODDS_API_KEY not configured');
  }
  return apiKey;
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

function getTeamAbbreviation(teamName) {
  const abbreviations = {
    'Atlanta Hawks': 'ATL',
    'Boston Celtics': 'BOS',
    'Brooklyn Nets': 'BKN',
    'Charlotte Hornets': 'CHA',
    'Chicago Bulls': 'CHI',
    'Cleveland Cavaliers': 'CLE',
    'Dallas Mavericks': 'DAL',
    'Denver Nuggets': 'DEN',
    'Detroit Pistons': 'DET',
    'Golden State Warriors': 'GSW',
    'Houston Rockets': 'HOU',
    'Indiana Pacers': 'IND',
    'LA Clippers': 'LAC',
    'Los Angeles Clippers': 'LAC',
    'Los Angeles Lakers': 'LAL',
    'Memphis Grizzlies': 'MEM',
    'Miami Heat': 'MIA',
    'Milwaukee Bucks': 'MIL',
    'Minnesota Timberwolves': 'MIN',
    'New Orleans Pelicans': 'NOP',
    'New York Knicks': 'NYK',
    'Oklahoma City Thunder': 'OKC',
    'Orlando Magic': 'ORL',
    'Philadelphia 76ers': 'PHI',
    'Phoenix Suns': 'PHX',
    'Portland Trail Blazers': 'POR',
    'Sacramento Kings': 'SAC',
    'San Antonio Spurs': 'SAS',
    'Toronto Raptors': 'TOR',
    'Utah Jazz': 'UTA',
    'Washington Wizards': 'WAS'
  };
  return abbreviations[teamName] || teamName.substring(0, 3).toUpperCase();
}

function extractBestOdds(bookmakers, marketKey) {
  if (!bookmakers || bookmakers.length === 0) return null;
  
  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets?.find(m => m.key === marketKey);
    if (market && market.outcomes) {
      return market.outcomes;
    }
  }
  return null;
}

function transformGame(game) {
  const spreadsOutcomes = extractBestOdds(game.bookmakers, 'spreads');
  const totalsOutcomes = extractBestOdds(game.bookmakers, 'totals');
  const h2hOutcomes = extractBestOdds(game.bookmakers, 'h2h');
  
  const homeSpread = spreadsOutcomes?.find(o => o.name === game.home_team);
  const awaySpread = spreadsOutcomes?.find(o => o.name === game.away_team);
  const overTotal = totalsOutcomes?.find(o => o.name === 'Over');
  const underTotal = totalsOutcomes?.find(o => o.name === 'Under');
  const homeML = h2hOutcomes?.find(o => o.name === game.home_team);
  const awayML = h2hOutcomes?.find(o => o.name === game.away_team);

  const formatSpread = (point) => {
    if (point == null) return '+0';
    return point > 0 ? `+${point}` : `${point}`;
  };

  return {
    id: game.id,
    awayTeam: getTeamAbbreviation(game.away_team),
    homeTeam: getTeamAbbreviation(game.home_team),
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
          point: formatSpread(awaySpread?.point), 
          odds: awaySpread?.price || -110 
        },
        home: { 
          point: formatSpread(homeSpread?.point), 
          odds: homeSpread?.price || -110 
        }
      },
      total: {
        over: { 
          point: overTotal?.point ? `O ${overTotal.point}` : 'O 220.5', 
          odds: overTotal?.price || -110 
        },
        under: { 
          point: underTotal?.point ? `U ${underTotal.point}` : 'U 220.5', 
          odds: underTotal?.price || -110 
        }
      },
      moneyline: { 
        away: awayML?.price || 150, 
        home: homeML?.price || -170 
      }
    }
  };
}

async function fetchNBAOdds() {
  const apiKey = getApiKey();
  const url = `${THE_ODDS_API_BASE_URL}/sports/basketball_nba/odds?apiKey=${apiKey}&regions=us&markets=spreads,totals,h2h&oddsFormat=american`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('The Odds API error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }
    
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');
    console.log(`The Odds API: ${remainingRequests} requests remaining, ${usedRequests} used`);
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching The Odds API:', error);
    throw error;
  }
}

async function fetchUpcomingNBAGames() {
  const rawGames = await fetchNBAOdds();
  
  const now = new Date();
  const upcomingGames = rawGames.filter(game => {
    const gameTime = new Date(game.commence_time);
    return gameTime > now;
  });
  
  upcomingGames.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));
  
  const games = upcomingGames.map(transformGame);
  
  const debugInfo = {
    source: 'the-odds-api',
    totalGames: rawGames.length,
    upcomingGames: upcomingGames.length,
    bookmakersSample: rawGames[0]?.bookmakers?.map(b => b.title) || []
  };
  
  return { games, debugInfo };
}

async function fetchNBAGames() {
  const { games } = await fetchUpcomingNBAGames();
  return games;
}

module.exports = {
  fetchNBAGames,
  fetchUpcomingNBAGames,
  fetchNBAOdds
};
