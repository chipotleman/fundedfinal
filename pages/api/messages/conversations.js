import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, profiles, users, friendships } from '../../../shared/schema';
import { eq, or, and, inArray, sql } from 'drizzle-orm';
// inArray is still used by the friend-profile lookups below.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    const friendshipRecords = await db
      .select()
      .from(friendships)
      .where(
        and(
          or(eq(friendships.userId, userId), eq(friendships.friendId, userId)),
          eq(friendships.status, 'accepted')
        )
      );

    const friendIds = friendshipRecords.map(f =>
      f.userId === userId ? f.friendId : f.userId
    );

    if (friendIds.length === 0) {
      return res.status(200).json({ conversations: [] });
    }

    // For every friend, fetch the single most-recent message exchanged
    // with this user. DISTINCT ON guarantees one row per partner regardless
    // of overall message volume.
    const friendIdList = sql.join(
      friendIds.map((id) => sql`${id}`),
      sql`, `
    );
    const latestRowsResult = await db.execute(sql`
      SELECT DISTINCT ON (other_id)
        other_id,
        id,
        sender_id,
        receiver_id,
        content,
        read,
        created_at
      FROM (
        SELECT
          CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS other_id,
          id, sender_id, receiver_id, content, read, created_at
        FROM messages
        WHERE (sender_id = ${userId} AND receiver_id IN (${friendIdList}))
           OR (receiver_id = ${userId} AND sender_id IN (${friendIdList}))
      ) sub
      ORDER BY other_id, created_at DESC
    `);

    const latestRows = Array.isArray(latestRowsResult)
      ? latestRowsResult
      : (latestRowsResult.rows || []);

    const latestByOther = new Map();
    for (const r of latestRows) {
      latestByOther.set(r.other_id, {
        id: r.id,
        senderId: r.sender_id,
        receiverId: r.receiver_id,
        content: r.content,
        read: !!r.read,
        createdAt: r.created_at,
      });
    }

    // Per-friend unread count (messages I haven't read from each friend).
    const unreadCountsResult = await db.execute(sql`
      SELECT sender_id AS other_id, COUNT(*)::int AS unread_count
      FROM messages
      WHERE receiver_id = ${userId}
        AND read = false
        AND sender_id IN (${friendIdList})
      GROUP BY sender_id
    `);
    const unreadCountRows = Array.isArray(unreadCountsResult)
      ? unreadCountsResult
      : (unreadCountsResult.rows || []);
    const unreadCountByFriend = new Map();
    for (const r of unreadCountRows) {
      unreadCountByFriend.set(r.other_id, Number(r.unread_count) || 0);
    }

    const [friendProfiles, friendUsers] = await Promise.all([
      db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          battleWins: profiles.battleWins,
          battleLosses: profiles.battleLosses,
          equippedFrame: profiles.equippedFrame,
          status: profiles.status,
          lastSeenAt: profiles.lastSeenAt,
        })
        .from(profiles)
        .where(inArray(profiles.id, friendIds)),
      db
        .select({ id: users.id, email: users.email, image: users.image })
        .from(users)
        .where(inArray(users.id, friendIds)),
    ]);

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const nowMs = Date.now();

    const conversations = friendIds.map(fid => {
      const profile = friendProfiles.find(p => p.id === fid);
      const user = friendUsers.find(u => u.id === fid);
      const emailHandle = user?.email ? user.email.split('@')[0] : null;
      const lastSeenAt = profile?.lastSeenAt ? new Date(profile.lastSeenAt) : null;
      const isOnline = lastSeenAt
        ? (nowMs - lastSeenAt.getTime()) <= ONLINE_THRESHOLD_MS
        : false;

      const last = latestByOther.get(fid) || null;
      const lastMessage = last
        ? {
            id: last.id,
            senderId: last.senderId,
            receiverId: last.receiverId,
            content: last.content,
            preview: (last.content || '').slice(0, 120),
            createdAt: last.createdAt,
            fromMe: last.senderId === userId,
            unread: !last.read && last.receiverId === userId,
          }
        : null;
      // createdAt may be a Date — normalize to ISO for the client.
      if (lastMessage && lastMessage.createdAt instanceof Date) {
        lastMessage.createdAt = lastMessage.createdAt.toISOString();
      }

      return {
        friend: {
          id: fid,
          username: profile?.username || emailHandle || 'Player',
          avatar: profile?.avatar || user?.image || null,
          battleWins: profile?.battleWins ?? 0,
          battleLosses: profile?.battleLosses ?? 0,
          equippedFrame: profile?.equippedFrame || null,
          status: profile?.status || 'inactive',
          lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
          isOnline,
        },
        lastMessage,
        unreadCount: unreadCountByFriend.get(fid) || 0,
      };
    });

    // Sort: unread first, then most recent message, then friends with no
    // history alphabetically at the bottom.
    conversations.sort((a, b) => {
      const au = a.lastMessage?.unread ? 1 : 0;
      const bu = b.lastMessage?.unread ? 1 : 0;
      if (au !== bu) return bu - au;

      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (at !== bt) return bt - at;

      return (a.friend.username || '').localeCompare(b.friend.username || '');
    });

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}
