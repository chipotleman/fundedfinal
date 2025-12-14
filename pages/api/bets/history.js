import { db } from "../../../lib/db";
import { userBets } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const bets = await db
      .select()
      .from(userBets)
      .where(eq(userBets.userId, session.user.id))
      .orderBy(desc(userBets.placedAt));

    const formattedBets = bets.map(bet => ({
      id: bet.id,
      matchup: bet.matchupName,
      selection: bet.selection,
      betType: bet.marketType,
      odds: bet.odds,
      stake: parseFloat(bet.stake) || 0,
      status: bet.status,
      placedAt: bet.placedAt,
      settledAt: bet.settledAt,
      profit: bet.status === 'won' 
        ? (parseFloat(bet.potentialPayout) - parseFloat(bet.stake)) 
        : bet.status === 'lost' 
          ? -parseFloat(bet.stake) 
          : 0,
      potentialPayout: parseFloat(bet.potentialPayout) || 0
    }));

    return res.status(200).json(formattedBets);
  } catch (error) {
    console.error("Error fetching bet history:", error);
    return res.status(500).json({ message: "Failed to fetch bet history" });
  }
}
