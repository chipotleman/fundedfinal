const WebSocket = require('ws');

const GOALSERVE_WS_URL = process.env.GOALSERVE_WS_URL || 'wss://ws.goalserve.com';
const API_KEY = process.env.GOALSERVE_API_KEY;

const liveDataStore = {
  scores: new Map(),
  odds: new Map(),
  ballPositions: new Map(),
  lastUpdate: null,
  connectionStatus: 'disconnected',
  subscribers: new Set()
};

let wsConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 1000;

function notifySubscribers(eventType, data) {
  liveDataStore.subscribers.forEach(callback => {
    try {
      callback({ type: eventType, data, timestamp: Date.now() });
    } catch (error) {
      console.error('[Goalserve WS] Subscriber notification error:', error);
    }
  });
}

function parseScoreUpdate(data) {
  try {
    const gameId = data.match_id || data.id;
    if (!gameId) return null;
    
    return {
      gameId,
      homeScore: parseInt(data.localteam?.goals || data.home_score || 0),
      awayScore: parseInt(data.visitorteam?.goals || data.away_score || 0),
      status: data.status || data.match_status,
      timer: data.timer || data.minute,
      period: data.period || data.half,
      possession: data.possession,
      lastEvent: data.last_event,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Goalserve WS] Score parse error:', error);
    return null;
  }
}

function parseOddsUpdate(data) {
  try {
    const gameId = data.match_id || data.id;
    if (!gameId) return null;
    
    return {
      gameId,
      bookmaker: data.bookmaker || 'bet365',
      markets: {
        moneyline: {
          home: data.home_ml || data.odds?.home,
          away: data.away_ml || data.odds?.away,
          draw: data.draw_ml || data.odds?.draw
        },
        spread: {
          home: { line: data.home_spread, odds: data.home_spread_odds },
          away: { line: data.away_spread, odds: data.away_spread_odds }
        },
        total: {
          line: data.total_line || data.over_under,
          over: data.over_odds,
          under: data.under_odds
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Goalserve WS] Odds parse error:', error);
    return null;
  }
}

function parseBallPosition(data) {
  try {
    const gameId = data.match_id || data.id;
    if (!gameId) return null;
    
    return {
      gameId,
      x: parseFloat(data.ball_x || data.x || 0),
      y: parseFloat(data.ball_y || data.y || 0),
      possession: data.possession,
      state: data.game_state || data.attack_state,
      player: data.player_with_ball,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Goalserve WS] Ball position parse error:', error);
    return null;
  }
}

function handleMessage(message) {
  try {
    const data = JSON.parse(message);
    const eventType = data.type || data.event_type || 'update';
    
    switch (eventType) {
      case 'score':
      case 'scores':
      case 'livescore': {
        const scoreData = parseScoreUpdate(data.data || data);
        if (scoreData) {
          liveDataStore.scores.set(scoreData.gameId, scoreData);
          notifySubscribers('score', scoreData);
        }
        break;
      }
      
      case 'odds':
      case 'inplay_odds':
      case 'live_odds': {
        const oddsData = parseOddsUpdate(data.data || data);
        if (oddsData) {
          liveDataStore.odds.set(oddsData.gameId, oddsData);
          notifySubscribers('odds', oddsData);
        }
        break;
      }
      
      case 'ball':
      case 'position':
      case 'ball_position':
      case 'tracker': {
        const positionData = parseBallPosition(data.data || data);
        if (positionData) {
          liveDataStore.ballPositions.set(positionData.gameId, positionData);
          notifySubscribers('position', positionData);
        }
        break;
      }
      
      case 'heartbeat':
      case 'ping':
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify({ type: 'pong' }));
        }
        break;
      
      default:
        console.log('[Goalserve WS] Unknown event type:', eventType);
        notifySubscribers('unknown', data);
    }
    
    liveDataStore.lastUpdate = Date.now();
  } catch (error) {
    console.error('[Goalserve WS] Message handling error:', error);
  }
}

