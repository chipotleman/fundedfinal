import goalserveWs from '../../../lib/goalserve-ws';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { connect, sport } = req.query;
    
    if (connect === 'true') {
      const sports = sport ? [sport] : ['basketball', 'hockey', 'baseball'];
      await goalserveWs.ensureConnected(sports);
    }
    
    const status = goalserveWs.getStatus();
    const liveEvents = goalserveWs.getAllLiveEvents();
    const availableEvents = goalserveWs.getAvailableEvents();
    
    res.status(200).json({
      success: true,
      ...status,
      liveEventCount: Object.keys(liveEvents).length,
      availableEventCount: Object.keys(availableEvents).length,
      supportedSports: goalserveWs.SUPPORTED_SPORTS,
      message: status.connectionStatus === 'not_configured' 
        ? 'Goalserve API key not configured. Set GOALSERVE_API_KEY environment variable.'
        : status.connectionStatus === 'connected'
        ? `Connected to: ${status.activeSports.join(', ')}`
        : `WebSocket ${status.connectionStatus}`
    });
  } catch (error) {
    console.error('[Goalserve WS Status] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get WebSocket status',
      connectionStatus: 'error',
      message: error.message
    });
  }
}
