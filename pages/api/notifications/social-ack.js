import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { socialNotifications } from '../../../shared/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');

// Marks the caller's social activity notifications (likes / comments on
// their posts) as read. Accepts either a list of ids or { all: true } to
// clear every unread row for this user. Mirrors the existing per-feature
// ack endpoints (forfeit-ack, result-ack, etc.) — bell + dropdown rely on
// readAt IS NULL to compute counts.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const userId = session.user.id;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : null;
  const all = req.body?.all === true;

  if (!all && (!ids || ids.length === 0)) {
    return res.status(400).json({ error: 'ids[] or all=true required' });
  }

  try {
    const now = new Date();
    const where = all
      ? and(eq(socialNotifications.recipientId, userId), isNull(socialNotifications.readAt))
      : and(
          eq(socialNotifications.recipientId, userId),
          isNull(socialNotifications.readAt),
          inArray(socialNotifications.id, ids),
        );
    const updated = await db
      .update(socialNotifications)
      .set({ readAt: now })
      .where(where)
      .returning({ id: socialNotifications.id });

    if (updated.length > 0) {
      try { publishBattleEvent(userId, { type: 'notification:refresh' }); } catch {}
    }
    return res.status(200).json({ acked: updated.length });
  } catch (err) {
    console.error('[social-ack POST] error', err);
    return res.status(500).json({ error: 'Failed to ack social notifications' });
  }
}
