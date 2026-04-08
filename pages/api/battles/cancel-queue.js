import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchupQueue, matchmakingQueue } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    await db
      .update(matchupQueue)
      .set({ status: 'expired' })
      .where(and(
        eq(matchupQueue.userId, userId),
        eq(matchupQueue.status, 'waiting')
      ));

    await db
      .delete(matchmakingQueue)
      .where(and(
        eq(matchmakingQueue.userId, userId),
        eq(matchmakingQueue.status, 'waiting')
      ));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Cancel queue error:', error);
    return res.status(500).json({ error: 'Failed to cancel queue' });
  }
}
