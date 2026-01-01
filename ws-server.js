const WebSocket = require('ws');
const http = require('http');

const WS_PORT = process.env.WS_PORT || 3001;
const VERCEL_API_URL = process.env.VERCEL_API_URL || 'https://thepiks.com';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 1000;
const WS_SERVER_API_KEY = process.env.WS_SERVER_API_KEY;

const clients = new Set();
let lastData = null;
let lastDataHash = null;
let pollInterval = null;
let isPolling = false;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      clients: clients.size,
      isPolling,
      lastUpdate: lastData?.timestamp || null
    }));
    return;
  }
  
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      clients: clients.size,
      isPolling,
      pollInterval: POLL_INTERVAL,
      vercelUrl: VERCEL_API_URL,
      lastDataHash,
      lastUpdate: lastData?.timestamp || null,
      eventCount: lastData?.events?.length || 0
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocket.Server({ server });

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {
        console.error('[WS Server] Broadcast error:', e.message);
      }
    }
  });
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

async function fetchLiveData() {
  try {
    const headers = {};
    if (WS_SERVER_API_KEY) {
      headers['Authorization'] = `Bearer ${WS_SERVER_API_KEY}`;
    }
    
    const response = await fetch(`${VERCEL_API_URL}/api/goalserve/live-feed`, { headers });
    if (!response.ok) {
      console.error('[WS Server] Fetch failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[WS Server] Fetch error:', error.message);
    return null;
  }
}

async function pollAndBroadcast() {
  if (clients.size === 0) {
    return;
  }
  
  const data = await fetchLiveData();
  if (!data) return;
  
  const dataStr = JSON.stringify(data.events || []);
  const newHash = simpleHash(dataStr);
  
  if (newHash !== lastDataHash) {
    lastData = data;
    lastDataHash = newHash;
    
    broadcast({
      type: 'update',
      events: data.events || [],
      timestamp: Date.now(),
      source: 'vercel-proxy'
    });
    
    console.log(`[WS Server] Broadcast update to ${clients.size} clients (${data.events?.length || 0} events)`);
  }
}

function startPolling() {
  if (isPolling) return;
  
  isPolling = true;
  console.log(`[WS Server] Starting polling at ${POLL_INTERVAL}ms interval`);
  
  pollAndBroadcast();
  
  pollInterval = setInterval(pollAndBroadcast, POLL_INTERVAL);
}

function stopPolling() {
  if (!isPolling) return;
  
  isPolling = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  console.log('[WS Server] Stopped polling (no clients)');
}

wss.on('connection', (ws, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[WS Server] Client connected from ${clientIp}. Total: ${clients.size + 1}`);
  
  clients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to live data feed',
    timestamp: Date.now()
  }));
  
  if (lastData) {
    ws.send(JSON.stringify({
      type: 'initial',
      events: lastData.events || [],
      timestamp: lastData.timestamp || Date.now(),
      source: 'cache'
    }));
  }
  
  if (clients.size === 1) {
    startPolling();
  }
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      
      if (data.type === 'subscribe') {
        console.log(`[WS Server] Client subscribed to: ${data.sports?.join(', ') || 'all'}`);
      }
    } catch (e) {
      console.error('[WS Server] Message parse error:', e.message);
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS Server] Client disconnected. Remaining: ${clients.size}`);
    
    if (clients.size === 0) {
      stopPolling();
    }
  });
  
  ws.on('error', (error) => {
    console.error('[WS Server] Client error:', error.message);
    clients.delete(ws);
  });
});

server.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`[WS Server] WebSocket server running on port ${WS_PORT}`);
  console.log(`[WS Server] Fetching data from: ${VERCEL_API_URL}`);
  console.log(`[WS Server] Poll interval: ${POLL_INTERVAL}ms`);
});

process.on('SIGTERM', () => {
  console.log('[WS Server] Shutting down...');
  stopPolling();
  wss.close();
  server.close();
  process.exit(0);
});
