import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'PUT') {
    try {
      const { avatarUrl } = req.body;

      if (!avatarUrl || typeof avatarUrl !== 'string') {
        return res.status(400).json({ error: 'Avatar URL required' });
      }

      await db
        .update(profiles)
        .set({ 
          avatar: avatarUrl.trim(),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, session.user.id));

      return res.status(200).json({ success: true, avatar: avatarUrl.trim() });
    } catch (error) {
      console.error('Error updating avatar:', error);
      return res.status(500).json({ error: 'Failed to update avatar' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
