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

  // Only the most recent battles are sent to the profile. The full list made
  // the profile slow (an opponent lookup per matchup); stats are still computed
  // over the wider set so the win/loss record stays accurate.
  const DISPLAY_LIMIT = 5;

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

    // Lightweight result/pnl per matchup — no opponent lookups, used for stats.
    const resolveOutcome = (matchup) => {
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
      return { result, pnl };
    };

    const outcomes = userMatchups.map((m) => ({ matchup: m, ...resolveOutcome(m) }));

    const completedBattles = outcomes.filter((o) => o.matchup.status === 'completed');
    const stats = {
      totalBattles: outcomes.length,
      completedBattles: completedBattles.length,
      wins: outcomes.filter((o) => o.result === 'win').length,
      losses: outcomes.filter((o) => o.result === 'loss').length,
      ties: outcomes.filter((o) => o.result === 'tie').length,
      active: outcomes.filter((o) => o.result === 'pending' || o.matchup.status !== 'completed').length,
      totalWinnings: outcomes
        .filter((o) => o.result === 'win')
        .reduce((sum, o) => sum + o.pnl, 0),
      netPnl: completedBattles.reduce((sum, o) => sum + o.pnl, 0),
    };

    // Enrich (opponent lookup) only the battles we actually display.
    const recent = outcomes.slice(0, DISPLAY_LIMIT);
    const battleHistory = await Promise.all(recent.map(async ({ matchup, result, pnl }) => {
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

      const userFinalBalance = isUser1 ? matchup.user1FinalBalance : matchup.user2FinalBalance;

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

    return res.status(200).json({ battles: battleHistory, stats });
  } catch (error) {
    console.error('Error fetching battle history:', error);
    return res.status(500).json({ error: 'Failed to fetch battle history' });
  }
}
