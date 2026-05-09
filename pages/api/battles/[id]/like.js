import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { battleLikes, matchups } from '../../../../shared/schema';
import { and, eq, sql } from 'drizzle-orm';

export default async function handler(req, res) {
  const { id: matchupId } = req.query;
  if (!matchupId || typeof matchupId !== 'string') {
    return res.status(400).json({ error: 'matchupId required' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    const [matchup] = await db
      .select({ id: matchups.id })
      .from(matchups)
      .where(eq(matchups.id, matchupId))
      .limit(1);
    if (!matchup) return res.status(404).json({ error: 'Battle not found' });

    // Race-safe toggle: try DELETE first; if nothing was deleted, INSERT.
    // The uniqueIndex (matchup_id, user_id) protects against concurrent
    // double-likes — we catch 23505 and treat it as already-liked.
    const deleted = await db
      .delete(battleLikes)
      .where(and(eq(battleLikes.matchupId, matchupId), eq(battleLikes.userId, userId)))
      .returning({ id: battleLikes.id });

    let liked;
    if (deleted.length > 0) {
      liked = false;
    } else {
      try {
        await db.insert(battleLikes).values({ matchupId, userId });
        liked = true;
      } catch (err) {
        const code = err?.cause?.code || err?.code;
        if (code === '23505') liked = true;
        else throw err;
      }
    }

    const [{ count }] = await db
      .select({
        count: sql`COUNT(*)::int`.as('count'),
      })
      .from(battleLikes)
      .where(eq(battleLikes.matchupId, matchupId));

    return res.status(200).json({ liked, likeCount: Number(count) || 0 });
  } catch (err) {
    console.error('[battles/like POST] error', err);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
}
