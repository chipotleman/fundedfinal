import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { db } from "../../../lib/db";
import { pikPools, poolParticipants, profiles } from "../../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;
    const { poolId } = req.body;

    if (!poolId) {
      return res.status(400).json({ error: "Pool ID required" });
    }

    const result = await db.transaction(async (tx) => {
      const [pool] = await tx
        .select()
        .from(pikPools)
        .where(eq(pikPools.id, poolId))
        .limit(1);

      if (!pool) {
        throw new Error("POOL_NOT_FOUND");
      }

      if (pool.status !== "open" && pool.status !== "filling") {
        throw new Error("POOL_NOT_ACCEPTING");
      }

      if (pool.currentPlayers >= pool.maxPlayers) {
        throw new Error("POOL_FULL");
      }

      const [existingParticipant] = await tx
        .select()
        .from(poolParticipants)
        .where(
          and(
            eq(poolParticipants.poolId, poolId),
            eq(poolParticipants.userId, userId)
          )
        )
        .limit(1);

      if (existingParticipant) {
        throw new Error("ALREADY_JOINED");
      }

      const [userProfile] = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const userBalance = parseFloat(userProfile?.bankroll || 0);
      const buyInAmount = parseFloat(pool.buyIn);

      if (userBalance < buyInAmount) {
        const error = new Error("INSUFFICIENT_BALANCE");
        error.data = { required: buyInAmount, available: userBalance, needed: buyInAmount - userBalance };
        throw error;
      }

      await tx
        .update(profiles)
        .set({
          bankroll: (userBalance - buyInAmount).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, userId));

      await tx.insert(poolParticipants).values({
        poolId,
        userId,
        balance: pool.startingBalance,
      });

      const newPlayerCount = pool.currentPlayers + 1;
      const totalCollected = parseFloat(pool.buyIn) * newPlayerCount;
      const platformFee = totalCollected * (parseFloat(pool.platformFeePercent) / 100);
      const newPrizePool = totalCollected - platformFee;

      let newStatus = pool.status;
      let startsAt = pool.startsAt;
      let endsAt = pool.endsAt;

      if (newPlayerCount >= pool.minPlayers && pool.status === "open") {
        newStatus = "filling";
      }

      if (newPlayerCount >= pool.maxPlayers) {
        newStatus = "active";
        startsAt = new Date();
        endsAt = new Date(Date.now() + pool.durationMinutes * 60 * 1000);
      }

      await tx
        .update(pikPools)
        .set({
          currentPlayers: newPlayerCount,
          prizePool: newPrizePool.toFixed(2),
          status: newStatus,
          startsAt,
          endsAt,
          updatedAt: new Date(),
        })
        .where(eq(pikPools.id, poolId));

      return {
        id: poolId,
        currentPlayers: newPlayerCount,
        prizePool: newPrizePool.toFixed(2),
        status: newStatus,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Successfully joined pool",
      pool: result,
    });
  } catch (error) {
    console.error("Error joining pool:", error);
    
    if (error.message === "POOL_NOT_FOUND") {
      return res.status(404).json({ error: "Pool not found" });
    }
    if (error.message === "POOL_NOT_ACCEPTING") {
      return res.status(400).json({ error: "Pool is not accepting participants" });
    }
    if (error.message === "POOL_FULL") {
      return res.status(400).json({ error: "Pool is full" });
    }
    if (error.message === "ALREADY_JOINED") {
      return res.status(400).json({ error: "Already joined this pool" });
    }
    if (error.message === "INSUFFICIENT_BALANCE") {
      return res.status(402).json({
        error: "Insufficient balance",
        code: "INSUFFICIENT_BALANCE",
        ...error.data,
      });
    }
    
    return res.status(500).json({ error: "Failed to join pool" });
  }
}
