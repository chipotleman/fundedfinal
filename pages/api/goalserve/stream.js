import goalserveWs from '../../../lib/goalserve-ws';

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
  const sports = sport ? [sport] : ['basketball', 'hockey', 'baseball'];

  await goalserveWs.ensureConnected(sports);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({
    type: 'connected',
    status: goalserveWs.getStatus(),
    timestamp: Date.now()
  });

  const unsubscribe = goalserveWs.subscribe((event) => {
    if (eventId && event.data?.id !== eventId) {
      return;
    }
    
    if (sport && event.data?.sport !== sport) {
      return;
    }
    
    sendEvent(event);
  });

  const heartbeatInterval = setInterval(() => {
    sendEvent({ type: 'heartbeat', timestamp: Date.now() });
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
