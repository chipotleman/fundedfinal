import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { userChallenges } from '../../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [challenge] = await db
      .select()
      .from(userChallenges)
      .where(and(
        eq(userChallenges.userId, session.user.id),
        inArray(userChallenges.status, ['active', 'pending'])
      ))
      .limit(1);

    if (!challenge) {
      return res.status(200).json({ challenge: null });
    }

    return res.status(200).json({ challenge });
  } catch (error) {
    console.error('Get active challenge error:', error);
    return res.status(500).json({ error: 'Failed to get active challenge' });
  }
}
