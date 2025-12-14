import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const adminCheck = await sql`SELECT id FROM admin_users WHERE id = ${token}`;
    if (adminCheck.length === 0) {
      const staffCheck = await sql`SELECT id FROM admin_staff WHERE id = ${token} AND is_active = true`;
      if (staffCheck.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { range = '7d' } = req.query;
  
  let dateFilter;
  switch (range) {
    case '1d':
      dateFilter = "NOW() - INTERVAL '1 day'";
      break;
    case '30d':
      dateFilter = "NOW() - INTERVAL '30 days'";
      break;
    default:
      dateFilter = "NOW() - INTERVAL '7 days'";
  }

  try {
    const [
      eventsCount,
      sessionsCount,
      pageViewsCount,
      demoBetsCount,
      unplacedBetsCount,
      eventsByType,
      topPages,
      recentEvents,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM user_events WHERE created_at > ${dateFilter}::timestamp`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(DISTINCT session_id) as count FROM session_metrics WHERE created_at > ${dateFilter}::timestamp`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*) as count FROM page_views WHERE created_at > ${dateFilter}::timestamp`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*) as count FROM demo_bets WHERE created_at > ${dateFilter}::timestamp`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*) as count FROM unplaced_bets WHERE added_at > ${dateFilter}::timestamp`.catch(() => [{ count: 0 }]),
      sql`
        SELECT event_type as type, COUNT(*) as count 
        FROM user_events 
        WHERE created_at > ${dateFilter}::timestamp
        GROUP BY event_type 
        ORDER BY count DESC 
        LIMIT 10
      `.catch(() => []),
      sql`
        SELECT page_url as url, COUNT(*) as views 
        FROM page_views 
        WHERE created_at > ${dateFilter}::timestamp
        GROUP BY page_url 
        ORDER BY views DESC 
        LIMIT 10
      `.catch(() => []),
      sql`
        SELECT id, user_id, visitor_id, session_id, event_type, page_url, created_at 
        FROM user_events 
        ORDER BY created_at DESC 
        LIMIT 20
      `.catch(() => []),
    ]);

    return res.status(200).json({
      totalEvents: parseInt(eventsCount[0]?.count || 0),
      totalSessions: parseInt(sessionsCount[0]?.count || 0),
      totalPageViews: parseInt(pageViewsCount[0]?.count || 0),
      demoBets: parseInt(demoBetsCount[0]?.count || 0),
      unplacedBets: parseInt(unplacedBetsCount[0]?.count || 0),
      eventsByType: eventsByType.map(e => ({ type: e.type, count: parseInt(e.count) })),
      topPages: topPages.map(p => ({ url: p.url, views: parseInt(p.views) })),
      recentEvents: recentEvents.map(e => ({
        id: e.id,
        userId: e.user_id,
        visitorId: e.visitor_id,
        sessionId: e.session_id,
        eventType: e.event_type,
        pageUrl: e.page_url,
        createdAt: e.created_at,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
