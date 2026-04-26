import { neon } from '@neondatabase/serverless';
import { isAuthenticatedUserAnalyticsOptedOut } from '../../../lib/analyticsOptOut';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId,
    visitorId,
    sessionId,
    pageUrl,
    pageTitle,
    referrer,
    timeOnPage,
    scrollDepth,
  } = req.body;

  if (!pageUrl) {
    return res.status(400).json({ error: 'Page URL is required' });
  }

  if (await isAuthenticatedUserAnalyticsOptedOut(req, res)) {
    return res.status(200).json({ success: true, dropped: true });
  }

  try {
    await sql`
      INSERT INTO page_views (user_id, visitor_id, session_id, page_url, page_title, referrer, time_on_page, scroll_depth)
      VALUES (${userId || null}, ${visitorId || null}, ${sessionId || null}, ${pageUrl}, ${pageTitle || null}, ${referrer || null}, ${timeOnPage || null}, ${scrollDepth || null})
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to track page view:', error);
    return res.status(500).json({ error: 'Failed to track page view' });
  }
}
