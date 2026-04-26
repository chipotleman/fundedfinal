import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { friendships, profiles, users } from '../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

/**
 * Returns the full list of mutual friends between the signed-in user and the
 * `userId` query param (typically a pending friend-request sender). The
 * notifications endpoint only ships a count + a 3-avatar preview so the
 * cards stay compact; this endpoint backs the "see all mutual friends"
 * popup that opens from those cards.
 *
 * Computes my accepted friend set and the other user's accepted friend set
 * with a single batched query (filtering on either side of `friendships`),
 * intersects them, then enriches each mutual id with profile info that's
 * enough to render `<UserAvatar>` (avatar, frame) plus a presence badge.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const otherIdRaw = req.query?.userId;
  const otherId = typeof otherIdRaw === 'string' && otherIdRaw.length > 0
    ? otherIdRaw
    : null;

  if (!otherId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (otherId === userId) {
    return res.status(200).json({ mutualFriends: [] });
  }

  try {
    const rows = await db
      .select({ userId: friendships.userId, friendId: friendships.friendId })
      .from(friendships)
      .where(and(
        or(
          eq(friendships.userId, userId),
          eq(friendships.friendId, userId),
          eq(friendships.userId, otherId),
          eq(friendships.friendId, otherId),
        ),
        eq(friendships.status, 'accepted'),
      ));

    const mySet = new Set();
    const theirSet = new Set();
    for (const r of rows) {
      if (r.userId === userId && r.friendId) mySet.add(r.friendId);
      if (r.friendId === userId && r.userId) mySet.add(r.userId);
      if (r.userId === otherId && r.friendId) theirSet.add(r.friendId);
      if (r.friendId === otherId && r.userId) theirSet.add(r.userId);
    }
    // Defensive: never include either of the two principals as a "mutual".
    mySet.delete(userId);
    mySet.delete(otherId);
    theirSet.delete(userId);
    theirSet.delete(otherId);

    const mutualIds = [];
    for (const id of mySet) {
      if (theirSet.has(id)) mutualIds.push(id);
    }

    if (mutualIds.length === 0) {
      return res.status(200).json({ mutualFriends: [] });
    }

    const [profs, usrs] = await Promise.all([
      db.select({
        id: profiles.id,
        username: profiles.username,
        avatar: profiles.avatar,
        equippedFrame: profiles.equippedFrame,
        lastSeenAt: profiles.lastSeenAt,
      }).from(profiles).where(inArray(profiles.id, mutualIds)),
      db.select({ id: users.id, email: users.email, image: users.image })
        .from(users).where(inArray(users.id, mutualIds)),
    ]);

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const nowMs = Date.now();
    const profMap = new Map(profs.map(p => [p.id, p]));
    const userMap = new Map(usrs.map(u => [u.id, u]));

    const mutualFriends = mutualIds.map(id => {
      const p = profMap.get(id);
      const u = userMap.get(id);
      const handle = u?.email ? u.email.split('@')[0] : null;
      const lastSeen = p?.lastSeenAt ? new Date(p.lastSeenAt) : null;
      const isOnline = lastSeen
        ? (nowMs - lastSeen.getTime()) <= ONLINE_THRESHOLD_MS
        : false;
      return {
        id,
        username: p?.username || handle || 'Player',
        avatar: p?.avatar || u?.image || null,
        equippedFrame: p?.equippedFrame || null,
        lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
        isOnline,
      };
    });

    // Online first, then alphabetical, so the most actionable signal sits
    // at the top of the list when users are scanning.
    mutualFriends.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return (a.username || '').localeCompare(b.username || '');
    });

    return res.status(200).json({ mutualFriends });
  } catch (error) {
    console.error('Error fetching mutual friends:', error);
    return res.status(500).json({ error: 'Failed to fetch mutual friends' });
  }
}
