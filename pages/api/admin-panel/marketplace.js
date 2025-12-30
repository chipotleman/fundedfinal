import { db } from '../../../lib/db';
import { cappers, capperSubscriptions, capperReviews } from '../../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const allCappers = await db.select().from(cappers).orderBy(desc(cappers.createdAt));
      
      const allSubscriptions = await db.select().from(capperSubscriptions)
        .orderBy(desc(capperSubscriptions.createdAt))
        .limit(100);

      const enrichedSubscriptions = await Promise.all(allSubscriptions.map(async (sub) => {
        const capperResults = await db.select().from(cappers).where(eq(cappers.id, sub.capperId)).limit(1);
        return {
          ...sub,
          capperName: capperResults[0]?.displayName || null,
        };
      }));

      const allReviews = await db.select().from(capperReviews)
        .orderBy(desc(capperReviews.createdAt))
        .limit(100);

      const enrichedReviews = await Promise.all(allReviews.map(async (review) => {
        const capperResults = await db.select().from(cappers).where(eq(cappers.id, review.capperId)).limit(1);
        return {
          ...review,
          capperName: capperResults[0]?.displayName || null,
        };
      }));

      const totalRevenue = allCappers.reduce((sum, c) => sum + parseFloat(c.totalRevenue || 0), 0);
      const activeSubscriptions = allSubscriptions.filter(s => s.status === 'active').length;
      const pendingReviews = allReviews.filter(r => r.status === 'pending').length;

      return res.status(200).json({
        cappers: allCappers,
        subscriptions: enrichedSubscriptions,
        reviews: enrichedReviews,
        stats: {
          totalCappers: allCappers.length,
          totalRevenue,
          activeSubscriptions,
          pendingReviews,
        },
      });
    } catch (error) {
      console.error('Failed to fetch marketplace data:', error);
      return res.status(500).json({ error: 'Failed to fetch marketplace data' });
    }
  }

  if (req.method === 'PUT') {
    const { action, capperId, isActive, reviewId, status } = req.body;

    try {
      if (action === 'toggle_capper') {
        await db.update(cappers)
          .set({ isActive, updatedAt: new Date() })
          .where(eq(cappers.id, capperId));
        return res.status(200).json({ success: true });
      }

      if (action === 'moderate_review') {
        await db.update(capperReviews)
          .set({ status, moderatedAt: new Date(), updatedAt: new Date() })
          .where(eq(capperReviews.id, reviewId));
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
      console.error('Failed to update:', error);
      return res.status(500).json({ error: 'Failed to update' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
