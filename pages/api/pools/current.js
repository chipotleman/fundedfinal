import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { pikPools, poolParticipants, poolBets, profiles } from "../../../shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;

    const activeParticipations = await db
      .select({
        participantId: poolParticipants.id,
        poolId: poolParticipants.poolId,
        balance: poolParticipants.balance,
        joinedAt: poolParticipants.joinedAt,
      })
      .from(poolParticipants)
      .where(eq(poolParticipants.userId, userId));

    if (activeParticipations.length === 0) {
      return res.status(200).json({ pool: null, participation: null });
    }

    const poolIds = activeParticipations.map((p) => p.poolId);

    const activePools = await db
      .select()
      .from(pikPools)
      .where(
        and(
          sql`${pikPools.id} = ANY(${poolIds})`,
          or(
            eq(pikPools.status, "open"),
            eq(pikPools.status, "filling"),
            eq(pikPools.status, "active")
          )
        )
      )
      .limit(1);

    if (activePools.length === 0) {
      return res.status(200).json({ pool: null, participation: null });
    }

    const pool = activePools[0];
    const participation = activeParticipations.find(
      (p) => p.poolId === pool.id
    );

    const allParticipants = await db
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
      .orderBy(desc(poolParticipants.balance));

    const myBets = await db
      .select()
      .from(poolBets)
      .where(
        and(eq(poolBets.poolId, pool.id), eq(poolBets.userId, userId))
      )
      .orderBy(desc(poolBets.placedAt));

    const myRank =
      allParticipants.findIndex((p) => p.odId === userId) + 1;

    const totalCollected = parseFloat(pool.buyIn) * pool.currentPlayers;
    const platformFee = totalCollected * (parseFloat(pool.platformFeePercent) / 100);
    const calculatedPrizePool = totalCollected - platformFee;

    return res.status(200).json({
      pool: {
        ...pool,
        calculatedPrizePool: calculatedPrizePool.toFixed(2),
      },
      participation: {
        ...participation,
        rank: myRank,
        totalParticipants: allParticipants.length,
      },
      participants: allParticipants,
      myBets,
    });
  } catch (error) {
    console.error("Error fetching current pool:", error);
    return res.status(500).json({ error: "Failed to fetch current pool" });
  }
}
