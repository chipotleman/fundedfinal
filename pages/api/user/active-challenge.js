import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { matchups, poolParticipants, pikPools, profiles } from "../../../shared/schema";
import { eq, or, and, inArray } from "drizzle-orm";

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

    const activeMatchups = await db
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

    if (activeMatchups.length > 0) {
      const matchup = activeMatchups[0];
      const isUser1 = matchup.user1Id === userId;
      const balance = isUser1 ? matchup.user1Balance : matchup.user2Balance;
      
      return res.status(200).json({
        hasActiveChallenge: true,
        challengeType: "1v1",
        challengeId: matchup.id,
        balance: parseFloat(balance),
        startingBalance: parseFloat(matchup.startingBalance),
        status: matchup.status,
        startsAt: matchup.startsAt,
        endsAt: matchup.endsAt,
        tier: matchup.challengeType,
      });
    }

    const userPoolParticipations = await db
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

    if (userPoolParticipations.length > 0) {
      const { participant, pool } = userPoolParticipations[0];
      
      return res.status(200).json({
        hasActiveChallenge: true,
        challengeType: "pool",
        challengeId: pool.id,
        participantId: participant.id,
        balance: parseFloat(participant.balance),
        startingBalance: parseFloat(pool.startingBalance),
        status: pool.status,
        startsAt: pool.startsAt,
        endsAt: pool.endsAt,
        poolName: pool.name,
        prizePool: parseFloat(pool.prizePool),
        currentPlayers: pool.currentPlayers,
        maxPlayers: pool.maxPlayers,
      });
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    return res.status(200).json({
      hasActiveChallenge: false,
      challengeType: null,
      balance: parseFloat(profile?.bankroll || 0),
    });
  } catch (error) {
    console.error("Error getting active challenge:", error.message);
    return res.status(500).json({ error: "Failed to get active challenge" });
  }
}
