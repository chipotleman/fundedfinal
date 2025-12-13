import { db } from '../../../lib/db';
import { users, userChallenges, userBets } from '../../../shared/schema';
import { eq, sql, gte, and } from 'drizzle-orm';
import { requireAdmin } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  if (!await requireAdmin(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const totalUsersResult = await db
      .select({ count: sql`count(*)` })
      .from(users);
    const totalUsers = parseInt(totalUsersResult[0].count);

    const totalChallengesResult = await db
      .select({ count: sql`count(*)` })
      .from(userChallenges);
    const totalChallenges = parseInt(totalChallengesResult[0].count);

    const activeChallengesResult = await db
      .select({ count: sql`count(*)` })
      .from(userChallenges)
      .where(eq(userChallenges.status, 'active'));
    const activeChallenges = parseInt(activeChallengesResult[0].count);

    const challengesByTierResult = await db
      .select({
        challengeType: userChallenges.challengeType,
        count: sql`count(*)`,
        active: sql`count(*) filter (where ${userChallenges.status} = 'active')`,
      })
      .from(userChallenges)
      .groupBy(userChallenges.challengeType);

    const revenueResult = await db
      .select({
        total: sql`coalesce(sum(${userChallenges.pricePaid}::numeric), 0)`,
      })
      .from(userChallenges);
    const totalRevenue = parseFloat(revenueResult[0].total) || 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsersResult = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo));
    const newUsersLast30Days = parseInt(newUsersResult[0].count);

    const newChallengesResult = await db
      .select({ count: sql`count(*)` })
      .from(userChallenges)
      .where(gte(userChallenges.createdAt, thirtyDaysAgo));
    const newChallengesLast30Days = parseInt(newChallengesResult[0].count);

    const recentRevenueResult = await db
      .select({
        total: sql`coalesce(sum(${userChallenges.pricePaid}::numeric), 0)`,
      })
      .from(userChallenges)
      .where(gte(userChallenges.createdAt, thirtyDaysAgo));
    const revenueLast30Days = parseFloat(recentRevenueResult[0].total) || 0;

    const challengesByStatus = await db
      .select({
        status: userChallenges.status,
        count: sql`count(*)`,
      })
      .from(userChallenges)
      .groupBy(userChallenges.status);

    return res.status(200).json({
      overview: {
        totalUsers,
        totalChallenges,
        activeChallenges,
        totalRevenue,
      },
      last30Days: {
        newUsers: newUsersLast30Days,
        newChallenges: newChallengesLast30Days,
        revenue: revenueLast30Days,
      },
      challengesByTier: challengesByTierResult.map(t => ({
        tier: t.challengeType,
        total: parseInt(t.count),
        active: parseInt(t.active),
      })),
      challengesByStatus: challengesByStatus.map(s => ({
        status: s.status,
        count: parseInt(s.count),
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
