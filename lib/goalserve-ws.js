const WebSocket = require('ws');

const GOALSERVE_AUTH_URL = 'http://live.goalserve.com/api/v1/auth/gettoken';
const GOALSERVE_WS_BASE = 'ws://live.goalserve.com/ws';
const API_KEY = process.env.GOALSERVE_API_KEY;

// Goalserve WebSocket sport identifiers (from official docs)
const SUPPORTED_SPORTS = ['soccer', 'basket', 'tennis', 'baseball', 'amfootball', 'hockey', 'volleyball'];

// Map our internal sport names to Goalserve WebSocket identifiers
const SPORT_MAPPING = {
  'basketball_nba': 'basket',
  'basketball_ncaab': 'basket',
  'basketball': 'basket',
  'americanfootball_nfl': 'amfootball',
  'americanfootball_ncaaf': 'amfootball',
  'football': 'amfootball',
  'icehockey_nhl': 'hockey',
  'hockey': 'hockey',
  'baseball_mlb': 'baseball',
  'baseball': 'baseball',
  'soccer': 'soccer',
  'tennis': 'tennis',
  'volleyball': 'volleyball'
};

const liveDataStore = {
  events: new Map(),
  availableEvents: new Map(),
  lastUpdate: null,
  connectionStatus: 'disconnected',
  subscribers: new Set(),
  jwtToken: null,
  tokenExpiry: null,
  activeSports: new Set(),
  rateLimitCooldown: null,
  tokenFetchAttempts: 0,
  lastError: null,
  lastErrorTime: null
};

const wsConnections = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 2000;
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000;

function notifySubscribers(eventType, data) {
  liveDataStore.subscribers.forEach(callback => {
    try {
      callback({ type: eventType, data, timestamp: Date.now() });
    } catch (error) {
      console.error('[Goalserve WS] Subscriber notification error:', error);
    }
  });
}

