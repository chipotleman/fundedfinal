import { db } from '../../../lib/db';
import { userBets, profiles, fakeOpponents, fakeOpponentBets, matchups } from '../../../shared/schema';
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

    let currentBankroll = parseFloat(userProfile.bankroll) || 0;
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

      // Use different table for fake opponents
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

        // Use different table for fake opponents
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
    
    // Update profile bankroll
    await db
      .update(profiles)
      .set({ 
        bankroll: newBankroll.toFixed(2),
        totalBets: (userProfile.totalBets || 0) + insertedBets.length,
        lastBetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(profiles.id, userId));

    // Also update matchup balance for fake opponents
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
    }

    return res.status(200).json({ 
      success: true, 
      newBankroll,
      betsPlaced: insertedBets.length,
      bets: insertedBets
    });
  } catch (error) {
    console.error('Error placing bets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
