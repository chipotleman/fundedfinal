import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { withdrawals, profiles, paymentMethods } from "../../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const FEES: Record<string, number | ((amount: number) => number)> = {
  bank_transfer: 0,
  instant_transfer: (amount: number) => amount * 0.015,
  venmo: 0,
  wire: 25,
  check: 0,
};

const MIN_AMOUNTS: Record<string, number> = {
  bank_transfer: 100,
  instant_transfer: 50,
  venmo: 25,
  wire: 500,
  check: 100,
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
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = session.user.id;

  if (req.method === "GET") {
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
        paymentMethodId,
        methodType,
        amount,
        paymentDetails,
      } = req.body;

      if (!methodType || !amount) {
        return res.status(400).json({ message: "Method type and amount are required" });
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const minAmount = MIN_AMOUNTS[methodType] || 25;
      if (amountNum < minAmount) {
        return res.status(400).json({ message: `Minimum withdrawal amount for this method is $${minAmount}` });
      }

      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId));

      if (!profile) {
        return res.status(404).json({ message: "User profile not found" });
      }

      const challengeData = profile.challenge as any;
      const startingBalance = challengeData?.startingBalance || 10000;
      const currentBalance = parseFloat(profile.bankroll?.toString() || '0');
      const profit = Math.max(0, currentBalance - startingBalance);
      const userSplit = challengeData?.userSplit || 80;
      const availableToWithdraw = Math.floor(profit * (userSplit / 100));

      // Pre-flight check (gives a precise error message). The real enforcement
      // happens atomically below — we still need this for nicer UX.
      if (amountNum > availableToWithdraw) {
        return res.status(400).json({ message: `Insufficient funds. Available to withdraw: $${availableToWithdraw}` });
      }

      if (paymentMethodId) {
        const [method] = await db
          .select()
          .from(paymentMethods)
          .where(and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.userId, userId)));

        if (!method) {
          return res.status(400).json({ message: "Invalid payment method" });
        }
      }

      const fee = calculateFee(methodType, amountNum);
      const netAmount = amountNum - fee;

      if (netAmount <= 0) {
        return res.status(400).json({ message: "Amount too low after fees" });
      }

      // Atomically deduct from bankroll AND enforce the profit-split cap in
      // the same statement. The cap rule is:
      //   amount <= floor((bankroll - startingBalance) * userSplit / 100)
      // To dodge floating-point and floor() ambiguity we encode it as integer
      // math:
      //   amount * 100 <= (bankroll - startingBalance) * userSplit
      // This closes the TOCTOU window where two concurrent requests could
      // each pass the JS pre-check on a stale balance and together exceed
      // the user's allowed withdrawable profit.
      const amountStr = amountNum.toFixed(2);
      const startingBalanceStr = String(startingBalance);
      const splitStr = String(userSplit);
      const debitRows = await db
        .update(profiles)
        .set({ bankroll: sql`${profiles.bankroll} - ${amountStr}` })
        .where(
          and(
            eq(profiles.id, userId),
            sql`${profiles.bankroll} >= ${amountStr}`,
            sql`(${amountStr}::numeric * 100) <= ((${profiles.bankroll} - ${startingBalanceStr}::numeric) * ${splitStr}::numeric)`
          )
        )
        .returning({ bankroll: profiles.bankroll });

      if (debitRows.length === 0) {
        return res.status(409).json({
          message:
            "Insufficient funds (or another withdrawal is in flight). Please refresh and try again.",
        });
      }

      const newBankroll = debitRows[0].bankroll;

      let newWithdrawal;
      try {
        const inserted = await db
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
        newWithdrawal = inserted[0];
      } catch (insertErr) {
        // Compensating refund: balance was deducted but withdrawal row failed.
        await db
          .update(profiles)
          .set({ bankroll: sql`${profiles.bankroll} + ${amountNum.toFixed(2)}` })
          .where(eq(profiles.id, userId));
        throw insertErr;
      }

      return res.status(201).json({
        withdrawal: newWithdrawal,
        newBankroll,
      });
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      return res.status(500).json({ message: "Failed to create withdrawal" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
