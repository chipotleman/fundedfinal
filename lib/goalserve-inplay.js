import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

// Gzip feeds for live scores (no odds)
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

// Authenticated inplay-odds feeds (contains betting odds)
// Format: https://www.goalserve.com/getfeed/{API_KEY}/{sport}/inplay-odds
// Try multiple path formats for football since Goalserve uses different conventions
const INPLAY_ODDS_SPORT_PATHS = {
  soccer: ['soccer/inplay-odds'],
  basketball: ['bsktbl/inplay-odds'],
  amfootball: ['americanfootball/inplay-odds', 'football/inplay-odds', 'amfootball/inplay-odds'],  // Try multiple paths
  hockey: ['hockey/inplay-odds'],
  baseball: ['baseball/inplay-odds']
};

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

  // Fetch inplay odds from authenticated API endpoint
  async fetchInplayOdds(sport) {
    const oddsFeedPath = INPLAY_ODDS_SPORT_PATHS[sport];
    if (!oddsFeedPath) {
      return null; // Sport not supported for odds
    }

    const apiKey = process.env.GOALSERVE_API_KEY;
    if (!apiKey) {
      return null; // No API key configured
    }

    // Try each path until one works
    const pathsToTry = Array.isArray(oddsFeedPath) ? oddsFeedPath : [oddsFeedPath];
    
    for (const path of pathsToTry) {
      const oddsUrl = `https://www.goalserve.com/getfeed/${apiKey}/${path}`;
      
      try {
        const response = await fetch(oddsUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Piks/1.0'
          }
        });

        if (!response.ok) {
          if (response.status !== 403) {
            console.log(`[Goalserve Inplay Odds] ${sport} HTTP ${response.status} - trying path: ${path}`);
          }
          continue; // Try next path
        }

        const text = await response.text();
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
          console.log(`[Goalserve Inplay Odds] ${sport} returned HTML - trying next path after: ${path}`);
          continue; // Try next path
        }

        const data = JSON.parse(text);
        console.log(`[Goalserve Inplay Odds] ${sport} SUCCESS - path: ${path}`);
        return data;
      } catch (error) {
        console.log(`[Goalserve Inplay Odds] ${sport} error on path ${path}: ${error.message}`);
        continue; // Try next path
      }
    }
    
    // All paths failed - log once
    console.log(`[Goalserve Inplay Odds] ${sport} - no working endpoint found, will use REST fallback`);
    return null;
  }

  // Merge odds data into events from gzip feed
  mergeOddsIntoEvents(sport, oddsData) {
    if (!oddsData) return;
    
    // Extract matches from odds data
    // Structure varies but typically: oddsData.scores?.category?.match or oddsData.fixtures?.category?.match
    let matches = [];
    
    try {
      // Try different structures
      const root = oddsData.scores || oddsData.fixtures || oddsData;
      
      if (root.category) {
        const categories = Array.isArray(root.category) ? root.category : [root.category];
        for (const cat of categories) {
          if (cat.match) {
            const catMatches = Array.isArray(cat.match) ? cat.match : [cat.match];
            matches = matches.concat(catMatches);
          }
          if (cat.matches?.match) {
            const catMatches = Array.isArray(cat.matches.match) ? cat.matches.match : [cat.matches.match];
            matches = matches.concat(catMatches);
          }
        }
      }
      
      if (matches.length === 0) {
        return;
      }
      
      console.log(`[Goalserve Inplay Odds] Found ${matches.length} ${sport} matches with odds`);
      
      // Merge odds into existing events
      for (const match of matches) {
        if (!match || !match.odds) continue;
        
        const matchId = match.id || match.matchId;
        if (!matchId) continue;
        
        // Find corresponding event by ID
        const eventKey = Object.keys(this.events).find(key => {
          const event = this.events[key];
          return event.raw?.id === matchId || 
                 event.id === matchId || 
                 event.id?.includes(matchId);
        });
        
        if (eventKey && this.events[eventKey]) {
          // Parse and merge odds
          const normalizedOdds = this.normalizeOdds(match.odds, sport, 
            this.events[eventKey].homeTeam, 
            this.events[eventKey].awayTeam
          );
          
          if (normalizedOdds) {
            this.events[eventKey].odds = normalizedOdds;
            console.log(`[Goalserve Inplay Odds] Merged odds for ${sport} match ${matchId}`);
          }
        }
      }
    } catch (error) {
      console.error(`[Goalserve Inplay Odds] Error merging ${sport} odds:`, error.message);
    }
  }

  async fetchAllFeeds() {
    const results = {};
    const sports = ['basketball', 'hockey', 'amfootball', 'baseball'];
    
    console.log('[Goalserve Inplay] Fetching all feeds...');
    
    // First fetch score data from gzip feeds
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
    
    // Then fetch and merge odds data from authenticated inplay-odds endpoints
    await Promise.allSettled(
      sports.map(async (sport) => {
        try {
          const oddsData = await this.fetchInplayOdds(sport);
          if (oddsData) {
            this.mergeOddsIntoEvents(sport, oddsData);
          }
        } catch (error) {
          // Silently fail - live odds optional if endpoint unavailable
        }
      })
    );
    
    const eventCount = Object.keys(this.events).length;
    console.log(`[Goalserve Inplay] Fetched all feeds, ${eventCount} total events`);
    
    return results;
  }

  normalizeEvent(event, sport) {
    
    // CRITICAL: Goalserve label conventions differ by sport
    // Basketball/Hockey: Labels are REVERSED (home=away, away=home) - SWAP needed
    // Football (amfootball): Labels are CORRECT (1=home, 2=away) - NO swap
    const isFootball = sport === 'amfootball';
    
    let homeTeam, awayTeam;
    if (isFootball) {
      // Football: NO swap - labels are correct
      homeTeam = event.home?.name || event.home || '';
      awayTeam = event.away?.name || event.away || '';
    } else {
      // Basketball/Hockey: SWAP - labels are reversed
      homeTeam = event.away?.name || event.away || '';
      awayTeam = event.home?.name || event.home || '';
    }
    
    // Check stats for team names if not found
    if ((!homeTeam || !awayTeam) && event.stats) {
      const teamStat = Object.values(event.stats).find(s => s.name === 'ITeam');
      if (teamStat) {
        if (isFootball) {
          homeTeam = homeTeam || teamStat.home || '';
          awayTeam = awayTeam || teamStat.away || '';
        } else {
          homeTeam = homeTeam || teamStat.away || '';
          awayTeam = awayTeam || teamStat.home || '';
        }
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
    // CRITICAL: Football scores are NOT reversed, but basketball/hockey ARE
    let homeScore = 0, awayScore = 0;
    
    // First try info.score (most accurate real-time)
    if (event.info?.score) {
      const scores = event.info.score.split(':');
      if (isFootball) {
        // Football: NO swap - format is "home:away"
        homeScore = parseInt(scores[0]) || 0;
        awayScore = parseInt(scores[1]) || 0;
      } else {
        // Basketball/Hockey: SWAP - format is "away:home"
        homeScore = parseInt(scores[1]) || 0;
        awayScore = parseInt(scores[0]) || 0;
      }
    }
    // Then try team_info scores
    else if (event.team_info?.home?.score || event.team_info?.away?.score) {
      if (isFootball) {
        homeScore = parseInt(event.team_info.home?.score) || 0;
        awayScore = parseInt(event.team_info.away?.score) || 0;
      } else {
        homeScore = parseInt(event.team_info.away?.score) || 0;
        awayScore = parseInt(event.team_info.home?.score) || 0;
      }
    }
    // Then try ss field
    else if (event.ss) {
      const scores = event.ss.split('-');
      if (isFootball) {
        homeScore = parseInt(scores[0]) || 0;
        awayScore = parseInt(scores[1]) || 0;
      } else {
        homeScore = parseInt(scores[1]) || 0;
        awayScore = parseInt(scores[0]) || 0;
      }
    }
    // Finally try stats.T (total score)
    else if (event.stats) {
      const totalStat = Object.values(event.stats).find(s => s.name === 'T');
      if (totalStat) {
        if (isFootball) {
          homeScore = parseInt(totalStat.home) || 0;
          awayScore = parseInt(totalStat.away) || 0;
        } else {
          homeScore = parseInt(totalStat.away) || 0;
          awayScore = parseInt(totalStat.home) || 0;
        }
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
      odds: this.normalizeOdds(event.odds, sport, homeTeam, awayTeam),
      stats: event.stats,
      extra: event.extra,
      raw: event
    };
  }

  normalizeOdds(odds, sport = 'unknown', homeTeam = '', awayTeam = '') {
    if (!odds || typeof odds !== 'object') return null;
    
    const normalized = {};
    
    // Goalserve has TWO possible structures:
    // 1. odds.type[].bookmaker[].odd[] (for REST API / some feeds)
    // 2. odds[market_id].participants[] (for other feeds)
    
    // Check if this is the type/bookmaker/odd structure
    if (odds.type) {
      return this.normalizeGoalserveTypeStructure(odds, sport, homeTeam, awayTeam);
    }
    
    // Otherwise use the participants structure
    const markets = Object.values(odds);
    
    // Keywords that indicate period-specific markets (we want full-game only)
    const periodKeywords = ['quarter', 'half', 'period', '1st', '2nd', '3rd', '4th', 'ot', 'overtime', 'inning'];
    
    // Normalize team names for fuzzy matching (football uses team names instead of Home/Away)
    const normalizeForMatch = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const homeTeamNorm = normalizeForMatch(homeTeam);
    const awayTeamNorm = normalizeForMatch(awayTeam);
    
    // Helper: Find participant by Home/Away label OR by team name match
    const findParticipant = (participants, isHome, strict = false) => {
      // First try standard Home/Away labels
      const labelMatch = participants.find(p => {
        const name = (p.name || '').toLowerCase();
        const shortName = (p.short_name || '').toLowerCase();
        if (isHome) {
          return name === 'home' || shortName === 'home' || p.name === '1';
        } else {
          return name === 'away' || shortName === 'away' || p.name === '2';
        }
      });
      
      if (labelMatch) return labelMatch;
      if (strict) return null;
      
      // Fallback: Match by team name (for football which uses actual team names)
      const teamNorm = isHome ? homeTeamNorm : awayTeamNorm;
      if (!teamNorm) return null;
      
      return participants.find(p => {
        const pName = normalizeForMatch(p.name);
        // Check if participant name contains team name or vice versa
        return pName.includes(teamNorm) || teamNorm.includes(pName);
      });
    };
    
    
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
      // For Home/Away labels: Goalserve has REVERSED labels - swap home/away odds
      // For team name labels (football): No swap needed, match directly to team names
      if ((marketName.includes('money line') || marketName.includes('home/away') || marketName === 'home away' || marketName === 'match winner') && !normalized.moneyline) {
        const drawOdd = participants.find(p => p.name === 'Draw' || p.name === 'X');
        
        // Check what type of labels we have
        const hasHomeAwayLabels = participants.some(p => 
          p.name === 'Home' || p.name === 'Away' || p.short_name === 'Home' || p.short_name === 'Away'
        );
        const hasNumericLabels = participants.some(p => p.name === '1' || p.name === '2');
        
        let homeOdd, awayOdd;
        
        if (hasHomeAwayLabels) {
          // Standard Home/Away labels - Goalserve has them REVERSED for basketball/hockey
          const goalserveHomeOdd = participants.find(p => p.name === 'Home' || p.short_name === 'Home');
          const goalserveAwayOdd = participants.find(p => p.name === 'Away' || p.short_name === 'Away');
          // SWAP: Goalserve "Away" = actual home, Goalserve "Home" = actual away
          homeOdd = goalserveAwayOdd;
          awayOdd = goalserveHomeOdd;
        } else if (hasNumericLabels) {
          // Numeric 1/2 labels - used by football
          // "1" = Home, "2" = Away - NO SWAP needed for football
          const odd1 = participants.find(p => p.name === '1');
          const odd2 = participants.find(p => p.name === '2');
          
          // For football, 1=Home, 2=Away directly (no reversal)
          if (sport === 'amfootball') {
            homeOdd = odd1;
            awayOdd = odd2;
          } else {
            // For other sports with 1/2 labels, apply same swap as Home/Away
            homeOdd = odd2;
            awayOdd = odd1;
          }
        } else {
          // Team name labels - match by team name, no swap needed
          homeOdd = findParticipant(participants, true);
          awayOdd = findParticipant(participants, false);
        }
        
        if ((homeOdd && homeOdd.suspend !== '1') || (awayOdd && awayOdd.suspend !== '1')) {
          normalized.moneyline = {
            home: this.parseOddsValue(homeOdd),
            away: this.parseOddsValue(awayOdd),
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
      // For Home/Away labels: Goalserve has them REVERSED - "Home" = actual away, "Away" = actual home
      // For team name labels (football): No swap needed, match directly to team names
      if (isSpreadMarket && (!normalized.spread || (isPreferredSpreadMarket && !normalized._spreadIsPreferred))) {
        // Check what type of labels we have
        const hasHomeAwayLabels = participants.some(p => 
          p.name === 'Home' || p.name === 'Away' || p.short_name === 'Home' || p.short_name === 'Away'
        );
        const hasNumericLabels = participants.some(p => p.name === '1' || p.name === '2');
        
        let homeParticipants, awayParticipants;
        
        if (hasHomeAwayLabels) {
          // Standard Home/Away labels - Goalserve has them REVERSED for basketball/hockey
          const goalserveHomeParticipants = participants.filter(p => 
            (p.name === 'Home' || p.short_name === 'Home') && p.suspend !== '1'
          );
          const goalserveAwayParticipants = participants.filter(p => 
            (p.name === 'Away' || p.short_name === 'Away') && p.suspend !== '1'
          );
          // SWAP for actual teams
          homeParticipants = goalserveAwayParticipants;
          awayParticipants = goalserveHomeParticipants;
        } else if (hasNumericLabels) {
          // Numeric 1/2 labels - used by football
          const odd1Participants = participants.filter(p => p.name === '1' && p.suspend !== '1');
          const odd2Participants = participants.filter(p => p.name === '2' && p.suspend !== '1');
          
          // For football, 1=Home, 2=Away directly (no reversal)
          if (sport === 'amfootball') {
            homeParticipants = odd1Participants;
            awayParticipants = odd2Participants;
          } else {
            // For other sports with 1/2 labels, apply same swap as Home/Away
            homeParticipants = odd2Participants;
            awayParticipants = odd1Participants;
          }
        } else {
          // Team name labels - match by team name, no swap needed
          homeParticipants = participants.filter(p => {
            if (p.suspend === '1') return false;
            const pName = normalizeForMatch(p.name);
            return pName.includes(homeTeamNorm) || homeTeamNorm.includes(pName);
          });
          awayParticipants = participants.filter(p => {
            if (p.suspend === '1') return false;
            const pName = normalizeForMatch(p.name);
            return pName.includes(awayTeamNorm) || awayTeamNorm.includes(pName);
          });
        }
        
        // Find matching pairs by handicap magnitude
        let allPairs = [];
        
        for (const homePart of homeParticipants) {
          const homeHcap = parseFloat(homePart.handicap) || 0;
          const matchingAway = awayParticipants.find(awayPart => {
            const awayHcap = parseFloat(awayPart.handicap) || 0;
            return Math.abs(Math.abs(homeHcap) - Math.abs(awayHcap)) < 0.01;
          });
          
          if (matchingAway) {
            const isMainPair = homePart.is_main === '1' || matchingAway.is_main === '1';
            allPairs.push({
              actualHome: homePart,
              actualAway: matchingAway,
              isMain: isMainPair,
              absHandicap: Math.abs(homeHcap)
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
        if (!bestPair && (homeParticipants.length > 0 || awayParticipants.length > 0)) {
          const mainHome = homeParticipants.find(p => p.is_main === '1') || homeParticipants[0];
          const mainAway = awayParticipants.find(p => p.is_main === '1') || awayParticipants[0];
          if (mainHome || mainAway) {
            bestPair = { actualHome: mainHome, actualAway: mainAway, isMain: false };
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
    // Also check for 'value' or 'dp3' fields
    const decimal = parseFloat(oddObj.value_eu || oddObj.dp3 || oddObj.value);
    if (isNaN(decimal) || decimal <= 1) return null;
    
    // If we have 'us' field directly, use it
    if (oddObj.us) {
      const usOdds = parseInt(oddObj.us);
      if (!isNaN(usOdds)) return usOdds;
    }
    
    // Convert decimal to American odds
    if (decimal >= 2) {
      return Math.round((decimal - 1) * 100);
    } else {
      return Math.round(-100 / (decimal - 1));
    }
  }
  
  // Handle Goalserve type/bookmaker/odd structure
  // Structure: odds.type[].bookmaker[].odd[]
  normalizeGoalserveTypeStructure(odds, sport, homeTeam, awayTeam) {
    const normalized = {};
    
    // Get types array - could be array or object
    let types = odds.type;
    if (!Array.isArray(types)) {
      types = types ? [types] : [];
    }
    
    // Prefer Bet365 bookmaker
    const preferredBookmaker = 'bet365';
    
    for (const marketType of types) {
      if (!marketType) continue;
      
      const marketName = (marketType.value || marketType.name || '').toLowerCase();
      
      // Get bookmakers - prefer Bet365
      let bookmakers = marketType.bookmaker;
      if (!Array.isArray(bookmakers)) {
        bookmakers = bookmakers ? [bookmakers] : [];
      }
      
      // Find preferred bookmaker or use first
      let bookmaker = bookmakers.find(b => b.name?.toLowerCase() === preferredBookmaker);
      if (!bookmaker) bookmaker = bookmakers[0];
      if (!bookmaker) continue;
      
      // Get odds array
      let oddsList = bookmaker.odd;
      if (!Array.isArray(oddsList)) {
        oddsList = oddsList ? [oddsList] : [];
      }
      
      // Home/Away (Moneyline)
      if ((marketName === 'home/away' || marketName.includes('money line') || marketName === 'match winner') && !normalized.moneyline) {
        // For NFL/amfootball: 1 = Home, 2 = Away (no swap)
        // For other sports with reversed Goalserve labels: swap
        const odd1 = oddsList.find(o => o.name === '1');
        const odd2 = oddsList.find(o => o.name === '2');
        const homeOdd = oddsList.find(o => o.name?.toLowerCase() === 'home');
        const awayOdd = oddsList.find(o => o.name?.toLowerCase() === 'away');
        const drawOdd = oddsList.find(o => o.name?.toLowerCase() === 'draw' || o.name === 'x');
        
        let actualHome, actualAway;
        
        if (odd1 && odd2) {
          // Numeric labels: 1=Home, 2=Away for football (no swap)
          if (sport === 'amfootball') {
            actualHome = odd1;
            actualAway = odd2;
          } else {
            // Other sports: Goalserve reverses, so swap
            actualHome = odd2;
            actualAway = odd1;
          }
        } else if (homeOdd || awayOdd) {
          // Named labels: Goalserve reverses home/away
          actualHome = awayOdd;
          actualAway = homeOdd;
        }
        
        if (actualHome || actualAway) {
          normalized.moneyline = {
            home: this.parseOddsValue(actualHome),
            away: this.parseOddsValue(actualAway),
            draw: this.parseOddsValue(drawOdd)
          };
        }
      }
      
      // Handicap (Spread) - structure: type.bookmaker.handicap[].odd[]
      if ((marketName === 'handicap' || marketName.includes('spread') || marketName === 'asian handicap') && !normalized.spread) {
        // Get handicap data - nested under bookmaker
        let handicaps = bookmaker.handicap;
        if (!Array.isArray(handicaps)) {
          handicaps = handicaps ? [handicaps] : [];
        }
        
        // Find main line or first available
        let mainHandicap = handicaps.find(h => h.main === '1') || handicaps[0];
        
        if (mainHandicap) {
          let handicapOdds = mainHandicap.odd;
          if (!Array.isArray(handicapOdds)) {
            handicapOdds = handicapOdds ? [handicapOdds] : [];
          }
          
          const odd1 = handicapOdds.find(o => o.name === '1');
          const odd2 = handicapOdds.find(o => o.name === '2');
          
          if (odd1 && odd2) {
            let homeSpread, awaySpread;
            
            if (sport === 'amfootball') {
              homeSpread = odd1;
              awaySpread = odd2;
            } else {
              homeSpread = odd2;
              awaySpread = odd1;
            }
            
            normalized.spread = {
              home: {
                line: parseFloat(homeSpread?.handicap) || 0,
                odds: this.parseOddsValue(homeSpread)
              },
              away: {
                line: parseFloat(awaySpread?.handicap) || 0,
                odds: this.parseOddsValue(awaySpread)
              }
            };
          }
        }
      }
      
      // Totals (Over/Under) - structure: type.bookmaker.total[].odd[]
      if ((marketName === 'totals' || marketName === 'over/under' || marketName.includes('total')) && !normalized.total) {
        // Get totals data - nested under bookmaker
        let totals = bookmaker.total;
        if (!Array.isArray(totals)) {
          totals = totals ? [totals] : [];
        }
        
        // Find main line or first available
        let mainTotal = totals.find(t => t.main === '1') || totals[0];
        
        if (mainTotal) {
          let totalOdds = mainTotal.odd;
          if (!Array.isArray(totalOdds)) {
            totalOdds = totalOdds ? [totalOdds] : [];
          }
          
          const overOdd = totalOdds.find(o => o.name?.toLowerCase() === 'over');
          const underOdd = totalOdds.find(o => o.name?.toLowerCase() === 'under');
          const line = parseFloat(mainTotal.name || mainTotal.line) || 0;
          
          if (overOdd || underOdd) {
            normalized.total = {
              line: line,
              over: this.parseOddsValue(overOdd),
              under: this.parseOddsValue(underOdd)
            };
          }
        }
      }
      
      // Also try direct odd[] parsing for markets that use it (like Home/Away with extra for totals)
      // Some feeds put totals line in bookmaker.extra and odds directly in bookmaker.odd
      if (!normalized.total && bookmaker.extra && oddsList.length >= 2) {
        const overOdd = oddsList.find(o => o.name?.toLowerCase() === 'over');
        const underOdd = oddsList.find(o => o.name?.toLowerCase() === 'under');
        if (overOdd || underOdd) {
          normalized.total = {
            line: parseFloat(bookmaker.extra) || 0,
            over: this.parseOddsValue(overOdd),
            under: this.parseOddsValue(underOdd)
          };
        }
      }
    }
    
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  processAndNotify(sport, data) {
    if (!data || data.error) return;
    
    const events = this.extractEvents(data, sport);
    
    // DEBUG: Log raw event structure for amfootball to find where odds are
    if (sport === 'amfootball' && events.length > 0) {
      const firstEvent = events[0];
      console.log(`[DEBUG amfootball] Raw event keys: ${Object.keys(firstEvent).join(', ')}`);
      console.log(`[DEBUG amfootball] Has odds field: ${!!firstEvent.odds}`);
      if (firstEvent.odds) {
        console.log(`[DEBUG amfootball] Odds keys: ${Object.keys(firstEvent.odds).join(', ')}`);
      }
      // Check if odds are nested elsewhere
      if (firstEvent.bet365_odds) console.log(`[DEBUG amfootball] Has bet365_odds`);
      if (firstEvent.markets) console.log(`[DEBUG amfootball] Has markets`);
      if (firstEvent.betting) console.log(`[DEBUG amfootball] Has betting`);
      if (firstEvent.bookmakers) console.log(`[DEBUG amfootball] Has bookmakers`);
    }
    
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
