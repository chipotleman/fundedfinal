import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/db";
import { profiles, userBets, fakeOpponents } from "../../../shared/schema";
import { eq } from "drizzle-orm";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "User ID is required" });
  }

  if (req.method === "GET") {
    try {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, id));

      if (!profile) {
        const [fakeOpp] = await db
          .select()
          .from(fakeOpponents)
          .where(eq(fakeOpponents.id, id));

        if (fakeOpp) {
          return res.status(200).json({
            id: fakeOpp.id,
            username: fakeOpp.displayName,
            avatar: fakeOpp.avatar,
            bio: fakeOpp.bio || '',
            isFakeOpponent: true,
            battleWins: fakeOpp.totalBattles ? Math.floor(fakeOpp.totalBattles * (parseFloat(String(fakeOpp.winRate || '50')) / 100)) : 0,
            battleLosses: fakeOpp.totalBattles ? fakeOpp.totalBattles - Math.floor(fakeOpp.totalBattles * (parseFloat(String(fakeOpp.winRate || '50')) / 100)) : 0,
            winRate: fakeOpp.winRate,
            total_bets: 0,
            wins: 0,
            losses: 0,
          });
        }

        return res.status(404).json({ message: "Profile not found" });
      }

      const bets = await db
        .select()
        .from(userBets)
        .where(eq(userBets.userId, id));

      const totalBets = bets.length;
      const wins = bets.filter(b => b.status === 'won').length;
      const losses = bets.filter(b => b.status === 'lost').length;

      return res.status(200).json({
        ...profile,
        total_bets: totalBets,
        wins,
        losses
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      return res.status(500).json({ message: "Failed to fetch profile" });
    }
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    try {
      const updateData = req.body;

      const [updatedProfile] = await db
        .update(profiles)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, id))
        .returning();

      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      return res.status(200).json(updatedProfile);
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
