import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchmakingQueue, matchups, profiles } from '../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';
const { publishMatchupStart } = require('../../../lib/battle-events');
const { sendPushToUsers, getAcceptedFriendIds } = require('../../../lib/web-push');

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      await db
        .delete(matchmakingQueue)
        .where(
          and(
            eq(matchmakingQueue.userId, session.user.id),
            eq(matchmakingQueue.status, 'waiting')
          )
        );
      return res.status(200).json({ success: true, cancelled: true });
    } catch (error) {
      console.error('Cancel matchmaking error:', error);
      return res.status(500).json({ error: 'Failed to cancel matchmaking' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { buyIn, gameMode, duration } = req.body;

  const GAME_MODES = {
    rush: { durationMinutes: 180, durationType: 'rush', coins: 10000 },
    original: { durationMinutes: 1440, durationType: 'original', coins: 10000 },
    tournament: { durationMinutes: 4320, durationType: 'tournament', coins: 100000 },
  };

  const parsedBuyIn = parseFloat(buyIn) || 100;
  const validGameMode = GAME_MODES[gameMode] ? gameMode : 'original';
  const mode = GAME_MODES[validGameMode];
  const parsedDuration = Math.round(mode.durationMinutes / 60);

  try {
    await db
      .delete(matchmakingQueue)
      .where(
        and(
          eq(matchmakingQueue.userId, userId),
          eq(matchmakingQueue.status, 'waiting')
        )
      );

    const existingQueue = await db
      .select()
      .from(matchmakingQueue)
      .where(
        and(
          ne(matchmakingQueue.userId, userId),
          eq(matchmakingQueue.buyIn, parsedBuyIn.toString()),
          eq(matchmakingQueue.gameMode, validGameMode),
          eq(matchmakingQueue.status, 'waiting')
        )
      )
      .limit(1);

    if (existingQueue.length > 0) {
      const opponent = existingQueue[0];
      
      await db
        .update(matchmakingQueue)
        .set({ status: 'matched', updatedAt: new Date() })
        .where(eq(matchmakingQueue.id, opponent.id));

      const potSize = parsedBuyIn * 2;
      const platformFee = potSize * 0.1;
      const winnerPayout = potSize - platformFee;
      const durationMinutes = mode.durationMinutes;
      const startingCoins = mode.coins;
      const now = new Date();
      const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      const [newMatchup] = await db
        .insert(matchups)
        .values({
          challengeType: 'random_battle',
          startingBalance: startingCoins.toString(),
          potSize: potSize.toString(),
          platformFee: platformFee.toString(),
          winnerPayout: winnerPayout.toString(),
          user1Id: opponent.userId,
          user2Id: userId,
          user1Balance: startingCoins.toString(),
          user2Balance: startingCoins.toString(),
          durationMinutes,
          durationType: mode.durationType,
          startsAt: now,
          endsAt,
          status: 'active',
        })
        .returning();

      const [opponentProfile] = await db
        .select({ username: profiles.username, avatar: profiles.avatar })
        .from(profiles)
        .where(eq(profiles.id, opponent.userId));

      try {
        publishMatchupStart(newMatchup, { reason: 'queue_matched' });
      } catch (_e) {}

      // Friends going live: notify both players' friends.
      try {
        const [friendsOfA, friendsOfB] = await Promise.all([
          getAcceptedFriendIds(opponent.userId),
          getAcceptedFriendIds(userId),
        ]);
        const exclude = new Set([opponent.userId, userId]);
        const targetsA = friendsOfA.filter(id => !exclude.has(id));
        const targetsB = friendsOfB.filter(id => !exclude.has(id));
        const [profA] = await db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, userId));
        if (targetsA.length > 0) {
          sendPushToUsers(targetsA, {
            category: 'friend_live',
            title: `${opponentProfile?.username || 'Your friend'} just started a battle`,
            body: 'Tap to spectate or jump into your own.',
            url: `/battle?live=${newMatchup.id}`,
            tag: `friend_live:${opponent.userId}:${newMatchup.id}`,
            data: { matchupId: newMatchup.id, type: 'friend_live', friendId: opponent.userId },
          }).catch(() => {});
        }
        if (targetsB.length > 0) {
          sendPushToUsers(targetsB, {
            category: 'friend_live',
            title: `${profA?.username || 'Your friend'} just started a battle`,
            body: 'Tap to spectate or jump into your own.',
            url: `/battle?live=${newMatchup.id}`,
            tag: `friend_live:${userId}:${newMatchup.id}`,
            data: { matchupId: newMatchup.id, type: 'friend_live', friendId: userId },
          }).catch(() => {});
        }
      } catch (e) { console.error('[matchmaking friend_live push]', e.message); }

      return res.status(200).json({
        matched: true,
        matchup: newMatchup,
        opponent: {
          id: opponent.userId,
          username: opponentProfile?.username || 'Opponent',
          avatar: opponentProfile?.avatar || null,
        },
        message: 'Match found! Battle starting now.',
      });
    }

    await db
      .insert(matchmakingQueue)
      .values({
        userId,
        buyIn: parsedBuyIn.toString(),
        duration: parsedDuration,
        gameMode: validGameMode,
        status: 'waiting',
      });

    return res.status(200).json({
      matched: false,
      message: 'Added to matchmaking queue. Waiting for opponent...',
    });
  } catch (error) {
    console.error('Matchmaking error:', error);
    return res.status(500).json({ error: 'Failed to start matchmaking' });
  }
}
