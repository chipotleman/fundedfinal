import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups } from '../../../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Acknowledge (dismiss) a game-result alert for the authenticated user so
// it stops appearing in the bell dropdown's Results section.
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
    const [m] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
    if (!m) {
      return res.status(404).json({ error: 'Matchup not found' });
    }
    const isUser1 = m.user1Id === userId;
    const isUser2 = m.user2Id === userId;
    if (!isUser1 && !isUser2) {
      return res.status(403).json({ error: 'Not a participant' });
    }

    const now = new Date();
    const setObj = isUser1 ? { user1ResultAckAt: now } : { user2ResultAckAt: now };
    const ackCol = isUser1 ? matchups.user1ResultAckAt : matchups.user2ResultAckAt;

    const result = await db
      .update(matchups)
      .set(setObj)
      .where(and(eq(matchups.id, matchupId), isNull(ackCol)))
      .returning({ id: matchups.id });

    return res.status(200).json({ success: true, acknowledged: result.length > 0 });
  } catch (error) {
    console.error('Result ack error:', error);
    return res.status(500).json({ error: 'Failed to acknowledge result' });
  }
}