async function getJwtToken() {
  if (!API_KEY) {
    console.warn('[Goalserve WS] No API key configured');
    liveDataStore.connectionStatus = 'not_configured';
    return null;
  }

  // Rate limit cooldown check - only skip if still in cooldown period
  if (liveDataStore.connectionStatus === 'rate_limited' && liveDataStore.rateLimitCooldown > Date.now()) {
    console.log('[Goalserve WS] Rate limit cooldown active, skipping token request');
    return null;
  }
  
  // Reset rate limit status if cooldown has expired
  if (liveDataStore.connectionStatus === 'rate_limited' && liveDataStore.rateLimitCooldown <= Date.now()) {
    console.log('[Goalserve WS] Rate limit cooldown expired, resetting status');
    liveDataStore.connectionStatus = 'disconnected';
    liveDataStore.rateLimitCooldown = null;
  }

  try {
    liveDataStore.tokenFetchAttempts++;
    console.log(`[Goalserve WS] Requesting JWT token (attempt ${liveDataStore.tokenFetchAttempts})...`);
    console.log(`[Goalserve WS] API Key present: ${API_KEY ? 'Yes (' + API_KEY.substring(0, 8) + '...)' : 'No'}`);
    console.log(`[Goalserve WS] Auth URL: ${GOALSERVE_AUTH_URL}`);
    
    // Goalserve requires JSON body with camelCase 'apiKey'
    const response = await fetch(GOALSERVE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiKey: API_KEY })
    });

    console.log(`[Goalserve WS] Token response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Goalserve WS] Token request failed:', response.status, errorText);
      
      if (response.status === 401) {
        liveDataStore.connectionStatus = 'ws_access_not_enabled';
        console.warn('[Goalserve WS] WebSocket access may not be enabled for this API key. Contact Goalserve for WebSocket access. Will not retry.');
      } else if (response.status === 429) {
        liveDataStore.connectionStatus = 'rate_limited';
        // Exponential backoff with jitter: 30s, 60s, 120s, 240s, max 10 minutes
        const backoffMs = Math.min(30000 * Math.pow(2, liveDataStore.tokenFetchAttempts - 1), 600000);
        const jitter = Math.random() * 10000;
        liveDataStore.rateLimitCooldown = Date.now() + backoffMs + jitter;
        console.warn(`[Goalserve WS] Rate limited. Cooldown for ${Math.round((backoffMs + jitter) / 1000)}s`);
      }
      return null;
    }

    const data = await response.json();
    if (data.token) {
      liveDataStore.jwtToken = data.token;
      liveDataStore.tokenExpiry = Date.now() + (55 * 60 * 1000);
      liveDataStore.tokenFetchAttempts = 0; // Reset on success
      liveDataStore.rateLimitCooldown = null;
      console.log('[Goalserve WS] JWT token obtained successfully');
      return data.token;
    } else {
      console.error('[Goalserve WS] No token in response:', data);
      return null;
    }
  } catch (error) {
    const errorMessage = error.cause ? `${error.message} - ${error.cause.message || error.cause.code}` : error.message;
    console.error('[Goalserve WS] Token request error:', errorMessage);
    liveDataStore.connectionStatus = 'connection_error';
    liveDataStore.lastError = errorMessage;
    liveDataStore.lastErrorTime = new Date().toISOString();
    return null;
  }
}

async function ensureValidToken() {
  if (!liveDataStore.jwtToken || Date.now() >= liveDataStore.tokenExpiry - TOKEN_REFRESH_MARGIN) {
    return await getJwtToken();
  }
  return liveDataStore.jwtToken;
}

function parseAvailableEvents(data) {
  try {
    const sport = data.sp;
    const events = data.evts || [];
    
    events.forEach(evt => {
      const homeName = evt.t1?.n || 'Home';
      const awayName = evt.t2?.n || 'Away';
      const eventData = {
        id: evt.id,
        mid: evt.mid,
        competitionId: evt.cmp_id,
        competitionName: evt.cmp_name,
        league: evt.cmp_name,
        homeTeam: homeName,
        awayTeam: awayName,
        homeScore: 0,
        awayScore: 0,
        team1: {
          name: homeName,
          kit: evt.t1?.kit
        },
        team2: {
          name: awayName,
          kit: evt.t2?.kit
        },
        providerId: evt.fi,
        sport: sport,
        bookmaker: data.bm,
        isLive: true,
        status: 'live',
        timestamp: Date.now()
      };
      liveDataStore.availableEvents.set(evt.id, eventData);
    });

    return events.length;
  } catch (error) {
    console.error('[Goalserve WS] Parse available events error:', error);
    return 0;
  }
}

function parseUpdateMessage(data) {
  try {
    const eventId = data.id;
    if (!eventId) return null;

    const homeScore = data.a?.[0] ?? 0;
    const awayScore = data.a?.[1] ?? 0;

    const stats = {};
    if (data.stats) {
      stats.corners = data.stats.c;
      stats.fouls = data.stats.f;
      stats.offsides = data.stats.o;
      stats.penalties = data.stats.p;
      stats.redCards = data.stats.r;
      stats.throwIns = data.stats.t;
      stats.yellowCards = data.stats.y;
      stats.substitutions = data.stats.s;
      stats.goalKicks = data.stats.g;
      stats.goals = data.stats.a;
      stats.firstHalfScore = data.stats.h1;
    }

    const comments = (data.cms || []).map(cm => ({
      id: cm.id,
      type: cm.mt,
      minute: cm.tm,
      text: cm.n,
      player: cm.p
    }));

    const rawOdds = (data.odds || []).map(odd => ({
      marketId: odd.id,
      blocked: odd.bl === 1,
      handicap: odd.ha,
      outcomes: (odd.o || []).map(o => ({
        name: o.n,
        value: o.v,
        lastValue: o.lv,
        blocked: o.b === 1
      }))
    }));
    
    // Parse odds into dashboard-friendly format
    const parsedOdds = { moneyline: {}, spread: {}, total: {} };
    rawOdds.forEach(odd => {
      if (odd.blocked) return;
      const outcomes = odd.outcomes || [];
      
      // Moneyline (market id 2 or 1x2)
      if (odd.marketId === 2 || odd.marketId === '2') {
        outcomes.forEach(o => {
          if (o.name === '1' || o.name?.toLowerCase().includes('home')) {
            parsedOdds.moneyline.home = o.value;
          } else if (o.name === '2' || o.name?.toLowerCase().includes('away')) {
            parsedOdds.moneyline.away = o.value;
          }
        });
      }
      
      // Spread/Handicap (market id 4 or handicap markets)
      if (odd.marketId === 4 || odd.marketId === '4' || odd.handicap) {
        outcomes.forEach(o => {
          const line = odd.handicap || 0;
          if (o.name === '1' || o.name?.toLowerCase().includes('home')) {
            parsedOdds.spread.home = { line: parseFloat(line), odds: o.value };
          } else if (o.name === '2' || o.name?.toLowerCase().includes('away')) {
            parsedOdds.spread.away = { line: parseFloat(-line), odds: o.value };
          }
        });
      }
      
      // Totals (market id 5 or over/under)
      if (odd.marketId === 5 || odd.marketId === '5') {
        const line = odd.handicap || 0;
        outcomes.forEach(o => {
          if (o.name?.toLowerCase().includes('over') || o.name === 'Over') {
            parsedOdds.total.line = parseFloat(line);
            parsedOdds.total.over = o.value;
          } else if (o.name?.toLowerCase().includes('under') || o.name === 'Under') {
            parsedOdds.total.under = o.value;
          }
        });
      }
    });

    const homeName = data.t1?.n || 'Home';
    const awayName = data.t2?.n || 'Away';
    
    // Format elapsed time (in seconds) to MM:SS or period display
    const elapsedSeconds = parseInt(data.et) || 0;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const formattedTime = elapsedSeconds > 0 
      ? `${minutes}:${seconds.toString().padStart(2, '0')}`
      : null;
    
    // Get period name for display
    const periodNames = {
      '1H': '1st Half', '2H': '2nd Half', 'HT': 'Halftime',
      '1P': '1st', '2P': '2nd', '3P': '3rd', 'OT': 'OT',
      '1Q': 'Q1', '2Q': 'Q2', '3Q': 'Q3', '4Q': 'Q4',
      '1': '1st', '2': '2nd', '3': '3rd', '4': '4th'
    };
    const periodDisplay = periodNames[data.pc] || data.pc;
    const displayClock = formattedTime 
      ? (periodDisplay ? `${periodDisplay} ${formattedTime}` : formattedTime)
      : periodDisplay || 'LIVE';

    const eventData = {
      id: eventId,
      mid: data.mid,
      sport: data.sp,
      bookmaker: data.bm,
      competitionId: data.cmp_id,
      competitionName: data.cmp_name,
      league: data.cmp_name,
      homeTeam: homeName,
      awayTeam: awayName,
      homeScore: homeScore,
      awayScore: awayScore,
      team1: {
        name: homeName,
        score: homeScore,
        kit: data.t1?.kit
      },
      team2: {
        name: awayName,
        score: awayScore,
        kit: data.t2?.kit
      },
      startTime: data.st,
      updatedAt: data.uptd,
      processTime: data.pt,
      elapsedTime: data.et,
      elapsedSeconds: elapsedSeconds,
      stopped: data.stp === 1,
      blocked: data.bl === 1,
      ballPosition: data.xy,
      period: data.pc,
      periodDisplay: periodDisplay,
      stateCode: data.sc,
      displayClock: displayClock,
      stats: stats,
      comments: comments,
      rawOdds: rawOdds,
      odds: parsedOdds,
      rawStat: data.stat,
      isLive: true,
      status: 'live',
      timestamp: Date.now()
    };

    return eventData;
  } catch (error) {
    console.error('[Goalserve WS] Parse update error:', error);
    return null;
  }
}

function handleMessage(sport, message) {
  try {
    const data = JSON.parse(message);
    const messageType = data.mt;

    switch (messageType) {
      case 'avl': {
        const count = parseAvailableEvents(data);
        console.log(`[Goalserve WS] ${sport}: Received ${count} available events`);
        notifySubscribers('available', { sport, count, events: data.evts });
        break;
      }

      case 'updt': {
        const eventData = parseUpdateMessage(data);
        if (eventData) {
          liveDataStore.events.set(eventData.id, eventData);
          notifySubscribers('update', eventData);
        }
        break;
      }

      default:
        console.log(`[Goalserve WS] ${sport}: Unknown message type:`, messageType);
    }

    liveDataStore.lastUpdate = Date.now();
  } catch (error) {
    console.error(`[Goalserve WS] ${sport}: Message handling error:`, error);
  }
}

async function connectToSport(sport) {
  const token = await ensureValidToken();
  if (!token) {
    console.error(`[Goalserve WS] Cannot connect to ${sport}: No valid token`);
    return false;
  }
  return connectToSportWithToken(sport, token);
}

async function connectToSportWithToken(sport, token) {
  if (wsConnections.has(sport) && wsConnections.get(sport).readyState === WebSocket.OPEN) {
    console.log(`[Goalserve WS] Already connected to ${sport}`);
    return true;
  }

  try {
    const wsUrl = `${GOALSERVE_WS_BASE}/${sport}?tkn=${token}`;
    console.log(`[Goalserve WS] Connecting to ${sport}...`);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log(`[Goalserve WS] Connected to ${sport}`);
      liveDataStore.activeSports.add(sport);
      liveDataStore.connectionStatus = 'connected';
      reconnectAttempts = 0;
      notifySubscribers('connected', { sport });
    });

    ws.on('message', (data) => {
      handleMessage(sport, data.toString());
    });

    ws.on('close', (code, reason) => {
      console.log(`[Goalserve WS] ${sport} connection closed: ${code} - ${reason}`);
      liveDataStore.activeSports.delete(sport);
      wsConnections.delete(sport);
      
      if (liveDataStore.activeSports.size === 0) {
        liveDataStore.connectionStatus = 'disconnected';
      }
      
      notifySubscribers('disconnected', { sport, code, reason: reason?.toString() });
      scheduleReconnect(sport);
    });

    ws.on('error', (error) => {
      console.error(`[Goalserve WS] ${sport} connection error:`, error.message);
      notifySubscribers('error', { sport, error: error.message });
    });

    wsConnections.set(sport, ws);
    return true;
  } catch (error) {
    console.error(`[Goalserve WS] Failed to connect to ${sport}:`, error);
    return false;
  }
}

function scheduleReconnect(sport) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[Goalserve WS] Max reconnection attempts reached for ${sport}`);
    liveDataStore.connectionStatus = 'failed';
    return;
  }

  const delay = RECONNECT_DELAY_BASE * Math.pow(2, Math.min(reconnectAttempts, 5));
  reconnectAttempts++;

  console.log(`[Goalserve WS] Reconnecting ${sport} in ${delay}ms (attempt ${reconnectAttempts})`);
  setTimeout(() => connectToSport(sport), delay);
}

