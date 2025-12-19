const SPORTSRADAR_BASE_URL = 'https://api.sportradar.com/nba/trial/v8/en';

function getApiKey() {
  const apiKey = process.env.SPORTSRADAR_API_KEY;
  if (!apiKey) {
    throw new Error('Sportsradar API key not configured');
  }
  return apiKey;
}

function formatGameTime(scheduled) {
  if (!scheduled) return 'TBD';
  const date = new Date(scheduled);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    timeZone: 'America/New_York'
  }) + ' ET';
}

function getQuarterDisplay(status, quarter) {
  if (status === 'closed') return 'Final';
  if (status === 'complete') return 'Final';
  if (status === 'scheduled') return '';
  if (status === 'inprogress') {
    return quarter ? `Q${quarter}` : 'Live';
  }
  if (status === 'halftime') return 'Half';
  return '';
}

function getDefaultOdds() {
  return {
    spread: {
      away: { point: '+0', odds: -110 },
      home: { point: '-0', odds: -110 }
    },
    total: {
      over: { point: 'O 220.5', odds: -110 },
      under: { point: 'U 220.5', odds: -110 }
    },
    moneyline: { away: 150, home: -170 }
  };
}

function transformGame(game) {
  const isLive = game.status === 'inprogress' || game.status === 'halftime';
  const isCompleted = game.status === 'closed' || game.status === 'complete';
  
  return {
    id: game.id,
    srId: game.sr_id,
    awayTeam: game.away?.alias || 'TBD',
    homeTeam: game.home?.alias || 'TBD',
    awayTeamFull: game.away?.name || 'Away Team',
    homeTeamFull: game.home?.name || 'Home Team',
    time: formatGameTime(game.scheduled),
    startTime: game.scheduled,
    awayScore: game.away_points || 0,
    homeScore: game.home_points || 0,
    quarter: getQuarterDisplay(game.status, game.quarter),
    isLive: isLive,
    isCompleted: isCompleted,
    status: game.status?.toUpperCase() || 'SCHEDULED',
    venue: game.venue?.name || null,
    broadcasts: game.broadcasts || [],
    lines: getDefaultOdds()
  };
}

async function fetchNBADailySchedule(year, month, day) {
  const url = `${SPORTSRADAR_BASE_URL}/games/${year}/${month}/${day}/schedule.json`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'x-api-key': getApiKey()
      }
    });

    if (!response.ok) {
      console.error('Sportsradar API error:', response.status);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.games || [];
  } catch (error) {
    console.error('Error fetching Sportsradar NBA schedule:', error);
    throw error;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUpcomingNBAGames(days = 1) {
  const games = [];
  let debugInfo = { 
    dates: [], 
    source: 'sportsradar',
    apiVersion: 'v8',
    oddsStatus: { code: null, message: 'Using default odds - Odds API pending activation' }
  };
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    try {
      if (i > 0) {
        await delay(1500);
      }
      
      const dayGames = await fetchNBADailySchedule(year, month, day);
      
      debugInfo.dates.push({
        date: dateStr,
        gamesCount: dayGames.length,
        oddsCount: 0,
        source: 'sportsradar'
      });
      
      games.push(...dayGames.map(game => transformGame(game)));
    } catch (error) {
      console.error(`Error fetching games for ${dateStr}:`, error);
      debugInfo.dates.push({
        date: dateStr,
        gamesCount: 0,
        error: error.message
      });
      if (error.message.includes('429')) {
        debugInfo.rateLimited = true;
        break;
      }
    }
  }
  
  return { games, debugInfo };
}

async function fetchNBAGames() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const games = await fetchNBADailySchedule(year, month, day);
  return games.map(game => transformGame(game));
}

module.exports = {
  fetchNBAGames,
  fetchUpcomingNBAGames,
  fetchNBADailySchedule
};
