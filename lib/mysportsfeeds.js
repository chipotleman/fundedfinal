const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull';

function getAuthHeader() {
  const apiKey = process.env.MYSPORTSFEEDS_API_KEY;
  const password = process.env.MYSPORTSFEEDS_PASSWORD;
  
  if (!apiKey || !password) {
    throw new Error('MySportsFeed credentials not configured');
  }
  
  const authString = Buffer.from(`${apiKey}:${password}`).toString('base64');
  return `Basic ${authString}`;
}

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (month >= 10) {
    return `${year}-${year + 1}-regular`;
  } else if (month <= 6) {
    return `${year - 1}-${year}-regular`;
  } else {
    return `${year - 1}-${year}-regular`;
  }
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

function getQuarterDisplay(period, isCompleted, isInProgress) {
  if (isCompleted) return 'Final';
  if (!isInProgress) return '';
  if (!period) return 'Live';
  return `${period}Q`;
}

function parseOddsFromLine(line) {
  const spread = {};
  const total = {};
  const moneyline = {};
  
  if (line.pointSpreadHome) {
    spread.homeSpread = line.pointSpreadHome.pointSpread;
    spread.homeOdds = line.pointSpreadHome.moneyLine || -110;
  }
  if (line.pointSpreadAway) {
    spread.awaySpread = line.pointSpreadAway.pointSpread;
    spread.awayOdds = line.pointSpreadAway.moneyLine || -110;
  }
  
  if (line.homeSpread) {
    spread.homeSpread = line.homeSpread.homeSpread || line.homeSpread.pointSpread;
    spread.homeOdds = line.homeSpread.odds || line.homeSpread.moneyLine || -110;
  }
  if (line.awaySpread) {
    spread.awaySpread = line.awaySpread.awaySpread || line.awaySpread.pointSpread;
    spread.awayOdds = line.awaySpread.odds || line.awaySpread.moneyLine || -110;
  }
  
  if (line.totalOver) {
    total.overUnder = line.totalOver.total;
    total.overOdds = line.totalOver.moneyLine || -110;
  }
  if (line.totalUnder) {
    total.underOdds = line.totalUnder.moneyLine || -110;
  }
  if (line.overUnder) {
    total.overUnder = line.overUnder.overUnder || line.overUnder.total;
    total.overOdds = line.over?.odds || line.overUnder?.overOdds || -110;
    total.underOdds = line.under?.odds || line.overUnder?.underOdds || -110;
  }
  if (line.over) {
    total.overOdds = line.over.odds || line.over.moneyLine || -110;
  }
  if (line.under) {
    total.underOdds = line.under.odds || line.under.moneyLine || -110;
  }
  
  if (line.moneylineHome) {
    moneyline.homeOdds = line.moneylineHome.moneyLine;
  }
  if (line.moneylineAway) {
    moneyline.awayOdds = line.moneylineAway.moneyLine;
  }
  if (line.homeMoneyLine) {
    moneyline.homeOdds = line.homeMoneyLine.moneyLine;
  }
  if (line.awayMoneyLine) {
    moneyline.awayOdds = line.awayMoneyLine.moneyLine;
  }
  
  return { spread, total, moneyline };
}

function transformGame(game, odds, teamRefs = {}) {
  const schedule = game.schedule || {};
  const score = game.score || {};
  const homeTeam = schedule.homeTeam || {};
  const awayTeam = schedule.awayTeam || {};
  
  const homeTeamRef = teamRefs[homeTeam.id] || {};
  const awayTeamRef = teamRefs[awayTeam.id] || {};
  
  const gameOdds = odds?.[schedule.id] || {};
  const spread = gameOdds.spread || {};
  const total = gameOdds.total || {};
  const moneyline = gameOdds.moneyline || {};

  const isCompleted = schedule.playedStatus === 'COMPLETED';
  const isInProgress = schedule.playedStatus === 'LIVE' || schedule.playedStatus === 'IN_PROGRESS';
  const currentPeriod = score.currentPeriod || null;

  const homeFullName = homeTeamRef.city && homeTeamRef.name 
    ? `${homeTeamRef.city} ${homeTeamRef.name}` 
    : homeTeam.name || 'Home Team';
  const awayFullName = awayTeamRef.city && awayTeamRef.name 
    ? `${awayTeamRef.city} ${awayTeamRef.name}` 
    : awayTeam.name || 'Away Team';

  return {
    id: schedule.id || game.id || Math.random().toString(36).substr(2, 9),
    awayTeam: awayTeam.abbreviation || awayTeamRef.abbreviation || awayTeam.name || 'Away',
    homeTeam: homeTeam.abbreviation || homeTeamRef.abbreviation || homeTeam.name || 'Home',
    awayTeamFull: awayFullName,
    homeTeamFull: homeFullName,
    time: formatGameTime(schedule.startTime),
    startTime: schedule.startTime,
    awayScore: score.awayScoreTotal || 0,
    homeScore: score.homeScoreTotal || 0,
    quarter: getQuarterDisplay(currentPeriod, isCompleted, isInProgress),
    isLive: isInProgress,
    isCompleted: isCompleted,
    status: schedule.playedStatus || 'UNPLAYED',
    lines: {
      spread: {
        away: { 
          point: spread.awaySpread != null ? (spread.awaySpread > 0 ? `+${spread.awaySpread}` : `${spread.awaySpread}`) : '+0', 
          odds: spread.awayOdds || -110 
        },
        home: { 
          point: spread.homeSpread != null ? (spread.homeSpread > 0 ? `+${spread.homeSpread}` : `${spread.homeSpread}`) : '-0', 
          odds: spread.homeOdds || -110 
        }
      },
      total: {
        over: { 
          point: total.overUnder != null ? `O ${total.overUnder}` : 'O 220.5', 
          odds: total.overOdds || -110 
        },
        under: { 
          point: total.overUnder != null ? `U ${total.overUnder}` : 'U 220.5', 
          odds: total.underOdds || -110 
        }
      },
      moneyline: { 
        away: moneyline.awayOdds || 150, 
        home: moneyline.homeOdds || -170 
      }
    }
  };
}

