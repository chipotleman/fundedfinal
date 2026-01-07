import { db } from '../../../lib/db';
import { userBets, profiles, fakeOpponents, fakeOpponentBets, matchups, poolParticipants, pikPools, poolBets } from '../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

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
      } else {
        currentBankroll = parseFloat(userProfile.bankroll) || 0;
      }
    }

    let totalStake = 0;

    if (betType === 'parlay' && parlayStake > 0) {
      totalStake = parlayStake;
    } else {
      totalStake = bets.reduce((sum, bet) => sum + (parseFloat(bet.stake) || 0), 0);
    }

    if (totalStake > currentBankroll) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const calculatePayout = (odds, stake) => {
      const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : parseInt(odds);
      if (oddsValue > 0) {
        return (stake * oddsValue / 100) + stake;
      } else {
        return (stake * (100 / Math.abs(oddsValue))) + stake;
      }
    };

    const insertedBets = [];

    if (betType === 'parlay' && parlayStake > 0) {
      const parlayDecimal = bets.reduce((acc, bet) => {
        const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : parseInt(bet.odds);
        const decimal = oddsValue > 0 ? (oddsValue/100 + 1) : (100/Math.abs(oddsValue) + 1);
        return acc * decimal;
      }, 1);
      const americanOdds = parlayDecimal >= 2 ? Math.round((parlayDecimal - 1) * 100) : Math.round(-100 / (parlayDecimal - 1));
      const potentialPayout = parlayStake * parlayDecimal;

      const legsData = bets.map(b => ({
        selection: b.selection,
        matchup: b.matchup,
        betType: b.betType,
        odds: typeof b.odds === 'object' ? b.odds.odds || b.odds.value || 0 : parseInt(b.odds),
        homeTeamFull: b.homeTeamFull,
        awayTeamFull: b.awayTeamFull,
        homeTeam: b.homeTeam,
        awayTeam: b.awayTeam,
        gameId: b.gameId
      }));

      if (isFakeOpponent && activeMatchup) {
        const fakeParlayBet = {
          matchupId: activeMatchup.id,
          fakeOpponentId: fakeOpponentEntry.id,
          matchupName: `${bets.length}-Leg Parlay`,
          marketType: 'parlay',
          selection: bets.map(b => b.selection).join(', '),
          odds: americanOdds.toString(),
          stake: parlayStake.toString(),
          potentialPayout: potentialPayout.toFixed(2),
          status: 'pending',
          legs: legsData,
        };
        const [insertedParlay] = await db.insert(fakeOpponentBets).values(fakeParlayBet).returning();
        insertedBets.push(insertedParlay);
        console.log('[Place Bet] Fake opponent parlay saved to fakeOpponentBets:', insertedParlay.id);
      } else if (challengeType === 'pool' && activeChallenge) {
        const poolBet = {
          poolId: activeChallenge.pool.id,
          userId,
          matchupName: `${bets.length}-Leg Parlay`,
          marketType: 'parlay',
          selection: bets.map(b => b.selection).join(', '),
          odds: americanOdds.toString(),
          stake: parlayStake.toString(),
          potentialPayout: potentialPayout.toFixed(2),
          status: 'pending',
          balanceBefore: currentBankroll.toFixed(2),
          balanceAfter: (currentBankroll - parlayStake).toFixed(2),
          legs: legsData,
        };
        const [insertedParlay] = await db.insert(poolBets).values(poolBet).returning();
        insertedBets.push(insertedParlay);
        console.log('[Place Bet] Pool parlay saved to poolBets:', insertedParlay.id);
      } else {
        const parlayBet = {
          userId,
          matchupName: `${bets.length}-Leg Parlay`,
          marketType: 'parlay',
          selection: bets.map(b => b.selection).join(', '),
          odds: americanOdds.toString(),
          stake: parlayStake.toString(),
          potentialPayout: potentialPayout.toFixed(2),
          status: 'pending',
          balanceBefore: currentBankroll.toFixed(2),
          balanceAfter: (currentBankroll - parlayStake).toFixed(2),
          legs: legsData,
        };
        const [insertedParlay] = await db.insert(userBets).values(parlayBet).returning();
        insertedBets.push(insertedParlay);
      }
    } else {
      for (const bet of bets) {
        if (!bet.stake || bet.stake <= 0) continue;

        const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
        const potentialPayout = calculatePayout(oddsValue, bet.stake);

        if (isFakeOpponent && activeMatchup) {
          const fakeBet = {
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
          };
          const [insertedBet] = await db.insert(fakeOpponentBets).values(fakeBet).returning();
          insertedBets.push(insertedBet);
          console.log('[Place Bet] Fake opponent bet saved to fakeOpponentBets:', insertedBet.id);
        } else if (challengeType === 'pool' && activeChallenge) {
          const poolBet = {
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
          };
          const [insertedBet] = await db.insert(poolBets).values(poolBet).returning();
          insertedBets.push(insertedBet);
          console.log('[Place Bet] Pool bet saved:', insertedBet.id);
        } else {
          const newBet = {
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
          };
          const [insertedBet] = await db.insert(userBets).values(newBet).returning();
          insertedBets.push(insertedBet);
        }
      }
    }

    const newBankroll = currentBankroll - totalStake;
    
    if (isFakeOpponent && activeMatchup) {
      const currentMatchupBalance = parseFloat(activeMatchup.user2Balance || activeMatchup.startingBalance || '0');
      const newMatchupBalance = currentMatchupBalance - totalStake;
      await db
        .update(matchups)
        .set({ 
          user2Balance: newMatchupBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(matchups.id, activeMatchup.id));
      console.log('[Place Bet] Updated matchup user2Balance:', newMatchupBalance.toFixed(2));
    } else if (challengeType === '1v1' && activeChallenge) {
      const isUser1 = activeChallenge.user1Id === userId;
      await db
        .update(matchups)
        .set({ 
          ...(isUser1 ? { user1Balance: newBankroll.toFixed(2) } : { user2Balance: newBankroll.toFixed(2) }),
          updatedAt: new Date()
        })
        .where(eq(matchups.id, activeChallenge.id));
      console.log('[Place Bet] Updated 1v1 balance for user:', newBankroll.toFixed(2));
    } else if (challengeType === 'pool' && activeChallenge) {
      await db
        .update(poolParticipants)
        .set({
          balance: newBankroll.toFixed(2),
        })
        .where(eq(poolParticipants.id, activeChallenge.participant.id));
      console.log('[Place Bet] Updated pool participant balance:', newBankroll.toFixed(2));
    } else {
      await db
        .update(profiles)
        .set({ 
          bankroll: newBankroll.toFixed(2),
          totalBets: (userProfile.totalBets || 0) + insertedBets.length,
          lastBetDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(profiles.id, userId));
    }

    await db
      .update(profiles)
      .set({ 
        totalBets: (userProfile.totalBets || 0) + insertedBets.length,
        lastBetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(profiles.id, userId));

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
