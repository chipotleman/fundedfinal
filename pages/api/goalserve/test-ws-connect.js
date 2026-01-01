import WebSocket from 'ws';

export default async function handler(req, res) {
  const API_KEY = process.env.GOALSERVE_API_KEY;
  const authUrl = 'http://live.goalserve.com/api/v1/auth/gettoken';
  const sport = req.query.sport || 'soccer';
  
  const results = {
    sport,
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

    const wsUrl = `ws://live.goalserve.com/ws/${sport}?tkn=${tokenData.token}`;
    results.wsUrl = wsUrl.replace(tokenData.token, '[TOKEN]');
    results.steps.push({ step: 'Connecting to WebSocket...', url: results.wsUrl });

    const wsResult = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Connection timeout (10s)' });
      }, 10000);

      try {
        const ws = new WebSocket(wsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'http://live.goalserve.com'
          }
        });
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve({ success: true, message: 'WebSocket connected!' });
          ws.close();
        });

        ws.on('message', (data) => {
          const parsed = JSON.parse(data.toString());
          resolve({ 
            success: true, 
            message: 'Received message!',
            messageType: parsed.mt,
            sport: parsed.sp,
            eventCount: parsed.evts?.length || 0
          });
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
