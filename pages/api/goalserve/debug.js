import { getAllLiveEvents, getAvailableEvents, getStatus, liveDataStore } from '../../../lib/goalserve-ws';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = getStatus();
    const liveEvents = getAllLiveEvents();
    const availableEvents = getAvailableEvents();

    const eventsArray = Object.entries(liveEvents).map(([id, event]) => ({
      id,
      sport: event.sport,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      league: event.league || event.competitionName,
      timestamp: event.timestamp,
      rawOdds: event.rawOdds || null,
      parsedOdds: event.odds || null,
      fullEvent: event
    }));

    const availableArray = Object.entries(availableEvents).map(([id, event]) => ({
      id,
      sport: event.sport,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      league: event.league || event.competitionName,
      fullEvent: event
    }));

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      connection: {
        status: status.connectionStatus,
        activeSports: status.activeSports,
        lastUpdate: status.lastUpdate ? new Date(status.lastUpdate).toISOString() : null,
        tokenValid: status.tokenValid
      },
      counts: {
        liveEvents: eventsArray.length,
        availableEvents: availableArray.length,
        subscribers: status.subscriberCount
      },
      liveEvents: eventsArray,
      availableEvents: availableArray
    });
  } catch (error) {
    console.error('[Debug API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
