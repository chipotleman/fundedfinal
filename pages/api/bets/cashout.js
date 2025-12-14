import { db } from '../../../lib/db';
import { userBets, profiles } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
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
    const { betId } = req.body;

    if (!betId) {
      return res.status(400).json({ error: 'Bet ID is required' });
    }

    const [bet] = await db
      .select()
      .from(userBets)
      .where(and(eq(userBets.id, betId), eq(userBets.userId, userId)))
      .limit(1);

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    if (bet.status !== 'pending') {
      return res.status(400).json({ error: 'Bet cannot be cashed out - already settled' });
    }

    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!userProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const stake = parseFloat(bet.stake) || 0;
    const cashoutAmount = stake * 0.8;
    const pnl = cashoutAmount - stake;

    const currentBankroll = parseFloat(userProfile.bankroll) || 0;
    const newBankroll = currentBankroll + cashoutAmount;
    const currentPnl = parseFloat(userProfile.pnl) || 0;
    const newPnl = currentPnl + pnl;

    const [updatedBet] = await db
      .update(userBets)
      .set({
        status: 'cashed_out',
        pnl: pnl.toFixed(2),
        settledAt: new Date()
      })
      .where(eq(userBets.id, betId))
      .returning();

    await db
      .update(profiles)
      .set({
        bankroll: newBankroll.toFixed(2),
        pnl: newPnl.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(profiles.id, userId));

    return res.status(200).json({
      success: true,
      bet: updatedBet,
      cashoutAmount,
      newBankroll
    });
  } catch (error) {
    console.error('Error cashing out bet:', error);
    return res.status(500).json({ error: 'Failed to cash out bet' });
  }
}
