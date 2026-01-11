const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

const NFL_SPORT_KEY = 'americanfootball_nfl';

const oddsCache = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION_MS = 30000;

function getApiKey() {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) {
    throw new Error('THE_ODDS_API_KEY not configured');
  }
  return apiKey;
}

function convertAmericanOdds(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 0) return null;
  
  if (decimalOdds >= 2.0) {
    return Math.round((decimalOdds - 1) * 100);
  } else {
    return Math.round(-100 / (decimalOdds - 1));
  }
}

function parseOddsValue(value) {
  if (value === undefined || value === null) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

export async function getNflOdds() {
  const now = Date.now();
  
  if (oddsCache.data && (now - oddsCache.timestamp) < CACHE_DURATION_MS) {
    console.log('[Odds API] Using cached NFL odds');
    return oddsCache.data;
  }
  
  try {
    const apiKey = getApiKey();
    const url = `${ODDS_API_BASE}/sports/${NFL_SPORT_KEY}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
    
    console.log('[Odds API] Fetching NFL odds from The Odds API...');
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`[Odds API] Error: HTTP ${response.status}`, text.substring(0, 200));
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
    }
    
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');
    console.log(`[Odds API] Requests used: ${usedRequests}, remaining: ${remainingRequests}`);
    
    const data = await response.json();
    
    const formattedOdds = formatOddsData(data);
    
    oddsCache.data = formattedOdds;
    oddsCache.timestamp = now;
    
    console.log(`[Odds API] Fetched ${formattedOdds.length} NFL games with odds`);
    
    return formattedOdds;
  } catch (error) {
    console.error('[Odds API] Error fetching NFL odds:', error.message);
    return oddsCache.data || [];
  }
}

function formatOddsData(events) {
  if (!Array.isArray(events)) return [];
  
  return events.map(event => {
    const bookmakers = event.bookmakers || [];
    
    const primaryBookmaker = bookmakers.find(b => 
      b.key === 'draftkings' || b.key === 'fanduel' || b.key === 'betmgm'
    ) || bookmakers[0];
    
    let lines = null;
    let allBookmakerOdds = {};
    
    if (primaryBookmaker) {
      const h2hMarket = primaryBookmaker.markets?.find(m => m.key === 'h2h');
      const spreadsMarket = primaryBookmaker.markets?.find(m => m.key === 'spreads');
      const totalsMarket = primaryBookmaker.markets?.find(m => m.key === 'totals');
      
      const homeOutcomeH2h = h2hMarket?.outcomes?.find(o => o.name === event.home_team);
      const awayOutcomeH2h = h2hMarket?.outcomes?.find(o => o.name === event.away_team);
      
      const homeOutcomeSpread = spreadsMarket?.outcomes?.find(o => o.name === event.home_team);
      const awayOutcomeSpread = spreadsMarket?.outcomes?.find(o => o.name === event.away_team);
      
      const overOutcome = totalsMarket?.outcomes?.find(o => o.name === 'Over');
      const underOutcome = totalsMarket?.outcomes?.find(o => o.name === 'Under');
      
      lines = {
        moneyline: {
          home: parseOddsValue(homeOutcomeH2h?.price),
          away: parseOddsValue(awayOutcomeH2h?.price)
        },
        spread: {
          home: parseOddsValue(homeOutcomeSpread?.point),
          away: parseOddsValue(awayOutcomeSpread?.point),
          homeOdds: parseOddsValue(homeOutcomeSpread?.price),
          awayOdds: parseOddsValue(awayOutcomeSpread?.price)
        },
        total: {
          over: parseOddsValue(overOutcome?.point),
          under: parseOddsValue(underOutcome?.point),
          overOdds: parseOddsValue(overOutcome?.price),
          underOdds: parseOddsValue(underOutcome?.price)
        }
      };
    }
    
    bookmakers.forEach(bm => {
      const h2hMarket = bm.markets?.find(m => m.key === 'h2h');
      const spreadsMarket = bm.markets?.find(m => m.key === 'spreads');
      const totalsMarket = bm.markets?.find(m => m.key === 'totals');
      
      if (h2hMarket || spreadsMarket || totalsMarket) {
        const homeOutcomeH2h = h2hMarket?.outcomes?.find(o => o.name === event.home_team);
        const awayOutcomeH2h = h2hMarket?.outcomes?.find(o => o.name === event.away_team);
        const homeOutcomeSpread = spreadsMarket?.outcomes?.find(o => o.name === event.home_team);
        const awayOutcomeSpread = spreadsMarket?.outcomes?.find(o => o.name === event.away_team);
        const overOutcome = totalsMarket?.outcomes?.find(o => o.name === 'Over');
        const underOutcome = totalsMarket?.outcomes?.find(o => o.name === 'Under');
        
        allBookmakerOdds[bm.title] = {
          moneyline: {
            home: parseOddsValue(homeOutcomeH2h?.price),
            away: parseOddsValue(awayOutcomeH2h?.price)
          },
          spread: {
            home: parseOddsValue(homeOutcomeSpread?.point),
            away: parseOddsValue(awayOutcomeSpread?.point),
            homeOdds: parseOddsValue(homeOutcomeSpread?.price),
            awayOdds: parseOddsValue(awayOutcomeSpread?.price)
          },
          total: {
            over: parseOddsValue(overOutcome?.point),
            under: parseOddsValue(underOutcome?.point),
            overOdds: parseOddsValue(overOutcome?.price),
            underOdds: parseOddsValue(underOutcome?.price)
          }
        };
      }
    });
    
    return {
      id: event.id,
      sport: 'americanfootball_nfl',
      sportName: 'NFL',
      homeTeam: getTeamAbbreviation(event.home_team),
      awayTeam: getTeamAbbreviation(event.away_team),
      homeTeamFull: event.home_team,
      awayTeamFull: event.away_team,
      commenceTime: event.commence_time,
      time: formatGameTime(event.commence_time),
      lines: lines,
      allBookmakerOdds: allBookmakerOdds,
      dataSource: 'TheOddsAPI'
    };
  });
}

function formatGameTime(isoTime) {
  if (!isoTime) return 'TBD';
  try {
    const date = new Date(isoTime);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    }) + ' ET';
  } catch {
    return 'TBD';
  }
}

function getTeamAbbreviation(teamName) {
  const abbreviations = {
    'Arizona Cardinals': 'ARI',
    'Atlanta Falcons': 'ATL',
    'Baltimore Ravens': 'BAL',
    'Buffalo Bills': 'BUF',
    'Carolina Panthers': 'CAR',
    'Chicago Bears': 'CHI',
    'Cincinnati Bengals': 'CIN',
    'Cleveland Browns': 'CLE',
    'Dallas Cowboys': 'DAL',
    'Denver Broncos': 'DEN',
    'Detroit Lions': 'DET',
    'Green Bay Packers': 'GB',
    'Houston Texans': 'HOU',
    'Indianapolis Colts': 'IND',
    'Jacksonville Jaguars': 'JAX',
    'Kansas City Chiefs': 'KC',
    'Las Vegas Raiders': 'LV',
    'Los Angeles Chargers': 'LAC',
    'Los Angeles Rams': 'LAR',
    'Miami Dolphins': 'MIA',
    'Minnesota Vikings': 'MIN',
    'New England Patriots': 'NE',
    'New Orleans Saints': 'NO',
    'New York Giants': 'NYG',
    'New York Jets': 'NYJ',
    'Philadelphia Eagles': 'PHI',
    'Pittsburgh Steelers': 'PIT',
    'San Francisco 49ers': 'SF',
    'Seattle Seahawks': 'SEA',
    'Tampa Bay Buccaneers': 'TB',
    'Tennessee Titans': 'TEN',
    'Washington Commanders': 'WAS'
  };
  
  return abbreviations[teamName] || teamName?.substring(0, 3).toUpperCase() || 'UNK';
}

export function clearOddsCache() {
  oddsCache.data = null;
  oddsCache.timestamp = 0;
}
