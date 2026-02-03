import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { ilike, ne, and } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const users = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        avatar: profiles.avatar,
        battleWins: profiles.battleWins,
        battleLosses: profiles.battleLosses,
      })
      .from(profiles)
      .where(
        and(
          ilike(profiles.username, `%${q}%`),
          ne(profiles.id, session.user.id)
        )
      )
      .limit(10);

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    return res.status(500).json({ error: 'Failed to search users' });
  }
}
