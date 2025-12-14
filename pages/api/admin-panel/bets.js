import { db } from '../../../lib/db';
import { userBets, users } from '../../../shared/schema';
import { eq, desc } from 'drizzle-orm';

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

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating bet:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
