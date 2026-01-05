import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, profiles, fakeOpponents } from '../../../shared/schema';
import { eq, or, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  try {
    const userMatchups = await db
      .select()
      .from(matchups)
      .where(or(
        eq(matchups.user1Id, userId),
        eq(matchups.user2Id, userId)
      ))
      .orderBy(desc(matchups.createdAt))
      .limit(50);

    const battleHistory = await Promise.all(userMatchups.map(async (matchup) => {
      const isUser1 = matchup.user1Id === userId;
      const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;
      
      let opponent = null;
      
      if (matchup.isFakeOpponent && matchup.fakeOpponentId) {
        const [fakeOpp] = await db
          .select()
          .from(fakeOpponents)
          .where(eq(fakeOpponents.id, matchup.fakeOpponentId));
        
        if (fakeOpp) {
          opponent = {
            id: fakeOpp.id,
            username: fakeOpp.username,
            displayName: fakeOpp.displayName,
            avatar: fakeOpp.avatar,
            isFake: true,
          };
        }
      } else if (opponentId) {
        const [oppProfile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, opponentId));
        
        if (oppProfile) {
          opponent = {
            id: oppProfile.id,
            username: oppProfile.username,
            avatar: oppProfile.avatar,
            battleWins: oppProfile.battleWins,
            battleLosses: oppProfile.battleLosses,
            isFake: false,
          };
        }
      }

      const userStartBalance = isUser1 ? parseFloat(matchup.startingBalance) : parseFloat(matchup.startingBalance);
      const userFinalBalance = isUser1 ? matchup.user1FinalBalance : matchup.user2FinalBalance;
      
      let result = 'pending';
      let pnl = 0;
      
      if (matchup.status === 'completed') {
        if (matchup.winnerId === userId) {
          result = 'win';
          pnl = parseFloat(matchup.winnerPayout);
        } else if (matchup.winnerType === 'tie') {
          result = 'tie';
          pnl = parseFloat(matchup.startingBalance) * 0.9;
        } else {
          result = 'loss';
          pnl = -parseFloat(matchup.startingBalance);
        }
      }

      return {
        id: matchup.id,
        challengeType: matchup.challengeType,
        durationType: matchup.durationType,
        startingBalance: parseFloat(matchup.startingBalance),
        potSize: parseFloat(matchup.potSize),
        userBalance: userFinalBalance ? parseFloat(userFinalBalance) : parseFloat(matchup.startingBalance),
        opponent,
        result,
        pnl,
        startsAt: matchup.startsAt,
        endsAt: matchup.endsAt,
        status: matchup.status,
        createdAt: matchup.createdAt,
      };
    }));

    const stats = {
      totalBattles: battleHistory.length,
      wins: battleHistory.filter(b => b.result === 'win').length,
      losses: battleHistory.filter(b => b.result === 'loss').length,
      ties: battleHistory.filter(b => b.result === 'tie').length,
      totalWinnings: battleHistory
        .filter(b => b.result === 'win')
        .reduce((sum, b) => sum + b.pnl, 0),
    };

    return res.status(200).json({ battles: battleHistory, stats });
  } catch (error) {
    console.error('Error fetching battle history:', error);
    return res.status(500).json({ error: 'Failed to fetch battle history' });
  }
}