async function connect(sports = ['basket', 'hockey', 'baseball', 'amfootball']) {
  if (!API_KEY) {
    console.warn('[Goalserve WS] No API key configured, skipping WebSocket connection');
    liveDataStore.connectionStatus = 'not_configured';
    return false;
  }

  // Don't retry if we know WebSocket access isn't available (401)
  if (liveDataStore.connectionStatus === 'ws_access_not_enabled') {
    console.log('[Goalserve WS] WebSocket access not enabled for this API key. Use REST API fallback.');
    return false;
  }

  // Don't retry immediately if rate limited - wait for cooldown
  if (liveDataStore.connectionStatus === 'rate_limited' && liveDataStore.rateLimitCooldown > Date.now()) {
    console.log('[Goalserve WS] Rate limited, cooldown active. Try again later.');
    return false;
  }

  console.log('[Goalserve WS] Initiating connections for:', sports);
  
  // Get token once before connecting to all sports
  const token = await ensureValidToken();
  if (!token) {
    console.error('[Goalserve WS] Failed to get JWT token, cannot connect');
    // Status is already set by getJwtToken - don't overwrite it
    return false;
  }
  
  // Now connect to each sport sequentially (they share the same token)
  const results = [];
  for (const sport of sports) {
    const result = await connectToSportWithToken(sport, token);
    results.push(result);
  }
  
  return results.some(r => r);
}

