const GOALSERVE_BASE_URL = 'https://www.goalserve.com/getfeed';

const POLL_INTERVAL_MS = 5000;

const SUPPORTED_SPORTS = {
  basketball_nba: {
    name: 'NBA',
    endpoint: 'bsktbl/nba-scores'
  },
  basketball_ncaab: {
    name: 'NCAAB', 
    endpoint: 'bsktbl/ncaa-scores'
  },
  americanfootball_nfl: {
    name: 'NFL',
    endpoint: 'football/nfl-scores'
  },
  americanfootball_ncaaf: {
    name: 'NCAAF',
    endpoint: 'football/fbs-scores'
  }
};

class LivePossessionPoller {
  constructor() {
    this.possessionState = new Map();
    this.subscribers = new Set();
    this.isPolling = false;
    this.pollInterval = null;
    this.lastPollTime = null;
    this.errorCount = 0;
    this.liveGameIds = new Set();
    this.consecutivePollErrors = 0;
    this.currentPollIntervalMs = POLL_INTERVAL_MS;
    this.sportErrors = {};
    this.sportBreakerUntil = {};
  }

  getApiKey() {
    const apiKey = process.env.GOALSERVE_API_KEY;
    if (!apiKey) {
      console.error('[PossessionPoller] GOALSERVE_API_KEY not configured');
      return null;
    }
    return apiKey;
  }

  async fetchScores(sportKey) {
    const sport = SUPPORTED_SPORTS[sportKey];
    if (!sport) return null;

    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const cbUntil = this.sportBreakerUntil[sportKey] || 0;
    if (Date.now() < cbUntil) {
      return null;
    }
    
    const url = `${GOALSERVE_BASE_URL}/${apiKey}/${sport.endpoint}?json=1`;

    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(fetchTimeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      this.sportErrors[sportKey] = 0;
      delete this.sportBreakerUntil[sportKey];
      return data;
    } catch (error) {
      const errCount = (this.sportErrors[sportKey] || 0) + 1;
      this.sportErrors[sportKey] = errCount;
      if (errCount >= 3) {
        const backoffMs = Math.min(120000, POLL_INTERVAL_MS * Math.pow(2, Math.min(errCount - 3, 5)));
        this.sportBreakerUntil[sportKey] = Date.now() + backoffMs;
        if (errCount === 3 || errCount % 10 === 0) {
          console.warn(`[PossessionPoller] Circuit breaker for ${sportKey}: ${errCount} errors, backing off ${Math.round(backoffMs / 1000)}s`);
        }
      } else {
        console.error(`[PossessionPoller] Error fetching ${sportKey}:`, error.message);
      }
      return null;
    }
  }
  
  isGameLive(match) {
    const status = (match.status || '').toLowerCase();
    
    const notLiveStatuses = ['not started', 'final', 'postponed', 'cancelled', 'ended', 'ft', 'aet', 'finished'];
    if (notLiveStatuses.some(s => status.includes(s))) {
      return false;
    }
    
    const liveIndicators = ['q1', 'q2', 'q3', 'q4', 'ot', '1st', '2nd', '3rd', '4th', 
                           'half', 'halftime', 'live', 'in progress', 'playing'];
    if (liveIndicators.some(s => status.includes(s))) {
      return true;
    }
    
    if (match.timer && (match.timer.q || match.timer.period || match.timer.tm !== undefined)) {
      return true;
    }
    
    if (status && !notLiveStatuses.some(s => status.includes(s))) {
      return true;
    }
    
    return false;
  }

  extractPossessionData(data, sportKey) {
    const possessionUpdates = [];
    
    if (!data) return possessionUpdates;

    try {
      let matches = [];
      
      if (sportKey.includes('basketball')) {
        const categories = data.scores?.category;
        if (Array.isArray(categories)) {
          categories.forEach(cat => {
            const catMatches = cat.match || cat.matches?.match;
            if (Array.isArray(catMatches)) {
              matches.push(...catMatches);
            } else if (catMatches) {
              matches.push(catMatches);
            }
          });
        } else if (categories?.match) {
          matches = Array.isArray(categories.match) ? categories.match : [categories.match];
        }
      } else if (sportKey.includes('football')) {
        const weeks = data.scores?.week;
        if (Array.isArray(weeks)) {
          weeks.forEach(week => {
            const weekMatches = week.match || week.matches?.match;
            if (Array.isArray(weekMatches)) {
              matches.push(...weekMatches);
            } else if (weekMatches) {
              matches.push(weekMatches);
            }
          });
        } else if (weeks?.match) {
          matches = Array.isArray(weeks.match) ? weeks.match : [weeks.match];
        }
      }

      matches.forEach(match => {
        if (!match) return;

        if (!this.isGameLive(match)) return;

        const homeTeam = match.awayteam;
        const awayTeam = match.hometeam;
        
        if (!homeTeam || !awayTeam) return;

        const gameId = match.id || match.contestID || `${homeTeam.id}_${awayTeam.id}`;
        
        const possession = {
          home: homeTeam.posession === 'True',
          away: awayTeam.posession === 'True'
        };

        possessionUpdates.push({
          gameId: String(gameId),
          sportKey,
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          possession,
          homeScore: parseInt(homeTeam.totalscore) || 0,
          awayScore: parseInt(awayTeam.totalscore) || 0,
          status: match.status || '',
          timer: match.timer || null,
          timestamp: Date.now()
        });
      });
    } catch (error) {
      console.error(`[PossessionPoller] Error parsing ${sportKey}:`, error.message);
    }

    return possessionUpdates;
  }

