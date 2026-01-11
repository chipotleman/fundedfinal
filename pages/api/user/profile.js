import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    try {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1);

      return res.status(200).json({ profile: profile || null });
    } catch (error) {
      console.error('Error fetching profile:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  if (req.method === 'PUT') {
    try {
      let { username, bio, avatar } = req.body;

      if (username && typeof username === 'string') {
        username = username.trim().slice(0, 100);
        if (username.length < 2) {
          return res.status(400).json({ error: 'Username must be at least 2 characters' });
        }
      }

      if (bio && typeof bio === 'string') {
        bio = bio.trim().slice(0, 500);
      }

      if (avatar && typeof avatar === 'string') {
        avatar = avatar.trim().slice(0, 500);
        if (avatar && !avatar.startsWith('/objects/') && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
          return res.status(400).json({ error: 'Invalid avatar URL format' });
        }
      }

      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(profiles)
          .set({
            username: username || existing.username,
            bio: bio !== undefined ? bio : existing.bio,
            avatar: avatar !== undefined ? avatar : existing.avatar,
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, session.user.id))
          .returning();

        return res.status(200).json({ profile: updated });
      } else {
        const [created] = await db
          .insert(profiles)
          .values({
            id: session.user.id,
            username: username || session.user.email?.split('@')[0] || 'User',
            bio: bio || '',
            avatar: avatar || '',
            bankroll: '0',
          })
          .returning();

        return res.status(200).json({ profile: created });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
