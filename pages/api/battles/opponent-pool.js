import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';

// Public pool of mock players used to populate the orbiting avatars on the
// "Finding Opponent" search screen. Returns a freshly shuffled slice of the
// fake-account roster (which numbers in the hundreds) so the search field
// reads as a busy crowd and the same face never appears twice in one orbit.
// The current viewer is always excluded so users never see themselves
// circling around their own avatar.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 24), 60);

  try {
    const session = await getServerSession(req, res, authOptions);
    const viewerId = session?.user?.id || null;

    const conditions = [
      eq(profiles.isFakeAccount, true),
      isNotNull(profiles.avatar),
      sql`length(trim(${profiles.avatar})) > 0`,
    ];
    if (viewerId) conditions.push(ne(profiles.id, viewerId));

    const rows = await db
      .select({
        id: profiles.id,
        username: profiles.username,
        avatar: profiles.avatar,
      })
      .from(profiles)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    return res.status(200).json({ players: rows });
  } catch (error) {
    console.error('Error building opponent pool:', error);
    return res.status(200).json({ players: [] });
  }
}
