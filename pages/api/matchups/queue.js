import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '../../../lib/db';
import { matchups, matchupQueue, fakeOpponents, profiles, userChallenges } from '../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';

const DURATION_CONFIGS = {
  '30_min': { minutes: 30, label: '30 Minutes' },
  '1_hour': { minutes: 60, label: '1 Hour' },
  '3_hours': { minutes: 180, label: '3 Hours' },
  '1_day': { minutes: 1440, label: '1 Day' },
  '3_days': { minutes: 4320, label: '3 Days' },
  '1_week': { minutes: 10080, label: '1 Week' },
};

const CHALLENGE_CONFIGS = {
  starter: { balance: 5000, price: 149 },
  pro: { balance: 10000, price: 249 },
  elite: { balance: 25000, price: 399 },
};

const PLATFORM_FEE_PERCENT = 0.10;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'POST') {
    try {
      const { challengeId, durationType = '1_day' } = req.body;

      if (!challengeId) {
        return res.status(400).json({ error: 'Challenge ID required' });
      }

      const durationConfig = DURATION_CONFIGS[durationType];
      if (!durationConfig) {
        return res.status(400).json({ error: 'Invalid duration type' });
      }

      const [challenge] = await db
        .select()
        .from(userChallenges)
        .where(and(eq(userChallenges.id, challengeId), eq(userChallenges.userId, userId)));

      if (!challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
      }

      const [existingQueue] = await db
        .select()
        .from(matchupQueue)
        .where(and(
          eq(matchupQueue.userId, userId),
          eq(matchupQueue.status, 'waiting')
        ));

      if (existingQueue) {
        return res.status(400).json({ error: 'Already in queue' });
      }

      const [existingMatchup] = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.user1Id, userId),
          eq(matchups.status, 'active')
        ));

      if (existingMatchup) {
        return res.status(400).json({ error: 'Already in an active matchup', matchupId: existingMatchup.id });
      }

      const challengeType = challenge.challengeType;
      const startingBalance = parseFloat(challenge.startingBalance);

      const [potentialMatch] = await db
        .select()
        .from(matchupQueue)
        .where(and(
          eq(matchupQueue.challengeType, challengeType),
          eq(matchupQueue.status, 'waiting'),
          ne(matchupQueue.userId, userId)
        ))
        .limit(1);

      if (potentialMatch) {
        const potSize = startingBalance * 2;
        const platformFee = potSize * PLATFORM_FEE_PERCENT;
        const winnerPayout = potSize - platformFee;
        const now = new Date();
        const endsAt = new Date(now.getTime() + durationConfig.minutes * 60 * 1000);

        const [newMatchup] = await db.insert(matchups).values({
          challengeType,
          startingBalance: startingBalance.toString(),
          potSize: potSize.toString(),
          platformFee: platformFee.toString(),
          winnerPayout: winnerPayout.toString(),
          user1Id: potentialMatch.userId,
          user1ChallengeId: potentialMatch.challengeId,
          user1Balance: startingBalance.toString(),
          user2Id: userId,
          user2ChallengeId: challengeId,
          user2Balance: startingBalance.toString(),
          isFakeOpponent: false,
          durationMinutes: durationConfig.minutes,
          durationType,
          startsAt: now,
          endsAt,
          status: 'active',
        }).returning();

        await db
          .update(matchupQueue)
          .set({ status: 'matched', matchupId: newMatchup.id, matchedAt: now })
          .where(eq(matchupQueue.id, potentialMatch.id));

        const [matchedProfile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, potentialMatch.userId));

        return res.status(200).json({
          status: 'matched',
          matchup: newMatchup,
          opponent: {
            id: potentialMatch.userId,
            username: matchedProfile?.username || 'Opponent',
            isReal: true,
          }
        });
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const [queueEntry] = await db.insert(matchupQueue).values({
        userId,
        challengeId,
        challengeType,
        startingBalance: startingBalance.toString(),
        durationType,
        status: 'waiting',
        expiresAt,
      }).returning();

      return res.status(200).json({
        status: 'queued',
        queueEntry,
        message: 'Looking for opponent...',
      });

    } catch (error) {
      console.error('Queue error:', error);
      return res.status(500).json({ error: 'Failed to queue for matchup' });
    }
  }

  if (req.method === 'GET') {
    try {
      const [queueEntry] = await db
        .select()
        .from(matchupQueue)
        .where(and(eq(matchupQueue.userId, userId), eq(matchupQueue.status, 'waiting')));

      const [activeMatchup] = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.status, 'active'),
          eq(matchups.user1Id, userId)
        ));

      const [activeMatchup2] = await db
        .select()
        .from(matchups)
        .where(and(
          eq(matchups.status, 'active'),
          eq(matchups.user2Id, userId)
        ));

      const matchup = activeMatchup || activeMatchup2;

      if (matchup) {
        let opponent = null;
        const isUser1 = matchup.user1Id === userId;
        const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;

        if (matchup.isFakeOpponent && matchup.fakeOpponentId) {
          const [fake] = await db
            .select()
            .from(fakeOpponents)
            .where(eq(fakeOpponents.id, matchup.fakeOpponentId));
          
          if (fake) {
            opponent = {
              id: fake.id,
              username: fake.displayName,
              avatar: fake.avatar,
              winRate: fake.winRate,
              isReal: false,
            };
          }
        } else if (opponentId) {
          const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, opponentId));

          opponent = {
            id: opponentId,
            username: profile?.username || 'Opponent',
            isReal: true,
          };
        }

        return res.status(200).json({
          status: 'matched',
          matchup,
          opponent,
          isUser1,
        });
      }

      if (queueEntry) {
        return res.status(200).json({
          status: 'queued',
          queueEntry,
        });
      }

      return res.status(200).json({
        status: 'none',
      });

    } catch (error) {
      console.error('Queue status error:', error);
      return res.status(500).json({ error: 'Failed to get queue status' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await db
        .update(matchupQueue)
        .set({ status: 'expired' })
        .where(and(eq(matchupQueue.userId, userId), eq(matchupQueue.status, 'waiting')));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Cancel queue error:', error);
      return res.status(500).json({ error: 'Failed to cancel queue' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
