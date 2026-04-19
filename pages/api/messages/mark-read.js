import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages } from '../../../shared/schema';
import { and, eq, inArray } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { senderIds } = req.body || {};

  try {
    const conditions = [
      eq(messages.receiverId, userId),
      eq(messages.read, false),
    ];

    if (Array.isArray(senderIds) && senderIds.length > 0) {
      conditions.push(inArray(messages.senderId, senderIds));
    }

    const updated = await db
      .update(messages)
      .set({ read: true, readAt: new Date() })
      .where(and(...conditions))
      .returning({ id: messages.id });

    if (updated && updated.length > 0) {
      try { publishBattleEvent(userId, { type: 'notification:refresh' }); } catch (_e) {}
    }

    return res.status(200).json({ marked: updated.length });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({ error: 'Failed to mark messages as read' });
  }
}
