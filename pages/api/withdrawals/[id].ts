import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { withdrawals, profiles } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = session.user.id;
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Withdrawal ID is required" });
  }

  if (req.method === "GET") {
    try {
      const [withdrawal] = await db
        .select()
        .from(withdrawals)
        .where(and(eq(withdrawals.id, id), eq(withdrawals.userId, userId)));

      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      return res.status(200).json(withdrawal);
    } catch (error) {
      console.error("Error fetching withdrawal:", error);
      return res.status(500).json({ message: "Failed to fetch withdrawal" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const [withdrawal] = await db
        .select()
        .from(withdrawals)
        .where(and(eq(withdrawals.id, id), eq(withdrawals.userId, userId)));

      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      if (withdrawal.status !== "under_review") {
        return res.status(400).json({ 
          message: "Only withdrawals under review can be cancelled" 
        });
      }

      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId));

      if (!profile) {
        return res.status(404).json({ message: "User profile not found" });
      }

      const currentBankroll = parseFloat(profile.bankroll?.toString() || '0');
      const refundAmount = parseFloat(withdrawal.amount?.toString() || '0');
      const newBankroll = (currentBankroll + refundAmount).toFixed(2);

      await db
        .update(profiles)
        .set({ bankroll: newBankroll })
        .where(eq(profiles.id, userId));

      const updatedStatusHistory = [
        ...(withdrawal.statusHistory as any[] || []),
        {
          status: "cancelled",
          timestamp: new Date().toISOString(),
          note: "Cancelled by user",
        },
      ];

      const [updatedWithdrawal] = await db
        .update(withdrawals)
        .set({ 
          status: "cancelled",
          statusHistory: updatedStatusHistory,
        })
        .where(eq(withdrawals.id, id))
        .returning();

      return res.status(200).json({ 
        withdrawal: updatedWithdrawal,
        refundedAmount: refundAmount,
        newBankroll 
      });
    } catch (error) {
      console.error("Error cancelling withdrawal:", error);
      return res.status(500).json({ message: "Failed to cancel withdrawal" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
