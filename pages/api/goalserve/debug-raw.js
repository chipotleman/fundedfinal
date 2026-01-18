import { getGoalserveInplayService } from '../../../lib/goalserve-inplay';

export default async function handler(req, res) {
  try {
    const service = getGoalserveInplayService();
    const { eventId, sport = 'hockey' } = req.query;
    
    const normalizedEvents = service.getEventsForSSR(sport) || [];
    
    const specificNormalized = eventId 
      ? normalizedEvents.find(e => e.id === eventId || e.id?.toString() === eventId)
      : normalizedEvents[0];
    
    const rawEvent = specificNormalized?.id && service.getRawEvent
      ? service.getRawEvent(specificNormalized.id) 
      : null;
    
    const rawFieldsWithValues = rawEvent 
      ? Object.fromEntries(
          Object.entries(rawEvent).map(([key, value]) => [
            key, 
            typeof value === 'object' ? `[object: ${Object.keys(value || {}).join(', ')}]` : value
          ])
        )
      : null;
    
    const deepRawFields = rawEvent ? {
      info: rawEvent.info ? Object.keys(rawEvent.info) : null,
      extra: rawEvent.extra ? Object.keys(rawEvent.extra) : null,
      stats: rawEvent.stats ? Object.keys(rawEvent.stats) : null,
      timer: rawEvent.timer ? Object.keys(rawEvent.timer) : null,
      scores: rawEvent.scores ? Object.keys(rawEvent.scores) : null,
      odds: rawEvent.odds ? Object.keys(rawEvent.odds) : null,
      
      infoDetails: rawEvent.info || null,
      extraDetails: rawEvent.extra || null,
      statsDetails: rawEvent.stats || null,
      timerDetails: rawEvent.timer || null,
      
      xyFields: {
        directXy: rawEvent.xy,
        infoXy: rawEvent.info?.xy,
        extraXy: rawEvent.extra?.xy,
        statsXy: rawEvent.stats?.xy,
        directX: rawEvent.x,
        directY: rawEvent.y,
        infoX: rawEvent.info?.x,
        infoY: rawEvent.info?.y,
        extraX: rawEvent.extra?.x,
        extraY: rawEvent.extra?.y
      },
      
      possessionFields: {
        directPossession: rawEvent.possession,
        directAttack: rawEvent.attack,
        infoPossession: rawEvent.info?.possession,
        infoAttack: rawEvent.info?.attack,
        extraPossession: rawEvent.extra?.possession,
        extraAttack: rawEvent.extra?.attack,
        statsPossession: rawEvent.stats?.possession,
        statsAttack: rawEvent.stats?.attack,
        infoPossessionTeam: rawEvent.info?.possession_team,
        extraPossessionTeam: rawEvent.extra?.possession_team
      }
    } : null;
    
    res.json({
      sport,
      eventIdQueried: eventId || 'first available',
      eventIdFound: specificNormalized?.id || 'none',
      totalEvents: normalizedEvents.length,
      serviceHasRawEvents: typeof service.getRawEvent === 'function',
      
      normalized: specificNormalized ? {
        id: specificNormalized.id,
        homeTeam: specificNormalized.homeTeam,
        awayTeam: specificNormalized.awayTeam,
        homeScore: specificNormalized.homeScore,
        awayScore: specificNormalized.awayScore,
        status: specificNormalized.status,
        period: specificNormalized.period,
        displayClock: specificNormalized.displayClock,
        xy: specificNormalized.xy,
        possession: specificNormalized.possession,
        allFields: Object.keys(specificNormalized)
      } : null,
      
      rawTopLevelFields: rawFieldsWithValues,
      rawDeepFields: deepRawFields,
      rawEventFull: rawEvent
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
