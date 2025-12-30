import { db } from '../../../lib/db';
import { cappers, capperProducts, capperPerformance } from '../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, sort = 'popular', search } = req.query;

    let allCappers = await db.select().from(cappers).where(eq(cappers.isActive, true));

    if (sport && sport !== 'all') {
      allCappers = allCappers.filter(c => {
        const specs = c.specialties || [];
        return specs.includes(sport.toUpperCase());
      });
    }

    if (search) {
      const searchLower = search.toLowerCase();
      allCappers = allCappers.filter(c => 
        c.displayName.toLowerCase().includes(searchLower) ||
        (c.bio && c.bio.toLowerCase().includes(searchLower))
      );
    }

    const cappersWithDetails = await Promise.all(allCappers.map(async (capper) => {
      const products = await db.select().from(capperProducts)
        .where(and(eq(capperProducts.capperId, capper.id), eq(capperProducts.isActive, true)))
        .orderBy(capperProducts.sortOrder);

      const performance = await db.select().from(capperPerformance)
        .where(and(eq(capperPerformance.capperId, capper.id), eq(capperPerformance.period, 'all_time')))
        .limit(1);

      const recentPerformance = await db.select().from(capperPerformance)
        .where(and(eq(capperPerformance.capperId, capper.id), eq(capperPerformance.period, 'monthly')))
        .orderBy(desc(capperPerformance.periodEnd))
        .limit(1);

      const lowestPrice = products.length > 0 
        ? Math.min(...products.map(p => parseFloat(p.price)))
        : null;

      return {
        ...capper,
        products,
        lowestPrice,
        performance: performance[0] || null,
        recentPerformance: recentPerformance[0] || null,
      };
    }));

    if (sort === 'popular') {
      cappersWithDetails.sort((a, b) => b.totalSubscribers - a.totalSubscribers);
    } else if (sort === 'rating') {
      cappersWithDetails.sort((a, b) => parseFloat(b.averageRating) - parseFloat(a.averageRating));
    } else if (sort === 'winrate') {
      cappersWithDetails.sort((a, b) => {
        const aWinRate = a.performance?.winRate || 0;
        const bWinRate = b.performance?.winRate || 0;
        return parseFloat(bWinRate) - parseFloat(aWinRate);
      });
    } else if (sort === 'newest') {
      cappersWithDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'price_low') {
      cappersWithDetails.sort((a, b) => (a.lowestPrice || 999999) - (b.lowestPrice || 999999));
    }

    return res.status(200).json({ cappers: cappersWithDetails });
  } catch (error) {
    console.error('Failed to fetch cappers:', error);
    return res.status(500).json({ error: 'Failed to fetch cappers' });
  }
}
