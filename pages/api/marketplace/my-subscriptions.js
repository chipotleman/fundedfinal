import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '../../../lib/db';
import { capperSubscriptions, capperProducts, cappers } from '../../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const subscriptions = await db.select().from(capperSubscriptions)
      .where(eq(capperSubscriptions.buyerId, session.user.id))
      .orderBy(desc(capperSubscriptions.createdAt));

    const enrichedSubscriptions = await Promise.all(subscriptions.map(async (sub) => {
      const productResults = await db.select().from(capperProducts)
        .where(eq(capperProducts.id, sub.productId))
        .limit(1);
      
      const capperResults = await db.select().from(cappers)
        .where(eq(cappers.id, sub.capperId))
        .limit(1);

      return {
        ...sub,
        product: productResults[0] || null,
        capper: capperResults[0] || null,
      };
    }));

    return res.status(200).json({ subscriptions: enrichedSubscriptions });
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
    return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
}
