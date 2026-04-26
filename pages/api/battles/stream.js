import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
const { subscribeBattleEvents, subscribeGlobalEvents } = require('../../../lib/battle-events');

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // Connection closed
    }
  };

  send({ type: 'connected', ts: Date.now() });

  const unsubscribeUser = subscribeBattleEvents(userId, (event) => {
    send(event);
  });
  // Also subscribe to the global channel so events meant for every
  // connected client (currently `highlights:refresh` for the /battle
  // recent-winners strip) reach this user too.
  const unsubscribeGlobal = subscribeGlobalEvents((event) => {
    send(event);
  });

  const heartbeat = setInterval(() => {
    send({ type: 'heartbeat', ts: Date.now() });
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribeUser();
    unsubscribeGlobal();
    try { res.end(); } catch (_e) {}
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
}