function connect() {
  if (!API_KEY) {
    console.warn('[Goalserve WS] No API key configured, skipping WebSocket connection');
    return;
  }
  
  if (!process.env.GOALSERVE_WS_URL) {
    console.log('[Goalserve WS] WebSocket URL not configured - contact Goalserve for WS access');
    liveDataStore.connectionStatus = 'not_configured';
    return;
  }
  
  try {
    const wsUrl = `${GOALSERVE_WS_URL}?apikey=${API_KEY}`;
    console.log('[Goalserve WS] Connecting to WebSocket...');
    
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.on('open', () => {
      console.log('[Goalserve WS] Connected successfully');
      liveDataStore.connectionStatus = 'connected';
      reconnectAttempts = 0;
      
      wsConnection.send(JSON.stringify({
        type: 'subscribe',
        sports: ['basketball_nba', 'americanfootball_nfl', 'basketball_ncaab', 
                 'americanfootball_ncaaf', 'baseball_mlb', 'icehockey_nhl'],
        feeds: ['scores', 'odds', 'ball_position']
      }));
    });
    
    wsConnection.on('message', (data) => {
      handleMessage(data.toString());
    });
    
    wsConnection.on('close', (code, reason) => {
      console.log(`[Goalserve WS] Connection closed: ${code} - ${reason}`);
      liveDataStore.connectionStatus = 'disconnected';
      scheduleReconnect();
    });
    
    wsConnection.on('error', (error) => {
      console.error('[Goalserve WS] Connection error:', error.message);
      liveDataStore.connectionStatus = 'error';
    });
    
  } catch (error) {
    console.error('[Goalserve WS] Failed to connect:', error);
    liveDataStore.connectionStatus = 'error';
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[Goalserve WS] Max reconnection attempts reached');
    liveDataStore.connectionStatus = 'failed';
    return;
  }
  
  const delay = RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;
  
  console.log(`[Goalserve WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  setTimeout(connect, delay);
}

function disconnect() {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  liveDataStore.connectionStatus = 'disconnected';
}

function subscribe(callback) {
  liveDataStore.subscribers.add(callback);
  return () => liveDataStore.subscribers.delete(callback);
}

function getLiveScore(gameId) {
  return liveDataStore.scores.get(gameId) || null;
}

function getLiveOdds(gameId) {
  return liveDataStore.odds.get(gameId) || null;
}

function getBallPosition(gameId) {
  return liveDataStore.ballPositions.get(gameId) || null;
}

function getAllLiveData() {
  return {
    scores: Object.fromEntries(liveDataStore.scores),
    odds: Object.fromEntries(liveDataStore.odds),
    ballPositions: Object.fromEntries(liveDataStore.ballPositions),
    connectionStatus: liveDataStore.connectionStatus,
    lastUpdate: liveDataStore.lastUpdate,
    subscriberCount: liveDataStore.subscribers.size
  };
}

function getStatus() {
  return {
    connectionStatus: liveDataStore.connectionStatus,
    lastUpdate: liveDataStore.lastUpdate,
    activeGames: liveDataStore.scores.size,
    subscriberCount: liveDataStore.subscribers.size,
    reconnectAttempts
  };
}

function ensureConnected() {
  if (liveDataStore.connectionStatus === 'not_configured') {
    return false;
  }
  if (!wsConnection && liveDataStore.connectionStatus !== 'connected' && liveDataStore.connectionStatus !== 'connecting') {
    connect();
    return true;
  }
  return liveDataStore.connectionStatus === 'connected';
}

if (process.env.GOALSERVE_WS_URL && process.env.GOALSERVE_API_KEY) {
  console.log('[Goalserve WS] Auto-connecting on module load...');
  connect();
}

module.exports = {
  connect,
  disconnect,
  subscribe,
  getLiveScore,
  getLiveOdds,
  getBallPosition,
  getAllLiveData,
  getStatus,
  ensureConnected,
  liveDataStore
};
