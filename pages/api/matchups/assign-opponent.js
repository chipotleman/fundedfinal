import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '../../../lib/db';
import { matchups, matchupQueue, fakeOpponents, userChallenges } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

const DURATION_CONFIGS = {
  '30_min': { minutes: 30, label: '30 Minutes' },
  '1_hour': { minutes: 60, label: '1 Hour' },
  '3_hours': { minutes: 180, label: '3 Hours' },
  '1_day': { minutes: 1440, label: '1 Day' },
  '3_days': { minutes: 4320, label: '3 Days' },
  '1_week': { minutes: 10080, label: '1 Week' },
};

const PLATFORM_FEE_PERCENT = 0.10;

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
    const [queueEntry] = await db
      .select()
      .from(matchupQueue)
      .where(and(eq(matchupQueue.userId, userId), eq(matchupQueue.status, 'waiting')));

    if (!queueEntry) {
      return res.status(404).json({ error: 'Not in queue' });
    }

    const [challenge] = await db
      .select()
      .from(userChallenges)
      .where(eq(userChallenges.id, queueEntry.challengeId));

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const activeFakeOpponents = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.isActive, true));

    if (activeFakeOpponents.length === 0) {
      return res.status(503).json({ 
        error: 'No opponents available', 
        message: 'Please try again later' 
      });
    }

    const randomFake = activeFakeOpponents[Math.floor(Math.random() * activeFakeOpponents.length)];
    const startingBalance = parseFloat(challenge.startingBalance);
    const potSize = startingBalance * 2;
    const platformFee = potSize * PLATFORM_FEE_PERCENT;
    const winnerPayout = potSize - platformFee;

    const durationConfig = DURATION_CONFIGS[queueEntry.durationType] || DURATION_CONFIGS['1_day'];
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationConfig.minutes * 60 * 1000);

    const [newMatchup] = await db.insert(matchups).values({
      challengeType: queueEntry.challengeType,
      startingBalance: startingBalance.toString(),
      potSize: potSize.toString(),
      platformFee: platformFee.toString(),
      winnerPayout: winnerPayout.toString(),
      user1Id: userId,
      user1ChallengeId: queueEntry.challengeId,
      user1Balance: startingBalance.toString(),
      user2Id: randomFake.id,
      user2ChallengeId: null,
      user2Balance: startingBalance.toString(),
      isFakeOpponent: true,
      fakeOpponentId: randomFake.id,
      durationMinutes: durationConfig.minutes,
      durationType: queueEntry.durationType,
      startsAt: now,
      endsAt,
      status: 'active',
    }).returning();

    await db
      .update(matchupQueue)
      .set({ status: 'matched', matchupId: newMatchup.id, matchedAt: now })
      .where(eq(matchupQueue.id, queueEntry.id));

    return res.status(200).json({
      status: 'matched',
      matchup: newMatchup,
      opponent: {
        id: randomFake.id,
        username: randomFake.displayName,
        avatar: randomFake.avatar,
        winRate: randomFake.winRate,
        totalBattles: randomFake.totalBattles,
        isReal: false,
      }
    });

  } catch (error) {
    console.error('Assign opponent error:', error);
    return res.status(500).json({ error: 'Failed to assign opponent' });
  }
}
