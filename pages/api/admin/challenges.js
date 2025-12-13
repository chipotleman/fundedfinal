import { db } from '../../../lib/db';
import { userChallenges, users } from '../../../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAdmin } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  if (!await requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = db
        .select({
          challenge: userChallenges,
          userEmail: users.email,
        })
        .from(userChallenges)
        .leftJoin(users, eq(userChallenges.userId, users.id));

      if (status) {
        query = query.where(eq(userChallenges.status, status));
      }

      const challenges = await query
        .orderBy(desc(userChallenges.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(userChallenges);
      const totalCount = parseInt(countResult[0].count);

      return res.status(200).json({
        challenges: challenges.map(c => ({
          ...c.challenge,
          userEmail: c.userEmail
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching challenges:', error);
      return res.status(500).json({ error: 'Failed to fetch challenges' });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        userId,
        challengeType,
        challengeName,
        startingBalance,
        userSplit = 90,
        isGift = true
      } = req.body;

      if (!userId || !challengeType || !challengeName || !startingBalance) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const profitTarget = parseFloat(startingBalance) * 0.2;
      const maxDailyLoss = parseFloat(startingBalance) * 0.1;

      const result = await db.insert(userChallenges).values({
        userId,
        challengeType,
        challengeName,
        startingBalance: startingBalance.toString(),
        currentBalance: startingBalance.toString(),
        userSplit: parseInt(userSplit),
        pricePaid: '0',
        status: 'active',
        phase: 1,
        pnl: '0',
        totalBets: 0,
        winRate: '0',
        dailyLoss: '0',
        maxDailyLoss: maxDailyLoss.toString(),
        profitTarget: profitTarget.toString(),
        transactionId: `GIFT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        activatedAt: new Date(),
      }).returning();

      return res.status(201).json({ success: true, challenge: result[0] });
    } catch (error) {
      console.error('Error creating challenge:', error);
      return res.status(500).json({ error: 'Failed to create challenge' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
