import { getInplayService } from '../../../lib/goalserve-inplay';

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
  const service = getInplayService();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (!service.isPolling) {
    const targetSports = sport ? [sport] : null;
    service.startPolling(targetSports);
  }

  sendEvent({
    type: 'connected',
    status: service.getStatus(),
    timestamp: Date.now()
  });

  const currentEvents = service.getEvents(sport);
  if (currentEvents.length > 0) {
    sendEvent({
      type: 'initial',
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
    
    sendEvent(event);
  });

  const heartbeatInterval = setInterval(() => {
    const status = service.getStatus();
    sendEvent({ 
      type: 'heartbeat', 
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
