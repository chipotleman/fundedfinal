import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const INPLAY_FEEDS = {
  soccer: 'http://inplay.goalserve.com/inplay-soccer.gz',
  basketball: 'http://inplay.goalserve.com/inplay-basket.gz',
  tennis: 'http://inplay.goalserve.com/inplay-tennis.gz',
  volleyball: 'http://inplay.goalserve.com/inplay-volleyball.gz',
  amfootball: 'http://inplay.goalserve.com/inplay-amfootball.gz',
  hockey: 'http://inplay.goalserve.com/inplay-hockey.gz',
  baseball: 'http://inplay.goalserve.com/inplay-baseball.gz',
  esports: 'http://inplay.goalserve.com/inplay-esports.gz'
};

const GOALSERVE_BASE_URL = 'https://www.goalserve.com/getfeed';

function formatDateForGoalserve(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function decimalToAmerican(decimal) {
  if (!decimal || decimal <= 1) return null;
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

const SPORT_MAPPING = {
  basketball_nba: 'basketball',
  basketball_ncaab: 'basketball',
  americanfootball_nfl: 'amfootball',
  americanfootball_ncaaf: 'amfootball',
  baseball_mlb: 'baseball',
  icehockey_nhl: 'hockey',
  soccer: 'soccer',
  tennis: 'tennis',
  volleyball: 'volleyball',
  esports: 'esports'
};

const TIME_STATUS = {
  0: 'not_started',
  1: 'live',
  2: 'to_be_fixed',
  3: 'ended',
  4: 'postponed',
  5: 'cancelled',
  6: 'walkover',
  7: 'interrupted',
  8: 'abandoned',
  9: 'retired',
  99: 'removed'
};

// Mapping from city abbreviations to full city names
const CITY_ABBREVIATIONS = {
  // NBA
  'ATL': 'Atlanta', 'BOS': 'Boston', 'BKN': 'Brooklyn', 'CHA': 'Charlotte',
  'CHI': 'Chicago', 'CLE': 'Cleveland', 'DAL': 'Dallas', 'DEN': 'Denver',
  'DET': 'Detroit', 'GSW': 'Golden State', 'HOU': 'Houston', 'IND': 'Indiana',
  'LAC': 'LA', 'LAL': 'Los Angeles', 'MEM': 'Memphis', 'MIA': 'Miami',
  'MIL': 'Milwaukee', 'MIN': 'Minnesota', 'NOP': 'New Orleans', 'NYK': 'New York',
  'OKC': 'Oklahoma City', 'ORL': 'Orlando', 'PHI': 'Philadelphia', 'PHX': 'Phoenix',
  'POR': 'Portland', 'SAC': 'Sacramento', 'SAS': 'San Antonio', 'SA': 'San Antonio',
  'TOR': 'Toronto', 'UTA': 'Utah', 'WAS': 'Washington',
  // NFL
  'ARI': 'Arizona', 'BAL': 'Baltimore', 'BUF': 'Buffalo', 'CAR': 'Carolina',
  'CIN': 'Cincinnati', 'GB': 'Green Bay', 'JAX': 'Jacksonville', 'KC': 'Kansas City',
  'LV': 'Las Vegas', 'LAR': 'Los Angeles', 'NE': 'New England', 'NO': 'New Orleans',
  'NYG': 'New York', 'NYJ': 'New York', 'PIT': 'Pittsburgh', 'SEA': 'Seattle',
  'SF': 'San Francisco', 'TB': 'Tampa Bay', 'TEN': 'Tennessee',
  // NHL
  'ANA': 'Anaheim', 'CGY': 'Calgary', 'CBJ': 'Columbus', 'COL': 'Colorado',
  'DAL': 'Dallas', 'EDM': 'Edmonton', 'FLA': 'Florida', 'LA': 'Los Angeles',
  'MTL': 'Montreal', 'NSH': 'Nashville', 'NJ': 'New Jersey', 'NYI': 'New York',
  'NYR': 'New York', 'OTT': 'Ottawa', 'PHI': 'Philadelphia', 'PIT': 'Pittsburgh',
  'SJ': 'San Jose', 'STL': 'St. Louis', 'VAN': 'Vancouver', 'VGK': 'Vegas',
  'WPG': 'Winnipeg', 'WSH': 'Washington', 'CAL': 'Calgary', 'MON': 'Montreal',
  // MLB
  'BAL': 'Baltimore', 'BOS': 'Boston', 'CHC': 'Chicago', 'CHW': 'Chicago',
  'CIN': 'Cincinnati', 'COL': 'Colorado', 'HOU': 'Houston', 'KC': 'Kansas City',
  'LAA': 'Los Angeles', 'LAD': 'Los Angeles', 'MIA': 'Miami', 'MIL': 'Milwaukee',
  'NYM': 'New York', 'NYY': 'New York', 'OAK': 'Oakland', 'PHI': 'Philadelphia',
  'SD': 'San Diego', 'SEA': 'Seattle', 'SF': 'San Francisco', 'STL': 'St. Louis',
  'TEX': 'Texas', 'TB': 'Tampa Bay', 'TOR': 'Toronto', 'WAS': 'Washington'
};

// Helper to expand city abbreviations in team names
function expandCityAbbreviation(name) {
  if (!name) return name;
  
  // Split and check if first word is an abbreviation
  const parts = name.split(' ');
  if (parts.length > 1) {
    const firstWord = parts[0].toUpperCase();
    if (CITY_ABBREVIATIONS[firstWord]) {
      parts[0] = CITY_ABBREVIATIONS[firstWord];
      return parts.join(' ');
    }
  }
  return name;
}

// Helper to format team names - keep all-uppercase abbreviations, title-case the rest
function formatTeamName(name) {
  if (!name) return '';
  
  // First expand any city abbreviations
  let formatted = expandCityAbbreviation(name);
  
  // Split on spaces and format each word
  formatted = formatted.split(' ').map(word => {
    // If the word is already all uppercase (abbreviation like BOS, LAL, NYK), keep it
    if (word.length > 0 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
      return word;
    }
    // Title case everything else: capitalize first letter, lowercase rest
    if (word.length > 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word;
  }).join(' ');
  
  // Capitalize league identifiers like (w) -> (W), (m) -> (M)
  formatted = formatted.replace(/\(([wm])\)/gi, (match, letter) => `(${letter.toUpperCase()})`);
  
  return formatted;
}

class GoalserveInplayService {
  constructor() {
    this.cache = new Map();
    this.lastFetch = new Map();
    this.subscribers = new Set();
    this.pollingIntervals = new Map();
    this.isPolling = false;
    this.pollInterval = 1000; // 1 second for sub-second latency
    this.events = {};
    this.lastUpdate = null;
    this.errors = new Map();
  }

  async fetchFeed(sport) {
    const feedUrl = INPLAY_FEEDS[sport];
    if (!feedUrl) {
      throw new Error(`Unknown sport: ${sport}`);
    }

    try {
      const response = await fetch(feedUrl, {
        headers: {
          'Accept-Encoding': 'gzip',
          'User-Agent': 'Piks/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const bufferData = Buffer.from(buffer);
      
      let data;
      const isGzip = bufferData[0] === 0x1f && bufferData[1] === 0x8b;
      
      if (isGzip) {
        const decompressed = await gunzip(bufferData);
        data = JSON.parse(decompressed.toString('utf-8'));
      } else {
        data = JSON.parse(bufferData.toString('utf-8'));
      }
      
      this.cache.set(sport, data);
      this.lastFetch.set(sport, Date.now());
      this.errors.delete(sport);
      
      return data;
    } catch (error) {
      console.error(`[Goalserve Inplay] Error fetching ${sport}:`, error.message);
      this.errors.set(sport, error.message);
      throw error;
    }
  }

  async fetchAllFeeds() {
    const results = {};
    const sports = ['basketball', 'hockey', 'amfootball', 'baseball'];
    
    console.log('[Goalserve Inplay] Fetching all feeds...');
    
    await Promise.allSettled(
      sports.map(async (sport) => {
        try {
          const data = await this.fetchFeed(sport);
          results[sport] = data;
          // Process and store events
          this.processAndNotify(sport, data);
        } catch (error) {
          console.error(`[Goalserve Inplay] ${sport} error:`, error.message);
          results[sport] = { error: error.message };
        }
      })
    );
    
    const eventCount = Object.keys(this.events).length;
    console.log(`[Goalserve Inplay] Fetched all feeds, ${eventCount} total events`);
    
    return results;
  }

  async fetchNFLScheduleOdds() {
    const apiKey = process.env.GOALSERVE_API_KEY;
    if (!apiKey) {
      console.log('[NFL Schedule Odds] No API key configured');
      return null;
    }

    const today = formatDateForGoalserve(new Date());
    const url = `${GOALSERVE_BASE_URL}/${apiKey}/football/nfl-shedule?showodds=1&json=1`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Piks/1.0' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const matches = this.extractNFLMatches(data, today);
      
      console.log(`[NFL Schedule Odds] Fetched ${matches.length} NFL games with odds for ${today}`);
      
      for (const match of matches) {
        const normalized = this.normalizeNFLScheduleEvent(match);
        if (normalized && normalized.odds) {
          const existing = this.events[normalized.id];
          if (!existing || JSON.stringify(existing) !== JSON.stringify(normalized)) {
            this.events[normalized.id] = normalized;
            this.notifySubscribers({
              type: 'events',
              changes: [{ type: existing ? 'update' : 'new', event: normalized }],
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      this.lastFetch.set('nfl_schedule', Date.now());
      this.errors.delete('nfl_schedule');
      return matches;
    } catch (error) {
      console.error(`[NFL Schedule Odds] Error:`, error.message);
      this.errors.set('nfl_schedule', error.message);
      return null;
    }
  }

  extractNFLMatches(data, targetDate) {
    const matches = [];
    
    if (!data?.shedules) return matches;
    
    const tournaments = Array.isArray(data.shedules.tournament) 
      ? data.shedules.tournament 
      : data.shedules.tournament ? [data.shedules.tournament] : [];
    
    for (const tournament of tournaments) {
      if (!tournament.week) continue;
      
      const weeks = Array.isArray(tournament.week) ? tournament.week : [tournament.week];
      
      for (const week of weeks) {
        if (!week.matches) continue;
        
        const weekMatches = Array.isArray(week.matches) ? week.matches : [week.matches];
        
        for (const dayGroup of weekMatches) {
          if (!dayGroup.match) continue;
          
          if (targetDate && dayGroup.formatted_date !== targetDate) continue;
          
          const dayMatches = Array.isArray(dayGroup.match) ? dayGroup.match : [dayGroup.match];
          
          for (const match of dayMatches) {
            if (match && match.hometeam) {
              match._parentOdds = dayGroup.odds;
              matches.push(match);
            }
          }
        }
      }
    }
    
    return matches;
  }

  normalizeNFLScheduleEvent(match) {
    if (!match || !match.hometeam || !match.awayteam) return null;
    
    const eventId = match.contestID || match.id || `nfl_${match.hometeam?.name}_vs_${match.awayteam?.name}`;
    
    const homeTeam = formatTeamName(match.hometeam?.name || '');
    const awayTeam = formatTeamName(match.awayteam?.name || '');
    
    const homeScore = parseInt(match.hometeam?.totalscore || 0);
    const awayScore = parseInt(match.awayteam?.totalscore || 0);
    
    let status = 'not_started';
    if (match.status === 'Final' || match.status === 'F' || match.status === 'FT') {
      status = 'ended';
    } else if (match.timer || match.status?.includes('Q') || match.status === 'Live' || match.status === 'In Progress') {
      status = 'live';
    }
    
    const oddsData = match.odds || match._parentOdds;
    const odds = this.parseNFLScheduleOdds(oddsData);
    
    return {
      id: eventId,
      sport: 'amfootball',
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status,
      league: 'NFL',
      leagueName: 'NFL',
      startTime: match.time,
      odds,
      timer: match.timer,
      displayClock: match.status || null,
      source: 'nfl_schedule'
    };
  }

  parseNFLScheduleOdds(oddsData) {
    if (!oddsData?.type) return null;
    
    const normalized = {};
    const types = Array.isArray(oddsData.type) ? oddsData.type : [oddsData.type];
    
    for (const type of types) {
      if (!type || !type.bookmaker) continue;
      
      const bookmakers = Array.isArray(type.bookmaker) ? type.bookmaker : [type.bookmaker];
      const bet365 = bookmakers.find(bm => bm?.name === 'Bet365') || bookmakers[0];
      
      if (!bet365?.odd) continue;
      
      const odds = Array.isArray(bet365.odd) ? bet365.odd : [bet365.odd];
      const marketType = (type.value || '').toLowerCase();
      
      if (marketType.includes('money') || marketType.includes('winner') || type.value === 'Home/Away') {
        const homeOdd = odds.find(o => o?.name === '2' || o?.name === 'Away');
        const awayOdd = odds.find(o => o?.name === '1' || o?.name === 'Home');
        
        if (homeOdd || awayOdd) {
          normalized.moneyline = {
            home: homeOdd ? decimalToAmerican(parseFloat(homeOdd.value)) : null,
            away: awayOdd ? decimalToAmerican(parseFloat(awayOdd.value)) : null
          };
        }
      }
      
      if (marketType.includes('spread') || marketType.includes('handicap')) {
        const homeOdd = odds.find(o => o?.name === '2' || o?.name === 'Away');
        const awayOdd = odds.find(o => o?.name === '1' || o?.name === 'Home');
        
        if (homeOdd || awayOdd) {
          normalized.spread = {
            home: {
              line: parseFloat(homeOdd?.handicap || 0),
              odds: homeOdd ? decimalToAmerican(parseFloat(homeOdd.value)) : null
            },
            away: {
              line: parseFloat(awayOdd?.handicap || 0),
              odds: awayOdd ? decimalToAmerican(parseFloat(awayOdd.value)) : null
            }
          };
        }
      }
      
      if (marketType.includes('over') || marketType.includes('total')) {
        const overOdd = odds.find(o => o?.name === 'Over');
        const underOdd = odds.find(o => o?.name === 'Under');
        
        if (overOdd || underOdd) {
          normalized.total = {
            line: parseFloat(overOdd?.handicap || underOdd?.handicap || 0),
            over: overOdd ? decimalToAmerican(parseFloat(overOdd.value)) : null,
            under: underOdd ? decimalToAmerican(parseFloat(underOdd.value)) : null
          };
        }
      }
    }
    
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  normalizeEvent(event, sport) {
    
    // CRITICAL: Goalserve inplay feed ALSO has REVERSED labels like the REST API
    // Their "home" = actual away team, "away" = actual home team
    // SWAP them here to get correct convention: Away @ Home display
    let homeTeam = event.away?.name || event.away || '';  // SWAP: away → homeTeam
    let awayTeam = event.home?.name || event.home || '';  // SWAP: home → awayTeam
    
    // Check stats for team names if not found (stats also reversed)
    if ((!homeTeam || !awayTeam) && event.stats) {
      const teamStat = Object.values(event.stats).find(s => s.name === 'ITeam');
      if (teamStat) {
        homeTeam = homeTeam || teamStat.away || '';  // SWAP
        awayTeam = awayTeam || teamStat.home || '';  // SWAP
      }
    }
    
    // Format team names with consistent title case
    homeTeam = formatTeamName(homeTeam);
    awayTeam = formatTeamName(awayTeam);
    
    // Extract canonical ID from multiple possible fields in priority order
    // Goalserve uses different ID fields depending on sport/feed type
    let eventId = event.id 
      || event.mid           // Match ID (common in inplay feeds)
      || event.fi            // Fixture ID
      || event.matchid       // Alternative match ID format
      || event.match_id      // Snake case variant
      || event.contestID     // Contest ID (used in NCAAF)
      || event.contestid     // Lowercase variant
      || event.event_id      // Generic event ID
      || event.extra?.id     // ID in extra object
      || event.extra?.mid    // Match ID in extra
      || event.extra?.matchid
      || event.extra?.contestID;
    
    // Log when we find an ID from non-standard field for debugging
    if (!event.id && eventId) {
      console.log(`[Goalserve Inplay] Using alternate ID field for ${homeTeam} vs ${awayTeam}: ${eventId}`);
    }
    
    // Generate synthetic ID only as last resort
    if (!eventId && homeTeam && awayTeam) {
      eventId = `${sport}_${homeTeam.replace(/\s+/g, '_')}_vs_${awayTeam.replace(/\s+/g, '_')}`.toLowerCase();
      console.log(`[Goalserve Inplay] WARNING: Using synthetic ID for ${homeTeam} vs ${awayTeam}: ${eventId}`);
    } else if (!eventId) {
      eventId = `${sport}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Goalserve Inplay] WARNING: Using random ID for unknown event`);
    }
    
    // Parse score - priority: info.score > team_info.home/away.score > ss > stats.T
    // CRITICAL: Goalserve scores are ALSO reversed - SWAP all score sources
    let homeScore = 0, awayScore = 0;
    
    // First try info.score (most accurate real-time)
    // Format is "away:home" in Goalserve, so SWAP: [1] is actual home, [0] is actual away
    if (event.info?.score) {
      const scores = event.info.score.split(':');
      homeScore = parseInt(scores[1]) || 0;  // SWAP: second value is actual home
      awayScore = parseInt(scores[0]) || 0;  // SWAP: first value is actual away
    }
    // Then try team_info scores (also reversed)
    else if (event.team_info?.home?.score || event.team_info?.away?.score) {
      homeScore = parseInt(event.team_info.away?.score) || 0;  // SWAP
      awayScore = parseInt(event.team_info.home?.score) || 0;  // SWAP
    }
    // Then try ss field (format "away-home", so swap)
    else if (event.ss) {
      const scores = event.ss.split('-');
      homeScore = parseInt(scores[1]) || 0;  // SWAP: second value is actual home
      awayScore = parseInt(scores[0]) || 0;  // SWAP: first value is actual away
    }
    // Finally try stats.T (total score) - also reversed
    else if (event.stats) {
      const totalStat = Object.values(event.stats).find(s => s.name === 'T');
      if (totalStat) {
        homeScore = parseInt(totalStat.away) || 0;  // SWAP
        awayScore = parseInt(totalStat.home) || 0;  // SWAP
      }
    }
    
    // Build display clock from timer data
    // Check multiple possible sources for timer: event.timer, event.info, event.extra, or direct fields
    let displayClock = null;
    
    // Try to find period from various sources
    let period = '';
    let clock = '';
    
    // Check event.timer object
    if (event.timer) {
      const timer = event.timer;
      if (timer.q) period = `Q${timer.q}`;
      else if (timer.tt) period = `Q${timer.tt}`;
      else if (timer.period) {
        const periodLower = timer.period.toLowerCase();
        if (periodLower.includes('overtime') || periodLower.includes('overtimer') || periodLower === 'ot') {
          period = 'OT';
        } else if (periodLower.includes('halftime')) {
          period = 'HALF';
        } else if (periodLower.includes('break')) {
          period = 'BREAK';
        } else {
          period = timer.period;
        }
      }
      
      // Check various timer formats: tm/ts, time_m/time_s, m/s
      if (timer.tm !== undefined && timer.ts !== undefined) {
        clock = `${timer.tm}:${String(timer.ts).padStart(2, '0')}`;
      } else if (timer.time_m !== undefined && timer.time_s !== undefined) {
        clock = `${timer.time_m}:${String(timer.time_s).padStart(2, '0')}`;
      } else if (timer.m !== undefined && timer.s !== undefined) {
        clock = `${timer.m}:${String(timer.s).padStart(2, '0')}`;
      } else if (timer.tr) {
        clock = timer.tr;
      } else if (timer.time) {
        clock = timer.time;
      } else if (timer.md !== undefined) {
        clock = `${timer.md}'`;
      }
    }
    
    // Helper to normalize period strings to compact format
    const normalizePeriod = (p) => {
      if (!p) return '';
      const lower = p.toString().toLowerCase().trim();
      // Overtime variations
      if (lower.includes('overtime') || lower.includes('overtimer') || lower === 'ot') return 'OT';
      // Quarter patterns: "1st Quarter", "Quarter 1", "2nd Quarter", etc.
      const quarterMatch = lower.match(/(\d)(st|nd|rd|th)?\s*quarter|quarter\s*(\d)/i);
      if (quarterMatch) {
        const qNum = quarterMatch[1] || quarterMatch[3];
        return `Q${qNum}`;
      }
      // Period patterns: "1st Period", "Period 1", "2nd Period", etc.
      const periodMatch = lower.match(/(\d)(st|nd|rd|th)?\s*period|period\s*(\d)/i);
      if (periodMatch) {
        const pNum = periodMatch[1] || periodMatch[3];
        return `P${pNum}`;
      }
      // Half patterns
      if (lower.includes('halftime') || lower.includes('half time')) return 'HALF';
      if (lower.includes('1st half') || lower === 'h1') return '1H';
      if (lower.includes('2nd half') || lower === 'h2') return '2H';
      // Break
      if (lower.includes('break')) return 'BREAK';
      // If already short (Q1, P2, etc.), return as-is uppercase
      if (/^[qph]\d$/i.test(lower)) return lower.toUpperCase();
      // Return original if no match
      return p;
    };
    
    // Check event.info for time/period
    if (event.info) {
      if (!period && event.info.period) {
        period = normalizePeriod(event.info.period);
      }
      if (!period && event.info.quarter) period = `Q${event.info.quarter}`;
      if (!clock && event.info.time) clock = event.info.time;
      if (!clock && event.info.timer) clock = event.info.timer;
      if (!clock && event.info.clock) clock = event.info.clock;
    }
    
    // Check event.extra for period/time
    if (event.extra) {
      if (!period && event.extra.period) {
        period = normalizePeriod(event.extra.period);
      }
      if (!period && event.extra.quarter) period = `Q${event.extra.quarter}`;
      if (!clock && event.extra.time) clock = event.extra.time;
    }
    
    // Check direct event fields
    if (!period && event.quarter) period = `Q${event.quarter}`;
    if (!period && event.period) {
      period = normalizePeriod(event.period);
    }
    if (!clock && event.time_live) clock = event.time_live;
    if (!clock && event.playing_time) clock = event.playing_time;
    
    // Build display clock
    if (period && clock) {
      displayClock = `${period} ${clock}`;
    } else if (clock) {
      displayClock = clock;
    } else if (period) {
      displayClock = period;
    }
    
    return {
      id: eventId,
      sport: sport,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeScore: homeScore,
      awayScore: awayScore,
      status: TIME_STATUS[event.time_status] || 'unknown',
      timeStatus: event.time_status,
      timer: event.timer,
      displayClock: displayClock,
      league: event.league?.name || event.league,
      startTime: event.time,
      odds: this.normalizeOdds(event.odds, sport),
      stats: event.stats,
      extra: event.extra,
      raw: event
    };
  }

  normalizeOdds(odds, sport = 'unknown') {
    if (!odds || typeof odds !== 'object') return null;
    
    const normalized = {};
    
    // Parse Goalserve inplay feed structure: odds[market_id].participants[]
    // Market names: "Money Line", "Asian Handicap", "Over/Under", etc.
    const markets = Object.values(odds);
    
    // Keywords that indicate period-specific markets (we want full-game only)
    const periodKeywords = ['quarter', 'half', 'period', '1st', '2nd', '3rd', '4th', 'ot', 'overtime', 'inning'];
    
    // Log all market names for debugging (per sport)
    const marketNames = markets.map(m => m?.name).filter(Boolean);
    if (marketNames.length > 0) {
      console.log(`[Inplay Odds ${sport}] All markets:`, marketNames.join(', '));
    }
    
    for (const market of markets) {
      if (!market || typeof market !== 'object' || !market.participants) continue;
      
      const marketName = (market.name || '').toLowerCase();
      const participants = Object.values(market.participants);
      
      // Skip suspended markets
      if (market.suspend === '1') continue;
      
      // Skip period-specific markets (quarters, halves, innings, etc.)
      // BUT keep "Game Lines" markets as they refer to full game
      const isPeriodMarket = periodKeywords.some(kw => marketName.includes(kw));
      const isGameLinesMarket = marketName.includes('game lines') || marketName.includes('game line') || marketName.includes('full game');
      if (isPeriodMarket && !isGameLinesMarket) continue;
      
      // Money Line / Home Away (full game only)
      // CRITICAL: Goalserve inplay feed ALSO has REVERSED labels - swap home/away odds
      if ((marketName.includes('money line') || marketName.includes('home/away') || marketName === 'home away' || marketName === 'match winner') && !normalized.moneyline) {
        // Goalserve labels: "Home" = actual away team, "Away" = actual home team
        const goalserveHomeOdd = participants.find(p => p.name === 'Home' || p.short_name === 'Home' || p.name === '1');
        const goalserveAwayOdd = participants.find(p => p.name === 'Away' || p.short_name === 'Away' || p.name === '2');
        const drawOdd = participants.find(p => p.name === 'Draw' || p.name === 'X');
        
        if ((goalserveHomeOdd && goalserveHomeOdd.suspend !== '1') || (goalserveAwayOdd && goalserveAwayOdd.suspend !== '1')) {
          normalized.moneyline = {
            home: this.parseOddsValue(goalserveAwayOdd),  // SWAP: Goalserve "Away" = actual home
            away: this.parseOddsValue(goalserveHomeOdd),  // SWAP: Goalserve "Home" = actual away
            draw: this.parseOddsValue(drawOdd)
          };
        }
      }
      
      // Asian Handicap / Spread (full game only) - match various naming patterns
      // For basketball, prioritize "Game Lines Spread" market (Bet365's primary spread)
      const isSpreadMarket = (marketName === 'asian handicap' || marketName === 'handicap' || marketName === 'spread' ||
                              marketName === 'game lines spread' || marketName.includes('spread') || marketName.includes('handicap'));
      const isPreferredSpreadMarket = (marketName === 'game lines spread' || marketName.includes('game lines'));
      
      // Only update spread if: no spread yet, OR this is the preferred market (overwrite non-preferred)
      // CRITICAL: Goalserve labels are REVERSED - "Home" = actual away, "Away" = actual home
      if (isSpreadMarket && (!normalized.spread || (isPreferredSpreadMarket && !normalized._spreadIsPreferred))) {
        // Goalserve "Home" participants = actual AWAY team spreads
        const goalserveHomeParticipants = participants.filter(p => 
          (p.name === 'Home' || p.short_name === 'Home') && p.suspend !== '1'
        );
        // Goalserve "Away" participants = actual HOME team spreads
        const goalserveAwayParticipants = participants.filter(p => 
          (p.name === 'Away' || p.short_name === 'Away') && p.suspend !== '1'
        );
        
        // Log available participants for debugging
        if (sport === 'basketball') {
          console.log(`[Inplay Basketball] Spread market "${market.name}": ${goalserveHomeParticipants.length} goalserve-home (actual away), ${goalserveAwayParticipants.length} goalserve-away (actual home) participants`);
          goalserveHomeParticipants.forEach(p => console.log(`  GS-Home (actual away): handicap=${p.handicap}, is_main=${p.is_main}, value=${p.value_eu}`));
          goalserveAwayParticipants.forEach(p => console.log(`  GS-Away (actual home): handicap=${p.handicap}, is_main=${p.is_main}, value=${p.value_eu}`));
        }
        
        // Find matching pairs by handicap magnitude
        // Goalserve "Home" = actual away team, Goalserve "Away" = actual home team
        let allPairs = [];
        
        // Iterate over Goalserve "Away" (actual home) to find matching Goalserve "Home" (actual away)
        for (const gsAway of goalserveAwayParticipants) {
          const gsAwayHcap = parseFloat(gsAway.handicap) || 0;
          // Look for matching Goalserve Home (actual away) with opposite sign
          const matchingGsHome = goalserveHomeParticipants.find(gsHome => {
            const gsHomeHcap = parseFloat(gsHome.handicap) || 0;
            return Math.abs(Math.abs(gsAwayHcap) - Math.abs(gsHomeHcap)) < 0.01;
          });
          
          if (matchingGsHome) {
            const isMainPair = gsAway.is_main === '1' || matchingGsHome.is_main === '1';
            allPairs.push({
              actualHome: gsAway,      // Goalserve "Away" = actual home
              actualAway: matchingGsHome,  // Goalserve "Home" = actual away
              isMain: isMainPair,
              absHandicap: Math.abs(gsAwayHcap)
            });
          }
        }
        
        // Sort pairs: main lines first, then by smallest handicap
        allPairs.sort((a, b) => {
          if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
          return a.absHandicap - b.absHandicap;
        });
        
        let bestPair = allPairs[0] || null;
        
        // Fallback: if no matching pair found, try to find any main line
        if (!bestPair && (goalserveHomeParticipants.length > 0 || goalserveAwayParticipants.length > 0)) {
          const mainGsAway = goalserveAwayParticipants.find(p => p.is_main === '1') || goalserveAwayParticipants[0];
          const mainGsHome = goalserveHomeParticipants.find(p => p.is_main === '1') || goalserveHomeParticipants[0];
          if (mainGsAway || mainGsHome) {
            bestPair = { actualHome: mainGsAway, actualAway: mainGsHome, isMain: false };
          }
        }
        
        if (bestPair && (bestPair.actualHome || bestPair.actualAway)) {
          normalized.spread = {
            home: { 
              line: parseFloat(bestPair.actualHome?.handicap) || 0, 
              odds: this.parseOddsValue(bestPair.actualHome) 
            },
            away: { 
              line: parseFloat(bestPair.actualAway?.handicap) || 0, 
              odds: this.parseOddsValue(bestPair.actualAway) 
            }
          };
          normalized._spreadIsPreferred = isPreferredSpreadMarket;
          
          // Debug log for basketball
          if (sport === 'basketball') {
            console.log(`[Inplay Basketball Spread] Selected from "${market.name}": Home (from GS-Away) ${bestPair.actualHome?.handicap} @ ${bestPair.actualHome?.value_eu}, Away (from GS-Home) ${bestPair.actualAway?.handicap} @ ${bestPair.actualAway?.value_eu}, isMain: ${bestPair.isMain}, preferred: ${isPreferredSpreadMarket}`);
          }
        }
      }
      
      // Over/Under / Totals (full game only - match any total-related market)
      // Basketball may call it "Points", hockey "Goals", etc.
      // Check if participants have Over/Under to identify totals markets
      const hasOverUnderParticipants = participants.some(p => 
        p.name === 'Over' || p.short_name === 'Over' || p.name === 'Under' || p.short_name === 'Under'
      );
      const isFullGameTotal = (marketName === 'over/under' || marketName === 'total' || marketName === 'totals' || 
                               marketName === 'over under' || marketName === 'game total' || marketName === 'game totals' ||
                               marketName === 'game lines total' || marketName === 'points' || marketName === 'goals' ||
                               marketName.includes('total') || marketName.includes('o/u') || marketName.includes('over/under') ||
                               (hasOverUnderParticipants && !marketName.includes('spread') && !marketName.includes('handicap')));
      
      // Debug: Log potential total market matches for basketball
      if (sport === 'basketball' && (isFullGameTotal || marketName.includes('over') || marketName.includes('under'))) {
        console.log(`[Inplay Basketball] Potential total market: "${market.name}", matched: ${isFullGameTotal}, already have: ${!!normalized.total}`);
      }
      
      if (isFullGameTotal && !normalized.total) {
        // Find main line or first available
        const mainOver = participants.find(p => (p.name === 'Over' || p.short_name === 'Over') && p.is_main === '1' && p.suspend !== '1');
        const mainUnder = participants.find(p => (p.name === 'Under' || p.short_name === 'Under') && p.is_main === '1' && p.suspend !== '1');
        
        const overOdd = mainOver || participants.find(p => (p.name === 'Over' || p.short_name === 'Over') && p.suspend !== '1');
        const underOdd = mainUnder || participants.find(p => (p.name === 'Under' || p.short_name === 'Under') && p.suspend !== '1');
        
        const line = parseFloat(overOdd?.handicap || underOdd?.handicap) || 0;
        
        if (overOdd || underOdd) {
          normalized.total = {
            line: line,
            over: this.parseOddsValue(overOdd),
            under: this.parseOddsValue(underOdd)
          };
        }
      }
    }
    
    return Object.keys(normalized).length > 0 ? normalized : null;
  }
  
  parseOddsValue(oddObj) {
    if (!oddObj || oddObj.suspend === '1') return null;
    
    // Use value_eu (European/decimal odds) and convert to American
    const decimal = parseFloat(oddObj.value_eu || oddObj.value);
    if (isNaN(decimal) || decimal <= 1) return null;
    
    // Convert decimal to American odds
    if (decimal >= 2) {
      return Math.round((decimal - 1) * 100);
    } else {
      return Math.round(-100 / (decimal - 1));
    }
  }

  processAndNotify(sport, data) {
    if (!data || data.error) return;
    
    const events = this.extractEvents(data, sport);
    const changes = [];
    
    for (const event of events) {
      const normalized = this.normalizeEvent(event, sport);
      const existing = this.events[normalized.id];
      
      if (!existing || JSON.stringify(existing) !== JSON.stringify(normalized)) {
        changes.push({
          type: existing ? 'update' : 'new',
          event: normalized
        });
        this.events[normalized.id] = normalized;
      }
    }
    
    if (changes.length > 0) {
      this.lastUpdate = new Date().toISOString();
      this.notifySubscribers({
        type: 'events',
        sport: sport,
        changes: changes,
        timestamp: this.lastUpdate
      });
    }
  }

  extractEvents(data, sport) {
    if (!data) return [];
    
    if (Array.isArray(data)) {
      return data;
    }
    
    if (data.events) {
      return Array.isArray(data.events) ? data.events : Object.values(data.events);
    }
    
    if (data.results) {
      let events = [];
      for (const league of Object.values(data.results)) {
        if (league.events) {
          events = events.concat(Object.values(league.events));
        } else if (Array.isArray(league)) {
          events = events.concat(league);
        }
      }
      return events;
    }
    
    return Object.values(data).filter(item => item && typeof item === 'object' && item.id);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(message) {
    for (const callback of this.subscribers) {
      try {
        callback(message);
      } catch (error) {
        console.error('[Goalserve Inplay] Subscriber error:', error);
      }
    }
  }

  startPolling(sports = null) {
    if (this.isPolling) return;
    
    this.isPolling = true;
    const targetSports = sports || Object.keys(INPLAY_FEEDS);
    
    console.log(`[Goalserve Inplay] Starting polling for: ${targetSports.join(', ')}`);
    
    const poll = async () => {
      if (!this.isPolling) return;
      
      for (const sport of targetSports) {
        try {
          const data = await this.fetchFeed(sport);
          this.processAndNotify(sport, data);
        } catch (error) {
        }
      }
      
      if (this.isPolling) {
        setTimeout(poll, this.pollInterval);
      }
    };
    
    poll();
    
    const pollNFLSchedule = async () => {
      if (!this.isPolling) return;
      
      try {
        await this.fetchNFLScheduleOdds();
      } catch (error) {
        console.error('[NFL Schedule Odds] Polling error:', error.message);
      }
      
      if (this.isPolling) {
        setTimeout(pollNFLSchedule, 30000);
      }
    };
    
    pollNFLSchedule();
    console.log('[Goalserve Inplay] NFL schedule odds polling started (30s interval)');
  }

  stopPolling() {
    this.isPolling = false;
    console.log('[Goalserve Inplay] Stopped polling');
  }

  getStatus() {
    return {
      isPolling: this.isPolling,
      pollInterval: this.pollInterval,
      subscriberCount: this.subscribers.size,
      eventCount: Object.keys(this.events).length,
      lastUpdate: this.lastUpdate,
      cachedSports: Array.from(this.cache.keys()),
      errors: Object.fromEntries(this.errors),
      supportedSports: Object.keys(INPLAY_FEEDS)
    };
  }

  getEvents(sport = null) {
    if (sport) {
      const mappedSport = SPORT_MAPPING[sport] || sport;
      return Object.values(this.events).filter(e => e.sport === mappedSport);
    }
    return Object.values(this.events);
  }

  // Returns events as trimmed, JSON-serializable data for SSR
  // Only includes fields needed for first paint - keeps payload small and fast
  getEventsForSSR(sport = null) {
    const events = this.getEvents(sport);
    try {
      // Trim to only essential fields for initial render
      return events.map(event => ({
        id: event.id,
        sport: event.sport,
        league: event.league,
        leagueName: event.leagueName,
        status: event.status,
        time: event.time,
        timer: event.timer,
        period: event.period,
        quarter: event.quarter,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        homeScore: event.homeScore,
        awayScore: event.awayScore,
        startTime: event.startTime,
        // Include basic odds if available
        odds: event.odds ? {
          moneyline: event.odds.moneyline,
          spread: event.odds.spread,
          total: event.odds.total
        } : null
      }));
    } catch (e) {
      console.error('[Goalserve Inplay] SSR serialization error:', e);
      return [];
    }
  }

  getLiveEvents(sport = null) {
    return this.getEvents(sport).filter(e => e.status === 'live');
  }

  getCachedData(sport) {
    return this.cache.get(sport);
  }

  mapSport(platformSport) {
    return SPORT_MAPPING[platformSport] || platformSport;
  }
}

let serviceInstance = null;

export function getInplayService() {
  if (!serviceInstance) {
    serviceInstance = new GoalserveInplayService();
  }
  return serviceInstance;
}

export default GoalserveInplayService;
