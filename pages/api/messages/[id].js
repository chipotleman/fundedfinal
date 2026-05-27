import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');

// DELETE /api/messages/[id]
//
// Hard-deletes a message. Only the original sender may delete their
// own message (no time window — WhatsApp-style "delete for everyone"
// without the 1-hour cap, per the simpler UX the user asked for).
// After delete we publish a `notification:message_deleted` SSE event
// to both peers so any open thread or conversation list can drop the
// row without refetching.
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const messageId = req.query.id;
  if (!messageId || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'Message ID required' });
  }

  try {
    const rows = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (rows.length === 0) {
      // Idempotent: already gone is success from the caller's POV.
      return res.status(200).json({ deleted: true, messageId });
    }

    const row = rows[0];
    if (row.senderId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await db.delete(messages).where(eq(messages.id, messageId));

    try {
      publishBattleEvent([row.receiverId, row.senderId], {
        type: 'notification:message_deleted',
        messageId,
        senderId: row.senderId,
        receiverId: row.receiverId,
      });
    } catch (_e) {}

    return res.status(200).json({ deleted: true, messageId });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
}
