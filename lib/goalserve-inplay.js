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

// Helper to format team names - keep all-uppercase abbreviations, title-case the rest
function formatTeamName(name) {
  if (!name) return '';
  
  // Split on spaces and format each word
  return name.split(' ').map(word => {
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

  normalizeEvent(event, sport) {
    
    // Extract team names from various formats
    let homeTeam = event.home?.name || event.home || '';
    let awayTeam = event.away?.name || event.away || '';
    
    // Check stats for team names if not found
    if ((!homeTeam || !awayTeam) && event.stats) {
      const teamStat = Object.values(event.stats).find(s => s.name === 'ITeam');
      if (teamStat) {
        homeTeam = homeTeam || teamStat.home || '';
        awayTeam = awayTeam || teamStat.away || '';
      }
    }
    
    // Format team names with consistent title case
    homeTeam = formatTeamName(homeTeam);
    awayTeam = formatTeamName(awayTeam);
    
    // Generate ID if not present - use combination of sport, teams, and date
    let eventId = event.id;
    if (!eventId && homeTeam && awayTeam) {
      eventId = `${sport}_${homeTeam.replace(/\s+/g, '_')}_vs_${awayTeam.replace(/\s+/g, '_')}`.toLowerCase();
    } else if (!eventId) {
      eventId = `${sport}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Parse score - priority: info.score > team_info.home/away.score > ss > stats.T
    let homeScore = 0, awayScore = 0;
    
    // First try info.score (most accurate real-time)
    if (event.info?.score) {
      const scores = event.info.score.split(':');
      homeScore = parseInt(scores[0]) || 0;
      awayScore = parseInt(scores[1]) || 0;
    }
    // Then try team_info scores
    else if (event.team_info?.home?.score) {
      homeScore = parseInt(event.team_info.home.score) || 0;
      awayScore = parseInt(event.team_info.away?.score) || 0;
    }
    // Then try ss field
    else if (event.ss) {
      const scores = event.ss.split('-');
      homeScore = parseInt(scores[0]) || 0;
      awayScore = parseInt(scores[1]) || 0;
    }
    // Finally try stats.T (total score)
    else if (event.stats) {
      const totalStat = Object.values(event.stats).find(s => s.name === 'T');
      if (totalStat) {
        homeScore = parseInt(totalStat.home) || 0;
        awayScore = parseInt(totalStat.away) || 0;
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
    
    // Determine live status from multiple sources
    // Inplay feeds use core.stopped: "0" = live, "1" = stopped/paused
    // Also check time_status for other feed formats
    let status = 'unknown';
    if (event.core) {
      // Inplay feed format
      if (event.core.removed === '1') {
        status = 'ended';
      } else if (event.core.stopped === '0') {
        status = 'live';
      } else if (event.core.stopped === '1') {
        status = 'paused'; // Game is paused/timeout but still active
      }
    } else if (event.time_status !== undefined) {
      // Standard feed format
      status = TIME_STATUS[event.time_status] || 'unknown';
    } else if (displayClock) {
      // If we have a display clock, assume it's live
      status = 'live';
    }
    
    return {
      id: eventId,
      sport: sport,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeScore: homeScore,
      awayScore: awayScore,
      status: status,
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
      if ((marketName.includes('money line') || marketName.includes('home/away') || marketName === 'home away' || marketName === 'match winner') && !normalized.moneyline) {
        const homeOdd = participants.find(p => p.name === 'Home' || p.short_name === 'Home' || p.name === '1');
        const awayOdd = participants.find(p => p.name === 'Away' || p.short_name === 'Away' || p.name === '2');
        const drawOdd = participants.find(p => p.name === 'Draw' || p.name === 'X');
        
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
      if (isSpreadMarket && (!normalized.spread || (isPreferredSpreadMarket && !normalized._spreadIsPreferred))) {
        // Separate home and away participants
        const homeParticipants = participants.filter(p => 
          (p.name === 'Home' || p.short_name === 'Home') && p.suspend !== '1'
        );
        const awayParticipants = participants.filter(p => 
          (p.name === 'Away' || p.short_name === 'Away') && p.suspend !== '1'
        );
        
        // Log available participants for debugging
        if (sport === 'basketball') {
          console.log(`[Inplay Basketball] Spread market "${market.name}": ${homeParticipants.length} home, ${awayParticipants.length} away participants`);
          homeParticipants.forEach(p => console.log(`  Home: handicap=${p.handicap}, is_main=${p.is_main}, value=${p.value_eu}`));
          awayParticipants.forEach(p => console.log(`  Away: handicap=${p.handicap}, is_main=${p.is_main}, value=${p.value_eu}`));
        }
        
        // Find matching pairs by handicap magnitude (home = -X, away = +X)
        // Priority: 1) is_main flag, 2) smallest absolute handicap (closest line)
        let allPairs = [];
        
        for (const home of homeParticipants) {
          const homeHcap = parseFloat(home.handicap) || 0;
          // Look for away with matching magnitude (opposite sign)
          const matchingAway = awayParticipants.find(away => {
            const awayHcap = parseFloat(away.handicap) || 0;
            return Math.abs(Math.abs(homeHcap) - Math.abs(awayHcap)) < 0.01;
          });
          
          if (matchingAway) {
            const isMainPair = home.is_main === '1' || matchingAway.is_main === '1';
            allPairs.push({
              home,
              away: matchingAway,
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
            bestPair = { home: mainHome, away: mainAway, isMain: false };
          }
        }
        
        if (bestPair && (bestPair.home || bestPair.away)) {
          normalized.spread = {
            home: { 
              line: parseFloat(bestPair.home?.handicap) || 0, 
              odds: this.parseOddsValue(bestPair.home) 
            },
            away: { 
              line: parseFloat(bestPair.away?.handicap) || 0, 
              odds: this.parseOddsValue(bestPair.away) 
            }
          };
          normalized._spreadIsPreferred = isPreferredSpreadMarket;
          
          // Debug log for basketball
          if (sport === 'basketball') {
            console.log(`[Inplay Basketball Spread] Selected from "${market.name}": Home ${bestPair.home?.handicap} @ ${bestPair.home?.value_eu}, Away ${bestPair.away?.handicap} @ ${bestPair.away?.value_eu}, isMain: ${bestPair.isMain}, preferred: ${isPreferredSpreadMarket}`);
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

  getLiveEvents(sport = null) {
    return this.getEvents(sport).filter(e => e.status === 'live' || e.status === 'paused');
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
