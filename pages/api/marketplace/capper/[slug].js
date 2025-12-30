import { db } from '../../../../lib/db';
import { cappers, capperProducts, capperPerformance, capperReviews, users } from '../../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  try {
    const capperResults = await db.select().from(cappers).where(eq(cappers.slug, slug)).limit(1);
    
    if (capperResults.length === 0) {
      return res.status(404).json({ error: 'Capper not found' });
    }

    const capper = capperResults[0];

    const products = await db.select().from(capperProducts)
      .where(and(eq(capperProducts.capperId, capper.id), eq(capperProducts.isActive, true)))
      .orderBy(capperProducts.sortOrder);

    const allTimePerformance = await db.select().from(capperPerformance)
      .where(and(eq(capperPerformance.capperId, capper.id), eq(capperPerformance.period, 'all_time')))
      .limit(1);

    const monthlyPerformance = await db.select().from(capperPerformance)
      .where(and(eq(capperPerformance.capperId, capper.id), eq(capperPerformance.period, 'monthly')))
      .orderBy(desc(capperPerformance.periodEnd))
      .limit(3);

    const reviewsRaw = await db.select().from(capperReviews)
      .where(and(eq(capperReviews.capperId, capper.id), eq(capperReviews.status, 'approved')))
      .orderBy(desc(capperReviews.createdAt))
      .limit(20);

    const reviews = await Promise.all(reviewsRaw.map(async (review) => {
      const userResults = await db.select({ username: users.email }).from(users).where(eq(users.id, review.buyerId)).limit(1);
      const username = userResults[0]?.email?.split('@')[0] || 'Anonymous';
      return {
        ...review,
        buyerName: username,
      };
    }));

    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const allReviews = await db.select().from(capperReviews)
      .where(and(eq(capperReviews.capperId, capper.id), eq(capperReviews.status, 'approved')));
    
    allReviews.forEach(r => {
      if (ratingBreakdown[r.rating] !== undefined) {
        ratingBreakdown[r.rating]++;
      }
    });

    return res.status(200).json({
      capper: {
        ...capper,
        products,
        performance: {
          allTime: allTimePerformance[0] || null,
          monthly: monthlyPerformance,
        },
        reviews,
        ratingBreakdown,
      }
    });
  } catch (error) {
    console.error('Failed to fetch capper:', error);
    return res.status(500).json({ error: 'Failed to fetch capper' });
  }
}
