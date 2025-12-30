import goalserveWs from '../../../lib/goalserve-ws';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, eventId, connect } = req.query;
    
    if (connect !== 'false') {
      const sports = sport ? [sport] : ['basketball', 'hockey', 'baseball'];
      await goalserveWs.ensureConnected(sports);
    }
    
    let events;
    
    if (eventId) {
      const event = goalserveWs.getLiveEvent(eventId);
      events = event ? { [eventId]: event } : {};
    } else if (sport) {
      events = goalserveWs.getLiveEventsBySport(sport);
    } else {
      events = goalserveWs.getAllLiveEvents();
    }
    
    const available = goalserveWs.getAvailableEvents();
    const status = goalserveWs.getStatus();
    
    res.status(200).json({
      success: true,
      status: status.connectionStatus,
      activeSports: status.activeSports,
      lastUpdate: status.lastUpdate,
      tokenValid: status.tokenValid,
      events: events,
      available: available,
      eventCount: Object.keys(events).length,
      availableCount: Object.keys(available).length
    });
  } catch (error) {
    console.error('[Goalserve WS Live] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get live events',
      message: error.message
    });
  }
}
