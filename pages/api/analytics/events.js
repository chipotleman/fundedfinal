import { neon } from '@neondatabase/serverless';
import { isAuthenticatedUserAnalyticsOptedOut } from '../../../lib/analyticsOptOut';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { events } = req.body;

  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Events array is required' });
  }

  if (await isAuthenticatedUserAnalyticsOptedOut(req, res)) {
    return res.status(200).json({ success: true, count: 0, dropped: true });
  }

  try {
    const insertPromises = events.map(async (event) => {
      const {
        type,
        userId,
        visitorId,
        sessionId,
        data,
        pageUrl,
        referrer,
        userAgent,
      } = event;

      if (!type) return null;

      const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

      await sql`
        INSERT INTO user_events (user_id, visitor_id, session_id, event_type, event_data, page_url, referrer, user_agent, ip_address)
        VALUES (${userId || null}, ${visitorId || null}, ${sessionId || null}, ${type}, ${JSON.stringify(data || {})}, ${pageUrl || null}, ${referrer || null}, ${userAgent || null}, ${ipAddress})
      `;

      return true;
    });

    await Promise.all(insertPromises);

    return res.status(200).json({ success: true, count: events.length });
  } catch (error) {
    console.error('Failed to track events:', error);
    return res.status(500).json({ error: 'Failed to track events' });
  }
}
