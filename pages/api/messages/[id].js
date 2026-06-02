import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages } from '../../../shared/schema';
import { eq, sql } from 'drizzle-orm';
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

  // `scope=me` hides the message from this user's view only (delete for me).
  // Any default / `scope=everyone` is the WhatsApp-style unsend that removes
  // the message for both participants (sender only).
  const deleteForMe = req.query.scope === 'me';

  try {
    const rows = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        deletedFor: messages.deletedFor,
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (rows.length === 0) {
      // Idempotent: already gone is success from the caller's POV.
      return res.status(200).json({ deleted: true, messageId });
    }

    const row = rows[0];
    const isParticipant = row.senderId === userId || row.receiverId === userId;

    if (deleteForMe) {
      // Either participant may hide the message from their own view.
      if (!isParticipant) {
        return res.status(403).json({ error: 'You can only delete your own conversations' });
      }

      // Append atomically in SQL so two participants hiding at the same time
      // can't clobber each other's entry (read-modify-write would lose-update).
      const updated = await db
        .update(messages)
        .set({
          deletedFor: sql`CASE
            WHEN COALESCE(${messages.deletedFor}, '[]'::jsonb) @> jsonb_build_array(${userId}::text)
              THEN ${messages.deletedFor}
            ELSE COALESCE(${messages.deletedFor}, '[]'::jsonb) || jsonb_build_array(${userId}::text)
          END`,
        })
        .where(eq(messages.id, messageId))
        .returning({ deletedFor: messages.deletedFor });

      // Once both participants have hidden it, the row is dead weight — hard
      // delete it. The per-user hide is already persisted above.
      const next = Array.isArray(updated?.[0]?.deletedFor) ? updated[0].deletedFor : [];
      if (next.includes(row.senderId) && next.includes(row.receiverId)) {
        await db.delete(messages).where(eq(messages.id, messageId));
      }

      // No SSE broadcast: the other participant still sees the message.
      return res.status(200).json({ deletedForMe: true, messageId });
    }

    // Unsend (delete for everyone) — sender only.
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