  detectChanges(newUpdates) {
    const changes = [];
    const currentLiveIds = new Set();

    newUpdates.forEach(update => {
      const key = `${update.sportKey}_${update.gameId}`;
      currentLiveIds.add(key);
      
      const previous = this.possessionState.get(key);

      if (!previous) {
        this.possessionState.set(key, update);
        changes.push({ type: 'new', ...update });
        return;
      }

      const possessionChanged = 
        previous.possession.home !== update.possession.home ||
        previous.possession.away !== update.possession.away;

      const scoreChanged =
        previous.homeScore !== update.homeScore ||
        previous.awayScore !== update.awayScore;

      if (possessionChanged || scoreChanged) {
        this.possessionState.set(key, update);
        changes.push({
          type: 'update',
          possessionChanged,
          scoreChanged,
          previousPossession: previous.possession,
          ...update
        });
      }
    });

    // Prune finished games from state (games no longer in live updates)
    for (const key of this.possessionState.keys()) {
      if (!currentLiveIds.has(key)) {
        const removed = this.possessionState.get(key);
        this.possessionState.delete(key);
        changes.push({ type: 'finished', gameId: removed.gameId, sportKey: removed.sportKey });
      }
    }
    
    this.liveGameIds = currentLiveIds;
    return changes;
  }

  async pollAllSports() {
    this.lastPollTime = Date.now();
    const allUpdates = [];
    let allFailed = true;

    const sportKeys = Object.keys(SUPPORTED_SPORTS);
    
    await Promise.allSettled(
      sportKeys.map(async (sportKey) => {
        const data = await this.fetchScores(sportKey);
        if (data) allFailed = false;
        const updates = this.extractPossessionData(data, sportKey);
        allUpdates.push(...updates);
      })
    );

    const changes = this.detectChanges(allUpdates);

    if (changes.length > 0) {
      console.log(`[PossessionPoller] ${changes.length} changes detected`);
      this.notifySubscribers(changes);
    }

    if (allFailed) {
      this.consecutivePollErrors++;
      if (this.consecutivePollErrors >= 3) {
        this.adjustPollInterval();
      }
    } else {
      if (this.consecutivePollErrors > 0) {
        this.consecutivePollErrors = 0;
        this.resetPollInterval();
      }
    }

    this.errorCount = 0;
    return { updates: allUpdates, changes };
  }

  adjustPollInterval() {
    const newInterval = Math.min(120000, POLL_INTERVAL_MS * Math.pow(2, Math.min(this.consecutivePollErrors - 3, 5)));
    if (newInterval !== this.currentPollIntervalMs) {
      this.currentPollIntervalMs = newInterval;
      if (this.consecutivePollErrors === 3 || this.consecutivePollErrors % 10 === 0) {
        console.warn(`[PossessionPoller] Backing off to ${Math.round(newInterval / 1000)}s interval (${this.consecutivePollErrors} consecutive failures)`);
      }
      this.restartWithNewInterval();
    }
  }

  resetPollInterval() {
    if (this.currentPollIntervalMs !== POLL_INTERVAL_MS) {
      console.log(`[PossessionPoller] API recovered, resetting to ${POLL_INTERVAL_MS / 1000}s interval`);
      this.currentPollIntervalMs = POLL_INTERVAL_MS;
      this.restartWithNewInterval();
    }
  }

  restartWithNewInterval() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollAllSports();
      } catch (error) {
        this.errorCount++;
        console.error('[PossessionPoller] Poll error:', error.message);
        if (this.errorCount > 10) {
          console.error('[PossessionPoller] Too many errors, stopping');
          this.stopPolling();
        }
      }
    }, this.currentPollIntervalMs);
  }

  notifySubscribers(changes) {
    this.subscribers.forEach(callback => {
      try {
        callback({
          type: 'possession_update',
          changes,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('[PossessionPoller] Subscriber error:', error.message);
      }
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Auto-start polling when first subscriber joins
    if (this.subscribers.size === 1 && !this.isPolling) {
      this.startPolling();
    }
    
    return () => {
      this.subscribers.delete(callback);
      
      // Auto-stop polling when last subscriber leaves
      if (this.subscribers.size === 0 && this.isPolling) {
        console.log('[PossessionPoller] No subscribers, stopping polling');
        this.stopPolling();
      }
    };
  }

  startPolling() {
    if (this.isPolling) {
      console.log('[PossessionPoller] Already polling');
      return;
    }

    console.log('[PossessionPoller] Starting 5-second possession polling');
    this.isPolling = true;

    this.pollAllSports();

    this.pollInterval = setInterval(async () => {
      try {
        await this.pollAllSports();
      } catch (error) {
        this.errorCount++;
        console.error('[PossessionPoller] Poll error:', error.message);
        
        if (this.errorCount > 10) {
          console.error('[PossessionPoller] Too many errors, stopping');
          this.stopPolling();
        }
      }
    }, POLL_INTERVAL_MS);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('[PossessionPoller] Stopped polling');
  }

  getStatus() {
    return {
      isPolling: this.isPolling,
      lastPollTime: this.lastPollTime,
      gamesTracked: this.possessionState.size,
      subscriberCount: this.subscribers.size,
      errorCount: this.errorCount
    };
  }

  getCurrentPossession(gameId) {
    for (const [key, state] of this.possessionState) {
      if (key.includes(gameId)) {
        return state;
      }
    }
    return null;
  }

  getAllPossessionStates() {
    return Array.from(this.possessionState.values());
  }
}

let instance = null;

export function getPossessionPoller() {
  if (!instance) {
    instance = new LivePossessionPoller();
  }
  return instance;
}

export function initializePossessionPolling() {
  // Just returns the poller instance - polling auto-starts when first subscriber joins
  return getPossessionPoller();
}
