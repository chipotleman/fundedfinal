import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { db } from "../../../lib/db";
import { pikPools, poolParticipants, profiles } from "../../../shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

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

    const userParticipations = await db
      .select({
        participation: poolParticipants,
        pool: pikPools,
      })
      .from(poolParticipants)
      .innerJoin(pikPools, eq(poolParticipants.poolId, pikPools.id))
      .where(eq(poolParticipants.userId, userId))
      .orderBy(desc(pikPools.createdAt));

    const activePool = userParticipations.find(
      (p) => p.pool.status === "active" || p.pool.status === "filling" || p.pool.status === "open"
    );

    if (!activePool) {
      return res.status(200).json({ hasActivePool: false, pool: null });
    }

    const allParticipants = await db
      .select()
      .from(poolParticipants)
      .where(eq(poolParticipants.poolId, activePool.pool.id))
      .orderBy(desc(poolParticipants.balance));

    const participantUserIds = allParticipants.map((p) => p.userId);
    
    let participantProfiles = [];
    if (participantUserIds.length > 0) {
      participantProfiles = await db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
        })
        .from(profiles)
        .where(inArray(profiles.id, participantUserIds));
    }

    const profileMap = {};
    participantProfiles.forEach((p) => {
      profileMap[p.id] = p;
    });

    const leaderboard = allParticipants.map((participant, index) => {
      const profile = profileMap[participant.userId] || {};
      const isCurrentUser = participant.userId === userId;
      
      let timeRemaining = null;
      if (activePool.pool.endsAt) {
        timeRemaining = new Date(activePool.pool.endsAt).getTime() - Date.now();
      }

      return {
        rank: index + 1,
        odId: participant.odId,
        odId: participant.odId,
        odId: participant.odId,
        userId: participant.userId,
        username: profile.username || `Player ${index + 1}`,
        avatar: profile.avatar,
        balance: parseFloat(participant.balance),
        isCurrentUser,
        timeRemaining,
        joinedAt: participant.joinedAt,
      };
    });

    const userRank = leaderboard.findIndex((p) => p.isCurrentUser) + 1;
    const userEntry = leaderboard.find((p) => p.isCurrentUser);

    return res.status(200).json({
      hasActivePool: true,
      pool: {
        id: activePool.pool.id,
        name: activePool.pool.name,
        status: activePool.pool.status,
        buyIn: parseFloat(activePool.pool.buyIn),
        prizePool: parseFloat(activePool.pool.prizePool),
        maxPrizePool: parseFloat(activePool.pool.maxPrizePool || activePool.pool.prizePool),
        startingBalance: parseFloat(activePool.pool.startingBalance),
        currentPlayers: activePool.pool.currentPlayers,
        maxPlayers: activePool.pool.maxPlayers,
        durationMinutes: activePool.pool.durationMinutes,
        startsAt: activePool.pool.startsAt,
        endsAt: activePool.pool.endsAt,
      },
      userRank,
      userBalance: userEntry?.balance || 0,
      leaderboard,
    });
  } catch (error) {
    console.error("Error fetching user pool:", error);
    return res.status(500).json({ error: "Failed to fetch pool data" });
  }
}
