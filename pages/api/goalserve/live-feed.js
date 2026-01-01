const { getInplayService } = require('../../../lib/goalserve-inplay');

const WS_SERVER_API_KEY = process.env.WS_SERVER_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (WS_SERVER_API_KEY) {
    const authHeader = req.headers.authorization;
    const providedKey = authHeader?.replace('Bearer ', '');
    
    if (providedKey !== WS_SERVER_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const inplayService = getInplayService();
    
    if (!inplayService.isPolling()) {
      await inplayService.startPolling();
    }

    const liveEvents = inplayService.getLiveEvents();
    const eventList = Object.values(liveEvents);

    const normalizedEvents = eventList.map(event => {
      const homeTeam = event.homeTeam || event.team_info?.[0]?.name || event.home?.name || 'Home';
      const awayTeam = event.awayTeam || event.team_info?.[1]?.name || event.away?.name || 'Away';
      
      let homeScore = event.homeScore ?? 0;
      let awayScore = event.awayScore ?? 0;
      
      if (event.info?.score) {
        const scoreParts = event.info.score.split('-').map(s => parseInt(s.trim()));
        if (scoreParts.length === 2) {
          homeScore = scoreParts[0] || 0;
          awayScore = scoreParts[1] || 0;
        }
      }
      
      if (homeScore === 0 && awayScore === 0 && event.team_info) {
        homeScore = parseInt(event.team_info[0]?.score) || 0;
        awayScore = parseInt(event.team_info[1]?.score) || 0;
      }

      const elapsedSeconds = parseInt(event.info?.time) || parseInt(event.timer) || 0;
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const formattedTime = elapsedSeconds > 0 
        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
        : null;
      
      const periodNames = {
        '1H': '1st Half', '2H': '2nd Half', 'HT': 'Halftime',
        '1P': '1st', '2P': '2nd', '3P': '3rd', 'OT': 'OT',
        '1Q': 'Q1', '2Q': 'Q2', '3Q': 'Q3', '4Q': 'Q4',
        '1': '1st', '2': '2nd', '3': '3rd', '4': '4th'
      };
      const period = event.info?.period || event.period;
      const periodDisplay = periodNames[period] || period;
      const displayClock = formattedTime 
        ? (periodDisplay ? `${periodDisplay} ${formattedTime}` : formattedTime)
        : periodDisplay || 'LIVE';

      const parsedOdds = { moneyline: {}, spread: {}, total: {} };
      
      if (event.odds?.bet365) {
        const b365 = event.odds.bet365;
        
        if (b365.moneyline) {
          parsedOdds.moneyline.home = b365.moneyline.home;
          parsedOdds.moneyline.away = b365.moneyline.away;
        }
        
        if (b365.spread) {
          parsedOdds.spread.home = b365.spread.home;
          parsedOdds.spread.away = b365.spread.away;
        }
        
        if (b365.total) {
          parsedOdds.total = b365.total;
        }
      }

      const sportName = (event.sport || '').toUpperCase();
      const leagueName = (event.league || event.competition?.name || event.name || '').toUpperCase();
      
      return {
        id: event.id,
        sport: sportName,
        league: leagueName,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        displayClock,
        period: periodDisplay,
        isLive: true,
        status: 'live',
        odds: parsedOdds,
        timestamp: event.timestamp || Date.now()
      };
    });

    return res.status(200).json({
      success: true,
      events: normalizedEvents,
      count: normalizedEvents.length,
      timestamp: Date.now(),
      source: 'goalserve-inplay'
    });

  } catch (error) {
    console.error('[Live Feed API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      events: [],
      timestamp: Date.now()
    });
  }
}
