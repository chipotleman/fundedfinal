import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { friendships, profiles, users } from '../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const pendingRequests = await db
        .select()
        .from(friendships)
        .where(
          and(
            eq(friendships.friendId, userId),
            eq(friendships.status, 'pending')
          )
        );

      if (pendingRequests.length === 0) {
        return res.status(200).json({ requests: [] });
      }

      const senderIds = pendingRequests.map(r => r.userId);
      const [senderProfiles, senderUsers] = await Promise.all([
        db
          .select({
            id: profiles.id,
            username: profiles.username,
            avatar: profiles.avatar,
            battleWins: profiles.battleWins,
            battleLosses: profiles.battleLosses,
          })
          .from(profiles)
          .where(inArray(profiles.id, senderIds)),
        db
          .select({ id: users.id, email: users.email, image: users.image })
          .from(users)
          .where(inArray(users.id, senderIds)),
      ]);

      const requests = pendingRequests.map(req => {
        const profile = senderProfiles.find(p => p.id === req.userId);
        const user = senderUsers.find(u => u.id === req.userId);
        const emailHandle = user?.email ? user.email.split('@')[0] : null;
        return {
          id: req.id,
          sender: {
            id: req.userId,
            username: profile?.username || emailHandle || 'Player',
            avatar: profile?.avatar || user?.image || null,
            battleWins: profile?.battleWins ?? 0,
            battleLosses: profile?.battleLosses ?? 0,
          },
          createdAt: req.createdAt,
        };
      });

      return res.status(200).json({ requests });
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      return res.status(500).json({ error: 'Failed to fetch friend requests' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
