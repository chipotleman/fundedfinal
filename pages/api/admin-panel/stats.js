import { db } from '../../../lib/db';
import { users, userBets, userChallenges } from '../../../shared/schema';
import { count, eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [usersCount] = await db.select({ value: count() }).from(users);
    const [betsCount] = await db.select({ value: count() }).from(userBets);
    const [pendingCount] = await db.select({ value: count() }).from(userBets).where(eq(userBets.status, 'pending'));
    const [challengesCount] = await db.select({ value: count() }).from(userChallenges).where(eq(userChallenges.status, 'active'));

    return res.status(200).json({
      totalUsers: usersCount?.value || 0,
      totalBets: betsCount?.value || 0,
      pendingBets: pendingCount?.value || 0,
      activeChallenges: challengesCount?.value || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
