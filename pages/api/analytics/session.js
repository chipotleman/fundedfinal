import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  if (action === 'start') {
    const { userId, visitorId, sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    try {
      await sql`
        INSERT INTO session_metrics (user_id, visitor_id, session_id)
        VALUES (${userId || null}, ${visitorId || null}, ${sessionId})
        ON CONFLICT (session_id) DO NOTHING
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to start session:', error);
      return res.status(500).json({ error: 'Failed to start session' });
    }
  }

  if (action === 'end') {
    const { sessionId, duration, pagesViewed, eventsCount } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    try {
      await sql`
        UPDATE session_metrics
        SET ended_at = NOW(),
            duration = ${duration || null},
            pages_viewed = COALESCE(${pagesViewed}, pages_viewed),
            events_count = COALESCE(${eventsCount}, events_count)
        WHERE session_id = ${sessionId}
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to end session:', error);
      return res.status(500).json({ error: 'Failed to end session' });
    }
  }

  if (action === 'heartbeat') {
    const { sessionId, pagesViewed, eventsCount } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    try {
      await sql`
        UPDATE session_metrics
        SET pages_viewed = COALESCE(${pagesViewed}, pages_viewed),
            events_count = COALESCE(${eventsCount}, events_count)
        WHERE session_id = ${sessionId}
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to update session:', error);
      return res.status(500).json({ error: 'Failed to update session' });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}
