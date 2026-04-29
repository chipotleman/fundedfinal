import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { sql } from 'drizzle-orm';
import { requireAdmin } from '../../../lib/adminAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const allProfiles = await db.select().from(profiles);
    
    const challenges = allProfiles
      .filter(p => p.challengeTier && p.challengePhase)
      .map(p => ({
        id: p.id,
        userId: p.userId,
        userName: p.name,
        userEmail: p.email,
        tier: p.challengeTier,
        status: p.challengePhase,
        bankroll: parseFloat(p.challengeBankroll) || 0,
        startingBankroll: parseFloat(p.startingBankroll) || 0,
        profitLoss: (parseFloat(p.challengeBankroll) || 0) - (parseFloat(p.startingBankroll) || 0),
        picksCount: p.totalBets || 0,
        startedAt: p.challengeStartDate,
      }));

    const stats = {
      total: challenges.length,
      active: challenges.filter(c => ['phase1', 'phase2', 'reward'].includes(c.status)).length,
      completed: challenges.filter(c => c.status === 'completed').length,
      failed: challenges.filter(c => c.status === 'failed').length,
    };

    return res.status(200).json({ challenges, stats });
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    return res.status(500).json({ error: 'Failed to fetch challenges' });
  }
}

export default requireAdmin(handler);
