const webpush = require('web-push');
const { db } = require('./db');
const { pushSubscriptions, friendships, friendMutes, profiles } = require('../shared/schema');
const { eq, and, inArray, or } = require('drizzle-orm');

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@piks.app';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.warn('[web-push] VAPID keys not configured, push disabled');
    return false;
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

const CATEGORY_COLUMN = {
  invite: 'catInvites',
  invite_outcome: 'catInviteOutcome',
  forfeit: 'catForfeits',
  result: 'catResults',
  friend_live: 'catFriendsLive',
  rematch: 'catRematch',
  social: 'catSocial',
};

function buildPayload({ category, title, body, url, tag, icon, image, data }) {
  const payload = {
    title: title || 'Piks',
    body: body || '',
    url: url || '/',
    tag: tag || category,
    category,
    icon: icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: data || {},
    ts: Date.now(),
  };
  // Only include `image` when the caller provides one — the service worker
  // forwards it to showNotification so Android/Chrome can render a large
  // hero preview (e.g. the sender's avatar on a social share).
  if (image) payload.image = image;
  return JSON.stringify(payload);
}

async function loadActiveSubscriptions(userIds, category) {
  if (!userIds || userIds.length === 0) return [];
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds];
  if (ids.length === 0) return [];
  const col = CATEGORY_COLUMN[category];
  if (!col) return [];
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(and(
      inArray(pushSubscriptions.userId, ids),
      eq(pushSubscriptions.enabled, true),
      eq(pushSubscriptions[col], true),
    ));
  return rows;
}

async function pruneSubscription(id) {
  try {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  } catch (e) {
    console.error('[web-push] prune failed', e.message);
  }
}

async function sendOne(sub, payloadJson) {
  try {
    await webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payloadJson, { TTL: 60 * 60 * 24 });
    return { ok: true };
  } catch (err) {
    const status = err && err.statusCode;
    if (status === 404 || status === 410) {
      await pruneSubscription(sub.id);
      return { ok: false, pruned: true };
    }
    console.error('[web-push] send error', status, err.body || err.message);
    return { ok: false };
  }
}

/**
 * Send a push notification to all subscriptions of the given user(s)
 * that have the given category enabled.
 *
 * @param {string|string[]} userIds
 * @param {{category: 'invite'|'invite_outcome'|'forfeit'|'result'|'friend_live'|'rematch', title: string, body: string, url: string, tag?: string, icon?: string, data?: any}} notification
 */
async function sendPushToUsers(userIds, notification) {
  if (!ensureVapid()) return { sent: 0, failed: 0 };
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : (userIds ? [userIds] : []);
  if (ids.length === 0) return { sent: 0, failed: 0 };

  // Per-friend mute: if a `senderId` is provided, any recipient who has
  // muted that sender is dropped from the push fan-out regardless of
  // their global category opt-in. The category toggle still applies via
  // loadActiveSubscriptions below.
  let allowedIds = ids;
  if (notification.senderId) {
    try {
      const muteRows = await db
        .select({ muterId: friendMutes.muterId })
        .from(friendMutes)
        .where(and(
          eq(friendMutes.mutedId, notification.senderId),
          inArray(friendMutes.muterId, ids),
        ));
      if (muteRows.length > 0) {
        const muted = new Set(muteRows.map((r) => r.muterId));
        allowedIds = ids.filter((id) => !muted.has(id));
      }
    } catch (e) {
      console.error('[web-push] mute filter failed', e.message);
    }
  }
  if (allowedIds.length === 0) return { sent: 0, failed: 0 };

  const subs = await loadActiveSubscriptions(allowedIds, notification.category);
  if (subs.length === 0) return { sent: 0, failed: 0 };
  const payload = buildPayload(notification);
  let sent = 0; let failed = 0;
  await Promise.all(subs.map(async (s) => {
    const r = await sendOne(s, payload);
    if (r.ok) sent++; else failed++;
  }));
  return { sent, failed };
}

async function getAcceptedFriendIds(userId) {
  if (!userId) return [];
  const rows = await db
    .select()
    .from(friendships)
    .where(and(
      or(eq(friendships.userId, userId), eq(friendships.friendId, userId)),
      eq(friendships.status, 'accepted'),
    ));
  const ids = new Set();
  for (const r of rows) {
    const other = r.userId === userId ? r.friendId : r.userId;
    if (other) ids.add(other);
  }
  return [...ids];
}

/**
 * Notify both players' accepted friends that a new battle just started.
 * Looks up each player's friends, excludes the two players, fetches their
 * usernames, and fires two `friend_live` push notifications using a shared
 * tag/url/copy scheme.
 *
 * Errors are caught and logged so callers don't need to wrap this call.
 *
 * @param {{matchupId: string|number, user1Id: string, user2Id: string}} args
 */
async function sendFriendLivePush({ matchupId, user1Id, user2Id }) {
  if (!matchupId || !user1Id || !user2Id) return;
  try {
    const [friendsOfUser1, friendsOfUser2, user1Rows, user2Rows] = await Promise.all([
      getAcceptedFriendIds(user1Id),
      getAcceptedFriendIds(user2Id),
      db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, user1Id)),
      db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, user2Id)),
    ]);
    const exclude = new Set([user1Id, user2Id]);
    const targetsForUser1Friends = friendsOfUser1.filter(id => !exclude.has(id));
    const targetsForUser2Friends = friendsOfUser2.filter(id => !exclude.has(id));
    const user1Name = user1Rows[0]?.username || 'Your friend';
    const user2Name = user2Rows[0]?.username || 'Your friend';
    if (targetsForUser1Friends.length > 0) {
      sendPushToUsers(targetsForUser1Friends, {
        category: 'friend_live',
        title: `${user1Name} just started a battle`,
        body: 'Tap to spectate or jump into your own.',
        url: `/battle?live=${matchupId}`,
        tag: `friend_live:${user1Id}:${matchupId}`,
        data: { matchupId, type: 'friend_live', friendId: user1Id },
      }).catch(() => {});
    }
    if (targetsForUser2Friends.length > 0) {
      sendPushToUsers(targetsForUser2Friends, {
        category: 'friend_live',
        title: `${user2Name} just started a battle`,
        body: 'Tap to spectate or jump into your own.',
        url: `/battle?live=${matchupId}`,
        tag: `friend_live:${user2Id}:${matchupId}`,
        data: { matchupId, type: 'friend_live', friendId: user2Id },
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[friend_live push]', e.message);
  }
}

module.exports = {
  sendPushToUsers,
  getAcceptedFriendIds,
  sendFriendLivePush,
  ensureVapid,
  CATEGORY_COLUMN,
};
