export default async function handler(req, res) {
  const API_KEY = process.env.GOALSERVE_API_KEY;
  const authUrl = 'https://live.goalserve.com/api/v1/auth/gettoken';
  
  const results = {
    apiKeyPresent: !!API_KEY,
    apiKeyPrefix: API_KEY ? API_KEY.substring(0, 8) + '...' : null,
    authUrl,
    timestamp: new Date().toISOString()
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ apikey: API_KEY }).toString(),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    results.status = response.status;
    results.statusText = response.statusText;
    results.headers = Object.fromEntries(response.headers.entries());
    
    const text = await response.text();
    results.responseBody = text.substring(0, 500);
    
    try {
      results.responseJson = JSON.parse(text);
    } catch (e) {
      results.responseJson = null;
    }

    results.success = response.ok;
  } catch (error) {
    results.success = false;
    results.error = error.message;
    results.errorName = error.name;
    if (error.cause) {
      results.errorCause = {
        message: error.cause.message,
        code: error.cause.code
      };
    }
  }

  res.status(200).json(results);
}
