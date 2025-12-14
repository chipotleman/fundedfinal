import { db } from '../../../lib/db';
import { userBets } from '../../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;

    const bets = await db
      .select()
      .from(userBets)
      .where(eq(userBets.userId, userId))
      .orderBy(desc(userBets.placedAt));

    const formattedBets = bets.map(bet => ({
      id: bet.id,
      matchup: bet.matchupName,
      selection: bet.selection,
      betType: bet.marketType,
      odds: parseInt(bet.odds) || 0,
      stake: parseFloat(bet.stake) || 0,
      status: bet.status === 'pending' ? 'open' : bet.status,
      placedAt: bet.placedAt,
      settledAt: bet.settledAt,
      profit: bet.status === 'won' 
        ? (parseFloat(bet.potentialPayout) - parseFloat(bet.stake)) 
        : bet.status === 'cashed_out'
        ? parseFloat(bet.pnl) || (parseFloat(bet.stake) * -0.2)
        : bet.status === 'lost'
        ? -parseFloat(bet.stake)
        : 0,
      potentialPayout: parseFloat(bet.potentialPayout) || 0
    }));

    formattedBets.sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      return new Date(b.placedAt) - new Date(a.placedAt);
    });

    return res.status(200).json(formattedBets);
  } catch (error) {
    console.error('Error fetching bet history:', error);
    return res.status(500).json({ error: 'Failed to fetch bet history' });
  }
}
