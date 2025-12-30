import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

export default async function handler(req, res) {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    serverInfo: {}
  };

  try {
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    results.serverInfo.outboundIP = ipData.ip;
    results.serverInfo.note = 'This is the IP that Goalserve sees when we make requests. This IP must be whitelisted.';
  } catch (e) {
    results.serverInfo.outboundIP = 'Could not determine';
    results.serverInfo.error = e.message;
  }

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
      
      const buffer = await response.arrayBuffer();
      const bufferData = Buffer.from(buffer);
      
      if (!response.ok) {
        const textContent = bufferData.toString('utf-8').substring(0, 200);
        results.tests[feed.name] = {
          status: 'failed',
          httpStatus: response.status,
          statusText: response.statusText,
          error: response.status === 403 ? 'IP not whitelisted (403 Forbidden)' : `HTTP ${response.status}`,
          preview: textContent.includes('403') || textContent.includes('Forbidden') ? 'Access denied - IP not whitelisted' : textContent.substring(0, 100)
        };
        continue;
      }
      
      const isGzip = bufferData[0] === 0x1f && bufferData[1] === 0x8b;
      
      let data;
      let dataSize;
      
      if (isGzip) {
        const decompressed = await gunzip(bufferData);
        data = JSON.parse(decompressed.toString('utf-8'));
        dataSize = decompressed.length;
      } else {
        const textContent = bufferData.toString('utf-8');
        const is403 = textContent.includes('403') || textContent.includes('Forbidden');
        
        if (is403) {
          results.tests[feed.name] = {
            status: 'failed',
            httpStatus: response.status,
            error: 'IP not whitelisted (received HTML error page)',
            preview: textContent.substring(0, 150)
          };
          continue;
        }
        
        try {
          data = JSON.parse(textContent);
          dataSize = bufferData.length;
        } catch (e) {
          results.tests[feed.name] = {
            status: 'failed',
            httpStatus: response.status,
            error: 'Response is not valid JSON',
            preview: textContent.substring(0, 150)
          };
          continue;
        }
      }
      
      const eventCount = data.events ? Object.keys(data.events).length : (typeof data === 'object' ? Object.keys(data).length : 0);
      
      results.tests[feed.name] = {
        status: 'success',
        httpStatus: response.status,
        responseTime: Date.now() - startTime,
        dataSize: dataSize,
        eventCount: eventCount,
        bookmaker: data.bm || 'unknown',
        lastUpdated: data.updated || null
      };
    } catch (error) {
      results.tests[feed.name] = {
        status: 'error',
        error: error.message === 'incorrect header check' 
          ? 'IP not whitelisted (received non-gzip response, likely HTML error page)'
          : error.message
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
      
      const responseText = await tokenResponse.text();
      let tokenData = {};
      
      try {
        tokenData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        tokenData = { parseError: true, rawResponse: responseText.substring(0, 200) };
      }
      
      const isSuccess = tokenResponse.ok && tokenData.token;
      const errorReason = !tokenResponse.ok 
        ? (tokenResponse.status === 401 ? 'IP not whitelisted or invalid API key' : `HTTP ${tokenResponse.status}`)
        : (!responseText ? 'Empty response - IP likely not whitelisted' : null);
      
      results.tests.websocket_auth = {
        status: isSuccess ? 'success' : 'failed',
        httpStatus: tokenResponse.status,
        responseTime: Date.now() - startTime,
        hasToken: !!tokenData.token,
        error: errorReason || tokenData.error || (tokenData.parseError ? 'Invalid JSON response' : null),
        rawResponse: !isSuccess ? (responseText.substring(0, 100) || '(empty)') : undefined
      };
    } catch (error) {
      results.tests.websocket_auth = {
        status: 'error',
        error: error.message === 'Unexpected end of JSON input' 
          ? 'Empty response from Goalserve - IP not whitelisted'
          : error.message
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
