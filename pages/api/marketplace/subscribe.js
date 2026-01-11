import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { capperProducts, cappers, capperSubscriptions } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID required' });
  }

  try {
    const productResults = await db.select().from(capperProducts)
      .where(eq(capperProducts.id, productId))
      .limit(1);

    if (productResults.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResults[0];

    const capperResults = await db.select().from(cappers)
      .where(eq(cappers.id, product.capperId))
      .limit(1);

    if (capperResults.length === 0) {
      return res.status(404).json({ error: 'Capper not found' });
    }

    const capper = capperResults[0];

    if (capper.userId === session.user.id) {
      return res.status(400).json({ error: 'Cannot subscribe to your own products' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + product.durationDays);

    const subscription = await db.insert(capperSubscriptions).values({
      productId: product.id,
      capperId: capper.id,
      buyerId: session.user.id,
      amountPaid: product.price,
      status: 'active',
      startsAt: new Date(),
      expiresAt: expiresAt,
      autoRenew: false,
    }).returning();

    await db.update(capperProducts)
      .set({ 
        totalSales: (product.totalSales || 0) + 1,
        updatedAt: new Date()
      })
      .where(eq(capperProducts.id, product.id));

    await db.update(cappers)
      .set({ 
        totalSubscribers: (capper.totalSubscribers || 0) + 1,
        totalRevenue: (parseFloat(capper.totalRevenue) + parseFloat(product.price)).toString(),
        updatedAt: new Date()
      })
      .where(eq(cappers.id, capper.id));

    return res.status(200).json({ 
      success: true,
      subscription: subscription[0],
      message: 'Subscription created successfully'
    });
  } catch (error) {
    console.error('Failed to create subscription:', error);
    return res.status(500).json({ error: 'Failed to create subscription' });
  }
}
