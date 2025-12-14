import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/db";
import { withdrawals } from "../../../shared/schema";
import { eq } from "drizzle-orm";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Withdrawal ID is required" });
  }

  if (req.method === "GET") {
    try {
      const [withdrawal] = await db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.id, id));

      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      return res.status(200).json(withdrawal);
    } catch (error) {
      console.error("Error fetching withdrawal:", error);
      return res.status(500).json({ message: "Failed to fetch withdrawal" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