function disconnect(sport = null) {
  if (sport) {
    const ws = wsConnections.get(sport);
    if (ws) {
      ws.close();
      wsConnections.delete(sport);
      liveDataStore.activeSports.delete(sport);
    }
  } else {
    wsConnections.forEach((ws, s) => {
      ws.close();
      liveDataStore.activeSports.delete(s);
    });
    wsConnections.clear();
  }
  
  if (liveDataStore.activeSports.size === 0) {
    liveDataStore.connectionStatus = 'disconnected';
  }
}

function subscribe(callback) {
  liveDataStore.subscribers.add(callback);
  return () => liveDataStore.subscribers.delete(callback);
}

function getLiveEvent(eventId) {
  return liveDataStore.events.get(eventId) || null;
}

function getAllLiveEvents() {
  return Object.fromEntries(liveDataStore.events);
}

function getAvailableEvents() {
  return Object.fromEntries(liveDataStore.availableEvents);
}

function getLiveEventsBySport(sport) {
  const events = {};
  liveDataStore.events.forEach((event, id) => {
    if (event.sport === sport) {
      events[id] = event;
    }
  });
  return events;
}

function getStatus() {
  return {
    connectionStatus: liveDataStore.connectionStatus,
    activeSports: Array.from(liveDataStore.activeSports),
    lastUpdate: liveDataStore.lastUpdate,
    liveEventCount: liveDataStore.events.size,
    availableEventCount: liveDataStore.availableEvents.size,
    subscriberCount: liveDataStore.subscribers.size,
    tokenValid: liveDataStore.jwtToken && Date.now() < liveDataStore.tokenExpiry,
    reconnectAttempts,
    lastError: liveDataStore.lastError,
    lastErrorTime: liveDataStore.lastErrorTime
  };
}

