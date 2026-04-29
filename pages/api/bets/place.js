import { db } from '../../../lib/db';
import { userBets, profiles, fakeOpponents, fakeOpponentBets, matchups, poolParticipants, pikPools, poolBets } from '../../../shared/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { calculatePayout, americanToDecimal } from '../../../utils/odds';
const { publishBattleEvent, publishMatchupPnlUpdate } = require('../../../lib/battle-events');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;
    const { bets, betType, parlayStake } = req.body;

    if (!bets || !Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ error: 'No bets provided' });
    }

    // Check if this user is a fake opponent
    const [fakeOpponentEntry] = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.userId, userId));

    const isFakeOpponent = !!fakeOpponentEntry;
    let activeMatchup = null;

    // If fake opponent, find their active matchup
    if (isFakeOpponent) {
      const [matchup] = await db
        .select()
        .from(matchups)
        .where(and(
          or(
            eq(matchups.fakeOpponentId, fakeOpponentEntry.id),
            eq(matchups.user2Id, fakeOpponentEntry.id)
          ),
          inArray(matchups.status, ['active', 'matched'])
        ));
      activeMatchup = matchup;
      console.log('[Place Bet] Fake opponent detected:', fakeOpponentEntry.displayName, 'matchup:', matchup?.id);
    }

    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!userProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    let activeChallenge = null;
    let challengeType = null;
    let currentBankroll = 0;

    if (isFakeOpponent && activeMatchup) {
      currentBankroll = parseFloat(activeMatchup.user2Balance || activeMatchup.startingBalance || '0') || 0;
    }

    const [userActiveMatchup] = await db
      .select()
      .from(matchups)
      .where(
        and(
          or(
            eq(matchups.user1Id, userId),
            eq(matchups.user2Id, userId)
          ),
          inArray(matchups.status, ['active'])
        )
      )
      .limit(1);

    if (userActiveMatchup) {
      challengeType = '1v1';
      activeChallenge = userActiveMatchup;
      const isUser1 = userActiveMatchup.user1Id === userId;
      currentBankroll = parseFloat(isUser1 ? userActiveMatchup.user1Balance : userActiveMatchup.user2Balance) || 0;
    } else {
      const [poolParticipation] = await db
        .select({
          participant: poolParticipants,
          pool: pikPools,
        })
        .from(poolParticipants)
        .innerJoin(pikPools, eq(poolParticipants.poolId, pikPools.id))
        .where(
          and(
            eq(poolParticipants.userId, userId),
            inArray(pikPools.status, ['open', 'filling', 'active'])
          )
        )
        .limit(1);

      if (poolParticipation) {
        challengeType = 'pool';
        activeChallenge = poolParticipation;
        currentBankroll = parseFloat(poolParticipation.participant.balance) || 0;
      }
    }

    if (!isFakeOpponent && !activeChallenge) {
      return res.status(400).json({ error: 'No active battle. Piks can only be placed using battle coins.' });
    }

    // ---- Validate & normalize stakes BEFORE computing totalStake -----------
    // Reject negative / non-finite stakes, sub-cent stakes, and oversized
    // stakes up front so we cannot end up debiting less than the sum of the
    // actually-inserted bets (e.g. mixing a positive stake with a negative
    // one would otherwise reduce totalStake while still inserting the
    // positive bet, and sub-cent stakes would round to a $0.00 debit while
    // still recording a real bet row).
    const MAX_STAKE = 10_000_000;
    const MIN_STAKE = 0.01;

    // Round to cents and validate. Returns null if invalid.
    const normalizeStake = (val) => {
      const n = Number(val);
      if (!Number.isFinite(n) || n < MIN_STAKE || n > MAX_STAKE) return null;
      const cents = Math.round(n * 100);
      return cents / 100;
    };

    let totalStake = 0;
    let normalizedParlayStake = null;

    if (betType === 'parlay' && parlayStake > 0) {
      normalizedParlayStake = normalizeStake(parlayStake);
      if (normalizedParlayStake === null) {
        return res.status(400).json({ error: 'Invalid parlay stake' });
      }
      totalStake = normalizedParlayStake;
    } else {
      for (const bet of bets) {
        const norm = normalizeStake(bet?.stake);
        if (norm === null) {
          return res.status(400).json({ error: 'Invalid bet stake' });
        }
        bet.stake = norm; // store normalized value for downstream insert
        totalStake += norm;
      }
      // Re-round the sum to avoid 0.1 + 0.2 style float drift before debit.
      totalStake = Math.round(totalStake * 100) / 100;
    }

    if (!(totalStake >= MIN_STAKE) || !Number.isFinite(totalStake)) {
      return res.status(400).json({ error: 'Stake must be at least $0.01' });
    }

    // Replace any later use of the raw user-supplied parlayStake with the
    // normalized value so persisted rows match what was debited.
    const effectiveParlayStake = normalizedParlayStake ?? parlayStake;

    // ---- Pre-compute parlay aggregates BEFORE we touch any balance ---------
    // Any user-input validation that can fail must run before the debit so we
    // never end up with money taken and no bet recorded.
    let parlayPrecomputed = null;
    if (betType === 'parlay' && parlayStake > 0) {
      let invalidLegOdds = false;
      const parlayDecimal = bets.reduce((acc, bet) => {
        const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : parseInt(bet.odds);
        const decimal = americanToDecimal(oddsValue);
        if (decimal === null) {
          invalidLegOdds = true;
          return acc;
        }
        return acc * decimal;
      }, 1);
      if (invalidLegOdds) {
        return res.status(400).json({ error: 'Invalid odds on parlay leg' });
      }
      const americanOdds = parlayDecimal >= 2
        ? Math.round((parlayDecimal - 1) * 100)
        : Math.round(-100 / (parlayDecimal - 1));
      parlayPrecomputed = {
        americanOdds,
        potentialPayout: effectiveParlayStake * parlayDecimal,
        legsData: bets.map(b => ({
          selection: b.selection,
          matchup: b.matchup,
          betType: b.betType,
          odds: typeof b.odds === 'object' ? b.odds.odds || b.odds.value || 0 : parseInt(b.odds),
          homeTeamFull: b.homeTeamFull,
          awayTeamFull: b.awayTeamFull,
          homeTeam: b.homeTeam,
          awayTeam: b.awayTeam,
          gameId: b.gameId
        })),
      };
    }

    // ---- Atomic balance reservation ----------------------------------------
    // Deduct from the relevant balance row using a conditional UPDATE so two
    // concurrent requests can never both pass when only one stake fits.
    // If the row was not updated (insufficient funds or row vanished) we bail
    // out with 409 before inserting any bet records.
    const stakeStr = totalStake.toFixed(2);
    let newBankroll = 0;
    let refundDeduction = null; // () => Promise — call to undo the deduction

    if (isFakeOpponent && activeMatchup) {
      const debited = await db
        .update(matchups)
        .set({
          user2Balance: sql`${matchups.user2Balance} - ${stakeStr}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(matchups.id, activeMatchup.id),
            sql`${matchups.user2Balance} >= ${stakeStr}`
          )
        )
        .returning({ user2Balance: matchups.user2Balance });

      if (debited.length === 0) {
        return res.status(409).json({ error: 'Insufficient balance' });
      }
      newBankroll = parseFloat(debited[0].user2Balance) || 0;
      refundDeduction = async () => {
        await db
          .update(matchups)
          .set({
            user2Balance: sql`${matchups.user2Balance} + ${stakeStr}`,
            updatedAt: new Date(),
          })
          .where(eq(matchups.id, activeMatchup.id));
      };
    } else if (challengeType === '1v1' && activeChallenge) {
      const isUser1 = activeChallenge.user1Id === userId;
      const balanceCol = isUser1 ? matchups.user1Balance : matchups.user2Balance;
      const debited = await db
        .update(matchups)
        .set({
          ...(isUser1
            ? { user1Balance: sql`${matchups.user1Balance} - ${stakeStr}` }
            : { user2Balance: sql`${matchups.user2Balance} - ${stakeStr}` }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(matchups.id, activeChallenge.id),
            sql`${balanceCol} >= ${stakeStr}`
          )
        )
        .returning({
          user1Balance: matchups.user1Balance,
          user2Balance: matchups.user2Balance,
        });

      if (debited.length === 0) {
        return res.status(409).json({ error: 'Insufficient balance' });
      }
      newBankroll = parseFloat(
        isUser1 ? debited[0].user1Balance : debited[0].user2Balance
      ) || 0;
      refundDeduction = async () => {
        await db
          .update(matchups)
          .set({
            ...(isUser1
              ? { user1Balance: sql`${matchups.user1Balance} + ${stakeStr}` }
              : { user2Balance: sql`${matchups.user2Balance} + ${stakeStr}` }),
            updatedAt: new Date(),
          })
          .where(eq(matchups.id, activeChallenge.id));
      };
    } else if (challengeType === 'pool' && activeChallenge) {
      const debited = await db
        .update(poolParticipants)
        .set({ balance: sql`${poolParticipants.balance} - ${stakeStr}` })
        .where(
          and(
            eq(poolParticipants.id, activeChallenge.participant.id),
            sql`${poolParticipants.balance} >= ${stakeStr}`
          )
        )
        .returning({ balance: poolParticipants.balance });

      if (debited.length === 0) {
        return res.status(409).json({ error: 'Insufficient balance' });
      }
      newBankroll = parseFloat(debited[0].balance) || 0;
      refundDeduction = async () => {
        await db
          .update(poolParticipants)
          .set({ balance: sql`${poolParticipants.balance} + ${stakeStr}` })
          .where(eq(poolParticipants.id, activeChallenge.participant.id));
      };
    } else {
      // No active battle and no fake opponent — already rejected above, but
      // guard defensively.
      return res.status(400).json({ error: 'No active battle' });
    }

    // currentBankroll == balance BEFORE this deduction, used for the
    // balanceBefore/balanceAfter audit fields recorded on each bet row.
    currentBankroll = newBankroll + totalStake;

    const insertedBets = [];

    // Build all rows up-front so we can insert them in a single statement.
    // A single multi-row INSERT is atomic in Postgres — either all rows land
    // or none do — which closes the partial-insert / free-bet loophole.
    const fakeRows = [];
    const poolRows = [];
    const userRows = [];

    if (parlayPrecomputed) {
      const { americanOdds, potentialPayout, legsData } = parlayPrecomputed;
      const baseParlay = {
        matchupName: `${bets.length}-Leg Parlay`,
        marketType: 'parlay',
        selection: bets.map(b => b.selection).join(', '),
        odds: americanOdds.toString(),
        stake: effectiveParlayStake.toString(),
        potentialPayout: potentialPayout.toFixed(2),
        status: 'pending',
        legs: legsData,
      };

      if (isFakeOpponent && activeMatchup) {
        fakeRows.push({
          ...baseParlay,
          matchupId: activeMatchup.id,
          fakeOpponentId: fakeOpponentEntry.id,
        });
      } else if (challengeType === 'pool' && activeChallenge) {
        poolRows.push({
          ...baseParlay,
          poolId: activeChallenge.pool.id,
          userId,
          balanceBefore: currentBankroll.toFixed(2),
          balanceAfter: (currentBankroll - effectiveParlayStake).toFixed(2),
        });
      } else {
        userRows.push({
          ...baseParlay,
          userId,
          ...(challengeType === '1v1' && activeChallenge ? { matchupId: activeChallenge.id } : {}),
          balanceBefore: currentBankroll.toFixed(2),
          balanceAfter: (currentBankroll - effectiveParlayStake).toFixed(2),
        });
      }
    } else {
      for (const bet of bets) {
        if (!bet.stake || bet.stake <= 0) continue;

        const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
        const potentialPayout = calculatePayout(oddsValue, bet.stake);

        if (isFakeOpponent && activeMatchup) {
          fakeRows.push({
            matchupId: activeMatchup.id,
            fakeOpponentId: fakeOpponentEntry.id,
            matchupName: bet.matchup,
            marketType: bet.betType,
            selection: bet.selection,
            odds: oddsValue.toString(),
            stake: bet.stake.toString(),
            potentialPayout: potentialPayout.toFixed(2),
            status: 'pending',
            homeTeamFull: bet.homeTeamFull,
            awayTeamFull: bet.awayTeamFull,
          });
        } else if (challengeType === 'pool' && activeChallenge) {
          poolRows.push({
            poolId: activeChallenge.pool.id,
            userId,
            matchupName: bet.matchup,
            marketType: bet.betType,
            selection: bet.selection,
            odds: oddsValue.toString(),
            stake: bet.stake.toString(),
            potentialPayout: potentialPayout.toFixed(2),
            status: 'pending',
            balanceBefore: currentBankroll.toFixed(2),
            balanceAfter: (currentBankroll - bet.stake).toFixed(2),
            homeTeamFull: bet.homeTeamFull,
            awayTeamFull: bet.awayTeamFull,
          });
        } else {
          userRows.push({
            userId,
            ...(challengeType === '1v1' && activeChallenge ? { matchupId: activeChallenge.id } : {}),
            matchupName: bet.matchup,
            marketType: bet.betType,
            selection: bet.selection,
            odds: oddsValue.toString(),
            stake: bet.stake.toString(),
            potentialPayout: potentialPayout.toFixed(2),
            status: 'pending',
            balanceBefore: currentBankroll.toFixed(2),
            balanceAfter: (currentBankroll - bet.stake).toFixed(2),
            homeTeamFull: bet.homeTeamFull,
            awayTeamFull: bet.awayTeamFull,
          });
        }
      }
    }

    try {
      // Each branch writes to exactly one table and runs a single atomic
      // multi-row INSERT. If it fails, no rows were written and the refund
      // simply reverses the up-front debit.
      if (fakeRows.length > 0) {
        const inserted = await db.insert(fakeOpponentBets).values(fakeRows).returning();
        insertedBets.push(...inserted);
        console.log('[Place Bet] Fake opponent bets saved:', inserted.length);
      }
      if (poolRows.length > 0) {
        const inserted = await db.insert(poolBets).values(poolRows).returning();
        insertedBets.push(...inserted);
        console.log('[Place Bet] Pool bets saved:', inserted.length);
      }
      if (userRows.length > 0) {
        const inserted = await db.insert(userBets).values(userRows).returning();
        insertedBets.push(...inserted);
      }

      if (insertedBets.length === 0) {
        // Defensive: nothing was inserted (e.g. all stakes were filtered
        // out). Refund and reject so the caller sees a clean error.
        throw new Error('No bets to insert');
      }
    } catch (insertErr) {
      // Bet insertion failed after we deducted balance — refund.
      try {
        if (refundDeduction) await refundDeduction();
      } catch (refundErr) {
        console.error('[Place Bet] Refund after insert failure FAILED:', refundErr);
      }
      throw insertErr;
    }

    // Balance was already deducted atomically above; here we only need to
    // publish the live PnL update for the opponent UI. Build a "best effort"
    // matchup snapshot by patching the new balance onto the row we already
    // loaded — it's all the consumer needs for the broadcast.
    if (isFakeOpponent && activeMatchup) {
      const updatedMatchup = { ...activeMatchup, user2Balance: newBankroll.toFixed(2) };
      try {
        publishMatchupPnlUpdate(updatedMatchup, { reason: 'bet:placed', byUserId: userId });
      } catch (e) { console.error('[Place Bet] publishMatchupPnlUpdate error:', e); }
    } else if (challengeType === '1v1' && activeChallenge) {
      const isUser1 = activeChallenge.user1Id === userId;
      const updatedMatchup = {
        ...activeChallenge,
        ...(isUser1
          ? { user1Balance: newBankroll.toFixed(2) }
          : { user2Balance: newBankroll.toFixed(2) }),
      };
      try {
        publishMatchupPnlUpdate(updatedMatchup, { reason: 'bet:placed', byUserId: userId });
      } catch (e) { console.error('[Place Bet] publishMatchupPnlUpdate error:', e); }
    }

    await db
      .update(profiles)
      .set({ 
        totalBets: (userProfile.totalBets || 0) + insertedBets.length,
        lastBetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(profiles.id, userId));

    try {
      if (isFakeOpponent && activeMatchup) {
        const realUserId = activeMatchup.user1Id;
        if (realUserId) {
          publishBattleEvent(realUserId, {
            type: 'matchup:bet',
            matchupId: activeMatchup.id,
            actorId: userId,
            betsPlaced: insertedBets.length,
            totalStake,
          });
        }
      } else if (challengeType === '1v1' && activeChallenge) {
        const opponentId = activeChallenge.user1Id === userId
          ? activeChallenge.user2Id
          : activeChallenge.user1Id;
        if (opponentId) {
          publishBattleEvent(opponentId, {
            type: 'matchup:bet',
            matchupId: activeChallenge.id,
            actorId: userId,
            betsPlaced: insertedBets.length,
            totalStake,
          });
        }
      }
    } catch (e) {
      console.error('[Place Bet] Failed to publish matchup:bet event:', e);
    }

    return res.status(200).json({ 
      success: true, 
      newBankroll,
      challengeType: challengeType || 'none',
      betsPlaced: insertedBets.length,
      bets: insertedBets
    });
  } catch (error) {
    console.error('Error placing bets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
