let goalserveWs = null;
let wsModuleAvailable = false;

try {
  goalserveWs = require('../../../lib/goalserve-ws');
  wsModuleAvailable = true;
} catch (e) {
  console.log('[Stream] WebSocket module not available in serverless environment');
}

const { getInplayService } = require('../../../lib/goalserve-inplay');
const { fetchLiveGames } = require('../../../lib/goalserve-live-serverless');

export const config = {
  api: {
    responseLimit: false,
  },
};

const DEFAULT_SPORTS = ['basket', 'hockey', 'baseball', 'amfootball'];

const isServerless = process.env.VERCEL === '1' || 
                     process.env.AWS_LAMBDA_FUNCTION_NAME || 
                     process.env.NETLIFY === 'true' ||
                     !wsModuleAvailable;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sport, eventId, source = 'websocket' } = req.query;
  
  const useServerlessFallback = isServerless || source === 'serverless';
  const useWebSocket = !useServerlessFallback && source !== 'inplay';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      console.error('[Stream] Write error:', e.message);
    }
  };

  if (useServerlessFallback) {
    await handleServerlessStream(req, res, sendEvent, sport, eventId);
  } else if (useWebSocket) {
    await handleWebSocketStream(req, res, sendEvent, sport, eventId);
  } else {
    await handleInplayStream(req, res, sendEvent, sport, eventId);
  }
}

