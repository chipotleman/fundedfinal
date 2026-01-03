import { getOrchestrator } from '../../../lib/live-data-orchestrator';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  
  const orchestrator = getOrchestrator();
  orchestrator.addClient(res);
  
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
    }
  }, 15000);
  
  req.on('close', () => {
    orchestrator.removeClient(res);
    clearInterval(heartbeat);
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
