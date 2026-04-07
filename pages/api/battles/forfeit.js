import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, profiles, userChallenges } from '../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    const activeMatchups = await db
      .select()
      .from(matchups)
      .where(and(
        or(
          eq(matchups.user1Id, userId),
          eq(matchups.user2Id, userId)
        ),
        inArray(matchups.status, ['active', 'matched'])
      ));

    if (activeMatchups.length === 0) {
      return res.status(404).json({ error: 'No active battle found' });
    }

    const matchup = activeMatchups[0];
    const isUser1 = matchup.user1Id === userId;
    const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;

    const totalPot = parseFloat(matchup.potSize);
    const platformFee = totalPot * 0.10;
    const winnerPayout = totalPot - platformFee;

    const now = new Date();

    const user1Final = isUser1 ? '0' : (parseFloat(matchup.user1Balance) || 0).toString();
    const user2Final = isUser1 ? (parseFloat(matchup.user2Balance) || 0).toString() : '0';

    const updatedRows = await db
      .update(matchups)
      .set({
        status: 'completed',
        winnerId: opponentId,
        winnerType: isUser1 ? 'user2' : 'user1',
        user1FinalBalance: user1Final,
        user2FinalBalance: user2Final,
        winnerPayout: winnerPayout.toString(),
        platformFee: platformFee.toString(),
        endsAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(matchups.id, matchup.id),
        inArray(matchups.status, ['active', 'matched'])
      ))
      .returning({ id: matchups.id });

    if (!updatedRows || updatedRows.length === 0) {
      return res.status(409).json({ error: 'Battle already completed or forfeited' });
    }

    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId));

    if (userProfile) {
      await db
        .update(profiles)
        .set({
          battleLosses: (userProfile.battleLosses || 0) + 1,
          updatedAt: now,
        })
        .where(eq(profiles.id, userId));
    }

    if (opponentId && !matchup.isFakeOpponent) {
      const [oppProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, opponentId));

      if (oppProfile) {
        const newBankroll = parseFloat(oppProfile.bankroll || 0) + winnerPayout;
        await db
          .update(profiles)
          .set({
            battleWins: (oppProfile.battleWins || 0) + 1,
            bankroll: newBankroll.toFixed(2),
            updatedAt: now,
          })
          .where(eq(profiles.id, opponentId));
      }

      const opponentChallengeId = isUser1 ? matchup.user2ChallengeId : matchup.user1ChallengeId;
      if (opponentChallengeId) {
        const [challenge] = await db
          .select()
          .from(userChallenges)
          .where(eq(userChallenges.id, opponentChallengeId));

        if (challenge) {
          const newBalance = parseFloat(challenge.currentBalance) + winnerPayout;
          await db
            .update(userChallenges)
            .set({ currentBalance: newBalance.toString() })
            .where(eq(userChallenges.id, opponentChallengeId));
        }
      }
    }

    const forfeiterChallengeId = isUser1 ? matchup.user1ChallengeId : matchup.user2ChallengeId;
    if (forfeiterChallengeId) {
      await db
        .update(userChallenges)
        .set({ currentBalance: '0' })
        .where(eq(userChallenges.id, forfeiterChallengeId));
    }

    return res.status(200).json({
      success: true,
      matchup: {
        id: matchup.id,
        status: 'completed',
        winnerId: opponentId,
        winnerType: isUser1 ? 'user2' : 'user1',
        totalPot,
        platformFee,
        winnerPayout,
      },
    });
  } catch (error) {
    console.error('Forfeit battle error:', error);
    return res.status(500).json({ error: 'Failed to forfeit battle' });
  }
}