async function handleServerlessStream(req, res, sendEvent, sport, eventId) {
  console.log('[Stream Serverless] Starting serverless-compatible stream');
  
  sendEvent({
    type: 'connected',
    source: 'serverless',
    status: {
      connectionStatus: 'serverless_polling',
      activeSports: sport ? [sport] : ['basketball_nba', 'basketball_ncaab', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb'],
      isServerless: true
    },
    timestamp: Date.now()
  });

  const fetchAndSend = async () => {
    try {
      const sportList = sport ? [sport] : null;
      const results = await fetchLiveGames(sportList);
      
      let filteredGames = results.games;
      if (eventId) {
        filteredGames = results.games.filter(g => g.id === eventId || g.id?.toString() === eventId);
      }
      
      sendEvent({
        type: 'update',
        source: 'serverless',
        events: filteredGames,
        count: filteredGames.length,
        cached: results.cached,
        isComplete: true,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[Stream Serverless] Fetch error:', err.message);
      sendEvent({
        type: 'error',
        source: 'serverless',
        message: err.message,
        timestamp: Date.now()
      });
    }
  };

  await fetchAndSend();

  const pollInterval = setInterval(fetchAndSend, 5000);

  const heartbeatInterval = setInterval(() => {
    sendEvent({
      type: 'heartbeat',
      source: 'serverless',
      timestamp: Date.now()
    });
  }, 15000);

  req.on('close', () => {
    clearInterval(pollInterval);
    clearInterval(heartbeatInterval);
  });

  req.on('error', () => {
    clearInterval(pollInterval);
    clearInterval(heartbeatInterval);
  });
}

async function handleWebSocketStream(req, res, sendEvent, sport, eventId) {
  const targetSports = sport 
    ? [goalserveWs.SPORT_MAPPING[sport] || sport] 
    : DEFAULT_SPORTS;

  let status = goalserveWs.getStatus();
  
  // Reset stuck connection states in production (serverless environment)
  if (status.connectionStatus === 'ws_access_not_enabled' || 
      status.connectionStatus === 'rate_limited' ||
      status.connectionStatus === 'disconnected') {
    console.log('[Stream WS] Resetting connection state from:', status.connectionStatus);
    goalserveWs.resetConnectionState();
    status = goalserveWs.getStatus();
  }
  
  sendEvent({
    type: 'connected',
    source: 'websocket',
    status: status,
    timestamp: Date.now()
  });

  if (status.connectionStatus !== 'connected') {
    console.log('[Stream WS] Connecting to sports:', targetSports);
    const connected = await goalserveWs.connect(targetSports);
    
    if (!connected) {
      const updatedStatus = goalserveWs.getStatus();
      
      if (updatedStatus.connectionStatus === 'ws_access_not_enabled' || 
          updatedStatus.connectionStatus === 'rate_limited') {
        console.log('[Stream WS] WebSocket unavailable, falling back to inplay');
        sendEvent({
          type: 'fallback',
          message: 'WebSocket unavailable, using inplay feeds',
          reason: updatedStatus.connectionStatus,
          timestamp: Date.now()
        });
        
        return handleInplayStream(req, res, sendEvent, sport, eventId);
      }
      
      sendEvent({
        type: 'connection_failed',
        message: updatedStatus.lastError || 'Failed to connect to WebSocket',
        status: updatedStatus,
        timestamp: Date.now()
      });
    }
  }

  const currentEvents = goalserveWs.getAllLiveEvents();
  const eventList = Object.values(currentEvents);
  
  if (eventList.length > 0) {
    const filteredEvents = sport 
      ? eventList.filter(e => e.sport === (goalserveWs.SPORT_MAPPING[sport] || sport))
      : eventList;
      
    if (filteredEvents.length > 0) {
      sendEvent({
        type: 'initial',
        source: 'websocket',
        events: filteredEvents,
        count: filteredEvents.length,
        timestamp: Date.now()
      });
    }
  }

  const availableEvents = goalserveWs.getAvailableEvents();
  if (Object.keys(availableEvents).length > 0) {
    sendEvent({
      type: 'available',
      source: 'websocket',
      data: { events: Object.values(availableEvents) },
      timestamp: Date.now()
    });
  }

  const unsubscribe = goalserveWs.subscribe((event) => {
    if (eventId && event.data?.id !== eventId) {
      return;
    }
    
    const mappedSport = sport ? (goalserveWs.SPORT_MAPPING[sport] || sport) : null;
    if (mappedSport && event.data?.sport !== mappedSport) {
      return;
    }
    
    sendEvent({
      type: event.type,
      source: 'websocket',
      data: event.data,
      timestamp: event.timestamp || Date.now()
    });
  });

  const heartbeatInterval = setInterval(() => {
    const wsStatus = goalserveWs.getStatus();
    sendEvent({ 
      type: 'heartbeat',
      source: 'websocket',
      eventCount: wsStatus.liveEventCount,
      activeSports: wsStatus.activeSports,
      lastUpdate: wsStatus.lastUpdate,
      connectionStatus: wsStatus.connectionStatus,
      timestamp: Date.now() 
    });
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
  });

  req.on('error', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
  });
}

async function handleInplayStream(req, res, sendEvent, sport, eventId) {
  const service = getInplayService();
  
  if (!service.isPolling) {
    const targetSports = sport ? [sport] : ['basketball', 'hockey', 'amfootball', 'baseball'];
    service.startPolling(targetSports);
  }

  sendEvent({
    type: 'connected',
    source: 'inplay',
    status: service.getStatus(),
    timestamp: Date.now()
  });

  let currentEvents = service.getEvents(sport);
  
  if (currentEvents.length === 0) {
    try {
      await service.fetchAllFeeds();
      currentEvents = service.getEvents(sport);
    } catch (e) {
      console.error('[Stream Inplay] Initial fetch error:', e.message);
      sendEvent({ type: 'error', message: e.message, timestamp: Date.now() });
    }
  }
  
  if (currentEvents.length > 0) {
    sendEvent({
      type: 'initial',
      source: 'inplay',
      events: currentEvents,
      count: currentEvents.length,
      timestamp: Date.now()
    });
  }

  const unsubscribe = service.subscribe((event) => {
    if (eventId && event.event?.id !== eventId) {
      return;
    }
    
    if (sport && event.sport !== sport) {
      return;
    }
    
    sendEvent({ ...event, source: 'inplay' });
  });

  const heartbeatInterval = setInterval(() => {
    const status = service.getStatus();
    sendEvent({ 
      type: 'heartbeat',
      source: 'inplay',
      eventCount: status.eventCount,
      lastUpdate: status.lastUpdate,
      timestamp: Date.now() 
    });
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
  });

  req.on('error', () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
  });
}
