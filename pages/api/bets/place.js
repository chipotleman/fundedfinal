import { db } from '../../../lib/db';
import { userBets, profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';

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

      const parlayBet = {
        userId,
        matchupName: `${bets.length}-Leg Parlay`,
        marketType: 'parlay',
        selection: bets.map(b => b.selection).join(', '),
        odds: americanOdds.toString(),
        stake: parlayStake.toString(),
        potentialPayout: potentialPayout.toFixed(2),
        status: 'pending',
      };

      await db.insert(userBets).values(parlayBet);
      insertedBets.push(parlayBet);
    } else {
      for (const bet of bets) {
        if (!bet.stake || bet.stake <= 0) continue;

        const oddsValue = typeof bet.odds === 'object' ? bet.odds.odds || bet.odds.value || 0 : bet.odds;
        const potentialPayout = calculatePayout(oddsValue, bet.stake);

        const newBet = {
          userId,
          matchupName: bet.matchup,
          marketType: bet.betType,
          selection: bet.selection,
          odds: oddsValue.toString(),
          stake: bet.stake.toString(),
          potentialPayout: potentialPayout.toFixed(2),
          status: 'pending',
        };

        await db.insert(userBets).values(newBet);
        insertedBets.push(newBet);
      }
    }

    const newBankroll = currentBankroll - totalStake;
    await db
      .update(profiles)
      .set({ 
        bankroll: newBankroll.toFixed(2),
        totalBets: (userProfile.totalBets || 0) + insertedBets.length,
        lastBetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(profiles.id, userId));

    return res.status(200).json({ 
      success: true, 
      newBankroll,
      betsPlaced: insertedBets.length
    });
  } catch (error) {
    console.error('Error placing bets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
