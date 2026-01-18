import { getInplayService } from '../../../lib/goalserve-inplay';
import { initializeGoalservePolling, getGoalserveStatus } from '../../../lib/goalserve-autostart';

export default async function handler(req, res) {
  try {
    initializeGoalservePolling();
    
    const service = getInplayService();
    const { eventId, sport = 'hockey' } = req.query;
    
    const serviceStatus = service.getStatus();
    const autostartStatus = getGoalserveStatus();
    
    const allEvents = service.getEvents();
    const sportEvents = service.getEvents(sport);
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
        infoBallPos: rawEvent.info?.ball_pos,
        extraBallPos: rawEvent.extra?.ball_pos,
        directBallPos: rawEvent.ball_pos,
        directX: rawEvent.x,
        directY: rawEvent.y,
        infoX: rawEvent.info?.x,
        infoY: rawEvent.info?.y,
        infoState: rawEvent.info?.state
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
        extraPossessionTeam: rawEvent.extra?.possession_team,
        teamInfoHomeServe: rawEvent.team_info?.home?.Serve,
        teamInfoAwayServe: rawEvent.team_info?.away?.Serve
      }
    } : null;
    
    res.json({
      serviceStatus: {
        isPolling: serviceStatus.isPolling,
        pollInterval: serviceStatus.pollInterval,
        subscriberCount: serviceStatus.subscriberCount,
        eventCount: serviceStatus.eventCount,
        lastUpdate: serviceStatus.lastUpdate,
        cachedSports: serviceStatus.cachedSports,
        errors: serviceStatus.errors,
        supportedSports: serviceStatus.supportedSports
      },
      autostartStatus,
      
      queriedSport: sport,
      eventIdQueried: eventId || 'first available',
      
      allEventsCount: allEvents.length,
      sportEventsCount: sportEvents.length,
      normalizedEventsCount: normalizedEvents.length,
      
      allEventIds: allEvents.slice(0, 10).map(e => ({ id: e.id, sport: e.sport, homeTeam: e.homeTeam, awayTeam: e.awayTeam })),
      
      eventIdFound: specificNormalized?.id || 'none',
      serviceHasRawEvents: typeof service.getRawEvent === 'function',
      rawEventsCount: Object.keys(service.rawEvents || {}).length,
      
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
