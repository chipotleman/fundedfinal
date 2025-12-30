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

  const connected = await goalserveWs.ensureConnected(sports);
  const status = goalserveWs.getStatus();
  
  // Check if WebSocket is not available and provide clear feedback
  if (!connected) {
    const wsStatus = status.connectionStatus;
    
    // For permanent failures (401), return error with fallback recommendation
    if (wsStatus === 'ws_access_not_enabled') {
      return res.status(503).json({
        error: 'WebSocket access not enabled',
        connectionStatus: wsStatus,
        message: 'WebSocket access requires a separate Goalserve subscription. Use /api/goalserve/live for REST API polling.',
        fallback: '/api/goalserve/live'
      });
    }
    
    // For temporary failures, still start SSE but inform client
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send connection failure info so client can fall back to REST
    sendEvent({
      type: 'connection_failed',
      status: status,
      message: 'WebSocket connection failed. Use REST API polling as fallback.',
      fallback: '/api/goalserve/live',
      timestamp: Date.now()
    });

    // Close connection after informing client
    res.end();
    return;
  }

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
    status: status,
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
