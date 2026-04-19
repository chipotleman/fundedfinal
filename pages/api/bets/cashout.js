import { db } from '../../../lib/db';
import { userBets, profiles, matchups } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
const { publishMatchupPnlUpdate } = require('../../../lib/battle-events');

export const CASHOUT_PAYOUT_RATIO = 0.8;
export const CASHOUT_FEE_RATIO = 1 - CASHOUT_PAYOUT_RATIO;

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
    const cashoutAmount = stake * CASHOUT_PAYOUT_RATIO;
    const pnl = cashoutAmount - stake;

    let liveMatchup = null;
    if (bet.matchupId) {
      const [m] = await db
        .select()
        .from(matchups)
        .where(eq(matchups.id, bet.matchupId))
        .limit(1);
      if (m && (m.status === 'active' || m.status === 'matched')) {
        liveMatchup = m;
      } else if (m) {
        return res.status(400).json({
          error: 'Bet cannot be cashed out - battle has ended',
        });
      }
    }

    const [updatedBet] = await db
      .update(userBets)
      .set({
        status: 'cashed_out',
        pnl: pnl.toFixed(2),
        settledAt: new Date()
      })
      .where(eq(userBets.id, betId))
      .returning();

    let newBankroll = parseFloat(userProfile.bankroll) || 0;

    if (liveMatchup) {
      const isUser1 = liveMatchup.user1Id === userId;
      const currentMatchupBalance = parseFloat(
        (isUser1 ? liveMatchup.user1Balance : liveMatchup.user2Balance) ?? 0
      );
      const newMatchupBalance = currentMatchupBalance + cashoutAmount;
      const [updatedMatchup] = await db
        .update(matchups)
        .set({
          ...(isUser1
            ? { user1Balance: newMatchupBalance.toFixed(2) }
            : { user2Balance: newMatchupBalance.toFixed(2) }),
          updatedAt: new Date(),
        })
        .where(eq(matchups.id, liveMatchup.id))
        .returning();
      try {
        publishMatchupPnlUpdate(updatedMatchup || liveMatchup, {
          reason: 'bet:cashed_out',
          byUserId: userId,
        });
      } catch (e) {
        console.error('[Cashout] publishMatchupPnlUpdate error:', e);
      }
    } else {
      newBankroll = (parseFloat(userProfile.bankroll) || 0) + cashoutAmount;
      const currentPnl = parseFloat(userProfile.pnl) || 0;
      const newPnl = currentPnl + pnl;
      await db
        .update(profiles)
        .set({
          bankroll: newBankroll.toFixed(2),
          pnl: newPnl.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(profiles.id, userId));
    }

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