async function ensureConnected(sports = ['basket', 'hockey', 'baseball', 'amfootball']) {
  if (!API_KEY) {
    return false;
  }
  
  const needsConnection = sports.filter(s => !liveDataStore.activeSports.has(s));
  if (needsConnection.length > 0) {
    return await connect(needsConnection);
  }
  return true;
}

setInterval(async () => {
  if (liveDataStore.jwtToken && Date.now() >= liveDataStore.tokenExpiry - TOKEN_REFRESH_MARGIN) {
    console.log('[Goalserve WS] Refreshing JWT token...');
    const newToken = await getJwtToken();
    if (newToken && liveDataStore.activeSports.size > 0) {
      const sports = Array.from(liveDataStore.activeSports);
      disconnect();
      await connect(sports);
    }
  }
}, 60 * 1000);

function resetConnectionState() {
  liveDataStore.connectionStatus = 'disconnected';
  liveDataStore.tokenFetchAttempts = 0;
  liveDataStore.rateLimitCooldown = null;
  liveDataStore.jwtToken = null;
  liveDataStore.tokenExpiry = null;
  liveDataStore.lastError = null;
  liveDataStore.lastErrorTime = null;
  console.log('[Goalserve WS] Connection state reset');
}

module.exports = {
  connect,
  disconnect,
  subscribe,
  getLiveEvent,
  getAllLiveEvents,
  getAvailableEvents,
  getLiveEventsBySport,
  getStatus,
  ensureConnected,
  connectToSport,
  getJwtToken,
  resetConnectionState,
  SUPPORTED_SPORTS,
  SPORT_MAPPING,
  liveDataStore
};