async function fetchOddsForDate(season, dateStr) {
  const oddsUrl = `${MYSPORTSFEEDS_BASE_URL}/nba/${season}/date/${dateStr}/odds_gamelines.json`;
  let oddsData = {};
  let teamRefs = {};
  let rawOddsResponse = null;
  let oddsStatus = { code: null, message: null };
  
  try {
    const oddsResponse = await fetch(oddsUrl, {
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });
    
    oddsStatus.code = oddsResponse.status;
    
    if (oddsResponse.ok) {
      const oddsJson = await oddsResponse.json();
      rawOddsResponse = oddsJson;
      oddsStatus.message = 'Success';
      const gameLines = oddsJson.gameLines || [];
      
      if (oddsJson.references?.teamReferences) {
        oddsJson.references.teamReferences.forEach(team => {
          teamRefs[team.id] = team;
        });
      }
      
      gameLines.forEach(gameLine => {
        const gameId = gameLine.game?.id;
        const lines = gameLine.lines || [];
        
        if (gameId && lines.length > 0) {
          const latestLine = lines[0];
          const parsed = parseOddsFromLine(latestLine);
          oddsData[gameId] = parsed;
        }
      });
    } else if (oddsResponse.status === 403) {
      oddsStatus.message = 'Access denied - CORE tier does not include odds data. Upgrade to PRO tier required.';
      console.log(`Odds endpoint returned 403 (Forbidden) for ${dateStr} - PRO tier required`);
    } else {
      oddsStatus.message = `HTTP ${oddsResponse.status}`;
      console.log(`Odds endpoint returned ${oddsResponse.status} for ${dateStr}`);
    }
  } catch (oddsError) {
    oddsStatus.code = 0;
    oddsStatus.message = `Error: ${oddsError.message}`;
    console.error('Error fetching odds for date:', dateStr, oddsError);
  }
  
  return { oddsData, teamRefs, rawOddsResponse, oddsStatus };
}

async function fetchNBAGames() {
  const season = getCurrentSeason();
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  const gamesUrl = `${MYSPORTSFEEDS_BASE_URL}/nba/${season}/date/${today}/games.json`;
  
  try {
    const response = await fetch(gamesUrl, {
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MySportsFeed API error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const games = data.games || [];
    
    const { oddsData, teamRefs } = await fetchOddsForDate(season, today);

    return games.map(game => transformGame(game, oddsData, teamRefs));
  } catch (error) {
    console.error('Error fetching NBA games:', error);
    throw error;
  }
}

async function fetchUpcomingNBAGames(days = 3) {
  const season = getCurrentSeason();
  const games = [];
  let debugInfo = { dates: [], rawOdds: null, oddsStatus: null, apiTier: 'CORE' };
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const url = `${MYSPORTSFEEDS_BASE_URL}/nba/${season}/date/${dateStr}/games.json`;
      const response = await fetch(url, {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const dayGames = data.games || [];
        
        const { oddsData, teamRefs, rawOddsResponse, oddsStatus } = await fetchOddsForDate(season, dateStr);
        
        if (i === 0) {
          debugInfo.rawOdds = rawOddsResponse;
          debugInfo.oddsStatus = oddsStatus;
          if (oddsStatus?.code === 403) {
            debugInfo.apiTier = 'CORE (odds not included - upgrade to PRO)';
          } else if (oddsStatus?.code === 200) {
            debugInfo.apiTier = 'PRO or higher (odds included)';
          }
        }
        
        debugInfo.dates.push({
          date: dateStr,
          gamesCount: dayGames.length,
          oddsCount: Object.keys(oddsData).length,
          oddsHttpStatus: oddsStatus?.code
        });
        
        games.push(...dayGames.map(game => transformGame(game, oddsData, teamRefs)));
      }
    } catch (error) {
      console.error(`Error fetching games for ${dateStr}:`, error);
    }
  }
  
  return { games, debugInfo };
}

module.exports = {
  fetchNBAGames,
  fetchUpcomingNBAGames,
  getCurrentSeason
};
