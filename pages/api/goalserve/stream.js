const { getInplayService } = require('../../../lib/goalserve-inplay');
const { initializeGoalservePolling } = require('../../../lib/goalserve-autostart');

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sport, eventId } = req.query;

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

  // Go directly to inplay feeds (Vercel doesn't support WebSocket, we're whitelisted for inplay)
  await handleInplayStream(req, res, sendEvent, sport, eventId);
}

async function handleInplayStream(req, res, sendEvent, sport, eventId) {
  initializeGoalservePolling();
  const service = getInplayService();

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
