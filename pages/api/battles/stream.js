import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
const { subscribeBattleEvents } = require('../../../lib/battle-events');

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

  const unsubscribe = subscribeBattleEvents(userId, (event) => {
    send(event);
  });

  const heartbeat = setInterval(() => {
    send({ type: 'heartbeat', ts: Date.now() });
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    try { res.end(); } catch (_e) {}
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
}
