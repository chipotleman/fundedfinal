import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, fakeOpponents, profiles, userBets, fakeOpponentBets, matchupQueue, matchmakingQueue } from '../../../shared/schema';
import { eq, and, or, inArray, sql, gte, lte, desc, isNotNull, isNull } from 'drizzle-orm';
const { computeMatchupSnapshot } = require('../../../lib/matchup-pnl-job');

// Look up an unacknowledged forfeit-win for this user. Backed by the
// persistent matchups.forfeitedById / forfeitAcknowledgedAt columns so
// the modal still surfaces after a server restart or 5-minute gap.
async function detectPendingForfeitWin(userId) {
  try {
    const rows = await db
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

    if (rows.length === 0) return null;
    const r = rows[0];
    const opponentId = r.user1Id === userId ? r.user2Id : r.user1Id;
    let opp = { username: 'Opponent', avatar: null };
    if (r.isFakeOpponent && r.fakeOpponentId) {
      const [fake] = await db.select().from(fakeOpponents).where(eq(fakeOpponents.id, r.fakeOpponentId));
      if (fake) opp = { username: fake.displayName, avatar: fake.avatar };
    } else if (opponentId) {
      const [oppProfile] = await db.select().from(profiles).where(eq(profiles.id, opponentId));
      if (oppProfile) opp = { username: oppProfile.username || 'Opponent', avatar: oppProfile.avatar };
    }
    return {
      matchupId: r.id,
      winnerPayout: parseFloat(r.winnerPayout || 0),
      opponent: opp,
      endedAt: r.endsAt,
    };
  } catch (e) {
    console.error('[Matchups Current] pending forfeit win detection error:', e);
    return null;
  }
}

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
    // Check if this user is a fake opponent (has a fake_opponents entry with this userId)
    const [fakeOpponentEntry] = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.userId, userId));

    // Build the search conditions - include fake opponent ID if this is a fake account
    const userIdConditions = [
      eq(matchups.user1Id, userId),
      eq(matchups.user2Id, userId)
    ];
    
    // If this is a fake opponent, also search by their fake opponent ID
    if (fakeOpponentEntry) {
      userIdConditions.push(eq(matchups.user2Id, fakeOpponentEntry.id));
      userIdConditions.push(eq(matchups.fakeOpponentId, fakeOpponentEntry.id));
    }

    // Prioritize active battles, then matched, then waiting
    const activeMatchups = await db
      .select()
      .from(matchups)
      .where(and(
        or(...userIdConditions),
        inArray(matchups.status, ['waiting', 'matched', 'active'])
      ))
      .orderBy(
        // Custom order: active > matched > waiting
        sql`CASE 
          WHEN status = 'active' THEN 1 
          WHEN status = 'matched' THEN 2 
          WHEN status = 'waiting' THEN 3 
          ELSE 4 
        END`
      );

    const validMatchups = activeMatchups.filter(m => {
      if (m.status === 'active' && m.endsAt) {
        const endTime = new Date(m.endsAt).getTime();
        if (endTime <= Date.now()) {
          fetch(`${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/api/matchups/resolve`, { method: 'POST' }).catch(() => {});
          return false;
        }
      }
      if (m.status === 'waiting') {
        if (m.user1Id && m.user2Id) {
          db.update(matchups)
            .set({ status: 'active' })
            .where(eq(matchups.id, m.id))
            .catch(() => {});
          m.status = 'active';
          return true;
        }
        const createdTime = new Date(m.createdAt || m.startsAt).getTime();
        const hoursSinceCreated = (Date.now() - createdTime) / (1000 * 60 * 60);
        if (hoursSinceCreated > 24) {
          db.update(matchups)
            .set({ status: 'expired' })
            .where(eq(matchups.id, m.id))
            .catch(() => {});
          return false;
        }
      }
      return true;
    });

    if (validMatchups.length === 0) {
      let queueMyProfile = null;
      const [queueProfileRow] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId));
      if (queueProfileRow) {
        queueMyProfile = {
          id: queueProfileRow.id,
          username: queueProfileRow.username,
          avatar: queueProfileRow.avatar,
        };
      }

      const [queueEntry] = await db
        .select()
        .from(matchupQueue)
        .where(and(
          eq(matchupQueue.userId, userId),
          eq(matchupQueue.status, 'waiting')
        ));

      if (queueEntry) {
        const queueAge = Date.now() - new Date(queueEntry.queuedAt).getTime();
        const maxQueueAge = 10 * 60 * 1000;
        if (queueAge > maxQueueAge) {
          await db
            .update(matchupQueue)
            .set({ status: 'expired' })
            .where(eq(matchupQueue.id, queueEntry.id));
        } else {
          return res.status(200).json({
            status: 'queued',
            queueEntry,
            myProfile: queueMyProfile,
            matchup: null,
          });
        }
      }

      const [mmQueueEntry] = await db
        .select()
        .from(matchmakingQueue)
        .where(and(
          eq(matchmakingQueue.userId, userId),
          eq(matchmakingQueue.status, 'waiting')
        ))
        .orderBy(desc(matchmakingQueue.createdAt))
        .limit(1);

      if (mmQueueEntry) {
        const queueAge = Date.now() - new Date(mmQueueEntry.createdAt).getTime();
        const maxQueueAge = 10 * 60 * 1000;
        if (queueAge > maxQueueAge) {
          await db
            .delete(matchmakingQueue)
            .where(eq(matchmakingQueue.id, mmQueueEntry.id));
        } else {
          return res.status(200).json({
            status: 'queued',
            queueEntry: mmQueueEntry,
            myProfile: queueMyProfile,
            matchup: null,
          });
        }
      }

      const recentForfeit = await detectPendingForfeitWin(userId);

      return res.status(200).json({
        status: 'none',
        matchup: null,
        recentForfeit,
      });
    }

    const matchup = validMatchups[0];
    
    // Determine if current user is user1 or user2
    // For fake opponents, they're user2 if their fakeOpponentId matches
    const isFakeOpponentUser = fakeOpponentEntry && 
      (matchup.fakeOpponentId === fakeOpponentEntry.id || matchup.user2Id === fakeOpponentEntry.id);
    const isUser1 = !isFakeOpponentUser && matchup.user1Id === userId;
    
    let opponent = null;
    let opponentBets = [];
    let myBets = [];
    let myProfile = null;

    const [myProfileRow] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId));
    if (myProfileRow) {
      myProfile = {
        id: myProfileRow.id,
        username: myProfileRow.username,
        avatar: myProfileRow.avatar,
        equippedFrame: myProfileRow.equippedFrame,
      };
    }

    if (isFakeOpponentUser) {
      console.log('[Matchups Current] User is fake opponent, fakeOpponentId:', fakeOpponentEntry.id);
      // Current user is the fake opponent - get user1 as the opponent
      const opponentId = matchup.user1Id;
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, opponentId));

      opponent = {
        id: opponentId,
        username: profile?.username || 'Opponent',
        avatar: profile?.avatar,
        equippedFrame: profile?.equippedFrame,
        winRate: profile?.winRate,
        isReal: true,
      };

      // Get opponent's bets (user1's bets) - only from during this battle
      const battleStart = matchup.startsAt || matchup.createdAt;
      const battleEnd = matchup.endsAt || new Date();
      const realOpponentBets = await db
        .select()
        .from(userBets)
        .where(and(
          eq(userBets.userId, opponentId),
          gte(userBets.placedAt, battleStart),
          lte(userBets.placedAt, battleEnd)
        ));
      opponentBets = realOpponentBets;
      console.log('[Matchups Current] Opponent bets count:', realOpponentBets.length, 'from battle:', battleStart, 'to', battleEnd);

      // Get my bets (fake opponent's bets)
      const fakeBets = await db
        .select()
        .from(fakeOpponentBets)
        .where(eq(fakeOpponentBets.matchupId, matchup.id));
      myBets = fakeBets;
      console.log('[Matchups Current] My fake bets count:', fakeBets.length, 'for matchup:', matchup.id);
    } else if (matchup.isFakeOpponent && matchup.fakeOpponentId) {
      const [fake] = await db
        .select()
        .from(fakeOpponents)
        .where(eq(fakeOpponents.id, matchup.fakeOpponentId));
      
      if (fake) {
        let avatarUrl = fake.avatar;
        if (!avatarUrl) {
          const profileId = fake.userId || fake.id;
          const [fakeProfile] = await db
            .select({ avatar: profiles.avatar })
            .from(profiles)
            .where(eq(profiles.id, profileId));
          if (fakeProfile?.avatar) {
            avatarUrl = fakeProfile.avatar;
          }
        }
        opponent = {
          id: fake.id,
          username: fake.displayName,
          avatar: avatarUrl,
          winRate: fake.winRate,
          totalBattles: fake.totalBattles,
          bio: fake.bio,
          isReal: false,
        };
      }

      const fakeBets = await db
        .select()
        .from(fakeOpponentBets)
        .where(eq(fakeOpponentBets.matchupId, matchup.id));
      opponentBets = fakeBets;

      // Get my bets (user1's bets) - only from during this battle
      const battleStart = matchup.startsAt || matchup.createdAt;
      const battleEnd = matchup.endsAt || new Date();
      myBets = await db
        .select()
        .from(userBets)
        .where(and(
          eq(userBets.userId, userId),
          gte(userBets.placedAt, battleStart),
          lte(userBets.placedAt, battleEnd)
        ));
    } else {
      const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;
      
      if (opponentId) {
        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, opponentId));

        opponent = {
          id: opponentId,
          username: profile?.username || 'Opponent',
          avatar: profile?.avatar,
          equippedFrame: profile?.equippedFrame,
          winRate: profile?.winRate,
          isReal: true,
        };

        const rawStart = matchup.startsAt || matchup.createdAt;
        const battleStart = new Date(new Date(rawStart).getTime() - 30000);
        const battleEnd = matchup.endsAt || new Date();

        const [realOpponentBets, realMyBets] = await Promise.all([
          db.select().from(userBets).where(and(
            eq(userBets.userId, opponentId),
            gte(userBets.placedAt, battleStart),
            lte(userBets.placedAt, battleEnd)
          )),
          db.select().from(userBets).where(and(
            eq(userBets.userId, userId),
            gte(userBets.placedAt, battleStart),
            lte(userBets.placedAt, battleEnd)
          )),
        ]);
        opponentBets = realOpponentBets;
        myBets = realMyBets;
      }
    }

    const hasPlacedBets = myBets.length > 0;
    const canSeeOpponentBets = hasPlacedBets;
    console.log('[Matchups Current] hasPlacedBets:', hasPlacedBets, 'canSeeOpponentBets:', canSeeOpponentBets, 'myBets count:', myBets.length);

    const myBalance = isUser1 
      ? parseFloat(matchup.user1Balance || matchup.startingBalance)
      : parseFloat(matchup.user2Balance || matchup.startingBalance);

    const opponentBalance = isUser1
      ? parseFloat(matchup.user2Balance || matchup.startingBalance)
      : parseFloat(matchup.user1Balance || matchup.startingBalance);

    const timeRemaining = matchup.endsAt 
      ? Math.max(0, new Date(matchup.endsAt).getTime() - Date.now())
      : null;

    let myLiveBalance = myBalance;
    let opponentLiveBalance = opponentBalance;
    let myUnrealizedPnl = 0;
    let opponentUnrealizedPnl = 0;
    let myPendingAtRiskCount = 0;
    let opponentPendingAtRiskCount = 0;
    try {
      const snapshot = await computeMatchupSnapshot(matchup);
      const isU1Side = isFakeOpponentUser ? false : isUser1;
      myLiveBalance = parseFloat((isU1Side ? snapshot.user1LiveBalance : snapshot.user2LiveBalance).toFixed(2));
      opponentLiveBalance = parseFloat((isU1Side ? snapshot.user2LiveBalance : snapshot.user1LiveBalance).toFixed(2));
      myUnrealizedPnl = parseFloat((isU1Side ? snapshot.user1UnrealizedPnl : snapshot.user2UnrealizedPnl).toFixed(2));
      opponentUnrealizedPnl = parseFloat((isU1Side ? snapshot.user2UnrealizedPnl : snapshot.user1UnrealizedPnl).toFixed(2));
      myPendingAtRiskCount = isU1Side ? snapshot.user1PendingAtRiskCount : snapshot.user2PendingAtRiskCount;
      opponentPendingAtRiskCount = isU1Side ? snapshot.user2PendingAtRiskCount : snapshot.user1PendingAtRiskCount;
    } catch (snapErr) {
      console.error('[Matchups Current] mark-to-market snapshot error:', snapErr?.message || snapErr);
    }

    const recentForfeit = await detectPendingForfeitWin(userId);

    return res.status(200).json({
      status: matchup.status,
      matchup,
      opponent,
      myProfile,
      myBets,
      recentForfeit,
      opponentBets: canSeeOpponentBets ? opponentBets : [],
      canSeeOpponentBets,
      isUser1,
      myBalance,
      opponentBalance,
      myLiveBalance,
      opponentLiveBalance,
      myUnrealizedPnl,
      opponentUnrealizedPnl,
      myPendingAtRiskCount,
      opponentPendingAtRiskCount,
      timeRemaining,
      endsAt: matchup.endsAt,
      startsAt: matchup.startsAt,
    });

  } catch (error) {
    console.error('Get current matchup error:', error);
    return res.status(500).json({ error: 'Failed to get current matchup' });
  }
}
