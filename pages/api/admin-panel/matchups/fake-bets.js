import { db } from '../../../../lib/db';
import { fakeOpponentBets, matchups, fakeOpponents } from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { matchupId } = req.query;

      let bets;
      if (matchupId) {
        bets = await db
          .select()
          .from(fakeOpponentBets)
          .where(eq(fakeOpponentBets.matchupId, matchupId))
          .orderBy(fakeOpponentBets.placedAt);
      } else {
        bets = await db
          .select()
          .from(fakeOpponentBets)
          .orderBy(fakeOpponentBets.placedAt)
          .limit(100);
      }

      return res.status(200).json(bets);
    } catch (error) {
      console.error('Get fake bets error:', error);
      return res.status(500).json({ error: 'Failed to fetch fake bets' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { matchupId, matchupName, marketType, selection, odds, stake, placedByAdminId } = req.body;

      if (!matchupId || !selection || !odds || !stake) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const [matchup] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
      
      if (!matchup) {
        return res.status(404).json({ error: 'Matchup not found' });
      }

      if (!matchup.isFakeOpponent || !matchup.fakeOpponentId) {
        return res.status(400).json({ error: 'This matchup does not have a fake opponent' });
      }

      const oddsNum = parseInt(odds);
      const stakeNum = parseFloat(stake);
      let potentialPayout = stakeNum;
      
      if (oddsNum > 0) {
        potentialPayout = stakeNum + (stakeNum * oddsNum / 100);
      } else {
        potentialPayout = stakeNum + (stakeNum * 100 / Math.abs(oddsNum));
      }

      const [newBet] = await db.insert(fakeOpponentBets).values({
        matchupId,
        fakeOpponentId: matchup.fakeOpponentId,
        matchupName: matchupName || 'Unknown Game',
        marketType: marketType || 'moneyline',
        selection,
        odds: odds.toString(),
        stake: stakeNum.toString(),
        potentialPayout: potentialPayout.toFixed(2),
        status: 'pending',
        placedByAdminId: placedByAdminId || null,
      }).returning();

      return res.status(201).json(newBet);
    } catch (error) {
      console.error('Create fake bet error:', error);
      return res.status(500).json({ error: 'Failed to create fake bet' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, status, pnl } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Bet ID required' });
      }

      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (pnl !== undefined) updateData.pnl = pnl.toString();
      if (status && status !== 'pending') {
        updateData.settledAt = new Date();
      }

      const [updated] = await db
        .update(fakeOpponentBets)
        .set(updateData)
        .where(eq(fakeOpponentBets.id, id))
        .returning();

      return res.status(200).json(updated);
    } catch (error) {
      console.error('Update fake bet error:', error);
      return res.status(500).json({ error: 'Failed to update fake bet' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Bet ID required' });
      }

      await db.delete(fakeOpponentBets).where(eq(fakeOpponentBets.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Delete fake bet error:', error);
      return res.status(500).json({ error: 'Failed to delete fake bet' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
