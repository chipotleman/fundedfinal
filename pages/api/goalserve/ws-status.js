import goalserveWs from '../../../lib/goalserve-ws';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = goalserveWs.getStatus();
    const allData = goalserveWs.getAllLiveData();
    
    res.status(200).json({
      success: true,
      ...status,
      liveGamesCount: Object.keys(allData.scores).length,
      liveOddsCount: Object.keys(allData.odds).length,
      trackedPositions: Object.keys(allData.ballPositions).length,
      message: status.connectionStatus === 'not_configured' 
        ? 'WebSocket URL not configured. Contact Goalserve for WebSocket access credentials.'
        : `WebSocket ${status.connectionStatus}`
    });
  } catch (error) {
    console.error('[Goalserve WS Status] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get WebSocket status',
      connectionStatus: 'error'
    });
  }
}
