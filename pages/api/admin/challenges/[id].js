import { db } from '../../../../lib/db';
import { userChallenges } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../../../../lib/adminAuth';

export default async function handler(req, res) {
  if (!await requireAdmin(req, res)) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const challenge = await db
        .select()
        .from(userChallenges)
        .where(eq(userChallenges.id, id))
        .limit(1);

      if (challenge.length === 0) {
        return res.status(404).json({ error: 'Challenge not found' });
      }

      return res.status(200).json(challenge[0]);
    } catch (error) {
      console.error('Error fetching challenge:', error);
      return res.status(500).json({ error: 'Failed to fetch challenge' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const {
        status,
        phase,
        currentBalance,
        pnl,
        dailyLoss,
        totalBets,
        winRate
      } = req.body;

      const updateData = { updatedAt: new Date() };
      
      if (status) updateData.status = status;
      if (phase !== undefined) updateData.phase = phase;
      if (currentBalance !== undefined) updateData.currentBalance = currentBalance.toString();
      if (pnl !== undefined) updateData.pnl = pnl.toString();
      if (dailyLoss !== undefined) updateData.dailyLoss = dailyLoss.toString();
      if (totalBets !== undefined) updateData.totalBets = totalBets;
      if (winRate !== undefined) updateData.winRate = winRate.toString();

      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
      }

      await db
        .update(userChallenges)
        .set(updateData)
        .where(eq(userChallenges.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating challenge:', error);
      return res.status(500).json({ error: 'Failed to update challenge' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await db.delete(userChallenges).where(eq(userChallenges.id, id));
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting challenge:', error);
      return res.status(500).json({ error: 'Failed to delete challenge' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
