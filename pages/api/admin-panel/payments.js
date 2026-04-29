import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { requireAdmin } from '../../../lib/adminAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const allProfiles = await db.select().from(profiles);
    
    const payments = allProfiles
      .filter(p => p.challengeTier && p.paymentStatus === 'completed')
      .map(p => {
        const tierPrices = { starter: 149, pro: 249, elite: 399 };
        return {
          id: p.id,
          userId: p.userId,
          userName: p.name,
          userEmail: p.email,
          amount: tierPrices[p.challengeTier] || 0,
          product: `${(p.challengeTier || '').charAt(0).toUpperCase() + (p.challengeTier || '').slice(1)} Challenge`,
          status: p.paymentStatus || 'completed',
          transactionId: p.paymentId || null,
          createdAt: p.challengeStartDate || p.createdAt,
        };
      });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const stats = {
      total: payments.length,
      revenue: totalRevenue,
      pending: 0,
      refunded: 0,
    };

    return res.status(200).json({ payments, stats });
  } catch (error) {
    console.error('Failed to fetch payments:', error);
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }
}

export default requireAdmin(handler);
