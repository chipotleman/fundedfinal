import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { friendships, matchups, profiles, users } from '../../../shared/schema';
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
 *
 * Each mutual also carries a small `connection` object describing *how* the
 * viewer knows them — battle count when they've actually played 1v1, else
 * the friendship age — so the popup row can render a short secondary line
 * ("3 battles together", "Friends since Mar 2025"). Both signals are
 * fetched in batched queries scoped to the mutual id set, so the cost
 * stays O(1) round-trips regardless of mutual list size.
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
  // Lightweight mode for surfaces (e.g. the public profile header badge)
  // that only need "how many mutuals do we share?" — skips the second
  // round-trip to load profile/avatar/presence data for each mutual id.
  const countOnly = req.query?.countOnly === '1' || req.query?.countOnly === 'true';

  if (!otherId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (otherId === userId) {
    return res.status(200).json(
      countOnly ? { mutualFriendsCount: 0 } : { mutualFriends: [] }
    );
  }

  try {
    const rows = await db
      .select({
        userId: friendships.userId,
        friendId: friendships.friendId,
        createdAt: friendships.createdAt,
      })
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
    // Earliest viewer↔friend createdAt per mutual id, used for the "Friends
    // since X" connection signal. A user can technically have two rows
    // (sender/receiver direction) for the same friendship, so keep the
    // earliest timestamp to describe how long they've actually been friends.
    const friendsSinceMs = new Map();
    const noteFriendSince = (otherUserId, createdAt) => {
      if (!otherUserId || !createdAt) return;
      const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
      if (!Number.isFinite(ts)) return;
      const prev = friendsSinceMs.get(otherUserId);
      if (prev === undefined || ts < prev) friendsSinceMs.set(otherUserId, ts);
    };

    for (const r of rows) {
      if (r.userId === userId && r.friendId) {
        mySet.add(r.friendId);
        noteFriendSince(r.friendId, r.createdAt);
      }
      if (r.friendId === userId && r.userId) {
        mySet.add(r.userId);
        noteFriendSince(r.userId, r.createdAt);
      }
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

    if (countOnly) {
      return res.status(200).json({ mutualFriendsCount: mutualIds.length });
    }

    if (mutualIds.length === 0) {
      return res.status(200).json({ mutualFriends: [] });
    }

    const [profs, usrs, battleRows] = await Promise.all([
      db.select({
        id: profiles.id,
        username: profiles.username,
        avatar: profiles.avatar,
        equippedFrame: profiles.equippedFrame,
        lastSeenAt: profiles.lastSeenAt,
      }).from(profiles).where(inArray(profiles.id, mutualIds)),
      db.select({ id: users.id, email: users.email, image: users.image })
        .from(users).where(inArray(users.id, mutualIds)),
      // Single batched fetch of every completed 1v1 between the viewer and
      // any mutual id; aggregated in JS into per-opponent counts. Only
      // `completed` matchups count — `waiting`/`active` battles are still
      // in flight and shouldn't claim a "battles together" signal yet.
      db.select({ user1Id: matchups.user1Id, user2Id: matchups.user2Id })
        .from(matchups)
        .where(and(
          eq(matchups.status, 'completed'),
          or(
            and(eq(matchups.user1Id, userId), inArray(matchups.user2Id, mutualIds)),
            and(eq(matchups.user2Id, userId), inArray(matchups.user1Id, mutualIds)),
          ),
        )),
    ]);

    const battleCounts = new Map();
    for (const b of battleRows) {
      const opponentId = b.user1Id === userId ? b.user2Id : b.user1Id;
      if (!opponentId) continue;
      battleCounts.set(opponentId, (battleCounts.get(opponentId) || 0) + 1);
    }

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
        connection: buildConnection({
          battles: battleCounts.get(id) || 0,
          friendsSinceMs: friendsSinceMs.get(id) ?? null,
          nowMs,
        }),
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

/**
 * Pick the most useful "how do you know them" line for a mutual.
 * Battles together is a stronger signal of actual interaction, so it wins
 * when present; otherwise we fall back to friendship age. Returns null
 * when no signal is available so the row can render its plain fallback.
 */
function buildConnection({ battles, friendsSinceMs, nowMs }) {
  if (battles > 0) {
    return {
      kind: 'battles',
      battles,
      text: battles === 1 ? '1 battle together' : `${battles} battles together`,
    };
  }
  if (friendsSinceMs && Number.isFinite(friendsSinceMs)) {
    const text = formatFriendsSince(friendsSinceMs, nowMs);
    if (text) {
      return {
        kind: 'friends_since',
        friendsSinceMs,
        text,
      };
    }
  }
  return null;
}

function formatFriendsSince(thenMs, nowMs) {
  const deltaMs = Math.max(0, nowMs - thenMs);
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(deltaMs / day);
  if (days < 1) return 'Friends since today';
  if (days < 7) return days === 1 ? 'Friends since yesterday' : `Friends for ${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Friends for 1 week' : `Friends for ${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30));
    return months === 1 ? 'Friends for 1 month' : `Friends for ${months} months`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? 'Friends for 1 year' : `Friends for ${years} years`;
}
