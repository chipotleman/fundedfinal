import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { cappers, capperProducts } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const capperResults = await db.select().from(cappers)
    .where(eq(cappers.userId, session.user.id))
    .limit(1);

  if (capperResults.length === 0) {
    return res.status(403).json({ error: 'Not registered as a capper' });
  }

  const capper = capperResults[0];

  if (req.method === 'GET') {
    try {
      const products = await db.select().from(capperProducts)
        .where(eq(capperProducts.capperId, capper.id))
        .orderBy(capperProducts.sortOrder);

      return res.status(200).json({ products });
    } catch (error) {
      console.error('Failed to fetch products:', error);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description, duration, durationDays, price, features, includesDiscord } = req.body;

      if (!name || !duration || !durationDays || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existingProducts = await db.select().from(capperProducts)
        .where(eq(capperProducts.capperId, capper.id));

      const newProduct = await db.insert(capperProducts).values({
        capperId: capper.id,
        name,
        description: description || '',
        type: 'subscription',
        duration,
        durationDays: parseInt(durationDays),
        price: price.toString(),
        features: features || [],
        includesDiscord: includesDiscord !== false,
        sortOrder: existingProducts.length,
        isActive: true,
      }).returning();

      return res.status(201).json({ product: newProduct[0] });
    } catch (error) {
      console.error('Failed to create product:', error);
      return res.status(500).json({ error: 'Failed to create product' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { productId, ...updates } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      const existingProduct = await db.select().from(capperProducts)
        .where(and(eq(capperProducts.id, productId), eq(capperProducts.capperId, capper.id)))
        .limit(1);

      if (existingProduct.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const updatedProduct = await db.update(capperProducts)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(capperProducts.id, productId))
        .returning();

      return res.status(200).json({ product: updatedProduct[0] });
    } catch (error) {
      console.error('Failed to update product:', error);
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
      }

      await db.update(capperProducts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(capperProducts.id, productId), eq(capperProducts.capperId, capper.id)));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to delete product:', error);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
