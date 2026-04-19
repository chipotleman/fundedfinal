import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, profiles, friendships } from '../../../shared/schema';
import { eq, or, and, desc } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    const { friendId } = req.query;
    if (!friendId) {
      return res.status(400).json({ error: 'Friend ID required' });
    }

    try {
      const areFriends = await db
        .select()
        .from(friendships)
        .where(
          and(
            or(
              and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
              and(eq(friendships.userId, friendId), eq(friendships.friendId, userId))
            ),
            eq(friendships.status, 'accepted')
          )
        )
        .limit(1);

      if (areFriends.length === 0) {
        return res.status(403).json({ error: 'You can only message friends' });
      }

      const conversationMessages = await db
        .select()
        .from(messages)
        .where(
          or(
            and(eq(messages.senderId, userId), eq(messages.receiverId, friendId)),
            and(eq(messages.senderId, friendId), eq(messages.receiverId, userId))
          )
        )
        .orderBy(messages.createdAt)
        .limit(100);

      const readAt = new Date();
      const updated = await db
        .update(messages)
        .set({ read: true, readAt })
        .where(
          and(eq(messages.senderId, friendId), eq(messages.receiverId, userId), eq(messages.read, false))
        )
        .returning({ id: messages.id });

      if (updated && updated.length > 0) {
        const updatedIds = new Set(updated.map((u) => u.id));
        for (const m of conversationMessages) {
          if (updatedIds.has(m.id)) {
            m.read = true;
            m.readAt = readAt;
          }
        }
      }

      if (updated && updated.length > 0) {
        try { publishBattleEvent(userId, { type: 'notification:refresh' }); } catch (_e) {}
      }

      return res.status(200).json({ messages: conversationMessages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  if (req.method === 'POST') {
    const { receiverId, content, messageType, attachmentUrl, attachmentDurationMs } = req.body;

    const isVoice = messageType === 'voice';
    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID required' });
    }
    if (isVoice) {
      if (!attachmentUrl || typeof attachmentUrl !== 'string') {
        return res.status(400).json({ error: 'Voice message requires attachmentUrl' });
      }
      // Only accept first-party object-storage paths so attachers can't smuggle
      // off-platform tracking/beacon URLs into a chat.
      if (!attachmentUrl.startsWith('/objects/')) {
        return res.status(400).json({ error: 'Invalid attachment URL' });
      }
    } else if (!content?.trim()) {
      return res.status(400).json({ error: 'Receiver ID and content required' });
    }

    try {
      const areFriends = await db
        .select()
        .from(friendships)
        .where(
          and(
            or(
              and(eq(friendships.userId, userId), eq(friendships.friendId, receiverId)),
              and(eq(friendships.userId, receiverId), eq(friendships.friendId, userId))
            ),
            eq(friendships.status, 'accepted')
          )
        )
        .limit(1);

      if (areFriends.length === 0) {
        return res.status(403).json({ error: 'You can only message friends' });
      }

      const insertValues = {
        senderId: userId,
        receiverId,
        content: isVoice ? (content?.trim() || '🎤 Voice message') : content.trim(),
        messageType: isVoice ? 'voice' : 'text',
      };
      if (isVoice) {
        insertValues.attachmentUrl = attachmentUrl;
        if (Number.isFinite(Number(attachmentDurationMs))) {
          insertValues.attachmentDurationMs = Math.max(
            0,
            Math.min(120000, Math.round(Number(attachmentDurationMs)))
          );
        }
      }

      const [newMessage] = await db
        .insert(messages)
        .values(insertValues)
        .returning();

      try {
        const messagePayload = {
          id: newMessage.id,
          senderId: userId,
          receiverId,
          content: newMessage.content,
          messageType: newMessage.messageType || 'text',
          attachmentUrl: newMessage.attachmentUrl || null,
          attachmentDurationMs: newMessage.attachmentDurationMs || null,
          createdAt:
            newMessage.createdAt instanceof Date
              ? newMessage.createdAt.toISOString()
              : newMessage.createdAt,
        };
        publishBattleEvent([receiverId, userId], {
          type: 'notification:message',
          message: messagePayload,
        });
      } catch (_e) {}

      return res.status(201).json({ message: newMessage });
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
