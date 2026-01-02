import goalserveWs from '../../../lib/goalserve-ws';

const STATUS_MESSAGES = {
  'not_configured': 'Goalserve API key not configured. Set GOALSERVE_API_KEY environment variable.',
  'connected': 'WebSocket connected and receiving live updates.',
  'ws_access_not_enabled': 'WebSocket access requires a separate Goalserve subscription. The REST API will be used for live data instead. Contact Goalserve support to enable WebSocket access.',
  'rate_limited': 'Rate limited by Goalserve API. Please try again later.',
  'auth_failed': 'WebSocket authentication failed. Check API key or contact Goalserve support.',
  'connection_error': 'Failed to connect to Goalserve WebSocket server.',
  'disconnected': 'WebSocket disconnected. REST API polling is available as fallback.',
  'failed': 'WebSocket connection failed after multiple attempts.'
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { connect, sport, reset } = req.query;
    
    // Reset connection state if requested (clears cached errors)
    if (reset === 'true') {
      goalserveWs.resetConnectionState();
    }
    
    if (connect === 'true') {
      // Use Goalserve WebSocket sport identifiers
      const sports = sport ? [sport] : ['basket', 'hockey', 'baseball', 'amfootball'];
      console.log('[Goalserve WS Status] Attempting to connect to:', sports);
      const connected = await goalserveWs.connect(sports);
      console.log('[Goalserve WS Status] Connection result:', connected);
    }
    
    const status = goalserveWs.getStatus();
    const liveEvents = goalserveWs.getAllLiveEvents();
    const availableEvents = goalserveWs.getAvailableEvents();
    
    const message = status.connectionStatus === 'connected' && status.activeSports.length > 0
      ? `Connected to: ${status.activeSports.join(', ')}`
      : STATUS_MESSAGES[status.connectionStatus] || `WebSocket ${status.connectionStatus}`;
    
    const wsAvailable = status.connectionStatus === 'connected';
    const restFallbackActive = !wsAvailable && status.connectionStatus !== 'not_configured';
    
    res.status(200).json({
      success: true,
      ...status,
      liveEventCount: Object.keys(liveEvents).length,
      availableEventCount: Object.keys(availableEvents).length,
      supportedSports: goalserveWs.SUPPORTED_SPORTS,
      wsAvailable,
      restFallbackActive,
      message,
      recommendation: !wsAvailable ? 'Use /api/goalserve/live for REST API polling (30-second cache)' : null
    });
  } catch (error) {
    console.error('[Goalserve WS Status] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get WebSocket status',
      connectionStatus: 'error',
      message: error.message,
      recommendation: 'Use /api/goalserve/live for REST API polling as fallback'
    });
  }
}
