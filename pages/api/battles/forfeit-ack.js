import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups } from '../../../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { matchupId } = req.body || {};
  if (!matchupId) {
    return res.status(400).json({ error: 'matchupId required' });
  }

  try {
    const result = await db
      .update(matchups)
      .set({ forfeitAcknowledgedAt: new Date() })
      .where(and(
        eq(matchups.id, matchupId),
        eq(matchups.winnerId, userId),
        isNull(matchups.forfeitAcknowledgedAt),
      ))
      .returning({ id: matchups.id });

    return res.status(200).json({ success: true, acknowledged: result.length > 0 });
  } catch (error) {
    console.error('Forfeit ack error:', error);
    return res.status(500).json({ error: 'Failed to acknowledge forfeit' });
  }
}
