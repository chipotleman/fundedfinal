import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { cappers, capperProducts, capperSubscriptions, capperReviews, capperPerformance } from '../../../shared/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const capperResults = await db.select().from(cappers)
      .where(eq(cappers.userId, session.user.id))
      .limit(1);

    if (capperResults.length === 0) {
      return res.status(403).json({ error: 'Not registered as a capper' });
    }

    const capper = capperResults[0];

    const products = await db.select().from(capperProducts)
      .where(eq(capperProducts.capperId, capper.id))
      .orderBy(capperProducts.sortOrder);

    const activeSubscriptions = await db.select().from(capperSubscriptions)
      .where(and(
        eq(capperSubscriptions.capperId, capper.id),
        eq(capperSubscriptions.status, 'active')
      ));

    const allSubscriptions = await db.select().from(capperSubscriptions)
      .where(eq(capperSubscriptions.capperId, capper.id))
      .orderBy(desc(capperSubscriptions.createdAt))
      .limit(50);

    const reviews = await db.select().from(capperReviews)
      .where(eq(capperReviews.capperId, capper.id))
      .orderBy(desc(capperReviews.createdAt))
      .limit(20);

    const performance = await db.select().from(capperPerformance)
      .where(and(eq(capperPerformance.capperId, capper.id), eq(capperPerformance.period, 'all_time')))
      .limit(1);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRevenue = allSubscriptions
      .filter(s => new Date(s.createdAt) >= thirtyDaysAgo)
      .reduce((sum, s) => sum + parseFloat(s.amountPaid || 0), 0);

    const stats = {
      totalSubscribers: activeSubscriptions.length,
      totalRevenue: parseFloat(capper.totalRevenue) || 0,
      monthlyRevenue: recentRevenue,
      averageRating: parseFloat(capper.averageRating) || 0,
      totalReviews: capper.totalReviews || 0,
      winRate: performance[0]?.winRate || 0,
      roi: performance[0]?.roi || 0,
    };

    return res.status(200).json({
      capper,
      products,
      activeSubscriptions,
      recentSubscriptions: allSubscriptions,
      reviews,
      performance: performance[0] || null,
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch dashboard:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
}
