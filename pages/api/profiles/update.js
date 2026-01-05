import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { username, avatar, bio } = req.body;

  try {
    if (username) {
      const existingUser = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(
          eq(profiles.username, username.toLowerCase().trim()),
          ne(profiles.id, userId)
        ))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (username !== undefined) {
      updateData.username = username.toLowerCase().trim();
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }
    if (bio !== undefined) {
      updateData.bio = bio;
    }

    const [updated] = await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, userId))
      .returning();

    if (!updated) {
      await db.insert(profiles).values({
        id: userId,
        username: username?.toLowerCase().trim() || null,
        avatar: avatar || null,
        bio: bio || null,
      });
      
      const [newProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId));
      
      return res.status(200).json(newProfile);
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}
