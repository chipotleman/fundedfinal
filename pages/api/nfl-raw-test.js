const API_KEY = process.env.GOALSERVE_API_KEY;

function getTodayDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}

function getFeeds() {
  const today = getTodayDate();
  return {
    inplay: `http://inplay.goalserve.com/inplay/amfootball?withOdds=1&json=1&key=${API_KEY}`,
    schedule: `http://www.goalserve.com/getfeed/${API_KEY}/football/nfl-shedule?date1=${today}&date2=${today}&showodds=1&json=1`,
    scores: `http://www.goalserve.com/getfeed/${API_KEY}/football/nfl-scores?json=1`
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  const { feed = 'inplay' } = req.query;
  const today = getTodayDate();
  const FEEDS = getFeeds();
  
  const feedUrl = FEEDS[feed];
  if (!feedUrl) {
    return res.status(400).json({ error: 'Invalid feed. Use: inplay, schedule, or scores', today });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Goalserve API returned ${response.status}: ${response.statusText}`,
        feed,
        feedUrl: feedUrl.replace(API_KEY, 'HIDDEN'),
        headers: Object.fromEntries(response.headers.entries())
      });
    }
    
    const text = await response.text();
    
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parseError = e.message;
    }
    
    let nflGames = [];
    let oddsInfo = [];
    
    if (parsed && feed === 'inplay') {
      const events = parsed.inplay?.events || parsed.events || [];
      const eventsArray = Array.isArray(events) ? events : Object.values(events);
      nflGames = eventsArray.filter(e => 
        e.league?.toLowerCase().includes('nfl') || 
        e.sport === 'amfootball' ||
        e.category?.toLowerCase().includes('nfl')
      );
      
      nflGames.forEach(game => {
        if (game.odds) {
          oddsInfo.push({
            matchup: `${game.home?.name || game.hometeam} vs ${game.away?.name || game.awayteam}`,
            rawOdds: game.odds,
            status: game.status || game.time_status,
            score: `${game.home?.score || 0} - ${game.away?.score || 0}`
          });
        }
      });
    }
    
    if (parsed && feed === 'schedule') {
      const tournaments = Array.isArray(parsed.shedules?.tournament) 
        ? parsed.shedules.tournament 
        : [parsed.shedules?.tournament].filter(Boolean);
      
      for (const tournament of tournaments) {
        const weeks = Array.isArray(tournament?.week) ? tournament.week : [tournament?.week].filter(Boolean);
        for (const week of weeks) {
          const matches = Array.isArray(week?.matches?.match) 
            ? week.matches.match 
            : [week?.matches?.match].filter(Boolean);
          
          for (const match of matches) {
            if (match?.hometeam && match?.odds) {
              nflGames.push(match);
              
              const types = Array.isArray(match.odds.type) ? match.odds.type : [match.odds.type].filter(Boolean);
              const bookmakerOdds = {};
              
              types.forEach(type => {
                const bookmakers = Array.isArray(type?.bookmaker) ? type.bookmaker : [type?.bookmaker].filter(Boolean);
                bookmakers.forEach(bm => {
                  if (!bm) return;
                  if (!bookmakerOdds[bm.name]) bookmakerOdds[bm.name] = {};
                  bookmakerOdds[bm.name][type.value || type.name || 'unknown'] = Array.isArray(bm.odd) ? bm.odd : [bm.odd];
                });
              });
              
              oddsInfo.push({
                matchup: `${match.awayteam?.name} @ ${match.hometeam?.name}`,
                status: match.status || match.timer || 'scheduled',
                time: match.time,
                date: match.date,
                bookmakers: Object.keys(bookmakerOdds),
                bet365: bookmakerOdds['bet365'] || null,
                bwin: bookmakerOdds['bwin'] || null,
                allBookmakers: bookmakerOdds
              });
            }
          }
        }
      }
    }
    
    return res.status(200).json({
      feed,
      feedUrl: feedUrl.replace(API_KEY, 'HIDDEN'),
      queryDate: today,
      timestamp: new Date().toISOString(),
      responseStatus: response.status,
      rawTextLength: text.length,
      parseError,
      nflGamesFound: nflGames.length,
      oddsInfo,
      rawData: parsed,
      rawText: parsed ? null : text.substring(0, 5000)
    });
    
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      feed,
      feedUrl: feedUrl.replace(API_KEY, 'HIDDEN')
    });
  }
}
