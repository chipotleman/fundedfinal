import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { matchmakingQueue, matchups } from '../../../shared/schema';
import { eq, and, ne } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { buyIn, duration } = req.body;

  const parsedBuyIn = parseFloat(buyIn) || 100;
  const parsedDuration = parseInt(duration) || 24;

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
          eq(matchmakingQueue.duration, parsedDuration),
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
      const durationMinutes = parsedDuration * 60;
      const now = new Date();
      const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      const [newMatchup] = await db
        .insert(matchups)
        .values({
          challengeType: 'random_battle',
          startingBalance: parsedBuyIn.toString(),
          potSize: potSize.toString(),
          platformFee: platformFee.toString(),
          winnerPayout: winnerPayout.toString(),
          user1Id: opponent.userId,
          user2Id: userId,
          user1Balance: parsedBuyIn.toString(),
          user2Balance: parsedBuyIn.toString(),
          durationMinutes,
          durationType: `${parsedDuration}_hours`,
          startsAt: now,
          endsAt,
          status: 'active',
        })
        .returning();

      return res.status(200).json({
        matched: true,
        matchup: newMatchup,
        message: 'Match found! Battle starting now.',
      });
    }

    await db
      .insert(matchmakingQueue)
      .values({
        userId,
        buyIn: parsedBuyIn.toString(),
        duration: parsedDuration,
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
