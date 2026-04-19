import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, friendships, battleInvites, profiles, users, matchups, fakeOpponents } from '../../../shared/schema';
import { eq, and, or, desc, lt, inArray, gte, isNotNull, isNull } from 'drizzle-orm';

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
        db.select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar, equippedFrame: profiles.equippedFrame, lastSeenAt: profiles.lastSeenAt })
          .from(profiles).where(inArray(profiles.id, senderIds)),
        db.select({ id: users.id, email: users.email, image: users.image })
          .from(users).where(inArray(users.id, senderIds)),
      ]);
      p.forEach(x => profMap.set(x.id, x));
      u.forEach(x => userMap.set(x.id, x));
    }

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const nowMs = Date.now();

    const buildSender = (id) => {
      const p = profMap.get(id);
      const u = userMap.get(id);
      const handle = u?.email ? u.email.split('@')[0] : null;
      const lastSeen = p?.lastSeenAt ? new Date(p.lastSeenAt) : null;
      const isOnline = lastSeen ? (nowMs - lastSeen.getTime()) <= ONLINE_THRESHOLD_MS : false;
      return {
        id,
        username: p?.username || handle || 'Player',
        avatar: p?.avatar || u?.image || null,
        equippedFrame: p?.equippedFrame || null,
        lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
        isOnline,
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
        preview: m.messageType === 'voice'
          ? '🎤 Voice message'
          : (m.content || '').slice(0, 80),
        messageType: m.messageType || 'text',
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

    // Game-result alerts: recent completed matchups that the user has not
    // yet acknowledged via /api/notifications/result-ack. Returns won/lost/
    // graded (tie) outcomes from the last 14 days, capped at 10 items.
    let gameResults = [];
    try {
      const RESULT_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
      const lookbackDate = new Date(Date.now() - RESULT_LOOKBACK_MS);
      const completed = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.status, 'completed'),
          or(
            and(eq(matchups.user1Id, userId), isNull(matchups.user1ResultAckAt)),
            and(eq(matchups.user2Id, userId), isNull(matchups.user2ResultAckAt)),
          ),
          gte(matchups.endsAt, lookbackDate),
        ))
        .orderBy(desc(matchups.endsAt))
        .limit(10);

      const opponentIds = [...new Set(completed
        .map(m => (m.user1Id === userId ? m.user2Id : m.user1Id))
        .filter(Boolean))];
      const fakeIds = [...new Set(completed
        .filter(m => m.isFakeOpponent && m.fakeOpponentId)
        .map(m => m.fakeOpponentId))];

      const oppProfMap = new Map();
      const fakeMap = new Map();
      if (opponentIds.length > 0) {
        const ops = await db.select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          equippedFrame: profiles.equippedFrame,
        }).from(profiles).where(inArray(profiles.id, opponentIds));
        ops.forEach(p => oppProfMap.set(p.id, p));
      }
      if (fakeIds.length > 0) {
        const fs = await db.select().from(fakeOpponents).where(inArray(fakeOpponents.id, fakeIds));
        fs.forEach(f => fakeMap.set(f.id, f));
      }

      gameResults = completed.map(m => {
        const isUser1 = m.user1Id === userId;
        const opponentId = isUser1 ? m.user2Id : m.user1Id;
        let opponent = { id: null, username: 'Opponent', avatar: null, equippedFrame: null };
        if (m.isFakeOpponent && m.fakeOpponentId) {
          const fake = fakeMap.get(m.fakeOpponentId);
          if (fake) opponent = { id: null, username: fake.displayName, avatar: fake.avatar, equippedFrame: null };
        } else if (opponentId) {
          const op = oppProfMap.get(opponentId);
          if (op) opponent = { id: op.id, username: op.username || 'Opponent', avatar: op.avatar, equippedFrame: op.equippedFrame };
        }

        let outcome = 'graded';
        if (m.winnerType === 'tie') outcome = 'graded';
        else if (m.winnerId === userId) outcome = 'won';
        else outcome = 'lost';

        const myFinal = isUser1 ? m.user1FinalBalance : m.user2FinalBalance;
        const start = m.startingBalance;
        const pnl = (parseFloat(myFinal || start || 0)) - (parseFloat(start || 0));
        const winnerPayout = parseFloat(m.winnerPayout || 0);

        return {
          id: m.id,
          matchupId: m.id,
          outcome,
          opponent,
          buyIn: parseFloat(start || 0),
          winnerPayout,
          pnl,
          endedAt: m.endsAt,
        };
      });
    } catch (_e) {}

    return res.status(200).json({
      battleInvites: battleInvitesOut,
      friendRequests: friendRequestsOut,
      unreadMessages: messagesOut,
      gameResults,
      counts: { ...counts, gameResults: gameResults.length, total: counts.total + gameResults.length },
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
