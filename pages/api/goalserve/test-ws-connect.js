import WebSocket from 'ws';

export default async function handler(req, res) {
  const API_KEY = process.env.GOALSERVE_API_KEY;
  const authUrl = 'http://live.goalserve.com/api/v1/auth/gettoken';
  const sport = req.query.sport || 'soccer';
  const format = req.query.format || '1';
  
  const results = {
    sport,
    format,
    timestamp: new Date().toISOString(),
    steps: []
  };

  try {
    results.steps.push({ step: 'Getting JWT token...' });
    
    const tokenResponse = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: API_KEY })
    });

    if (!tokenResponse.ok) {
      results.steps.push({ step: 'Token request failed', status: tokenResponse.status });
      return res.status(200).json(results);
    }

    const tokenData = await tokenResponse.json();
    results.steps.push({ step: 'Got token', tokenPrefix: tokenData.token?.substring(0, 20) + '...' });

    const token = tokenData.token;
    const encodedToken = encodeURIComponent(token);
    
    let wsUrl;
    switch (format) {
      case '1':
        wsUrl = `ws://live.goalserve.com/ws/${sport}?tkn=${encodedToken}`;
        break;
      case '2':
        wsUrl = `wss://live.goalserve.com/ws/${sport}?tkn=${encodedToken}`;
        break;
      case '3':
        wsUrl = `ws://live.goalserve.com?token=${encodedToken}`;
        break;
      case '4':
        wsUrl = `wss://live.goalserve.com?token=${encodedToken}`;
        break;
      case '5':
        wsUrl = `ws://live.goalserve.com/ws/${sport}?token=${encodedToken}`;
        break;
      case '6':
        wsUrl = `wss://live.goalserve.com/ws/${sport}?token=${encodedToken}`;
        break;
      default:
        wsUrl = `ws://live.goalserve.com/ws/${sport}?tkn=${encodedToken}`;
    }
    
    results.wsUrl = wsUrl.replace(token, '[TOKEN]').replace(encodedToken, '[TOKEN]');
    results.steps.push({ step: 'Connecting to WebSocket...', url: results.wsUrl });

    const wsResult = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Connection timeout (10s)' });
      }, 10000);

      try {
        const ws = new WebSocket(wsUrl);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          results.steps.push({ step: 'Connection opened! Waiting for message...' });
          ws.send(JSON.stringify({ action: 'subscribe', sport: sport }));
        });

        ws.on('message', (data) => {
          clearTimeout(timeout);
          try {
            const parsed = JSON.parse(data.toString());
            resolve({ 
              success: true, 
              message: 'Received message!',
              messageType: parsed.mt || parsed.type || Object.keys(parsed)[0],
              dataKeys: Object.keys(parsed).slice(0, 5)
            });
          } catch (e) {
            resolve({ 
              success: true, 
              message: 'Received non-JSON message',
              raw: data.toString().substring(0, 100)
            });
          }
          ws.close();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });

        ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          if (code !== 1000) {
            resolve({ success: false, error: `Closed: ${code} - ${reason}` });
          }
        });
        
        ws.on('unexpected-response', (request, response) => {
          clearTimeout(timeout);
          let body = '';
          response.on('data', (chunk) => { body += chunk; });
          response.on('end', () => {
            resolve({ 
              success: false, 
              error: `HTTP ${response.statusCode}: ${response.statusMessage}`,
              headers: response.headers,
              body: body.substring(0, 200)
            });
          });
        });
      } catch (e) {
        clearTimeout(timeout);
        resolve({ success: false, error: e.message });
      }
    });

    results.steps.push({ step: 'WebSocket result', ...wsResult });
    results.success = wsResult.success;
    results.wsConnected = wsResult.success;

  } catch (error) {
    results.success = false;
    results.error = error.message;
  }

  res.status(200).json(results);
}
