import { getInplayService } from '../../../lib/goalserve-inplay';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, eventId, keys } = req.query;
    const service = getInplayService();
    
    if (eventId) {
      const rawEvent = service.getRawEvent(eventId);
      const normalizedEvent = service.getEvents().find(e => e.id === eventId);
      
      if (!rawEvent) {
        return res.status(404).json({ 
          error: 'Event not found',
          eventId,
          availableIds: Object.keys(service.getRawEvents()).slice(0, 20)
        });
      }
      
      return res.status(200).json({
        success: true,
        eventId,
        rawEvent,
        normalizedEvent,
        allRawKeys: Object.keys(rawEvent),
        extraKeys: rawEvent.extra ? Object.keys(rawEvent.extra) : null,
        infoKeys: rawEvent.info ? Object.keys(rawEvent.info) : null,
        statsKeys: rawEvent.stats ? Object.keys(rawEvent.stats) : null,
        teamInfoKeys: rawEvent.team_info ? {
          home: rawEvent.team_info.home ? Object.keys(rawEvent.team_info.home) : null,
          away: rawEvent.team_info.away ? Object.keys(rawEvent.team_info.away) : null
        } : null
      });
    }
    
    const rawEvents = service.getRawEvents(sport);
    const events = service.getEvents(sport);
    
    if (keys === 'true') {
      const sampleEvent = Object.values(rawEvents)[0];
      return res.status(200).json({
        success: true,
        sport: sport || 'all',
        eventCount: Object.keys(rawEvents).length,
        sampleEventKeys: sampleEvent ? {
          topLevel: Object.keys(sampleEvent),
          extra: sampleEvent.extra ? Object.keys(sampleEvent.extra) : null,
          info: sampleEvent.info ? Object.keys(sampleEvent.info) : null,
          stats: sampleEvent.stats ? Object.keys(sampleEvent.stats) : null,
          markets: sampleEvent.markets ? 'array of markets' : null,
          team_info: sampleEvent.team_info ? {
            home: sampleEvent.team_info.home ? Object.keys(sampleEvent.team_info.home) : null,
            away: sampleEvent.team_info.away ? Object.keys(sampleEvent.team_info.away) : null
          } : null
        } : null
      });
    }
    
    const firstFiveRaw = Object.entries(rawEvents).slice(0, 5).reduce((acc, [id, evt]) => {
      acc[id] = evt;
      return acc;
    }, {});
    
    return res.status(200).json({
      success: true,
      sport: sport || 'all',
      totalEvents: Object.keys(rawEvents).length,
      normalizedCount: events.length,
      status: service.getStatus(),
      rawEvents: firstFiveRaw,
      eventIds: Object.keys(rawEvents)
    });

  } catch (error) {
    console.error('[Raw Inplay API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch raw inplay data',
      message: error.message 
    });
  }
}
