import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, profiles, userBets, fakeOpponentBets } from '../../../shared/schema';
import { eq, or, desc, ne, and, inArray } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  try {
    const matches = await db
      .select()
      .from(matchups)
      .where(
        or(
          eq(matchups.user1Id, userId),
          eq(matchups.user2Id, userId)
        )
      )
      .orderBy(desc(matchups.createdAt))
      .limit(limit);

    const opponentIds = matches.map(m => m.user1Id === userId ? m.user2Id : m.user1Id).filter(Boolean);
    const uniqueIds = [...new Set(opponentIds)];

    let opponentProfiles = {};
    if (uniqueIds.length > 0) {
      const profs = await db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          equippedFrame: profiles.equippedFrame,
          battleWins: profiles.battleWins,
          battleLosses: profiles.battleLosses,
        })
        .from(profiles)
        .where(or(...uniqueIds.map(id => eq(profiles.id, id))));
      profs.forEach(p => { opponentProfiles[p.id] = p; });
    }

    // Compute pending (un-graded at expiry) bet counts per side for completed matchups.
    const completedIds = matches.filter(m => m.status === 'completed').map(m => m.id);
    const pendingByMatchup = {};
    if (completedIds.length > 0) {
      const completedMatchups = matches.filter(m => completedIds.includes(m.id));
      const realPending = await db
        .select()
        .from(userBets)
        .where(and(
          inArray(userBets.matchupId, completedIds),
          eq(userBets.status, 'pending'),
        ));
      const fakePending = await db
        .select()
        .from(fakeOpponentBets)
        .where(and(
          inArray(fakeOpponentBets.matchupId, completedIds),
          eq(fakeOpponentBets.status, 'pending'),
        ));

      // Backfill: some real-user bets may have been placed without
      // matchupId set (legacy). Fall back to time-window matching.
      const allUserPendingNoMatchup = await db
        .select()
        .from(userBets)
        .where(eq(userBets.status, 'pending'));

      for (const m of completedMatchups) {
        pendingByMatchup[m.id] = { user1: 0, user2: 0 };
      }

      for (const b of realPending) {
        const m = completedMatchups.find(x => x.id === b.matchupId);
        if (!m) continue;
        if (b.userId === m.user1Id) pendingByMatchup[m.id].user1++;
        else if (b.userId === m.user2Id) pendingByMatchup[m.id].user2++;
      }
      for (const b of fakePending) {
        const m = completedMatchups.find(x => x.id === b.matchupId);
        if (!m || !m.isFakeOpponent) continue;
        pendingByMatchup[m.id].user2++;
      }
      // Time-window backfill for legacy bets without matchupId.
      for (const b of allUserPendingNoMatchup) {
        if (b.matchupId) continue;
        if (!b.placedAt) continue;
        const placedAt = new Date(b.placedAt).getTime();
        const m = completedMatchups.find(mm => {
          if (mm.user1Id !== b.userId && mm.user2Id !== b.userId) return false;
          const start = new Date(mm.startsAt || mm.createdAt).getTime();
          const end = new Date(mm.endsAt).getTime();
          return placedAt >= start && placedAt <= end;
        });
        if (!m) continue;
        if (b.userId === m.user1Id) pendingByMatchup[m.id].user1++;
        else if (b.userId === m.user2Id) pendingByMatchup[m.id].user2++;
      }
    }

    const enriched = matches.map(m => {
      const isUser1 = m.user1Id === userId;
      const opponentId = isUser1 ? m.user2Id : m.user1Id;
      const myBalance = isUser1 ? (m.user1FinalBalance ?? m.user1Balance ?? '0') : (m.user2FinalBalance ?? m.user2Balance ?? '0');
      const opponentBalance = isUser1 ? (m.user2FinalBalance ?? m.user2Balance ?? '0') : (m.user1FinalBalance ?? m.user1Balance ?? '0');

      let result = 'pending';
      if (m.status === 'completed') {
        if (m.winnerId === userId) result = 'win';
        else if (m.winnerType === 'tie') result = 'tie';
        else result = 'loss';
      } else if (m.status === 'cancelled') {
        result = 'cancelled';
      }

      const pendingCounts = pendingByMatchup[m.id] || { user1: 0, user2: 0 };
      const myPendingCount = isUser1 ? pendingCounts.user1 : pendingCounts.user2;
      const opponentPendingCount = isUser1 ? pendingCounts.user2 : pendingCounts.user1;

      return {
        id: m.id,
        matchType: m.matchType || m.challengeType,
        status: m.status,
        result,
        buyIn: m.startingBalance,
        potSize: m.potSize,
        winnerPayout: m.winnerPayout,
        winnerId: m.winnerId,
        winnerType: m.winnerType,
        user1FinalBalance: m.user1FinalBalance,
        user2FinalBalance: m.user2FinalBalance,
        myBalance: parseFloat(myBalance || 0),
        opponentBalance: parseFloat(opponentBalance || 0),
        pnl: (parseFloat(myBalance) || 0) - (parseFloat(m.startingBalance) || 0),
        opponent: opponentProfiles[opponentId] || { username: 'Unknown', avatar: null },
        isFakeOpponent: m.isFakeOpponent,
        duration: m.durationMinutes,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        createdAt: m.createdAt,
        pendingCountUser1: pendingCounts.user1,
        pendingCountUser2: pendingCounts.user2,
        myPendingCount,
        opponentPendingCount,
      };
    });

    return res.status(200).json({ matches: enriched });
  } catch (error) {
    console.error('Error fetching battle history:', error);
    return res.status(500).json({ error: 'Failed to fetch battle history' });
  }
}
