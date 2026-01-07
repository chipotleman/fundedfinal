import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { db } from "../../../lib/db";
import { pikPools, poolParticipants, profiles } from "../../../shared/schema";
import { eq, and, or, sql, desc, ne } from "drizzle-orm";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;

    const pools = await db
      .select({
        id: pikPools.id,
        name: pikPools.name,
        buyIn: pikPools.buyIn,
        startingBalance: pikPools.startingBalance,
        minPlayers: pikPools.minPlayers,
        maxPlayers: pikPools.maxPlayers,
        currentPlayers: pikPools.currentPlayers,
        prizePool: pikPools.prizePool,
        platformFeePercent: pikPools.platformFeePercent,
        durationType: pikPools.durationType,
        durationMinutes: pikPools.durationMinutes,
        status: pikPools.status,
        startsAt: pikPools.startsAt,
        endsAt: pikPools.endsAt,
        createdAt: pikPools.createdAt,
      })
      .from(pikPools)
      .where(or(eq(pikPools.status, "open"), eq(pikPools.status, "filling")))
      .orderBy(desc(pikPools.createdAt))
      .limit(10);

    const poolsWithParticipants = await Promise.all(
      pools.map(async (pool) => {
        const participants = await db
          .select({
            odId: poolParticipants.userId,
            balance: poolParticipants.balance,
            joinedAt: poolParticipants.joinedAt,
            username: profiles.username,
            avatar: profiles.avatar,
          })
          .from(poolParticipants)
          .leftJoin(profiles, eq(poolParticipants.userId, profiles.id))
          .where(eq(poolParticipants.poolId, pool.id))
          .orderBy(poolParticipants.joinedAt)
          .limit(25);

        const isJoined = userId
          ? participants.some((p) => p.odId === userId)
          : false;

        const totalCollected = parseFloat(pool.buyIn) * pool.currentPlayers;
        const platformFee = totalCollected * (parseFloat(pool.platformFeePercent) / 100);
        const calculatedPrizePool = totalCollected - platformFee;
        
        // Calculate max prize when pool is full
        const maxTotalCollected = parseFloat(pool.buyIn) * pool.maxPlayers;
        const maxPlatformFee = maxTotalCollected * (parseFloat(pool.platformFeePercent) / 100);
        const maxPrizePool = maxTotalCollected - maxPlatformFee;

        return {
          ...pool,
          participants,
          isJoined,
          calculatedPrizePool: calculatedPrizePool.toFixed(2),
          maxPrizePool: maxPrizePool.toFixed(2),
          spotsRemaining: pool.maxPlayers - pool.currentPlayers,
        };
      })
    );

    return res.status(200).json({ pools: poolsWithParticipants });
  } catch (error) {
    console.error("Error fetching available pools:", error);
    return res.status(500).json({ error: "Failed to fetch pools" });
  }
}
