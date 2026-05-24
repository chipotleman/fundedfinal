import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { friendships, friendMutes } from '../../../../shared/schema';
import { and, eq, or } from 'drizzle-orm';

async function areFriends(userId, otherId) {
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(
      eq(friendships.status, 'accepted'),
      or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, otherId)),
        and(eq(friendships.userId, otherId), eq(friendships.friendId, userId)),
      ),
    ))
    .limit(1);
  return rows.length > 0;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { id: otherId } = req.query;

  if (!otherId || typeof otherId !== 'string' || otherId === userId) {
    return res.status(400).json({ error: 'Invalid friend id' });
  }

  if (req.method === 'GET') {
    try {
      const rows = await db
        .select({ id: friendMutes.id })
        .from(friendMutes)
        .where(and(eq(friendMutes.muterId, userId), eq(friendMutes.mutedId, otherId)))
        .limit(1);
      return res.status(200).json({ muted: rows.length > 0 });
    } catch (err) {
      console.error('[friends mute GET]', err);
      return res.status(500).json({ error: 'Failed to load mute state' });
    }
  }

  if (req.method === 'POST') {
    try {
      if (!(await areFriends(userId, otherId))) {
        return res.status(403).json({ error: 'You can only mute friends' });
      }
      // Idempotent upsert via ON CONFLICT on the unique (muter_id, muted_id) pair.
      await db
        .insert(friendMutes)
        .values({ muterId: userId, mutedId: otherId })
        .onConflictDoNothing();
      return res.status(200).json({ muted: true });
    } catch (err) {
      console.error('[friends mute POST]', err);
      return res.status(500).json({ error: 'Failed to mute friend' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await db
        .delete(friendMutes)
        .where(and(eq(friendMutes.muterId, userId), eq(friendMutes.mutedId, otherId)));
      return res.status(200).json({ muted: false });
    } catch (err) {
      console.error('[friends mute DELETE]', err);
      return res.status(500).json({ error: 'Failed to unmute friend' });
    }
  }

  res.setHeader('Allow', 'GET,POST,DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
