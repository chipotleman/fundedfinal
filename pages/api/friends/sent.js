import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { friendships, profiles } from '../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

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
    const sentRequests = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.userId, userId),
          eq(friendships.status, 'pending')
        )
      );

    if (sentRequests.length === 0) {
      return res.status(200).json({ requests: [] });
    }

    const receiverIds = sentRequests.map(r => r.friendId);
    const receiverProfiles = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        avatar: profiles.avatar,
        battleWins: profiles.battleWins,
        battleLosses: profiles.battleLosses,
      })
      .from(profiles)
      .where(
        or(...receiverIds.map(id => eq(profiles.id, id)))
      );

    const requests = sentRequests.map(req => ({
      id: req.id,
      receiver: receiverProfiles.find(p => p.id === req.friendId),
      createdAt: req.createdAt,
    }));

    return res.status(200).json({ requests });
  } catch (error) {
    console.error('Error fetching sent friend requests:', error);
    return res.status(500).json({ error: 'Failed to fetch sent friend requests' });
  }
}
