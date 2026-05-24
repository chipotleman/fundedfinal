import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, friendships, profiles } from '../../../shared/schema';
import { and, eq, or, inArray } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');
const { sendPushToUsers } = require('../../../lib/web-push');

const NOTE_MAX = 280;
const MAX_RECIPIENTS = 20;
const ALLOWED_TYPES = new Set(['battle', 'post', 'result']);
// Hard byte cap on the user-controlled portion of the request body
// (`item` + `recipientIds` + `note`). Sanitization clamps individual
// fields, but a buggy/malicious client could still send a snapshot
// stuffed with thousands of unknown extra fields — `req.body` has
// already been parsed into memory by then. 16KB is comfortably above
// the legitimate ceiling (a max-recipient share with a maxed note and
// snapshot serializes to well under 4KB) while still rejecting
// obvious abuse early.
const MAX_PAYLOAD_BYTES = 16 * 1024;

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

  // Enforce a hard byte budget on the user-controlled portion of the
  // body *before* we touch sanitization or the DB. The Next.js body
  // parser has already buffered `req.body`, but rejecting it here
  // stops oversize payloads from being persisted, fanned out over SSE,
  // or echoed into push notifications. We measure the JSON
  // serialization in UTF-8 bytes — close enough to the wire size for
  // a budget check, and resilient to clients sending wide unicode.
  try {
    const measured = JSON.stringify({ recipientIds, note, item });
    if (typeof measured === 'string'
        && Buffer.byteLength(measured, 'utf8') > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: 'Share payload too large' });
    }
  } catch (_e) {
    // Unserializable body (e.g. circular refs) — reject as malformed
    // rather than letting downstream code trip on it.
    return res.status(400).json({ error: 'Invalid share payload' });
  }

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

    // Best-effort push for offline recipients. We send a single batch
    // (sender + thread are the same for all recipients) with a richer
    // payload: the sender's avatar drives the OS notification icon, and
    // we include a small snapshot so the system tray can preview what
    // was shared (battle pot / post body / result). Tapping the push
    // deep-links to /messenger?chat=<senderId> so the recipient lands
    // directly in the thread with the sender.
    try {
      const senderRows = await db
        .select({
          username: profiles.username,
          avatar: profiles.avatar,
          updatedAt: profiles.updatedAt,
        })
        .from(profiles)
        .where(eq(profiles.id, userId));
      const senderName = senderRows[0]?.username || 'A friend';
      // Web push payloads are capped (~4KB on most pushers), so we never
      // inline a giant base64 data: URL. Instead we always reference the
      // sender's avatar through the `/api/users/<id>/avatar` proxy — that
      // endpoint serves http(s) avatars via redirect and decodes base64
      // avatars to binary on the fly, so the OS notification can always
      // load it. The URL is relative; the service worker resolves it
      // against the page origin when calling showNotification.
      const rawAvatar = senderRows[0]?.avatar || null;
      // Pin a version token so the CDN can hold the avatar response
      // long-term. The token rolls over whenever the profile changes, so a
      // new avatar invalidates the cache without any explicit purge.
      const avatarVersion = senderRows[0]?.updatedAt
        ? new Date(senderRows[0].updatedAt).getTime()
        : null;
      const senderAvatarUrl =
        `/api/users/${encodeURIComponent(userId)}/avatar` +
        (avatarVersion ? `?v=${avatarVersion}` : '');
      const senderAvatarOriginal = rawAvatar && /^https?:\/\//i.test(rawAvatar) && rawAvatar.length <= 500
        ? rawAvatar
        : null;

      const itemLabel = itemType === 'battle'
        ? 'a battle'
        : (itemType === 'result' ? 'a battle result' : 'a post');

      // One-line preview of the shared item for the notification body
      // (falls back to a generic CTA when there's nothing meaningful).
      let preview = '';
      if (snapshot) {
        if (itemType === 'battle' && snapshot.user1 && snapshot.user2) {
          preview = `${snapshot.user1.username || 'P1'} vs ${snapshot.user2.username || 'P2'}`;
          if (snapshot.potSize) preview += ` · ${snapshot.potSize.toLocaleString()} pot`;
        } else if (itemType === 'result' && snapshot.winner) {
          preview = `${snapshot.winner.username || 'Winner'} beat ${snapshot.loser?.username || 'opponent'}`;
        } else if (itemType === 'post' && snapshot.body) {
          preview = snapshot.body;
        }
      }
      const body = cleanNote
        ? `"${cleanNote}"`
        : (preview || (itemType === 'battle'
            ? 'Tap to spectate the battle'
            : (itemType === 'result' ? 'Tap to watch the replay' : 'Tap to read the post')));

      sendPushToUsers(validRecipients, {
        category: 'social',
        senderId: userId,
        title: `${senderName} shared ${itemLabel} with you`,
        body,
        icon: senderAvatarUrl,
        // `image` becomes the large hero preview on Android/Chrome — the
        // sender's avatar makes it obvious who shared something at a glance.
        image: senderAvatarUrl,
        url: `/messenger?chat=${encodeURIComponent(userId)}`,
        tag: `social:share:${item.id}:${userId}`,
        data: {
          type: 'social_share',
          itemType,
          itemId: item.id,
          actorId: userId,
          actorName: senderName,
          actorAvatar: senderAvatarOriginal || senderAvatarUrl,
          snapshot,
          threadId: userId,
        },
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
