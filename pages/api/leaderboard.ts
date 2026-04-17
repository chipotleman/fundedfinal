import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../lib/db";
import { profiles, userBets } from "../../shared/schema";
import { and, gte, inArray, sql } from "drizzle-orm";

const TIMEFRAME_DAYS: Record<string, number | null> = {
  weekly: 7,
  monthly: 30,
  alltime: null,
};

function tierFor(winRate: number): "Elite" | "Pro" | "Starter" {
  if (winRate >= 60) return "Elite";
  if (winRate >= 50) return "Pro";
  return "Starter";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const timeframeParam =
    typeof req.query.timeframe === "string" ? req.query.timeframe : "alltime";
  const timeframe = TIMEFRAME_DAYS.hasOwnProperty(timeframeParam)
    ? timeframeParam
    : "alltime";
  const categoryParam =
    typeof req.query.category === "string"
      ? req.query.category.toLowerCase()
      : "all";
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1),
    100
  );

  try {
    const days = TIMEFRAME_DAYS[timeframe];
    const since = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      : null;

    const conditions = [sql`${userBets.status} IN ('won', 'lost')`];
    if (since) conditions.push(gte(userBets.placedAt, since));

    const stats = await db
      .select({
        userId: userBets.userId,
        totalBets: sql<number>`COUNT(*)::int`,
        wins: sql<number>`COUNT(*) FILTER (WHERE ${userBets.status} = 'won')::int`,
        profit: sql<number>`COALESCE(SUM(${userBets.pnl}), 0)::float`,
        totalStake: sql<number>`COALESCE(SUM(${userBets.stake}), 0)::float`,
      })
      .from(userBets)
      .where(and(...conditions))
      .groupBy(userBets.userId);

    if (stats.length === 0) {
      return res.status(200).json({ leaders: [] });
    }

    const userIds = stats.map((s) => s.userId);
    const allProfiles = await db
      .select()
      .from(profiles)
      .where(inArray(profiles.id, userIds));

    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

    let leaders = stats
      .map((s) => {
        const p = profileMap.get(s.userId);
        if (!p) return null;
        if (p.isFakeAccount) return null;
        const totalBets = Number(s.totalBets) || 0;
        const wins = Number(s.wins) || 0;
        const profit = Number(s.profit) || 0;
        const totalStake = Number(s.totalStake) || 0;
        const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;
        const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;
        return {
          id: p.id,
          username: p.username || "Anonymous",
          avatar: p.avatar || null,
          profit: Math.round(profit),
          roi: Math.round(roi * 10) / 10,
          wins,
          losses: totalBets - wins,
          totalBets,
          winRate: Math.round(winRate * 10) / 10,
          tier: tierFor(winRate),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (categoryParam !== "all") {
      leaders = leaders.filter((l) => l.tier.toLowerCase() === categoryParam);
    }

    leaders.sort((a, b) => b.profit - a.profit);
    const ranked = leaders
      .slice(0, limit)
      .map((l, i) => ({ ...l, rank: i + 1 }));

    return res.status(200).json({ leaders: ranked });
  } catch (err) {
    console.error("Leaderboard error", err);
    return res.status(500).json({ message: "Failed to load leaderboard" });
  }
}
