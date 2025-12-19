import { fetchSportOdds, getCreditStatus, getCacheStatus } from '../../../lib/theoddsapi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { debug } = req.query;
    
    const result = await fetchSportOdds('basketball_nba');
    
    const response = {
      games: result.games,
      count: result.games.length,
      fromCache: result.fromCache,
      source: 'the-odds-api',
      creditStatus: getCreditStatus()
    };
    
    if (debug === 'true') {
      response.debugInfo = result.debugInfo;
      response.cacheStatus = getCacheStatus();
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in NBA games API:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch NBA games',
      message: error.message 
    });
  }
}
