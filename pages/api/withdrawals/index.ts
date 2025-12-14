import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/db";
import { withdrawals, profiles } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";

const FEES: Record<string, number | ((amount: number) => number)> = {
  bank_transfer: 0,
  instant_transfer: (amount: number) => amount * 0.015,
  venmo: 0,
  wire: 25,
  check: 0,
};

function calculateFee(methodType: string, amount: number): number {
  const feeCalc = FEES[methodType];
  if (typeof feeCalc === "function") {
    return feeCalc(amount);
  }
  return feeCalc || 0;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ message: "User ID is required" });
    }

    try {
      const userWithdrawals = await db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.userId, userId))
        .orderBy(desc(withdrawals.createdAt));

      return res.status(200).json(userWithdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      return res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        userId,
        paymentMethodId,
        methodType,
        amount,
        paymentDetails,
      } = req.body;

      if (!userId || !methodType || !amount) {
        return res.status(400).json({ message: "User ID, method type, and amount are required" });
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId));

      if (!profile) {
        return res.status(404).json({ message: "User profile not found" });
      }

      const fee = calculateFee(methodType, amountNum);
      const netAmount = amountNum - fee;

      if (netAmount <= 0) {
        return res.status(400).json({ message: "Amount too low after fees" });
      }

      const [newWithdrawal] = await db
        .insert(withdrawals)
        .values({
          userId,
          paymentMethodId,
          methodType,
          amount: amountNum.toFixed(2),
          fee: fee.toFixed(2),
          netAmount: netAmount.toFixed(2),
          status: "under_review",
          statusHistory: [
            {
              status: "under_review",
              timestamp: new Date().toISOString(),
              note: "Withdrawal request submitted",
            },
          ],
          paymentDetails,
        })
        .returning();

      return res.status(201).json(newWithdrawal);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      return res.status(500).json({ message: "Failed to create withdrawal" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
