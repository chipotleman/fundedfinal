import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { friendships } from '../../../shared/schema';
import { eq, or, and } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;
  const { receiverId, stop } = req.body || {};
  if (!receiverId) {
    return res.status(400).json({ error: 'Receiver ID required' });
  }
  const isStop = stop === true;

  try {
    const areFriends = await db
      .select()
      .from(friendships)
      .where(
        and(
          or(
            and(eq(friendships.userId, userId), eq(friendships.friendId, receiverId)),
            and(eq(friendships.userId, receiverId), eq(friendships.friendId, userId))
          ),
          eq(friendships.status, 'accepted')
        )
      )
      .limit(1);

    if (areFriends.length === 0) {
      return res.status(403).json({ error: 'You can only message friends' });
    }

    try {
      publishBattleEvent(receiverId, {
        type: 'notification:typing',
        senderId: userId,
        stop: isStop,
      });
    } catch (_e) {}

    return res.status(204).end();
  } catch (error) {
    console.error('Error publishing typing indicator:', error);
    return res.status(500).json({ error: 'Failed to publish typing indicator' });
  }
}
