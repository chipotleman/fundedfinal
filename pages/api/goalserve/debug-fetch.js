import { getInplayService } from '../../../lib/goalserve-inplay';

export default async function handler(req, res) {
  try {
    const service = getInplayService();
    const { sport = 'hockey' } = req.query;
    
    console.log(`[Debug Fetch] Directly fetching ${sport} from Goalserve...`);
    
    const rawData = await service.fetchFeed(sport);
    
    const events = service.extractEvents ? service.extractEvents(rawData, sport) : [];
    const firstEvent = events[0];
    
    res.json({
      sport,
      fetchSuccess: true,
      rawDataType: typeof rawData,
      rawDataKeys: rawData ? Object.keys(rawData) : null,
      
      extractedEventsCount: events.length,
      
      firstEventKeys: firstEvent ? Object.keys(firstEvent) : null,
      firstEventInfo: firstEvent?.info ? Object.keys(firstEvent.info) : null,
      firstEventExtra: firstEvent?.extra ? Object.keys(firstEvent.extra) : null,
      firstEventStats: firstEvent?.stats ? Object.keys(firstEvent.stats) : null,
      firstEventTimer: firstEvent?.timer ? Object.keys(firstEvent.timer) : null,
      firstEventTeamInfo: firstEvent?.team_info ? Object.keys(firstEvent.team_info) : null,
      
      positionFields: firstEvent ? {
        ball_pos: firstEvent.info?.ball_pos,
        xy: firstEvent.xy,
        infoXy: firstEvent.info?.xy,
        state: firstEvent.info?.state,
        minute: firstEvent.info?.minute,
        seconds: firstEvent.info?.seconds
      } : null,
      
      possessionFields: firstEvent ? {
        attack: firstEvent.attack || firstEvent.info?.attack,
        possession: firstEvent.possession || firstEvent.info?.possession,
        homeServe: firstEvent.team_info?.home?.Serve,
        awayServe: firstEvent.team_info?.away?.Serve
      } : null,
      
      firstEventRaw: firstEvent,
      firstEventInfoFull: firstEvent?.info
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
