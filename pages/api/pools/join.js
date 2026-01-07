import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { pikPools, poolParticipants, profiles, matchups } from "../../../shared/schema";
import { eq, and, or, inArray } from "drizzle-orm";

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

    const [activeMatchup] = await db
      .select()
      .from(matchups)
      .where(
        and(
          or(
            eq(matchups.user1Id, userId),
            eq(matchups.user2Id, userId)
          ),
          inArray(matchups.status, ["waiting", "matched", "active"])
        )
      )
      .limit(1);

    if (activeMatchup) {
      return res.status(409).json({
        error: "You are already in an active 1v1 battle",
        code: "ACTIVE_CHALLENGE_EXISTS",
        challengeType: "1v1",
      });
    }

    const [existingPoolParticipation] = await db
      .select({
        participant: poolParticipants,
        pool: pikPools,
      })
      .from(poolParticipants)
      .innerJoin(pikPools, eq(poolParticipants.poolId, pikPools.id))
      .where(
        and(
          eq(poolParticipants.userId, userId),
          inArray(pikPools.status, ["open", "filling", "active"])
        )
      )
      .limit(1);

    if (existingPoolParticipation) {
      return res.status(409).json({
        error: "You are already in an active pool",
        code: "ACTIVE_CHALLENGE_EXISTS",
        challengeType: "pool",
      });
    }

    const [pool] = await db
      .select()
      .from(pikPools)
      .where(eq(pikPools.id, poolId))
      .limit(1);

    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    if (pool.status !== "open" && pool.status !== "filling") {
      return res.status(400).json({ error: "Pool is not accepting participants" });
    }

    if (pool.currentPlayers >= pool.maxPlayers) {
      return res.status(400).json({ error: "Pool is full" });
    }

    const [existingParticipant] = await db
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
      return res.status(400).json({ error: "Already joined this pool" });
    }

    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    const userBalance = parseFloat(userProfile?.bankroll || 0);
    const buyInAmount = parseFloat(pool.buyIn);

    if (userBalance < buyInAmount) {
      return res.status(402).json({
        error: "Insufficient balance",
        code: "INSUFFICIENT_BALANCE",
        required: buyInAmount,
        available: userBalance,
        needed: buyInAmount - userBalance,
      });
    }

    await db
      .update(profiles)
      .set({
        bankroll: (userBalance - buyInAmount).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));

    await db.insert(poolParticipants).values({
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

    await db
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

    return res.status(200).json({
      success: true,
      message: "Successfully joined pool",
      pool: {
        id: poolId,
        currentPlayers: newPlayerCount,
        prizePool: newPrizePool.toFixed(2),
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Error joining pool:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to join pool", details: error.message });
  }
}
