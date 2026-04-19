import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { userChallenges } from '../../../shared/schema';
import { eq, asc } from 'drizzle-orm';

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
      .select({
        id: userChallenges.id,
        startingBalance: userChallenges.startingBalance,
        pricePaid: userChallenges.pricePaid,
        activatedAt: userChallenges.activatedAt,
        createdAt: userChallenges.createdAt,
      })
      .from(userChallenges)
      .where(eq(userChallenges.userId, session.user.id))
      .orderBy(asc(userChallenges.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return res.status(200).json({ hasDeposited: false, signedIn: true });
    }

    const first = rows[0];
    const startingBalance = parseFloat(first.startingBalance) || 0;
    const pricePaid = parseFloat(first.pricePaid) || 0;
    const matchAmount = Math.max(0, startingBalance - pricePaid);
    const grantedAt = first.activatedAt || first.createdAt;

    return res.status(200).json({
      hasDeposited: true,
      signedIn: true,
      firstChallengeId: first.id,
      startingBalance,
      pricePaid,
      matchAmount,
      grantedAt: grantedAt ? new Date(grantedAt).toISOString() : null,
    });
  } catch (error) {
    console.error('has-deposited error:', error);
    return res.status(500).json({ error: 'Failed to check deposit status' });
  }
}
