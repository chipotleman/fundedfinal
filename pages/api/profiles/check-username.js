import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters', available: false });
  }

  if (username.length > 20) {
    return res.status(400).json({ error: 'Username must be 20 characters or less', available: false });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores', available: false });
  }

  const session = await getServerSession(req, res, authOptions);
  const currentUserId = session?.user?.id;

  try {
    const conditions = [eq(profiles.username, username.toLowerCase().trim())];
    
    if (currentUserId) {
      conditions.push(ne(profiles.id, currentUserId));
    }

    const existingUser = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(...conditions))
      .limit(1);

    return res.status(200).json({ 
      available: existingUser.length === 0,
      username: username.toLowerCase().trim()
    });
  } catch (error) {
    console.error('Error checking username:', error);
    return res.status(500).json({ error: 'Failed to check username', available: false });
  }
}
