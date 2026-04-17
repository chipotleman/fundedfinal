import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { friendships, profiles, users } from '../../../shared/schema';
import { eq, or, and, inArray } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const friendshipRecords = await db
        .select()
        .from(friendships)
        .where(
          and(
            or(
              eq(friendships.userId, userId),
              eq(friendships.friendId, userId)
            ),
            eq(friendships.status, 'accepted')
          )
        );

      const friendIds = friendshipRecords.map(f => 
        f.userId === userId ? f.friendId : f.userId
      );

      if (friendIds.length === 0) {
        return res.status(200).json({ friends: [] });
      }

      const [friendProfiles, friendUsers] = await Promise.all([
        db
          .select({
            id: profiles.id,
            username: profiles.username,
            avatar: profiles.avatar,
            battleWins: profiles.battleWins,
            battleLosses: profiles.battleLosses,
            status: profiles.status,
          })
          .from(profiles)
          .where(inArray(profiles.id, friendIds)),
        db
          .select({ id: users.id, email: users.email, image: users.image })
          .from(users)
          .where(inArray(users.id, friendIds)),
      ]);

      const friends = friendIds.map(fid => {
        const profile = friendProfiles.find(p => p.id === fid);
        const user = friendUsers.find(u => u.id === fid);
        const emailHandle = user?.email ? user.email.split('@')[0] : null;
        return {
          id: fid,
          username: profile?.username || emailHandle || 'Player',
          avatar: profile?.avatar || user?.image || null,
          battleWins: profile?.battleWins ?? 0,
          battleLosses: profile?.battleLosses ?? 0,
          status: profile?.status || 'inactive',
        };
      });

      return res.status(200).json({ friends });
    } catch (error) {
      console.error('Error fetching friends:', error);
      return res.status(500).json({ error: 'Failed to fetch friends' });
    }
  }

  if (req.method === 'POST') {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'Friend ID is required' });
    }

    if (friendId === userId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    try {
      const existingFriendship = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
            and(eq(friendships.userId, friendId), eq(friendships.friendId, userId))
          )
        )
        .limit(1);

      if (existingFriendship.length > 0) {
        const existing = existingFriendship[0];
        if (existing.status === 'accepted') {
          return res.status(400).json({ error: 'Already friends' });
        }
        if (existing.status === 'pending') {
          if (existing.friendId === userId) {
            await db
              .update(friendships)
              .set({ status: 'accepted', updatedAt: new Date() })
              .where(eq(friendships.id, existing.id));
            try {
              publishBattleEvent([userId, existing.userId], { type: 'notification:refresh' });
            } catch (_e) {}
            return res.status(200).json({ message: 'Friend request accepted', status: 'accepted' });
          }
          return res.status(400).json({ error: 'Friend request already pending' });
        }
      }

      await db.insert(friendships).values({
        userId,
        friendId,
        status: 'pending',
      });

      try {
        publishBattleEvent(friendId, { type: 'notification:friend_request' });
      } catch (_e) {}

      return res.status(201).json({ message: 'Friend request sent', status: 'pending' });
    } catch (error) {
      console.error('Error adding friend:', error);
      return res.status(500).json({ error: 'Failed to send friend request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
