import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

export default async function handler(req, res) {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  const httpFeeds = [
    { name: 'basketball', url: 'http://inplay.goalserve.com/inplay-basket.gz' },
    { name: 'hockey', url: 'http://inplay.goalserve.com/inplay-hockey.gz' },
    { name: 'amfootball', url: 'http://inplay.goalserve.com/inplay-amfootball.gz' }
  ];

  for (const feed of httpFeeds) {
    try {
      const startTime = Date.now();
      const response = await fetch(feed.url, {
        headers: { 'Accept-Encoding': 'gzip' }
      });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const decompressed = await gunzip(Buffer.from(buffer));
        const data = JSON.parse(decompressed.toString('utf-8'));
        
        results.tests[feed.name] = {
          status: 'success',
          httpStatus: response.status,
          responseTime: Date.now() - startTime,
          dataSize: decompressed.length,
          eventCount: typeof data === 'object' ? Object.keys(data).length : 'unknown'
        };
      } else {
        results.tests[feed.name] = {
          status: 'failed',
          httpStatus: response.status,
          statusText: response.statusText,
          error: response.status === 403 ? 'IP not whitelisted' : 'Access denied'
        };
      }
    } catch (error) {
      results.tests[feed.name] = {
        status: 'error',
        error: error.message
      };
    }
  }

  const apiKey = process.env.GOALSERVE_API_KEY;
  if (apiKey) {
    try {
      const startTime = Date.now();
      const tokenResponse = await fetch('http://live.goalserve.com/api/v1/auth/gettoken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      const tokenData = await tokenResponse.json();
      
      results.tests.websocket_auth = {
        status: tokenResponse.ok ? 'success' : 'failed',
        httpStatus: tokenResponse.status,
        responseTime: Date.now() - startTime,
        hasToken: !!tokenData.token,
        error: tokenData.error || (tokenResponse.status === 401 ? 'IP not whitelisted or invalid API key' : null)
      };
    } catch (error) {
      results.tests.websocket_auth = {
        status: 'error',
        error: error.message
      };
    }
  } else {
    results.tests.websocket_auth = {
      status: 'skipped',
      error: 'GOALSERVE_API_KEY not configured'
    };
  }

  const allSuccess = Object.values(results.tests).every(t => t.status === 'success');
  const anySuccess = Object.values(results.tests).some(t => t.status === 'success');
  
  results.summary = {
    allTestsPassed: allSuccess,
    anyTestsPassed: anySuccess,
    recommendation: allSuccess 
      ? 'All endpoints accessible. Live data integration ready.'
      : anySuccess 
        ? 'Partial access. Some endpoints may use different IP whitelisting.'
        : 'No endpoints accessible. Confirm both IPs (52.70.127.138 and 54.92.239.253) are whitelisted with Goalserve.'
  };

  res.status(200).json(results);
}
