import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function decodeToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const decoded = decodeToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const adminCheck = await sql`SELECT id FROM admin_users WHERE id = ${decoded.id}`;
    if (adminCheck.length === 0) {
      const staffCheck = await sql`SELECT id FROM admin_staff WHERE id = ${decoded.id} AND is_active = true`;
      if (staffCheck.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { range = '7d' } = req.query;
  
  let daysAgo;
  switch (range) {
    case '1d':
      daysAgo = 1;
      break;
    case '30d':
      daysAgo = 30;
      break;
    default:
      daysAgo = 7;
  }

  const now = new Date();
  const startDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - (daysAgo - 1),
  ));
  const startDateStr = startDate.toISOString();

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
      promoSlotStats,
      promoSlotDailyStatsRaw,
      badgeShareStatsRaw,
      badgeShareTotalsRaw,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM user_events WHERE created_at >= ${startDateStr}`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(DISTINCT session_id) as count FROM session_metrics WHERE created_at >= ${startDateStr}`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*) as count FROM page_views WHERE created_at >= ${startDateStr}`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*) as count FROM demo_bets WHERE created_at >= ${startDateStr}`.catch(() => [{ count: 0 }]),
      sql`SELECT COUNT(*) as count FROM unplaced_bets WHERE added_at >= ${startDateStr}`.catch(() => [{ count: 0 }]),
      sql`
        SELECT event_type as type, COUNT(*) as count 
        FROM user_events 
        WHERE created_at >= ${startDateStr}
        GROUP BY event_type 
        ORDER BY count DESC 
        LIMIT 10
      `.catch(() => []),
      sql`
        SELECT page_url as url, COUNT(*) as views 
        FROM page_views 
        WHERE created_at >= ${startDateStr}
        GROUP BY page_url 
        ORDER BY views DESC 
        LIMIT 10
      `.catch(() => []),
      sql`
        SELECT id, user_id, visitor_id, session_id, event_type, event_data, page_url, created_at 
        FROM user_events 
        ORDER BY created_at DESC 
        LIMIT 20
      `.catch(() => []),
      sql`
        SELECT
          (event_data->>'slotIndex')::int AS slot_index,
          event_data->>'containerType' AS container_type,
          COUNT(*) FILTER (WHERE event_type = 'promo_impression') AS impressions,
          COUNT(*) FILTER (WHERE event_type = 'promo_click') AS clicks
        FROM user_events
        WHERE created_at >= ${startDateStr}
          AND event_type IN ('promo_impression', 'promo_click')
          AND event_data ? 'slotIndex'
          AND event_data ? 'containerType'
        GROUP BY slot_index, container_type
        ORDER BY slot_index ASC, impressions DESC
      `.catch(() => []),
      sql`
        SELECT
          to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
          (event_data->>'slotIndex')::int AS slot_index,
          event_data->>'containerType' AS container_type,
          COUNT(*) FILTER (WHERE event_type = 'promo_impression') AS impressions,
          COUNT(*) FILTER (WHERE event_type = 'promo_click') AS clicks
        FROM user_events
        WHERE created_at >= ${startDateStr}
          AND event_type IN ('promo_impression', 'promo_click')
          AND event_data ? 'slotIndex'
          AND event_data ? 'containerType'
        GROUP BY day, slot_index, container_type
        ORDER BY day ASC, slot_index ASC, container_type ASC
      `.catch(() => []),
      sql`
        SELECT
          event_data->>'achievementId' AS achievement_id,
          MAX(NULLIF(event_data->>'rarity', '')) AS rarity,
          COUNT(*) FILTER (WHERE event_type = 'badge_share') AS total_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share' AND event_data->>'sharePath' = 'native') AS native_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share' AND event_data->>'sharePath' = 'files') AS files_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share' AND event_data->>'sharePath' = 'clipboard') AS clipboard_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share_profile_visit') AS profile_visits
        FROM user_events
        WHERE created_at >= ${startDateStr}
          AND event_type IN ('badge_share', 'badge_share_profile_visit')
          AND event_data ? 'achievementId'
          AND NULLIF(event_data->>'achievementId', '') IS NOT NULL
        GROUP BY achievement_id
        ORDER BY total_shares DESC, profile_visits DESC, achievement_id ASC
        LIMIT 50
      `.catch(() => []),
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'badge_share') AS total_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share' AND event_data->>'sharePath' = 'native') AS native_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share' AND event_data->>'sharePath' = 'files') AS files_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share' AND event_data->>'sharePath' = 'clipboard') AS clipboard_shares,
          COUNT(*) FILTER (WHERE event_type = 'badge_share_profile_visit') AS profile_visits
        FROM user_events
        WHERE created_at >= ${startDateStr}
          AND event_type IN ('badge_share', 'badge_share_profile_visit')
      `.catch(() => [{ total_shares: 0, native_shares: 0, files_shares: 0, clipboard_shares: 0, profile_visits: 0 }]),
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
      promoSlotStats: promoSlotStats.map(r => ({
        slotIndex: r.slot_index,
        containerType: r.container_type,
        impressions: parseInt(r.impressions || 0),
        clicks: parseInt(r.clicks || 0),
      })),
      promoSlotDailyStats: (promoSlotDailyStatsRaw || []).map(r => ({
        day: r.day,
        slotIndex: r.slot_index,
        containerType: r.container_type,
        impressions: parseInt(r.impressions || 0),
        clicks: parseInt(r.clicks || 0),
      })),
      badgeShareStats: (badgeShareStatsRaw || []).map(r => ({
        achievementId: r.achievement_id,
        rarity: r.rarity || null,
        totalShares: parseInt(r.total_shares || 0),
        nativeShares: parseInt(r.native_shares || 0),
        filesShares: parseInt(r.files_shares || 0),
        clipboardShares: parseInt(r.clipboard_shares || 0),
        profileVisits: parseInt(r.profile_visits || 0),
      })),
      badgeShareTotals: {
        totalShares: parseInt(badgeShareTotalsRaw?.[0]?.total_shares || 0),
        nativeShares: parseInt(badgeShareTotalsRaw?.[0]?.native_shares || 0),
        filesShares: parseInt(badgeShareTotalsRaw?.[0]?.files_shares || 0),
        clipboardShares: parseInt(badgeShareTotalsRaw?.[0]?.clipboard_shares || 0),
        profileVisits: parseInt(badgeShareTotalsRaw?.[0]?.profile_visits || 0),
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
