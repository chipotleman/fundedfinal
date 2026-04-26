import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { markAchievementsViewed } from '../../../../lib/achievements';

// POST /api/me/achievements/view
//
// Flips the persistent `viewedAt` flag on every currently-unviewed
// achievement entry for the calling user. Powers the "you actually opened
// the Achievements section" signal so the unread dot on the Profile tab +
// Achievements header clears across refreshes / devices / tabs.
//
// Distinct from /celebrate, which only fires when the unlock popup is
// dismissed. A user who closes the popup quickly without ever browsing
// their badges should still see the dot until they open the section.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const marked = await markAchievementsViewed(session.user.id);
    return res.status(200).json({ success: true, marked });
  } catch (err) {
    console.error('[ACHIEVEMENTS] view handler error:', err);
    return res.status(500).json({ error: 'Failed to mark viewed' });
  }
}
