/**
 * Rush settlement — writes winner / final balances / payout to the
 * matchup row and updates the winner's bankroll, then fires the same
 * matchup:end / matchup:completed SSE events the existing battle modes
 * use so the /battle page result popup surfaces automatically.
 *
 * Idempotent: if the matchup is already 'completed' nothing happens.
 */
const { eq, and, ne } = require('drizzle-orm');
const { db } = require('./db');
const { matchups, profiles, userChallenges } = require('../shared/schema');
const { publishBattleEvent, publishMatchupEnd } = require('./battle-events');
const { sendPushToUsers } = require('./web-push');

async function settleRushMatchup(matchupId) {
  const [matchup] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
  if (!matchup) return null;
  if (matchup.status === 'completed') return matchup;

  const state = matchup.rushState;
  if (!state || state.phase !== 'completed') return matchup;

  const totalPot = parseFloat(matchup.potSize) || 0;
  // Honor the existing 10% rake the rest of the system already uses
  // (matchmaking/private already wrote winnerPayout assuming 10%). Using
  // matchup.winnerPayout directly when present keeps Rush consistent
  // with whatever the matchup row was created with.
  const platformFee = parseFloat(matchup.platformFee) || (totalPot * 0.10);
  const winnerPayout = parseFloat(matchup.winnerPayout) || (totalPot - platformFee);

  const startingBalance = parseFloat(matchup.startingBalance) || 0;
  const winnerType = state.winnerType;
  const winnerUserId = state.winnerUserId;

  // Map rush score → final balance numbers so the existing MatchResult
  // popup (which displays user1FinalBalance / user2FinalBalance) shows
  // a meaningful "winner has more" comparison. Winner gets stake + payout,
  // loser gets 0 — same convention used by the forfeit endpoint.
  let user1Final = '0';
  let user2Final = '0';
  if (winnerType === 'user1') {
    user1Final = (startingBalance + winnerPayout).toFixed(2);
    user2Final = '0';
  } else if (winnerType === 'user2') {
    user1Final = '0';
    user2Final = (startingBalance + winnerPayout).toFixed(2);
  } else {
    // Tie — refund stakes (no rake on a tie).
    user1Final = startingBalance.toFixed(2);
    user2Final = startingBalance.toFixed(2);
  }

  const now = new Date();

  // Conditional update: only set 'completed' if it isn't already, so two
  // simultaneous /state reads don't double-pay the winner.
  const updated = await db
    .update(matchups)
    .set({
      status: 'completed',
      winnerId: winnerType === 'tie' ? null : winnerUserId,
      winnerType,
      user1FinalBalance: user1Final,
      user2FinalBalance: user2Final,
      winnerPayout: winnerPayout.toFixed(2),
      platformFee: platformFee.toFixed(2),
      endsAt: now,
      updatedAt: now,
    })
    .where(and(eq(matchups.id, matchupId), ne(matchups.status, 'completed')))
    .returning({ id: matchups.id });

  if (!updated || updated.length === 0) {
    // Lost the race — already settled by another concurrent request.
    const [fresh] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
    return fresh;
  }

  // Pay the winner out of the pot (skip on tie — both get their stake
  // refunded to the matchup row, no bankroll movement).
  if (winnerType !== 'tie' && winnerUserId && !matchup.isFakeOpponent) {
    try {
      const [winnerProfile] = await db.select().from(profiles).where(eq(profiles.id, winnerUserId));
      if (winnerProfile) {
        const newBankroll = (parseFloat(winnerProfile.bankroll || 0) + winnerPayout).toFixed(2);
        await db
          .update(profiles)
          .set({
            bankroll: newBankroll,
            battleWins: (winnerProfile.battleWins || 0) + 1,
            updatedAt: now,
          })
          .where(eq(profiles.id, winnerUserId));
      }
      const loserId = winnerUserId === matchup.user1Id ? matchup.user2Id : matchup.user1Id;
      if (loserId) {
        const [loserProfile] = await db.select().from(profiles).where(eq(profiles.id, loserId));
        if (loserProfile) {
          await db
            .update(profiles)
            .set({
              battleLosses: (loserProfile.battleLosses || 0) + 1,
              updatedAt: now,
            })
            .where(eq(profiles.id, loserId));
        }
      }
      // Update challenge bankrolls if linked.
      const winnerChallengeId = winnerUserId === matchup.user1Id ? matchup.user1ChallengeId : matchup.user2ChallengeId;
      if (winnerChallengeId) {
        const [chal] = await db.select().from(userChallenges).where(eq(userChallenges.id, winnerChallengeId));
        if (chal) {
          await db
            .update(userChallenges)
            .set({ currentBalance: (parseFloat(chal.currentBalance) + winnerPayout).toFixed(2) })
            .where(eq(userChallenges.id, winnerChallengeId));
        }
      }
      const loserChallengeId = winnerUserId === matchup.user1Id ? matchup.user2ChallengeId : matchup.user1ChallengeId;
      if (loserChallengeId) {
        await db.update(userChallenges).set({ currentBalance: '0' }).where(eq(userChallenges.id, loserChallengeId));
      }
    } catch (err) {
      console.error('[rush settlement] bankroll update error:', err?.message || err);
    }
  }

  // Fan out SSE so both clients (rush page + /battle page) react.
  try {
    publishMatchupEnd(matchup, {
      reason: 'rush_complete',
      winnerId: winnerType === 'tie' ? null : winnerUserId,
      winnerType,
      winnerPayout,
    });
    const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
    publishBattleEvent(recipients, {
      type: 'matchup:completed',
      matchupId: matchup.id,
      winnerId: winnerType === 'tie' ? null : winnerUserId,
      winnerType,
      winnerPayout,
      reason: 'rush_complete',
    });

    // Push notification for the winner mirroring the forfeit flow.
    if (winnerType !== 'tie' && winnerUserId && !matchup.isFakeOpponent) {
      try {
        sendPushToUsers(winnerUserId, {
          category: 'rush_win',
          title: 'You won the Rush!',
          body: `You collected $${winnerPayout.toFixed(2)}.`,
          url: `/battle?result=${matchup.id}`,
          tag: `rush_win:${matchup.id}`,
          data: { matchupId: matchup.id, type: 'rush_win', winnerPayout },
        }).catch(err => console.error('[rush push]', err.message));
      } catch (err) { console.error('[rush push outer]', err.message); }
    }
  } catch (err) {
    console.error('[rush settlement] publish error:', err?.message || err);
  }

  const [fresh] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
  return fresh;
}

module.exports = { settleRushMatchup };
