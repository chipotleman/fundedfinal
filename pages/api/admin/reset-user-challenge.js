import { db } from '../../../lib/db';
import { 
  matchups, 
  matchupQueue, 
  pikPools, 
  poolParticipants,
  profiles,
  users
} from '../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

function verifyAdminToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.exp && decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const admin = verifyAdminToken(req);
  if (!admin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          username: profiles.username,
        })
        .from(users)
        .leftJoin(profiles, eq(users.id, profiles.id))
        .limit(100);

      const usersWithChallenges = [];

      for (const user of allUsers) {
        const [activeMatchup] = await db
          .select()
          .from(matchups)
          .where(
            and(
              or(eq(matchups.user1Id, user.id), eq(matchups.user2Id, user.id)),
              inArray(matchups.status, ['waiting', 'matched', 'active'])
            )
          )
          .limit(1);

        const [queueEntry] = await db
          .select()
          .from(matchupQueue)
          .where(
            and(
              eq(matchupQueue.userId, user.id),
              eq(matchupQueue.status, 'waiting')
            )
          )
          .limit(1);

        const [poolParticipation] = await db
          .select({
            participant: poolParticipants,
            pool: pikPools,
          })
          .from(poolParticipants)
          .innerJoin(pikPools, eq(poolParticipants.poolId, pikPools.id))
          .where(
            and(
              eq(poolParticipants.userId, user.id),
              inArray(pikPools.status, ['open', 'filling', 'active'])
            )
          )
          .limit(1);

        if (activeMatchup || queueEntry || poolParticipation) {
          usersWithChallenges.push({
            ...user,
            matchup: activeMatchup || null,
            queueEntry: queueEntry || null,
            pool: poolParticipation?.pool || null,
            poolParticipant: poolParticipation?.participant || null,
          });
        }
      }

      return res.status(200).json({ users: usersWithChallenges });
    } catch (error) {
      console.error('Error fetching users with challenges:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  if (req.method === 'POST') {
    const { userId, action, matchupId, poolId } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ error: 'userId and action are required' });
    }

    try {
      switch (action) {
        case 'cancel_matchup': {
          if (!matchupId) {
            return res.status(400).json({ error: 'matchupId is required' });
          }
          
          await db
            .update(matchups)
            .set({ 
              status: 'cancelled',
              updatedAt: new Date()
            })
            .where(eq(matchups.id, matchupId));

          await db
            .update(matchupQueue)
            .set({ status: 'expired' })
            .where(
              and(
                eq(matchupQueue.userId, userId),
                eq(matchupQueue.matchupId, matchupId)
              )
            );

          return res.status(200).json({ success: true, message: 'Matchup cancelled' });
        }

        case 'leave_queue': {
          await db
            .update(matchupQueue)
            .set({ status: 'expired' })
            .where(
              and(
                eq(matchupQueue.userId, userId),
                eq(matchupQueue.status, 'waiting')
              )
            );

          return res.status(200).json({ success: true, message: 'Removed from queue' });
        }

        case 'leave_pool': {
          if (!poolId) {
            return res.status(400).json({ error: 'poolId is required' });
          }

          await db
            .delete(poolParticipants)
            .where(
              and(
                eq(poolParticipants.userId, userId),
                eq(poolParticipants.poolId, poolId)
              )
            );

          const [pool] = await db
            .select()
            .from(pikPools)
            .where(eq(pikPools.id, poolId))
            .limit(1);

          if (pool && pool.currentPlayers > 0) {
            const newPlayerCount = pool.currentPlayers - 1;
            const buyIn = parseFloat(pool.buyIn) || 0;
            const feePercent = parseFloat(pool.platformFeePercent) || 10;
            const newPrizePool = newPlayerCount * buyIn * (1 - feePercent / 100);

            await db
              .update(pikPools)
              .set({
                currentPlayers: newPlayerCount,
                prizePool: newPrizePool.toFixed(2),
                status: newPlayerCount === 0 ? 'cancelled' : pool.status,
                updatedAt: new Date()
              })
              .where(eq(pikPools.id, poolId));
          }

          return res.status(200).json({ success: true, message: 'Removed from pool' });
        }

        case 'reset_all': {
          await db
            .update(matchups)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(
              and(
                or(eq(matchups.user1Id, userId), eq(matchups.user2Id, userId)),
                inArray(matchups.status, ['waiting', 'matched', 'active'])
              )
            );

          await db
            .update(matchupQueue)
            .set({ status: 'expired' })
            .where(
              and(
                eq(matchupQueue.userId, userId),
                eq(matchupQueue.status, 'waiting')
              )
            );

          const userPools = await db
            .select({ poolId: poolParticipants.poolId })
            .from(poolParticipants)
            .innerJoin(pikPools, eq(poolParticipants.poolId, pikPools.id))
            .where(
              and(
                eq(poolParticipants.userId, userId),
                inArray(pikPools.status, ['open', 'filling', 'active'])
              )
            );

          for (const { poolId: pId } of userPools) {
            await db
              .delete(poolParticipants)
              .where(
                and(
                  eq(poolParticipants.userId, userId),
                  eq(poolParticipants.poolId, pId)
                )
              );

            const [pool] = await db
              .select()
              .from(pikPools)
              .where(eq(pikPools.id, pId))
              .limit(1);

            if (pool && pool.currentPlayers > 0) {
              const newPlayerCount = pool.currentPlayers - 1;
              const buyIn = parseFloat(pool.buyIn) || 0;
              const feePercent = parseFloat(pool.platformFeePercent) || 10;
              const newPrizePool = newPlayerCount * buyIn * (1 - feePercent / 100);

              await db
                .update(pikPools)
                .set({
                  currentPlayers: newPlayerCount,
                  prizePool: newPrizePool.toFixed(2),
                  status: newPlayerCount === 0 ? 'cancelled' : pool.status,
                  updatedAt: new Date()
                })
                .where(eq(pikPools.id, pId));
            }
          }

          return res.status(200).json({ success: true, message: 'All challenges reset' });
        }

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error('Error resetting challenge:', error);
      return res.status(500).json({ error: 'Failed to reset challenge' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
