import { getScores, SUPPORTED_SPORTS } from './goalserve';

class LiveDataOrchestrator {
  constructor() {
    this.scores = {};
    this.isPolling = false;
    this.pollInterval = null;
    this.inplayAvailable = false;
    this.mode = 'rest';
    this.clients = new Set();
    this.lastPollTime = null;
    this.simulatorEnabled = false;
    this.simulatorInterval = null;
  }

  async checkInplayAccess() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('http://inplay.goalserve.com/inplay-basket.gz', {
        signal: controller.signal,
        headers: { 'Accept-Encoding': 'gzip' }
      });
      
      clearTimeout(timeout);
      this.inplayAvailable = response.ok;
      this.mode = response.ok ? 'inplay' : 'rest';
      
      console.log(`[LiveData] Inplay access: ${this.inplayAvailable ? 'AVAILABLE' : 'BLOCKED (403)'}`);
      return this.inplayAvailable;
    } catch (err) {
      this.inplayAvailable = false;
      this.mode = 'rest';
      console.log('[LiveData] Inplay access check failed:', err.message);
      return false;
    }
  }

  addClient(res) {
    this.clients.add(res);
    console.log(`[LiveData] Client connected. Total: ${this.clients.size}`);
    
    if (Object.keys(this.scores).length > 0) {
      this.sendToClient(res, {
        type: 'init',
        scores: this.scores,
        mode: this.mode,
        timestamp: Date.now()
      });
    }
    
    this.startPolling();
  }

  removeClient(res) {
    this.clients.delete(res);
    console.log(`[LiveData] Client disconnected. Total: ${this.clients.size}`);
    
    if (this.clients.size === 0) {
      this.stopPolling();
    }
  }

  sendToClient(client, data) {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      this.clients.delete(client);
    }
  }

  broadcast(data) {
    for (const client of this.clients) {
      this.sendToClient(client, data);
    }
  }

  async fetchFromRest() {
    const now = Date.now();
    const newScores = {};
    
    const sportKeys = Object.keys(SUPPORTED_SPORTS);
    
    await Promise.all(
      sportKeys.map(async (sportKey) => {
        try {
          const scores = await getScores(sportKey);
          if (scores && scores.length > 0) {
            scores.forEach(game => {
              if (game.isLive) {
                const gameId = `${sportKey}_${game.id}`;
                newScores[gameId] = {
                  id: gameId,
                  originalId: game.id,
                  sport: sportKey,
                  homeTeam: game.home_team,
                  awayTeam: game.away_team,
                  homeScore: parseInt(game.scores?.home?.total) || 0,
                  awayScore: parseInt(game.scores?.away?.total) || 0,
                  period: game.period,
                  clock: game.clock,
                  isLive: true,
                  status: game.status,
                  timestamp: now
                };
              }
            });
          }
        } catch (err) {
          console.error(`[LiveData] REST fetch error for ${sportKey}:`, err.message);
        }
      })
    );
    
    return newScores;
  }

  detectChanges(oldScores, newScores) {
    const changes = [];
    
    for (const [gameId, newGame] of Object.entries(newScores)) {
      const oldGame = oldScores[gameId];
      
      if (!oldGame) {
        changes.push({ type: 'new', game: newGame });
      } else if (
        oldGame.homeScore !== newGame.homeScore ||
        oldGame.awayScore !== newGame.awayScore ||
        oldGame.period !== newGame.period ||
        oldGame.clock !== newGame.clock
      ) {
        changes.push({ type: 'update', game: newGame, prev: oldGame });
      }
    }
    
    for (const gameId of Object.keys(oldScores)) {
      if (!newScores[gameId]) {
        changes.push({ type: 'ended', gameId });
      }
    }
    
    return changes;
  }

  startSimulator() {
    if (this.simulatorInterval) return;
    
    console.log('[LiveData] Starting subsecond simulator for development');
    this.simulatorEnabled = true;
    
    this.simulatorInterval = setInterval(() => {
      if (Object.keys(this.scores).length === 0) return;
      
      const gameIds = Object.keys(this.scores);
      if (gameIds.length === 0) return;
      
      const randomGameId = gameIds[Math.floor(Math.random() * gameIds.length)];
      const game = { ...this.scores[randomGameId] };
      
      if (Math.random() > 0.7) {
        if (Math.random() > 0.5) {
          game.homeScore += Math.random() > 0.7 ? 3 : 2;
        } else {
          game.awayScore += Math.random() > 0.7 ? 3 : 2;
        }
        
        this.scores[randomGameId] = { ...game, timestamp: Date.now() };
        
        this.broadcast({
          type: 'scores',
          scores: this.scores,
          changes: [{ type: 'update', game }],
          mode: 'simulator',
          timestamp: Date.now()
        });
      }
    }, 500);
  }

  stopSimulator() {
    if (this.simulatorInterval) {
      clearInterval(this.simulatorInterval);
      this.simulatorInterval = null;
    }
    this.simulatorEnabled = false;
  }

  async startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    
    await this.checkInplayAccess();
    
    console.log(`[LiveData] Starting polling in ${this.mode} mode`);
    
    const poll = async () => {
      try {
        const newScores = await this.fetchFromRest();
        const changes = this.detectChanges(this.scores, newScores);
        
        this.scores = newScores;
        this.lastPollTime = Date.now();
        
        this.broadcast({
          type: 'scores',
          scores: this.scores,
          changes,
          mode: this.mode,
          timestamp: Date.now()
        });
        
        if (!this.inplayAvailable && !this.simulatorEnabled && changes.length === 0) {
          this.startSimulator();
        }
      } catch (err) {
        console.error('[LiveData] Poll error:', err.message);
      }
    };
    
    await poll();
    
    const pollIntervalMs = this.inplayAvailable ? 1000 : 5000;
    this.pollInterval = setInterval(poll, pollIntervalMs);
    
    if (!this.inplayAvailable) {
      this.startSimulator();
    }
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    this.stopSimulator();
    console.log('[LiveData] Polling stopped');
  }

  getStatus() {
    return {
      mode: this.mode,
      inplayAvailable: this.inplayAvailable,
      simulatorEnabled: this.simulatorEnabled,
      isPolling: this.isPolling,
      clientCount: this.clients.size,
      gameCount: Object.keys(this.scores).length,
      lastPollTime: this.lastPollTime
    };
  }
}

let orchestratorInstance = null;

export function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new LiveDataOrchestrator();
  }
  return orchestratorInstance;
}

export default LiveDataOrchestrator;
