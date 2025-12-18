const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull';

function getAuthHeader() {
  const apiKey = process.env.MYSPORTSFEEDS_API_KEY;
  const password = process.env.MYSPORTSFEEDS_PASSWORD || 'MYSPORTSFEEDS';
  
  if (!apiKey) {
    throw new Error('MySportsFeed API key not configured');
  }
  
  // MySportsFeeds v2.x uses API_KEY:MYSPORTSFEEDS as the auth format
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

function formatOdds(americanOdds) {
  if (!americanOdds) return -110;
  return americanOdds > 0 ? `+${americanOdds}` : americanOdds;
}

function getQuarterDisplay(period, isCompleted, isInProgress) {
  if (isCompleted) return 'Final';
  if (!isInProgress) return '';
  if (!period) return 'Live';
  return `${period}Q`;
}

function transformGame(game, odds) {
  const schedule = game.schedule || {};
  const score = game.score || {};
  const homeTeam = schedule.homeTeam || {};
  const awayTeam = schedule.awayTeam || {};
  
  const gameOdds = odds?.[game.schedule?.id] || {};
  const spread = gameOdds.spread || {};
  const total = gameOdds.total || {};
  const moneyline = gameOdds.moneyline || {};

  const isCompleted = schedule.playedStatus === 'COMPLETED';
  const isInProgress = schedule.playedStatus === 'LIVE' || schedule.playedStatus === 'IN_PROGRESS';
  const currentPeriod = score.currentPeriod || null;

  const hasOdds = !!(spread.awaySpread || spread.homeSpread || moneyline.awayOdds || moneyline.homeOdds || total.overUnder);

  return {
    id: schedule.id || game.id || Math.random().toString(36).substr(2, 9),
    awayTeam: awayTeam.abbreviation || awayTeam.name || 'Away',
    homeTeam: homeTeam.abbreviation || homeTeam.name || 'Home',
    awayTeamFull: awayTeam.name || 'Away Team',
    homeTeamFull: homeTeam.name || 'Home Team',
    time: formatGameTime(schedule.startTime),
    startTime: schedule.startTime,
    awayScore: score.awayScoreTotal || 0,
    homeScore: score.homeScoreTotal || 0,
    quarter: getQuarterDisplay(currentPeriod, isCompleted, isInProgress),
    isLive: isInProgress,
    isCompleted: isCompleted,
    status: schedule.playedStatus || 'UNPLAYED',
    oddsAvailable: hasOdds,
    lines: {
      spread: {
        away: { 
          point: spread.awaySpread ? (spread.awaySpread > 0 ? `+${spread.awaySpread}` : `${spread.awaySpread}`) : 'N/A', 
          odds: spread.awayOdds || null 
        },
        home: { 
          point: spread.homeSpread ? (spread.homeSpread > 0 ? `+${spread.homeSpread}` : `${spread.homeSpread}`) : 'N/A', 
          odds: spread.homeOdds || null 
        }
      },
      total: {
        over: { 
          point: total.overUnder ? `O ${total.overUnder}` : 'N/A', 
          odds: total.overOdds || null 
        },
        under: { 
          point: total.overUnder ? `U ${total.overUnder}` : 'N/A', 
          odds: total.underOdds || null 
        }
      },
      moneyline: { 
        away: moneyline.awayOdds || null, 
        home: moneyline.homeOdds || null 
      }
    }
  };
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
    
    const oddsUrl = `${MYSPORTSFEEDS_BASE_URL}/nba/${season}/date/${today}/odds_gamelines.json`;
    let oddsData = {};
    
    try {
      const oddsResponse = await fetch(oddsUrl, {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });
      
      if (oddsResponse.ok) {
        const oddsJson = await oddsResponse.json();
        const gameLines = oddsJson.gameLines || [];
        
        gameLines.forEach(gameLine => {
          const gameId = gameLine.game?.id;
          const lines = gameLine.lines || [];
          
          if (gameId && lines.length > 0) {
            const latestLine = lines[0];
            oddsData[gameId] = {
              spread: {
                homeSpread: latestLine.homeSpread?.homeSpread,
                awaySpread: latestLine.awaySpread?.awaySpread,
                homeOdds: latestLine.homeSpread?.odds,
                awayOdds: latestLine.awaySpread?.odds
              },
              total: {
                overUnder: latestLine.overUnder?.overUnder,
                overOdds: latestLine.over?.odds,
                underOdds: latestLine.under?.odds
              },
              moneyline: {
                homeOdds: latestLine.homeMoneyLine?.moneyLine,
                awayOdds: latestLine.awayMoneyLine?.moneyLine
              }
            };
          }
        });
      }
    } catch (oddsError) {
      console.error('Error fetching odds:', oddsError);
    }

    return games.map(game => transformGame(game, oddsData));
  } catch (error) {
    console.error('Error fetching NBA games:', error);
    throw error;
  }
}

async function fetchUpcomingNBAGames(days = 3) {
  const season = getCurrentSeason();
  const games = [];
  
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
        
        let oddsData = {};
        try {
          const oddsUrl = `${MYSPORTSFEEDS_BASE_URL}/nba/${season}/date/${dateStr}/odds_gamelines.json`;
          const oddsResponse = await fetch(oddsUrl, {
            headers: {
              'Authorization': getAuthHeader(),
              'Content-Type': 'application/json'
            }
          });
          
          if (oddsResponse.ok) {
            const oddsJson = await oddsResponse.json();
            const gameLines = oddsJson.gameLines || [];
            
            gameLines.forEach(gameLine => {
              const gameId = gameLine.game?.id;
              const lines = gameLine.lines || [];
              
              if (gameId && lines.length > 0) {
                const latestLine = lines[0];
                oddsData[gameId] = {
                  spread: {
                    homeSpread: latestLine.homeSpread?.homeSpread,
                    awaySpread: latestLine.awaySpread?.awaySpread,
                    homeOdds: latestLine.homeSpread?.odds,
                    awayOdds: latestLine.awaySpread?.odds
                  },
                  total: {
                    overUnder: latestLine.overUnder?.overUnder,
                    overOdds: latestLine.over?.odds,
                    underOdds: latestLine.under?.odds
                  },
                  moneyline: {
                    homeOdds: latestLine.homeMoneyLine?.moneyLine,
                    awayOdds: latestLine.awayMoneyLine?.moneyLine
                  }
                };
              }
            });
          }
        } catch (oddsError) {
          console.error('Error fetching odds for date:', dateStr, oddsError);
        }
        
        games.push(...dayGames.map(game => transformGame(game, oddsData)));
      }
    } catch (error) {
      console.error(`Error fetching games for ${dateStr}:`, error);
    }
  }
  
  return games;
}

module.exports = {
  fetchNBAGames,
  fetchUpcomingNBAGames,
  getCurrentSeason
};
