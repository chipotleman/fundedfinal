import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { messages, friendships, battleInvites, profiles } from '../../../shared/schema';
import { eq, and, sql, or } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    const [unreadMessagesResult, friendRequestsResult, battleInvitesResult] = await Promise.all([
      db
        .select({ count: sql`count(*)` })
        .from(messages)
        .where(and(eq(messages.receiverId, userId), eq(messages.read, false))),
      db
        .select({ count: sql`count(*)` })
        .from(friendships)
        .where(and(eq(friendships.friendId, userId), eq(friendships.status, 'pending'))),
      db
        .select({ count: sql`count(*)` })
        .from(battleInvites)
        .where(and(eq(battleInvites.receiverId, userId), eq(battleInvites.status, 'pending'))),
    ]);

    const unreadMessages = parseInt(unreadMessagesResult[0]?.count || 0);
    const pendingFriendRequests = parseInt(friendRequestsResult[0]?.count || 0);
    const pendingBattleInvites = parseInt(battleInvitesResult[0]?.count || 0);

    return res.status(200).json({
      unreadMessages,
      pendingFriendRequests,
      pendingBattleInvites,
      total: unreadMessages + pendingFriendRequests + pendingBattleInvites,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}
