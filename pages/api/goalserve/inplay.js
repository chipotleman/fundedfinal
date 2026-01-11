import { getInplayService } from '../../../lib/goalserve-inplay';
import { initializeGoalservePolling } from '../../../lib/goalserve-autostart';

export default async function handler(req, res) {
  initializeGoalservePolling();
  const service = getInplayService();
  const { sport, action, live } = req.query;

  try {
    if (action === 'status') {
      return res.status(200).json({
        success: true,
        ...service.getStatus()
      });
    }

    if (action === 'start') {
      const sports = sport ? sport.split(',') : null;
      service.startPolling(sports);
      return res.status(200).json({
        success: true,
        message: 'Polling started',
        sports: sports || 'all'
      });
    }

    if (action === 'stop') {
      service.stopPolling();
      return res.status(200).json({
        success: true,
        message: 'Polling stopped'
      });
    }

    if (action === 'fetch') {
      if (!sport) {
        const data = await service.fetchAllFeeds();
        return res.status(200).json({
          success: true,
          data
        });
      }
      const data = await service.fetchFeed(sport);
      return res.status(200).json({
        success: true,
        sport,
        eventCount: service.extractEvents ? Object.keys(data).length : 'unknown',
        data
      });
    }

    if (live === 'true') {
      const events = service.getLiveEvents(sport);
      return res.status(200).json({
        success: true,
        count: events.length,
        events
      });
    }

    const events = service.getEvents(sport);
    return res.status(200).json({
      success: true,
      count: events.length,
      lastUpdate: service.lastUpdate,
      events
    });

  } catch (error) {
    console.error('[Inplay API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
