import { getPossessionPoller, initializePossessionPolling } from '../../../lib/live-possession-poller';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sport, gameId } = req.query;

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
      console.error('[PossessionStream] Write error:', e.message);
    }
  };

  initializePossessionPolling();
  const poller = getPossessionPoller();

  sendEvent({
    type: 'connected',
    source: 'possession',
    status: poller.getStatus(),
    timestamp: Date.now()
  });

  const currentStates = poller.getAllPossessionStates();
  let filteredStates = currentStates;
  
  if (sport) {
    filteredStates = filteredStates.filter(s => s.sportKey.includes(sport));
  }
  if (gameId) {
    filteredStates = filteredStates.filter(s => s.gameId === gameId);
  }

  sendEvent({
    type: 'initial',
    source: 'possession',
    states: filteredStates,
    count: filteredStates.length,
    timestamp: Date.now()
  });

  const unsubscribe = poller.subscribe((event) => {
    if (event.type === 'possession_update') {
      let changes = event.changes;

      if (sport) {
        changes = changes.filter(c => c.sportKey.includes(sport));
      }
      if (gameId) {
        changes = changes.filter(c => c.gameId === gameId);
      }

      if (changes.length > 0) {
        sendEvent({
          type: 'possession_update',
          source: 'possession',
          changes,
          timestamp: event.timestamp
        });
      }
    }
  });

  const heartbeatInterval = setInterval(() => {
    const status = poller.getStatus();
    sendEvent({
      type: 'heartbeat',
      source: 'possession',
      gamesTracked: status.gamesTracked,
      lastPollTime: status.lastPollTime,
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
