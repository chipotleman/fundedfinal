import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, friendships, battleInvites, profiles, users, matchups, fakeOpponents } from '../../../shared/schema';
import { eq, and, or, desc, lt, inArray, gte, isNotNull, isNull } from 'drizzle-orm';
const { sendPushToUsers } = require('../../../lib/web-push');
const { publishBattleEvent } = require('../../../lib/battle-events');
import { getUncelebratedAchievements } from '../../../lib/achievements';

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
    // Notify the senders via web-push so they learn about the expiry even when
    // the app is closed.
    try {
      const expiredRows = await db
        .update(battleInvites)
        .set({ status: 'expired', respondedAt: new Date() })
        .where(and(eq(battleInvites.status, 'pending'), lt(battleInvites.expiresAt, new Date())))
        .returning({ id: battleInvites.id, senderId: battleInvites.senderId, receiverId: battleInvites.receiverId, buyIn: battleInvites.buyIn });
      if (expiredRows && expiredRows.length > 0) {
        try {
          const affected = [
            ...new Set(
              expiredRows
                .flatMap(r => [r.senderId, r.receiverId])
                .filter(Boolean)
            ),
          ];
          if (affected.length > 0) {
            publishBattleEvent(affected, { type: 'notification:refresh' });
          }
        } catch (_e) {}
        const receiverIds = [...new Set(expiredRows.map(r => r.receiverId).filter(Boolean))];
        const recvProfMap = new Map();
        if (receiverIds.length > 0) {
          const recvProfs = await db
            .select({ id: profiles.id, username: profiles.username })
            .from(profiles)
            .where(inArray(profiles.id, receiverIds));
          recvProfs.forEach(p => recvProfMap.set(p.id, p));
        }
        for (const row of expiredRows) {
          if (!row.senderId) continue;
          const recvName = recvProfMap.get(row.receiverId)?.username || 'Your friend';
          const buyInLabel = row.buyIn ? ` $${parseFloat(row.buyIn)}` : '';
          sendPushToUsers(row.senderId, {
            category: 'invite_outcome',
            title: 'Battle invite expired',
            body: `${recvName} didn't respond to your${buyInLabel} battle invite in time`,
            url: '/battle',
            tag: `invite_expired:${row.id}`,
            data: { inviteId: row.id, type: 'invite_expired' },
          }).catch(() => {});
        }
      }
    } catch (_e) {}

    const [pendingInvites, pendingFriends, unreadMsgs, outgoingPendingInvitesRows] = await Promise.all([
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
      db.select().from(battleInvites)
        .where(and(eq(battleInvites.senderId, userId), eq(battleInvites.status, 'pending')))
        .orderBy(desc(battleInvites.createdAt))
        .limit(20),
    ]);

    const senderIds = [...new Set([
      ...pendingInvites.map(i => i.senderId),
      ...pendingFriends.map(f => f.userId),
      ...unreadMsgs.map(m => m.senderId),
      ...outgoingPendingInvitesRows.map(i => i.receiverId),
    ].filter(Boolean))];

    const profMap = new Map();
    const userMap = new Map();
    if (senderIds.length > 0) {
      const [p, u] = await Promise.all([
        db.select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar, equippedFrame: profiles.equippedFrame, lastSeenAt: profiles.lastSeenAt })
          .from(profiles).where(inArray(profiles.id, senderIds)),
        db.select({ id: users.id, email: users.email, image: users.image, createdAt: users.createdAt })
          .from(users).where(inArray(users.id, senderIds)),
      ]);
      p.forEach(x => profMap.set(x.id, x));
      u.forEach(x => userMap.set(x.id, x));
    }

    // Friend-request social proof: compute mutual-friend count and prior
    // 1v1 battle count for each pending friend-request sender, in batched
    // queries that avoid N+1 lookups. Falls back to "joined Piks <X> ago"
    // on the client when nothing else is available.
    const friendCtxMap = new Map();
    const friendRequestSenderIds = [...new Set(pendingFriends.map(f => f.userId).filter(Boolean))];
    if (friendRequestSenderIds.length > 0) {
      try {
        // 1. My accepted friend ids — one query.
        const myFriendRows = await db
          .select({ userId: friendships.userId, friendId: friendships.friendId })
          .from(friendships)
          .where(and(
            or(eq(friendships.userId, userId), eq(friendships.friendId, userId)),
            eq(friendships.status, 'accepted'),
          ));
        const myFriendIds = new Set(
          myFriendRows.map(r => (r.userId === userId ? r.friendId : r.userId)).filter(Boolean)
        );

        // 2. All accepted friendships involving any of the senders — one query.
        let senderFriendIdsBySender = new Map();
        if (myFriendIds.size > 0) {
          const senderFriendRows = await db
            .select({ userId: friendships.userId, friendId: friendships.friendId })
            .from(friendships)
            .where(and(
              or(
                inArray(friendships.userId, friendRequestSenderIds),
                inArray(friendships.friendId, friendRequestSenderIds),
              ),
              eq(friendships.status, 'accepted'),
            ));
          for (const row of senderFriendRows) {
            // Determine which side is the sender and which is the "other".
            const senderSideIds = [];
            if (friendRequestSenderIds.includes(row.userId)) senderSideIds.push({ sid: row.userId, other: row.friendId });
            if (friendRequestSenderIds.includes(row.friendId)) senderSideIds.push({ sid: row.friendId, other: row.userId });
            for (const { sid, other } of senderSideIds) {
              if (!other || other === userId) continue;
              if (!senderFriendIdsBySender.has(sid)) senderFriendIdsBySender.set(sid, new Set());
              senderFriendIdsBySender.get(sid).add(other);
            }
          }
        }

        // 3. Completed matchups between me and any sender — one query.
        const priorBattlesBySender = new Map();
        const battleRows = await db
          .select({ user1Id: matchups.user1Id, user2Id: matchups.user2Id })
          .from(matchups)
          .where(and(
            eq(matchups.status, 'completed'),
            or(
              and(eq(matchups.user1Id, userId), inArray(matchups.user2Id, friendRequestSenderIds)),
              and(eq(matchups.user2Id, userId), inArray(matchups.user1Id, friendRequestSenderIds)),
            ),
          ));
        for (const row of battleRows) {
          const otherId = row.user1Id === userId ? row.user2Id : row.user1Id;
          if (!otherId) continue;
          priorBattlesBySender.set(otherId, (priorBattlesBySender.get(otherId) || 0) + 1);
        }

        // 4. Pre-compute mutual-friend id lists per sender (intersection of
        //    sender's friends with mine), capped at 3 each for the preview
        //    avatar stack. Collect every mutual id we want to display so we
        //    can fetch their profiles in one batched query below.
        const MUTUAL_PREVIEW_LIMIT = 3;
        const mutualIdsBySender = new Map();
        const allMutualPreviewIds = new Set();
        for (const sid of friendRequestSenderIds) {
          const senderSet = senderFriendIdsBySender.get(sid);
          const mutualIds = [];
          if (senderSet && myFriendIds.size > 0) {
            for (const fid of senderSet) {
              if (myFriendIds.has(fid)) mutualIds.push(fid);
            }
          }
          mutualIdsBySender.set(sid, mutualIds);
          for (let i = 0; i < Math.min(MUTUAL_PREVIEW_LIMIT, mutualIds.length); i++) {
            allMutualPreviewIds.add(mutualIds[i]);
          }
        }

        // 5. Batched profile lookup for every avatar we'll display.
        const mutualProfileMap = new Map();
        if (allMutualPreviewIds.size > 0) {
          const previewProfiles = await db
            .select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
            .from(profiles)
            .where(inArray(profiles.id, [...allMutualPreviewIds]));
          previewProfiles.forEach(p => mutualProfileMap.set(p.id, p));
        }

        // 6. Build the per-sender context payload.
        for (const sid of friendRequestSenderIds) {
          const mutualIds = mutualIdsBySender.get(sid) || [];
          const mutualFriends = mutualIds.length;
          const mutualFriendPreview = mutualIds
            .slice(0, MUTUAL_PREVIEW_LIMIT)
            .map(fid => {
              const p = mutualProfileMap.get(fid);
              if (!p) return null;
              return { id: p.id, username: p.username || 'Player', avatar: p.avatar || null };
            })
            .filter(Boolean);
          const priorBattles = priorBattlesBySender.get(sid) || 0;
          const joinedAt = userMap.get(sid)?.createdAt
            ? new Date(userMap.get(sid).createdAt).toISOString()
            : null;
          friendCtxMap.set(sid, { mutualFriends, mutualFriendPreview, priorBattles, joinedAt });
        }
      } catch (_e) {}
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

    const outgoingPendingInvites = outgoingPendingInvitesRows.map(i => ({
      id: i.id,
      buyIn: i.buyIn,
      duration: i.duration,
      gameMode: i.gameMode,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      receiver: buildSender(i.receiverId),
    }));

    const friendRequestsOut = pendingFriends.map(f => ({
      id: f.id,
      createdAt: f.createdAt,
      sender: buildSender(f.userId),
      context: friendCtxMap.get(f.userId) || null,
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
        const oppFinal = isUser1 ? m.user2FinalBalance : m.user1FinalBalance;
        const start = m.startingBalance;
        const scorePnl = (parseFloat(myFinal || start || 0)) - (parseFloat(start || 0));
        const winnerPayout = parseFloat(m.winnerPayout || 0);
        const potSize = parseFloat(m.potSize || 0);
        const cashBuyIn = potSize / 2;
        let cashPnl = 0;
        if (m.winnerType === 'tie') cashPnl = -(cashBuyIn * 0.1);
        else if (m.winnerId === userId) cashPnl = winnerPayout - cashBuyIn;
        else cashPnl = -cashBuyIn;

        return {
          id: m.id,
          matchupId: m.id,
          outcome,
          opponent,
          buyIn: cashBuyIn,
          winnerPayout,
          pnl: cashPnl,
          scorePnl,
          myScore: parseFloat(myFinal || start || 0),
          opponentScore: parseFloat(oppFinal || start || 0),
          startingBalance: parseFloat(start || 0),
          potSize,
          winnerId: m.winnerId,
          winnerType: m.winnerType,
          endedAt: m.endsAt,
          isFakeOpponent: !!m.isFakeOpponent,
        };
      });
    } catch (_e) {}

    // Pending rematch requests: completed matchups where the opponent has
    // accepted a rematch but this user has not yet acted (and no rematch has
    // been created yet). Surfaces in the bell so users who closed the result
    // popup can still see and respond to the request.
    let pendingRematches = [];
    try {
      const REMATCH_LOOKBACK_MS = 24 * 60 * 60 * 1000;
      const lookback = new Date(Date.now() - REMATCH_LOOKBACK_MS);
      const candidates = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.status, 'completed'),
          isNull(matchups.rematchMatchupId),
          or(eq(matchups.user1Id, userId), eq(matchups.user2Id, userId)),
          gte(matchups.endsAt, lookback),
        ))
        .orderBy(desc(matchups.endsAt))
        .limit(10);

      const filtered = candidates.filter(m => {
        if (m.isFakeOpponent) return false;
        const isUser1 = m.user1Id === userId;
        const opponentAccepted = isUser1 ? !!m.user2RematchAt : !!m.user1RematchAt;
        const meActed = isUser1
          ? (!!m.user1RematchAt || !!m.user1RematchDeclinedAt)
          : (!!m.user2RematchAt || !!m.user2RematchDeclinedAt);
        return opponentAccepted && !meActed;
      });

      const oppIds = [...new Set(filtered.map(m => (m.user1Id === userId ? m.user2Id : m.user1Id)).filter(Boolean))];
      const oppProfMap2 = new Map();
      if (oppIds.length > 0) {
        const ops = await db.select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          equippedFrame: profiles.equippedFrame,
        }).from(profiles).where(inArray(profiles.id, oppIds));
        ops.forEach(p => oppProfMap2.set(p.id, p));
      }

      pendingRematches = filtered.map(m => {
        const isUser1 = m.user1Id === userId;
        const oppId = isUser1 ? m.user2Id : m.user1Id;
        const op = oppId ? oppProfMap2.get(oppId) : null;
        const requestedAtRaw = isUser1 ? m.user2RematchAt : m.user1RematchAt;
        return {
          id: `rematch:${m.id}`,
          matchupId: m.id,
          requestedAt: requestedAtRaw ? new Date(requestedAtRaw).toISOString() : null,
          opponent: op
            ? { id: op.id, username: op.username || 'Opponent', avatar: op.avatar, equippedFrame: op.equippedFrame }
            : { id: oppId, username: 'Opponent', avatar: null, equippedFrame: null },
        };
      });
    } catch (_e) {}

    // Catch-up: surface any newly earned achievement whose celebration popup
    // hasn't been shown yet (e.g. SSE event missed during a reconnect, or
    // user has multiple tabs and one already dismissed it). Backed by the
    // persistent profile.achievements[].celebratedAt flag so it never
    // replays for badges already celebrated.
    let pendingAchievementUnlocks = [];
    try {
      pendingAchievementUnlocks = await getUncelebratedAchievements(userId);
    } catch (_e) {}

    return res.status(200).json({
      battleInvites: battleInvitesOut,
      outgoingBattleInvites: outgoingPendingInvites,
      friendRequests: friendRequestsOut,
      unreadMessages: messagesOut,
      gameResults,
      pendingRematches,
      pendingAchievementUnlocks,
      counts: { ...counts, gameResults: gameResults.length, pendingRematches: pendingRematches.length, total: counts.total + gameResults.length + pendingRematches.length },
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
