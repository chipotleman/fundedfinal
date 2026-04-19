import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { userChallenges } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(200).json({ hasDeposited: false, signedIn: false });
    }

    const rows = await db
      .select({ id: userChallenges.id })
      .from(userChallenges)
      .where(eq(userChallenges.userId, session.user.id))
      .limit(1);

    return res.status(200).json({
      hasDeposited: rows.length > 0,
      signedIn: true,
    });
  } catch (error) {
    console.error('has-deposited error:', error);
    return res.status(500).json({ error: 'Failed to check deposit status' });
  }
}
