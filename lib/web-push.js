const webpush = require('web-push');
const { db } = require('./db');
const { pushSubscriptions, friendships } = require('../shared/schema');
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
  forfeit: 'catForfeits',
  result: 'catResults',
  friend_live: 'catFriendsLive',
};

function buildPayload({ category, title, body, url, tag, icon, data }) {
  return JSON.stringify({
    title: title || 'Piks',
    body: body || '',
    url: url || '/',
    tag: tag || category,
    category,
    icon: icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: data || {},
    ts: Date.now(),
  });
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
 * @param {{category: 'invite'|'forfeit'|'result'|'friend_live', title: string, body: string, url: string, tag?: string, icon?: string, data?: any}} notification
 */
async function sendPushToUsers(userIds, notification) {
  if (!ensureVapid()) return { sent: 0, failed: 0 };
  const subs = await loadActiveSubscriptions(userIds, notification.category);
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

module.exports = {
  sendPushToUsers,
  getAcceptedFriendIds,
  ensureVapid,
  CATEGORY_COLUMN,
};
