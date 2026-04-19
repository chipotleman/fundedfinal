import { db } from '../../../lib/db';
import { matchups, fakeOpponents, profiles, userBets, fakeOpponentBets, userChallenges } from '../../../shared/schema';
import { eq, and, or, lt, gte, lte } from 'drizzle-orm';
import { publishBattleEvent } from '../../../lib/battle-events';
import { sendPushToUsers } from '../../../lib/web-push';
import { CASHOUT_FEE_RATIO } from '../bets/cashout';
import { evaluateAndAwardAchievements } from '../../../lib/achievements';

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

    if (expiredMatchups.length > 0) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:5000';
        const gradeResponse = await fetch(`${baseUrl}/api/bets/grade`, {
          method: 'POST',
        });
        if (gradeResponse.ok) {
          const gradeData = await gradeResponse.json().catch(() => ({}));
          if (gradeData?.graded) {
            console.log(`[Resolve] Pre-resolve grading pass settled ${gradeData.graded} bets`);
          }
        } else {
          console.warn(`[Resolve] Pre-resolve grading pass returned ${gradeResponse.status}`);
        }
      } catch (gradeError) {
        console.error('[Resolve] Pre-resolve grading pass failed:', gradeError);
      }
    }

    const results = [];

    for (const matchup of expiredMatchups) {
      try {
        const matchupStartTime = new Date(matchup.startsAt || matchup.createdAt);
        const matchupEndTime = new Date(matchup.endsAt);
        
        let user1FinalBalance = parseFloat(matchup.startingBalance);
        let user2FinalBalance = parseFloat(matchup.startingBalance);
        let pendingCountUser1 = 0;
        let pendingCountUser2 = 0;

        const user1Bets = await db
          .select()
          .from(userBets)
          .where(and(
            eq(userBets.userId, matchup.user1Id),
            gte(userBets.placedAt, matchupStartTime),
            lte(userBets.placedAt, matchupEndTime)
          ));

        for (const bet of user1Bets) {
          if (bet.status === 'won' && bet.pnl) {
            user1FinalBalance += parseFloat(bet.pnl);
          } else if (bet.status === 'lost' && bet.stake) {
            user1FinalBalance -= parseFloat(bet.stake);
          } else if (bet.status === 'cashed_out' && bet.stake) {
            user1FinalBalance -= parseFloat(bet.stake) * CASHOUT_FEE_RATIO;
          } else if (bet.status === 'push') {
            // No-op: stake is fully refunded on a push.
          } else if (bet.status === 'pending') {
            // Pending at battle end: stake is forfeited toward the
            // battle's score (deducted), matching the live PnL view.
            if (bet.stake) user1FinalBalance -= parseFloat(bet.stake);
            pendingCountUser1++;
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
            } else if (bet.status === 'cashed_out' && bet.stake) {
              user2FinalBalance -= parseFloat(bet.stake) * CASHOUT_FEE_RATIO;
            } else if (bet.status === 'push') {
              // No-op: stake is fully refunded on a push.
            } else if (bet.status === 'pending') {
              if (bet.stake) user2FinalBalance -= parseFloat(bet.stake);
              pendingCountUser2++;
            }
          }
        } else {
          const user2Bets = await db
            .select()
            .from(userBets)
            .where(and(
              eq(userBets.userId, matchup.user2Id),
              gte(userBets.placedAt, matchupStartTime),
              lte(userBets.placedAt, matchupEndTime)
            ));

          for (const bet of user2Bets) {
            if (bet.status === 'won' && bet.pnl) {
              user2FinalBalance += parseFloat(bet.pnl);
            } else if (bet.status === 'lost' && bet.stake) {
              user2FinalBalance -= parseFloat(bet.stake);
            } else if (bet.status === 'cashed_out' && bet.stake) {
              user2FinalBalance -= parseFloat(bet.stake) * CASHOUT_FEE_RATIO;
            } else if (bet.status === 'push') {
              // No-op: stake is fully refunded on a push.
            } else if (bet.status === 'pending') {
              if (bet.stake) user2FinalBalance -= parseFloat(bet.stake);
              pendingCountUser2++;
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

        const totalPot = parseFloat(matchup.startingBalance) * 2;
        const platformFee = totalPot * 0.10;
        const winnerPayout = totalPot - platformFee;

        await db
          .update(matchups)
          .set({
            status: 'completed',
            user1FinalBalance: user1FinalBalance.toString(),
            user2FinalBalance: user2FinalBalance.toString(),
            winnerId,
            winnerType,
            platformFee: platformFee.toString(),
            updatedAt: now,
          })
          .where(eq(matchups.id, matchup.id));

        if (winnerId && winnerType !== 'tie') {
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
          try {
            if (winnerType === 'user1' && matchup.user1Id) {
              const [winProfile] = await db.select().from(profiles).where(eq(profiles.id, matchup.user1Id));
              if (winProfile) {
                await db.update(profiles).set({
                  battleWins: (winProfile.battleWins || 0) + 1,
                  updatedAt: now,
                }).where(eq(profiles.id, matchup.user1Id));
              }
              if (matchup.user2Id && !matchup.isFakeOpponent) {
                const [loseProfile] = await db.select().from(profiles).where(eq(profiles.id, matchup.user2Id));
                if (loseProfile) {
                  await db.update(profiles).set({
                    battleLosses: (loseProfile.battleLosses || 0) + 1,
                    updatedAt: now,
                  }).where(eq(profiles.id, matchup.user2Id));
                }
              }
            } else if (winnerType === 'user2' && matchup.user2Id && !matchup.isFakeOpponent) {
              const [winProfile] = await db.select().from(profiles).where(eq(profiles.id, matchup.user2Id));
              if (winProfile) {
                await db.update(profiles).set({
                  battleWins: (winProfile.battleWins || 0) + 1,
                  updatedAt: now,
                }).where(eq(profiles.id, matchup.user2Id));
              }
              if (matchup.user1Id) {
                const [loseProfile] = await db.select().from(profiles).where(eq(profiles.id, matchup.user1Id));
                if (loseProfile) {
                  await db.update(profiles).set({
                    battleLosses: (loseProfile.battleLosses || 0) + 1,
                    updatedAt: now,
                  }).where(eq(profiles.id, matchup.user1Id));
                }
              }
            } else if (winnerType === 'user2' && matchup.isFakeOpponent && matchup.user1Id) {
              const [loseProfile] = await db.select().from(profiles).where(eq(profiles.id, matchup.user1Id));
              if (loseProfile) {
                await db.update(profiles).set({
                  battleLosses: (loseProfile.battleLosses || 0) + 1,
                  updatedAt: now,
                }).where(eq(profiles.id, matchup.user1Id));
              }
            }
          } catch (statsErr) {
            console.error('[Resolve] battle stats update error:', statsErr);
          }
        } else if (winnerType === 'tie') {
          const halfPot = totalPot / 2;
          const tieRefund = halfPot * 0.9;
          
          if (matchup.user1ChallengeId) {
            const [challenge1] = await db
              .select()
              .from(userChallenges)
              .where(eq(userChallenges.id, matchup.user1ChallengeId));

            if (challenge1) {
              const newBalance = parseFloat(challenge1.currentBalance) + tieRefund;
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
              const newBalance = parseFloat(challenge2.currentBalance) + tieRefund;
              await db
                .update(userChallenges)
                .set({ currentBalance: newBalance.toString() })
                .where(eq(userChallenges.id, matchup.user2ChallengeId));
            }
          }
        }

        try {
          const participants = [matchup.user1Id];
          if (matchup.user2Id && !matchup.isFakeOpponent) participants.push(matchup.user2Id);
          for (const uid of participants) {
            if (uid) await evaluateAndAwardAchievements(uid);
          }
        } catch (achErr) {
          console.error('[Resolve] achievement evaluation error:', achErr);
        }

        try {
          const recipients = [matchup.user1Id];
          if (matchup.user2Id && !matchup.isFakeOpponent) recipients.push(matchup.user2Id);
          publishBattleEvent(recipients, {
            type: 'matchup:completed',
            matchupId: matchup.id,
            winnerId,
            winnerType,
            user1FinalBalance,
            user2FinalBalance,
            totalPot,
            platformFee,
            winnerPayout: winnerType !== 'tie' ? winnerPayout : null,
            pendingCountUser1,
            pendingCountUser2,
          });
          // Independent push for the bell-dropdown "Results" section so
          // NotificationsContext refreshes immediately instead of waiting
          // up to ~25s for the next poll. The generic `notification:*`
          // handler triggers refresh() on receipt.
          publishBattleEvent(recipients, {
            type: 'notification:result',
            matchupId: matchup.id,
            winnerId,
            winnerType,
          });
        } catch (e) {
          console.error('[Resolve] publish event error:', e);
        }

        // Push notification for battle finished — separate body for winner/loser/tie.
        try {
          const sendResultPush = async (uid, isWinner, isTie, payout) => {
            if (!uid) return;
            let title, body;
            if (isTie) {
              title = 'Battle ended in a tie';
              body = `Your battle settled as a tie. Half-pot refunded.`;
            } else if (isWinner) {
              title = 'You won the battle!';
              body = payout != null ? `You won $${Number(payout).toFixed(2)}.` : 'Your battle just finished — go check your payout.';
            } else {
              title = 'Battle finished';
              body = 'Your opponent edged you out this time. Tap to see the results.';
            }
            await sendPushToUsers(uid, {
              category: 'result',
              title,
              body,
              url: `/battle?result=${matchup.id}`,
              tag: `result:${matchup.id}`,
              data: { matchupId: matchup.id, type: 'result' },
            }).catch(err => console.error('[result push]', err.message));
          };
          if (winnerType === 'tie') {
            await sendResultPush(matchup.user1Id, false, true, null);
            if (matchup.user2Id && !matchup.isFakeOpponent) await sendResultPush(matchup.user2Id, false, true, null);
          } else {
            const winnerUid = winnerType === 'user1' ? matchup.user1Id : matchup.user2Id;
            const loserUid = winnerType === 'user1' ? matchup.user2Id : matchup.user1Id;
            if (winnerUid && (winnerType !== 'user2' || !matchup.isFakeOpponent)) await sendResultPush(winnerUid, true, false, winnerPayout);
            if (loserUid && (winnerType !== 'user1' || matchup.user2Id) && !matchup.isFakeOpponent) await sendResultPush(loserUid, false, false, null);
            // If user2 is fake, only user1 exists.
            if (matchup.isFakeOpponent && winnerType === 'user2' && matchup.user1Id) {
              await sendResultPush(matchup.user1Id, false, false, null);
            }
          }
        } catch (pushErr) {
          console.error('[Resolve] push error:', pushErr);
        }

        results.push({
          matchupId: matchup.id,
          winnerId,
          winnerType,
          user1FinalBalance,
          user2FinalBalance,
          totalPot,
          platformFee,
          winnerPayout: winnerType !== 'tie' ? winnerPayout : null,
          betsCountUser1: user1Bets.length,
          pendingCountUser1,
          pendingCountUser2,
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
