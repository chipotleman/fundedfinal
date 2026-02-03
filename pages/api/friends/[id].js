import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { friendships } from '../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const { action } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "accept" or "reject"' });
    }

    try {
      const friendship = await db
        .select()
        .from(friendships)
        .where(
          and(
            eq(friendships.id, id),
            eq(friendships.friendId, userId),
            eq(friendships.status, 'pending')
          )
        )
        .limit(1);

      if (friendship.length === 0) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      if (action === 'accept') {
        await db
          .update(friendships)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(eq(friendships.id, id));
        return res.status(200).json({ message: 'Friend request accepted' });
      } else {
        await db
          .delete(friendships)
          .where(eq(friendships.id, id));
        return res.status(200).json({ message: 'Friend request rejected' });
      }
    } catch (error) {
      console.error('Error updating friend request:', error);
      return res.status(500).json({ error: 'Failed to update friend request' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await db
        .delete(friendships)
        .where(
          and(
            or(
              and(eq(friendships.userId, userId), eq(friendships.friendId, id)),
              and(eq(friendships.userId, id), eq(friendships.friendId, userId))
            ),
            eq(friendships.status, 'accepted')
          )
        );

      return res.status(200).json({ message: 'Friend removed' });
    } catch (error) {
      console.error('Error removing friend:', error);
      return res.status(500).json({ error: 'Failed to remove friend' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
