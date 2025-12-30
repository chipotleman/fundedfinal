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
    
    // Generate ID if not present - use combination of sport, teams, and date
    let eventId = event.id;
    if (!eventId && homeTeam && awayTeam) {
      eventId = `${sport}_${homeTeam.replace(/\s+/g, '_')}_vs_${awayTeam.replace(/\s+/g, '_')}`.toLowerCase();
    } else if (!eventId) {
      eventId = `${sport}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Parse score from ss field or stats
    let homeScore = 0, awayScore = 0;
    if (event.ss) {
      const scores = event.ss.split('-');
      homeScore = parseInt(scores[0]) || 0;
      awayScore = parseInt(scores[1]) || 0;
    } else if (event.stats) {
      // Try T (total) or Half from stats
      const totalStat = Object.values(event.stats).find(s => s.name === 'T' || s.name === 'Half');
      if (totalStat) {
        homeScore = parseInt(totalStat.home) || 0;
        awayScore = parseInt(totalStat.away) || 0;
      }
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
      league: event.league?.name || event.league,
      startTime: event.time,
      odds: this.normalizeOdds(event.odds),
      stats: event.stats,
      extra: event.extra,
      raw: event
    };
  }

  normalizeOdds(odds) {
    if (!odds) return null;
    
    const normalized = {};
    
    if (odds['1_1']) {
      normalized.moneyline = {
        home: odds['1_1'].home_od,
        away: odds['1_1'].away_od,
        draw: odds['1_1'].draw_od
      };
    }
    
    if (odds['1_2']) {
      normalized.spread = {
        home: { line: odds['1_2'].handicap, odds: odds['1_2'].home_od },
        away: { line: odds['1_2'].handicap ? -parseFloat(odds['1_2'].handicap) : null, odds: odds['1_2'].away_od }
      };
    }
    
    if (odds['1_3']) {
      normalized.total = {
        line: odds['1_3'].handicap,
        over: odds['1_3'].over_od,
        under: odds['1_3'].under_od
      };
    }
    
    return normalized;
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
