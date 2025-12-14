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

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const [
      userProfile,
      userBets,
      demoBets,
      userEvents,
      pageViews,
      sessionMetrics,
    ] = await Promise.all([
      sql`SELECT * FROM profiles WHERE id = ${userId} LIMIT 1`,
      sql`
        SELECT id, matchup_name, market_type, selection, odds, stake, 
               potential_payout, status, balance_before, balance_after, created_at
        FROM user_bets 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC 
        LIMIT 100
      `,
      sql`
        SELECT id, matchup_name, market_type, selection, odds, stake, 
               potential_payout, result, created_at
        FROM demo_bets 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC 
        LIMIT 100
      `,
      sql`
        SELECT id, event_type, event_data, page_url, created_at
        FROM user_events 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC 
        LIMIT 100
      `,
      sql`
        SELECT id, page_url, page_title, created_at
        FROM page_views 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC 
        LIMIT 50
      `,
      sql`
        SELECT id, started_at, ended_at, duration, pages_viewed, events_count
        FROM session_metrics 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC 
        LIMIT 20
      `,
    ]);

    const profile = userProfile[0] || null;

    const bets = userBets.map(bet => ({
      id: bet.id,
      matchupName: bet.matchup_name,
      marketType: bet.market_type,
      selection: bet.selection,
      odds: bet.odds,
      stake: bet.stake,
      potentialPayout: bet.potential_payout,
      status: bet.status,
      balanceBefore: bet.balance_before,
      balanceAfter: bet.balance_after,
      createdAt: bet.created_at,
    }));

    const demoBetsList = demoBets.map(bet => ({
      id: bet.id,
      matchupName: bet.matchup_name,
      marketType: bet.market_type,
      selection: bet.selection,
      odds: bet.odds,
      stake: bet.stake,
      potentialPayout: bet.potential_payout,
      status: bet.result || 'pending',
      createdAt: bet.created_at,
    }));

    const events = userEvents.map(event => ({
      id: event.id,
      eventType: event.event_type,
      eventData: event.event_data,
      pageUrl: event.page_url,
      createdAt: event.created_at,
    }));

    const pages = pageViews.map(pv => ({
      id: pv.id,
      pageUrl: pv.page_url,
      pageTitle: pv.page_title,
      createdAt: pv.created_at,
    }));

    const sessions = sessionMetrics.map(s => ({
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      duration: s.duration,
      pagesViewed: s.pages_viewed,
      eventsCount: s.events_count,
    }));

    const timeline = [
      ...bets.map(b => ({ type: 'bet', data: b, timestamp: b.createdAt })),
      ...events.map(e => ({ type: 'event', data: e, timestamp: e.createdAt })),
      ...pages.map(p => ({ type: 'pageView', data: p, timestamp: p.createdAt })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);

    return res.status(200).json({
      profile,
      bets,
      demoBets: demoBetsList,
      events,
      pageViews: pages,
      sessions,
      timeline,
      stats: {
        totalBets: bets.length,
        totalDemoBets: demoBetsList.length,
        totalEvents: events.length,
        totalPageViews: pages.length,
        totalSessions: sessions.length,
        pendingBets: bets.filter(b => b.status === 'pending').length,
        wonBets: bets.filter(b => b.status === 'won').length,
        lostBets: bets.filter(b => b.status === 'lost').length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch user activity:', error);
    return res.status(500).json({ error: 'Failed to fetch user activity' });
  }
}
