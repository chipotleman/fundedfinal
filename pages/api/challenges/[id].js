import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { userChallenges } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Challenge ID required' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const [challenge] = await db
        .select()
        .from(userChallenges)
        .where(and(
          eq(userChallenges.id, id),
          eq(userChallenges.userId, session.user.id)
        ));

      if (!challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
      }

      return res.status(200).json(challenge);
    } catch (error) {
      console.error('Get challenge error:', error);
      return res.status(500).json({ error: 'Failed to get challenge' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
