import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, friendships, battleInvites, profiles, users, matchups, fakeOpponents } from '../../../shared/schema';
import { eq, and, desc, lt, inArray, gte, isNotNull, isNull } from 'drizzle-orm';

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
    // Expire any stale battle invites so the receiver doesn't keep seeing them.
    try {
      await db
        .update(battleInvites)
        .set({ status: 'expired', respondedAt: new Date() })
        .where(and(eq(battleInvites.status, 'pending'), lt(battleInvites.expiresAt, new Date())));
    } catch (_e) {}

    const [pendingInvites, pendingFriends, unreadMsgs] = await Promise.all([
      db.select().from(battleInvites)
        .where(and(eq(battleInvites.receiverId, userId), eq(battleInvites.status, 'pending')))
        .orderBy(desc(battleInvites.createdAt))
        .limit(20),
      db.select().from(friendships)
        .where(and(eq(friendships.friendId, userId), eq(friendships.status, 'pending')))
        .orderBy(desc(friendships.createdAt))
        .limit(20),
      db.select().from(messages)
        .where(and(eq(messages.receiverId, userId), eq(messages.read, false)))
        .orderBy(desc(messages.createdAt))
        .limit(50),
    ]);

    const senderIds = [...new Set([
      ...pendingInvites.map(i => i.senderId),
      ...pendingFriends.map(f => f.userId),
      ...unreadMsgs.map(m => m.senderId),
    ].filter(Boolean))];

    const profMap = new Map();
    const userMap = new Map();
    if (senderIds.length > 0) {
      const [p, u] = await Promise.all([
        db.select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar, equippedFrame: profiles.equippedFrame })
          .from(profiles).where(inArray(profiles.id, senderIds)),
        db.select({ id: users.id, email: users.email, image: users.image })
          .from(users).where(inArray(users.id, senderIds)),
      ]);
      p.forEach(x => profMap.set(x.id, x));
      u.forEach(x => userMap.set(x.id, x));
    }

    const buildSender = (id) => {
      const p = profMap.get(id);
      const u = userMap.get(id);
      const handle = u?.email ? u.email.split('@')[0] : null;
      return {
        id,
        username: p?.username || handle || 'Player',
        avatar: p?.avatar || u?.image || null,
        equippedFrame: p?.equippedFrame || null,
      };
    };

    const battleInvitesOut = pendingInvites.map(i => ({
      id: i.id,
      buyIn: i.buyIn,
      duration: i.duration,
      gameMode: i.gameMode,
      createdAt: i.createdAt,
      sender: buildSender(i.senderId),
    }));

    const friendRequestsOut = pendingFriends.map(f => ({
      id: f.id,
      createdAt: f.createdAt,
      sender: buildSender(f.userId),
    }));

    // Group unread messages by sender — keep only the most recent so the
    // toast/badge represents distinct conversations rather than one per line.
    const seenSenders = new Set();
    const messagesOut = [];
    for (const m of unreadMsgs) {
      if (!m.senderId || seenSenders.has(m.senderId)) continue;
      seenSenders.add(m.senderId);
      messagesOut.push({
        id: m.id,
        preview: (m.content || '').slice(0, 80),
        createdAt: m.createdAt,
        sender: buildSender(m.senderId),
      });
    }

    const counts = {
      battleInvites: battleInvitesOut.length,
      friendRequests: friendRequestsOut.length,
      unreadMessages: messagesOut.length,
      total: battleInvitesOut.length + friendRequestsOut.length + messagesOut.length,
    };

    // Catch-up: surface any pending forfeit win for this user. Backed by
    // the persistent matchups.forfeitedById / forfeitAcknowledgedAt columns
    // so the modal still appears after a server restart or any gap — no
    // time window required. Cleared via /api/battles/forfeit-ack on dismiss.
    let recentForfeitWin = null;
    try {
      const recentWon = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.winnerId, userId),
          eq(matchups.status, 'completed'),
          isNotNull(matchups.forfeitedById),
          isNull(matchups.forfeitAcknowledgedAt),
        ))
        .orderBy(desc(matchups.endsAt))
        .limit(1);

      if (recentWon.length > 0) {
        const r = recentWon[0];
        const loserId = r.user1Id === userId ? r.user2Id : r.user1Id;
        let loserProfile = { username: 'Opponent', avatar: null };
        if (r.isFakeOpponent && r.fakeOpponentId) {
          const [fake] = await db.select().from(fakeOpponents).where(eq(fakeOpponents.id, r.fakeOpponentId));
          if (fake) loserProfile = { username: fake.displayName, avatar: fake.avatar };
        } else if (loserId) {
          const [lp] = await db
            .select({ username: profiles.username, avatar: profiles.avatar })
            .from(profiles)
            .where(eq(profiles.id, loserId));
          if (lp) loserProfile = { username: lp.username || 'Opponent', avatar: lp.avatar };
        }
        recentForfeitWin = {
          matchupId: r.id,
          winnerId: userId,
          winnerPayout: parseFloat(r.winnerPayout || 0),
          loser: loserProfile,
        };
      }
    } catch (_e) {}

    return res.status(200).json({
      battleInvites: battleInvitesOut,
      friendRequests: friendRequestsOut,
      unreadMessages: messagesOut,
      counts,
      recentForfeitWin,
      // Backwards-compat fields kept for any older callers.
      pendingBattleInvites: counts.battleInvites,
      pendingFriendRequests: counts.friendRequests,
      unreadMessagesCount: unreadMsgs.length,
      total: counts.total,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}
