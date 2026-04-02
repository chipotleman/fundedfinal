import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { battleInvites, profiles, friendships } from '../../../shared/schema';
import { eq, and, or, lt } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const now = new Date();

      await db
        .update(battleInvites)
        .set({ status: 'expired', respondedAt: now })
        .where(
          and(
            eq(battleInvites.status, 'pending'),
            lt(battleInvites.expiresAt, now)
          )
        );

      const receivedInvites = await db
        .select()
        .from(battleInvites)
        .where(
          and(
            eq(battleInvites.receiverId, userId),
            eq(battleInvites.status, 'pending')
          )
        );

      const sentInvites = await db
        .select()
        .from(battleInvites)
        .where(
          and(
            eq(battleInvites.senderId, userId),
            eq(battleInvites.status, 'pending')
          )
        );

      const allUserIds = [
        ...receivedInvites.map(i => i.senderId),
        ...sentInvites.map(i => i.receiverId),
      ].filter((v, i, a) => a.indexOf(v) === i);

      let userProfiles = [];
      if (allUserIds.length > 0) {
        userProfiles = await db
          .select({
            id: profiles.id,
            username: profiles.username,
            avatar: profiles.avatar,
            battleWins: profiles.battleWins,
            battleLosses: profiles.battleLosses,
          })
          .from(profiles)
          .where(
            or(...allUserIds.map(id => eq(profiles.id, id)))
          );
      }

      const enrichedReceived = receivedInvites.map(invite => ({
        ...invite,
        sender: userProfiles.find(p => p.id === invite.senderId),
      }));

      const enrichedSent = sentInvites.map(invite => ({
        ...invite,
        receiver: userProfiles.find(p => p.id === invite.receiverId),
      }));

      return res.status(200).json({
        received: enrichedReceived,
        sent: enrichedSent,
      });
    } catch (error) {
      console.error('Error fetching battle invites:', error);
      return res.status(500).json({ error: 'Failed to fetch battle invites' });
    }
  }

  if (req.method === 'POST') {
    const { receiverId, buyIn, duration } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (receiverId === userId) {
      return res.status(400).json({ error: 'You cannot challenge yourself' });
    }

    const parsedBuyIn = parseFloat(buyIn) || 100;
    const parsedDuration = parseInt(duration) || 24;

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
        return res.status(400).json({ error: 'You can only challenge friends' });
      }

      const existingInvite = await db
        .select()
        .from(battleInvites)
        .where(
          and(
            or(
              and(eq(battleInvites.senderId, userId), eq(battleInvites.receiverId, receiverId)),
              and(eq(battleInvites.senderId, receiverId), eq(battleInvites.receiverId, userId))
            ),
            eq(battleInvites.status, 'pending')
          )
        )
        .limit(1);

      if (existingInvite.length > 0) {
        return res.status(400).json({ error: 'A pending battle invite already exists between you' });
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const [newInvite] = await db
        .insert(battleInvites)
        .values({
          senderId: userId,
          receiverId,
          buyIn: parsedBuyIn.toString(),
          duration: parsedDuration,
          status: 'pending',
          expiresAt,
        })
        .returning();

      return res.status(201).json({ 
        message: 'Battle invite sent',
        invite: newInvite,
      });
    } catch (error) {
      console.error('Error sending battle invite:', error);
      return res.status(500).json({ error: 'Failed to send battle invite' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
