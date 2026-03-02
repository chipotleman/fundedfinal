import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, profiles } from '../../../shared/schema';
import { eq, or, desc, ne } from 'drizzle-orm';

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
          battleWins: profiles.battleWins,
          battleLosses: profiles.battleLosses,
        })
        .from(profiles)
        .where(or(...uniqueIds.map(id => eq(profiles.id, id))));
      profs.forEach(p => { opponentProfiles[p.id] = p; });
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

      return {
        id: m.id,
        matchType: m.matchType || m.challengeType,
        status: m.status,
        result,
        buyIn: m.startingBalance,
        potSize: m.potSize,
        winnerPayout: m.winnerPayout,
        myBalance: parseFloat(myBalance || 0),
        opponentBalance: parseFloat(opponentBalance || 0),
        pnl: (parseFloat(myBalance) || 0) - (parseFloat(m.startingBalance) || 0),
        opponent: opponentProfiles[opponentId] || { username: 'Unknown', avatar: null },
        isFakeOpponent: m.isFakeOpponent,
        duration: m.durationMinutes,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        createdAt: m.createdAt,
      };
    });

    return res.status(200).json({ matches: enriched });
  } catch (error) {
    console.error('Error fetching battle history:', error);
    return res.status(500).json({ error: 'Failed to fetch battle history' });
  }
}
