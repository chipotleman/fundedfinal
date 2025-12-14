import { db } from '../../../../lib/db';
import { userChallenges, profiles } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function decodeToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

const CHALLENGE_CONFIGS = {
  starter: {
    type: 'starter',
    name: 'Starter Challenge',
    balance: 5000,
    userSplit: 90,
    profitTarget: 1000,
    maxDrawdown: 750,
    maxDailyLoss: 500,
  },
  pro: {
    type: 'pro',
    name: 'Pro Challenge',
    balance: 10000,
    userSplit: 90,
    profitTarget: 2000,
    maxDrawdown: 1500,
    maxDailyLoss: 1000,
  },
  elite: {
    type: 'elite',
    name: 'Elite Challenge',
    balance: 25000,
    userSplit: 90,
    profitTarget: 5000,
    maxDrawdown: 3750,
    maxDailyLoss: 2500,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const decoded = decodeToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const adminCheck = await sql`SELECT id FROM admin_users WHERE id = ${decoded.id}`;
    if (adminCheck.length === 0) {
      const staffCheck = await sql`SELECT id FROM admin_staff WHERE id = ${decoded.id} AND is_active = true`;
      if (staffCheck.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId, challengeType, userSplit: customUserSplit } = req.body;

  if (!userId || !challengeType) {
    return res.status(400).json({ error: 'User ID and challenge type are required' });
  }

  const config = CHALLENGE_CONFIGS[challengeType.toLowerCase()];
  if (!config) {
    return res.status(400).json({ error: 'Invalid challenge type. Must be starter, pro, or elite' });
  }

  const userSplit = customUserSplit && [80, 85, 90].includes(customUserSplit) ? customUserSplit : config.userSplit;

  try {
    const [newChallenge] = await db
      .insert(userChallenges)
      .values({
        userId,
        challengeType: config.type,
        challengeName: config.name,
        startingBalance: config.balance.toString(),
        currentBalance: config.balance.toString(),
        userSplit: userSplit,
        pricePaid: '0',
        phase: 1,
        status: 'active',
        profitTarget: config.profitTarget.toString(),
        maxDailyLoss: config.maxDailyLoss.toString(),
      })
      .returning();

    await db
      .update(profiles)
      .set({
        bankroll: config.balance.toString(),
        status: 'active',
        challenge: {
          type: config.type,
          name: config.name,
          startingBalance: config.balance,
          userSplit: userSplit,
        },
        challengeStartDate: new Date(),
        challengePhase: 1,
        maxDailyLoss: config.maxDailyLoss.toString(),
        profitTarget: config.profitTarget.toString(),
        pnl: '0',
        dailyLoss: '0',
      })
      .where(eq(profiles.id, userId));

    return res.status(200).json({ 
      success: true, 
      message: `${config.name} granted successfully`,
      challenge: newChallenge
    });
  } catch (error) {
    console.error('Failed to grant challenge:', error);
    return res.status(500).json({ error: 'Failed to grant challenge' });
  }
}
