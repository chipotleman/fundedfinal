import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { markAchievementsCelebrated } from '../../../../lib/achievements';

// POST /api/me/achievements/celebrate
// Body: { achievementIds: string[] }
//
// Flips the persistent `celebratedAt` flag on the matching achievement
// entries so the unlock popup is never shown twice for the same badge —
// even after a refresh, an SSE reconnect catch-up, or a second tab.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const body = req.body || {};
  const ids = Array.isArray(body.achievementIds) ? body.achievementIds : [];
  if (ids.length === 0) {
    return res.status(400).json({ error: 'achievementIds required' });
  }

  try {
    const marked = await markAchievementsCelebrated(userId, ids);
    return res.status(200).json({ success: true, marked });
  } catch (err) {
    console.error('[ACHIEVEMENTS] celebrate handler error:', err);
    return res.status(500).json({ error: 'Failed to mark celebrated' });
  }
}
