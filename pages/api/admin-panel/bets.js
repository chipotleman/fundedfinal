import { db } from '../../../lib/db';
import { userBets, users, profiles } from '../../../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const allBets = await db
        .select({
          id: userBets.id,
          userId: userBets.userId,
          matchupName: userBets.matchupName,
          marketType: userBets.marketType,
          selection: userBets.selection,
          odds: userBets.odds,
          stake: userBets.stake,
          potentialPayout: userBets.potentialPayout,
          status: userBets.status,
          pnl: userBets.pnl,
          placedAt: userBets.placedAt,
          settledAt: userBets.settledAt,
        })
        .from(userBets)
        .orderBy(desc(userBets.placedAt));

      const betsWithUser = await Promise.all(
        allBets.map(async (bet) => {
          const [user] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, bet.userId))
            .limit(1);

          return {
            ...bet,
            userEmail: user?.email || 'Unknown',
          };
        })
      );

      return res.status(200).json({ bets: betsWithUser });
    } catch (error) {
      console.error('Error fetching bets:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    const { betId, status, odds, pnl } = req.body;

    if (!betId) {
      return res.status(400).json({ error: 'Bet ID is required' });
    }

    try {
      const [existingBet] = await db
        .select()
        .from(userBets)
        .where(eq(userBets.id, betId))
        .limit(1);

      if (!existingBet) {
        return res.status(404).json({ error: 'Bet not found' });
      }

      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (odds !== undefined) updateData.odds = odds;
      if (pnl !== undefined) updateData.pnl = pnl;
      if (status === 'won' || status === 'lost') {
        updateData.settledAt = new Date();
      }

      await db
        .update(userBets)
        .set(updateData)
        .where(eq(userBets.id, betId));

      if ((status === 'won' || status === 'lost') && existingBet.status === 'pending') {
        const [userProfile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, existingBet.userId))
          .limit(1);

        if (userProfile) {
          const currentBankroll = parseFloat(userProfile.bankroll) || 0;
          const stake = parseFloat(existingBet.stake) || 0;
          const potentialPayout = parseFloat(existingBet.potentialPayout) || 0;
          const betPnl = parseFloat(pnl) || (status === 'won' ? potentialPayout - stake : -stake);

          let newBankroll = currentBankroll;
          if (status === 'won') {
            newBankroll = currentBankroll + potentialPayout;
          }

          const currentPnl = parseFloat(userProfile.pnl) || 0;
          const newPnl = currentPnl + betPnl;

          const totalBets = (userProfile.totalBets || 0);
          const wonBets = (userProfile.wonBets || 0) + (status === 'won' ? 1 : 0);
          const lostBets = (userProfile.lostBets || 0) + (status === 'lost' ? 1 : 0);
          const newWinRate = totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0;

          await db
            .update(profiles)
            .set({
              bankroll: newBankroll.toString(),
              pnl: newPnl.toString(),
              wonBets: wonBets,
              lostBets: lostBets,
              winRate: newWinRate,
            })
            .where(eq(profiles.id, existingBet.userId));
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating bet:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
