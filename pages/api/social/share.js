import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, friendships } from '../../../shared/schema';
import { and, eq, or, inArray } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');
const { sendPushToUsers } = require('../../../lib/web-push');

const NOTE_MAX = 280;
const MAX_RECIPIENTS = 20;
const ALLOWED_TYPES = new Set(['battle', 'post', 'result']);

// Best-effort sanitization of the snapshot the client sends along with a
// share. We only store the small handful of fields needed to render the
// preview bubble so attackers can't smuggle arbitrary blobs into another
// user's inbox.
function sanitizeSnapshot(type, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const str = (v, max = 80) => {
    if (v == null) return null;
    const s = String(v);
    return s.length > max ? s.slice(0, max) : s;
  };
  if (type === 'battle') {
    return {
      potSize: raw.potSize != null ? Number(raw.potSize) || 0 : 0,
      durationType: str(raw.durationType, 24),
      user1: raw.user1 ? {
        username: str(raw.user1.username, 32),
        avatar: str(raw.user1.avatar, 500),
      } : null,
      user2: raw.user2 ? {
        username: str(raw.user2.username, 32),
        avatar: str(raw.user2.avatar, 500),
      } : null,
    };
  }
  if (type === 'post') {
    return {
      body: str(raw.body, 200),
      author: raw.author ? {
        username: str(raw.author.username, 32),
        avatar: str(raw.author.avatar, 500),
      } : null,
    };
  }
  if (type === 'result') {
    return {
      potSize: raw.potSize != null ? Number(raw.potSize) || 0 : 0,
      winner: raw.winner ? {
        username: str(raw.winner.username, 32),
        avatar: str(raw.winner.avatar, 500),
      } : null,
      loser: raw.loser ? {
        username: str(raw.loser.username, 32),
        avatar: str(raw.loser.avatar, 500),
      } : null,
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;

  const { recipientIds, note, item } = req.body || {};
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    return res.status(400).json({ error: 'recipientIds required' });
  }
  if (recipientIds.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `Up to ${MAX_RECIPIENTS} recipients at a time` });
  }
  if (!item || typeof item !== 'object') {
    return res.status(400).json({ error: 'item required' });
  }
  const itemType = String(item.type || '').toLowerCase();
  if (!ALLOWED_TYPES.has(itemType)) {
    return res.status(400).json({ error: 'Unsupported share type' });
  }
  if (!item.id || typeof item.id !== 'string') {
    return res.status(400).json({ error: 'item.id required' });
  }
  const cleanNote = (note || '').toString().trim().slice(0, NOTE_MAX);
  const snapshot = sanitizeSnapshot(itemType, item.snapshot);

  // Friend-check all recipients in one round trip.
  const dedupedRecipients = Array.from(new Set(recipientIds.filter((r) => typeof r === 'string' && r && r !== userId)));
  if (dedupedRecipients.length === 0) {
    return res.status(400).json({ error: 'No valid recipients' });
  }

  try {
    const friendRows = await db
      .select({ userId: friendships.userId, friendId: friendships.friendId })
      .from(friendships)
      .where(and(
        eq(friendships.status, 'accepted'),
        or(
          and(eq(friendships.userId, userId), inArray(friendships.friendId, dedupedRecipients)),
          and(eq(friendships.friendId, userId), inArray(friendships.userId, dedupedRecipients)),
        ),
      ));
    const friendSet = new Set(
      friendRows.map((r) => (r.userId === userId ? r.friendId : r.userId)),
    );
    const validRecipients = dedupedRecipients.filter((r) => friendSet.has(r));
    if (validRecipients.length === 0) {
      return res.status(403).json({ error: 'You can only share with friends' });
    }

    const messageType = itemType === 'battle'
      ? 'shared_battle'
      : (itemType === 'result' ? 'shared_result' : 'shared_post');
    // Stash the share payload in `content` as JSON. MessagesPanel detects
    // the messageType and parses; if parsing fails it falls back to the
    // raw note so the recipient still sees something useful.
    const payload = JSON.stringify({
      v: 1,
      type: itemType,
      id: item.id,
      note: cleanNote,
      snapshot,
    });

    const rows = validRecipients.map((receiverId) => ({
      senderId: userId,
      receiverId,
      content: payload,
      messageType,
    }));

    const inserted = await db.insert(messages).values(rows).returning();

    for (const newMessage of inserted) {
      try {
        const messagePayload = {
          id: newMessage.id,
          senderId: userId,
          receiverId: newMessage.receiverId,
          content: newMessage.content,
          messageType: newMessage.messageType,
          attachmentUrl: null,
          attachmentDurationMs: null,
          attachmentPeaks: null,
          createdAt: newMessage.createdAt instanceof Date
            ? newMessage.createdAt.toISOString()
            : newMessage.createdAt,
        };
        publishBattleEvent([newMessage.receiverId, userId], {
          type: 'notification:message',
          message: messagePayload,
        });
      } catch (_e) {}
    }

    // Best-effort push for offline recipients.
    try {
      sendPushToUsers(validRecipients, {
        category: 'social',
        title: itemType === 'battle'
          ? 'A battle was shared with you'
          : (itemType === 'result' ? 'A battle result was shared with you' : 'A post was shared with you'),
        body: cleanNote || (itemType === 'battle'
          ? 'Tap to spectate the battle'
          : (itemType === 'result' ? 'Tap to watch the replay' : 'Tap to read the post')),
        url: '/messenger',
        tag: `social:share:${item.id}:${userId}`,
        data: { type: 'social_share', itemType, itemId: item.id, actorId: userId },
      }).catch(() => {});
    } catch (_e) {}

    return res.status(201).json({
      sent: validRecipients.length,
      skipped: dedupedRecipients.length - validRecipients.length,
    });
  } catch (err) {
    console.error('[social/share POST] error', err);
    return res.status(500).json({ error: 'Failed to share' });
  }
}
