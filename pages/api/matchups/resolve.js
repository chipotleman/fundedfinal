import { db } from '../../../lib/db';
import { matchups, fakeOpponents, profiles, userBets, fakeOpponentBets, userChallenges } from '../../../shared/schema';
import { eq, and, or, lt } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date();
    
    const expiredMatchups = await db
      .select()
      .from(matchups)
      .where(and(
        eq(matchups.status, 'active'),
        lt(matchups.endsAt, now)
      ));

    const results = [];

    for (const matchup of expiredMatchups) {
      try {
        let user1FinalBalance = parseFloat(matchup.user1Balance);
        let user2FinalBalance = parseFloat(matchup.user2Balance);

        const user1Bets = await db
          .select()
          .from(userBets)
          .where(eq(userBets.userId, matchup.user1Id));

        for (const bet of user1Bets) {
          if (bet.status === 'won' && bet.pnl) {
            user1FinalBalance += parseFloat(bet.pnl);
          } else if (bet.status === 'lost' && bet.stake) {
            user1FinalBalance -= parseFloat(bet.stake);
          }
        }

        if (matchup.isFakeOpponent) {
          const fakeBets = await db
            .select()
            .from(fakeOpponentBets)
            .where(eq(fakeOpponentBets.matchupId, matchup.id));

          for (const bet of fakeBets) {
            if (bet.status === 'won' && bet.pnl) {
              user2FinalBalance += parseFloat(bet.pnl);
            } else if (bet.status === 'lost' && bet.stake) {
              user2FinalBalance -= parseFloat(bet.stake);
            }
          }
        } else {
          const user2Bets = await db
            .select()
            .from(userBets)
            .where(eq(userBets.userId, matchup.user2Id));

          for (const bet of user2Bets) {
            if (bet.status === 'won' && bet.pnl) {
              user2FinalBalance += parseFloat(bet.pnl);
            } else if (bet.status === 'lost' && bet.stake) {
              user2FinalBalance -= parseFloat(bet.stake);
            }
          }
        }

        let winnerId = null;
        let winnerType = null;

        if (user1FinalBalance > user2FinalBalance) {
          winnerId = matchup.user1Id;
          winnerType = 'user1';
        } else if (user2FinalBalance > user1FinalBalance) {
          winnerId = matchup.user2Id;
          winnerType = 'user2';
        } else {
          winnerType = 'tie';
        }

        await db
          .update(matchups)
          .set({
            status: 'completed',
            user1FinalBalance: user1FinalBalance.toString(),
            user2FinalBalance: user2FinalBalance.toString(),
            winnerId,
            winnerType,
            updatedAt: now,
          })
          .where(eq(matchups.id, matchup.id));

        if (winnerId && winnerType !== 'tie') {
          const winnerPayout = parseFloat(matchup.winnerPayout);

          if (winnerType === 'user1') {
            const [challenge] = await db
              .select()
              .from(userChallenges)
              .where(eq(userChallenges.id, matchup.user1ChallengeId));

            if (challenge) {
              const newBalance = parseFloat(challenge.currentBalance) + winnerPayout;
              await db
                .update(userChallenges)
                .set({ currentBalance: newBalance.toString() })
                .where(eq(userChallenges.id, matchup.user1ChallengeId));
            }
          } else if (winnerType === 'user2' && !matchup.isFakeOpponent) {
            const [challenge] = await db
              .select()
              .from(userChallenges)
              .where(eq(userChallenges.id, matchup.user2ChallengeId));

            if (challenge) {
              const newBalance = parseFloat(challenge.currentBalance) + winnerPayout;
              await db
                .update(userChallenges)
                .set({ currentBalance: newBalance.toString() })
                .where(eq(userChallenges.id, matchup.user2ChallengeId));
            }
          }
        } else if (winnerType === 'tie') {
          const halfPot = parseFloat(matchup.startingBalance);
          
          if (matchup.user1ChallengeId) {
            const [challenge1] = await db
              .select()
              .from(userChallenges)
              .where(eq(userChallenges.id, matchup.user1ChallengeId));

            if (challenge1) {
              const newBalance = parseFloat(challenge1.currentBalance) + halfPot * 0.9;
              await db
                .update(userChallenges)
                .set({ currentBalance: newBalance.toString() })
                .where(eq(userChallenges.id, matchup.user1ChallengeId));
            }
          }

          if (!matchup.isFakeOpponent && matchup.user2ChallengeId) {
            const [challenge2] = await db
              .select()
              .from(userChallenges)
              .where(eq(userChallenges.id, matchup.user2ChallengeId));

            if (challenge2) {
              const newBalance = parseFloat(challenge2.currentBalance) + halfPot * 0.9;
              await db
                .update(userChallenges)
                .set({ currentBalance: newBalance.toString() })
                .where(eq(userChallenges.id, matchup.user2ChallengeId));
            }
          }
        }

        results.push({
          matchupId: matchup.id,
          winnerId,
          winnerType,
          user1FinalBalance,
          user2FinalBalance,
        });

      } catch (matchupError) {
        console.error(`Error resolving matchup ${matchup.id}:`, matchupError);
        results.push({
          matchupId: matchup.id,
          error: matchupError.message,
        });
      }
    }

    return res.status(200).json({
      resolved: results.length,
      results,
    });

  } catch (error) {
    console.error('Resolve matchups error:', error);
    return res.status(500).json({ error: 'Failed to resolve matchups' });
  }
}
