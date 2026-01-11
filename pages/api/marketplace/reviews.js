import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '../../../lib/db';
import { capperReviews, capperSubscriptions, cappers } from '../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (req.method === 'GET') {
    const { capperId } = req.query;
    
    if (!capperId) {
      return res.status(400).json({ error: 'Capper ID required' });
    }

    try {
      const reviews = await db.select().from(capperReviews)
        .where(and(eq(capperReviews.capperId, capperId), eq(capperReviews.status, 'approved')))
        .orderBy(desc(capperReviews.createdAt));

      return res.status(200).json({ reviews });
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  }

  if (req.method === 'POST') {
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { capperId, subscriptionId, rating, title, comment } = req.body;

    if (!capperId || !subscriptionId || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
      const subscriptionResults = await db.select().from(capperSubscriptions)
        .where(and(
          eq(capperSubscriptions.id, subscriptionId),
          eq(capperSubscriptions.buyerId, session.user.id)
        ))
        .limit(1);

      if (subscriptionResults.length === 0) {
        return res.status(403).json({ error: 'You can only review products you have purchased' });
      }

      const existingReview = await db.select().from(capperReviews)
        .where(and(
          eq(capperReviews.capperId, capperId),
          eq(capperReviews.buyerId, session.user.id),
          eq(capperReviews.subscriptionId, subscriptionId)
        ))
        .limit(1);

      if (existingReview.length > 0) {
        return res.status(400).json({ error: 'You have already reviewed this subscription' });
      }

      const review = await db.insert(capperReviews).values({
        capperId,
        buyerId: session.user.id,
        subscriptionId,
        rating: parseInt(rating),
        title: title || null,
        comment: comment || null,
        status: 'approved',
        isVerifiedPurchase: true,
      }).returning();

      const allReviews = await db.select().from(capperReviews)
        .where(and(eq(capperReviews.capperId, capperId), eq(capperReviews.status, 'approved')));

      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRating / allReviews.length;

      await db.update(cappers)
        .set({
          averageRating: averageRating.toFixed(2),
          totalReviews: allReviews.length,
          updatedAt: new Date(),
        })
        .where(eq(cappers.id, capperId));

      return res.status(201).json({ review: review[0] });
    } catch (error) {
      console.error('Failed to create review:', error);
      return res.status(500).json({ error: 'Failed to create review' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
