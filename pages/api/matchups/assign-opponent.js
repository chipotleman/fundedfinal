import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchups, matchupQueue, matchmakingQueue, fakeOpponents, profiles, users } from '../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
const { publishMatchupStart } = require('../../../lib/battle-events');
const { computeBattleEndsAt } = require('../../../lib/battleEndTime');

const DURATION_CONFIGS = {
  '30_min': { minutes: 30, label: '30 Minutes' },
  '1_hour': { minutes: 60, label: '1 Hour' },
  '3_hours': { minutes: 180, label: '3 Hours' },
  '1_day': { minutes: 1440, label: '1 Day' },
  '3_days': { minutes: 4320, label: '3 Days' },
  '1_week': { minutes: 10080, label: '1 Week' },
};

const GAME_MODES = {
  rush: { durationMinutes: 180, durationType: 'rush', coins: 10000 },
  original: { durationMinutes: 1440, durationType: 'original', coins: 10000 },
  tournament: { durationMinutes: 4320, durationType: 'tournament', coins: 100000 },
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
    let queueEntry = null;
    let queueSource = null;

    const [mqEntry] = await db
      .select()
      .from(matchupQueue)
      .where(and(eq(matchupQueue.userId, userId), eq(matchupQueue.status, 'waiting')));

    if (mqEntry) {
      queueEntry = mqEntry;
      queueSource = 'matchupQueue';
    } else {
      const [mmEntry] = await db
        .select()
        .from(matchmakingQueue)
        .where(and(eq(matchmakingQueue.userId, userId), eq(matchmakingQueue.status, 'waiting')))
        .orderBy(desc(matchmakingQueue.createdAt))
        .limit(1);

      if (mmEntry) {
        queueEntry = mmEntry;
        queueSource = 'matchmakingQueue';
      }
    }

    if (!queueEntry) {
      return res.status(404).json({ error: 'Not in queue' });
    }

    const activeFakeOpponents = await db
      .select({
        fo: fakeOpponents,
        profile: profiles,
        user: users,
      })
      .from(fakeOpponents)
      .innerJoin(profiles, eq(profiles.id, fakeOpponents.id))
      .innerJoin(users, eq(users.id, fakeOpponents.id))
      .where(eq(fakeOpponents.isActive, true));

    const validFakeOpponents = activeFakeOpponents.filter(row => 
      row.fo.userId && 
      row.fo.displayName && 
      row.fo.id === row.fo.userId &&
      row.profile.isFakeAccount === true &&
      row.user.id === row.fo.id
    );

    if (validFakeOpponents.length === 0) {
      return res.status(503).json({ 
        error: 'No opponents available', 
        message: 'Please try again later' 
      });
    }

    const randomRow = validFakeOpponents[Math.floor(Math.random() * validFakeOpponents.length)];
    const randomFake = randomRow.fo;
    const fakeProfileAvatar = randomRow.profile?.avatar || null;

    let startingBalance, durationMinutes, durationType, challengeType;

    if (queueSource === 'matchmakingQueue') {
      const mode = GAME_MODES[queueEntry.gameMode] || GAME_MODES.original;
      startingBalance = mode.coins;
      durationMinutes = mode.durationMinutes;
      durationType = mode.durationType || queueEntry.gameMode;
      challengeType = 'random_battle';
    } else {
      startingBalance = parseFloat(queueEntry.startingBalance) || 5000;
      const durationConfig = DURATION_CONFIGS[queueEntry.durationType] || DURATION_CONFIGS['1_day'];
      durationMinutes = durationConfig.minutes;
      durationType = queueEntry.durationType;
      challengeType = queueEntry.challengeType;
    }

    const potSize = parseFloat(queueEntry.buyIn || startingBalance) * 2;
    const platformFee = potSize * PLATFORM_FEE_PERCENT;
    const winnerPayout = potSize - platformFee;

    const now = new Date();
    const endsAt = computeBattleEndsAt({ durationType, durationMinutes }, now);

    const [newMatchup] = await db.insert(matchups).values({
      challengeType,
      startingBalance: startingBalance.toString(),
      potSize: potSize.toString(),
      platformFee: platformFee.toString(),
      winnerPayout: winnerPayout.toString(),
      user1Id: userId,
      user1Balance: startingBalance.toString(),
      user2Id: randomFake.id,
      user2Balance: startingBalance.toString(),
      isFakeOpponent: true,
      fakeOpponentId: randomFake.id,
      durationMinutes,
      durationType,
      startsAt: now,
      endsAt,
      status: 'active',
    }).returning();

    if (queueSource === 'matchupQueue') {
      await db
        .update(matchupQueue)
        .set({ status: 'matched', matchupId: newMatchup.id, matchedAt: now })
        .where(eq(matchupQueue.id, queueEntry.id));
    } else {
      await db
        .update(matchmakingQueue)
        .set({ status: 'matched', updatedAt: now })
        .where(eq(matchmakingQueue.id, queueEntry.id));
    }

    try {
      publishMatchupStart(newMatchup, { reason: 'opponent_assigned' });
    } catch (_e) {}

    return res.status(200).json({
      status: 'matched',
      matchup: newMatchup,
      opponent: {
        id: randomFake.id,
        username: randomFake.displayName,
        avatar: randomFake.avatar || fakeProfileAvatar,
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
