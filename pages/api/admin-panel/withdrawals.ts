import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/db";
import { withdrawals, profiles, users } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";

function decodeToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = decodeToken(req.headers.authorization);
  if (!admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const allWithdrawals = await db
        .select({
          id: withdrawals.id,
          userId: withdrawals.userId,
          methodType: withdrawals.methodType,
          amount: withdrawals.amount,
          fee: withdrawals.fee,
          netAmount: withdrawals.netAmount,
          status: withdrawals.status,
          paymentDetails: withdrawals.paymentDetails,
          adminNotes: withdrawals.adminNotes,
          denialReason: withdrawals.denialReason,
          createdAt: withdrawals.createdAt,
          reviewedAt: withdrawals.reviewedAt,
          processedAt: withdrawals.processedAt,
          finalizedAt: withdrawals.finalizedAt,
        })
        .from(withdrawals)
        .orderBy(desc(withdrawals.createdAt));

      const withdrawalsWithUsers = await Promise.all(
        allWithdrawals.map(async (w) => {
          const [user] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, w.userId));
          return {
            ...w,
            userEmail: user?.email || "Unknown",
          };
        })
      );

      return res.status(200).json(withdrawalsWithUsers);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      return res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { id, action, adminNotes, denialReason } = req.body;

      if (!id || !action) {
        return res.status(400).json({ message: "Withdrawal ID and action are required" });
      }

      const [withdrawal] = await db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.id, id));

      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      const statusHistory = (withdrawal.statusHistory as any[]) || [];
      let newStatus = withdrawal.status;
      let updateData: any = {
        updatedAt: new Date(),
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      };

      if (action === "approve") {
        if (withdrawal.status === "under_review") {
          newStatus = "awaiting_processing";
        } else if (withdrawal.status === "awaiting_processing") {
          newStatus = "finalized";
          updateData.finalizedAt = new Date();
        }
      } else if (action === "process") {
        if (withdrawal.status === "awaiting_processing") {
          newStatus = "finalized";
          updateData.processedAt = new Date();
          updateData.finalizedAt = new Date();
        }
      } else if (action === "deny") {
        newStatus = "denied";
        updateData.denialReason = denialReason || "Request denied by admin";
      }

      if (adminNotes) {
        updateData.adminNotes = adminNotes;
      }

      statusHistory.push({
        status: newStatus,
        timestamp: new Date().toISOString(),
        by: admin.email,
        note: action === "deny" ? denialReason : `Status changed to ${newStatus}`,
      });

      updateData.status = newStatus;
      updateData.statusHistory = statusHistory;

      const [updatedWithdrawal] = await db
        .update(withdrawals)
        .set(updateData)
        .where(eq(withdrawals.id, id))
        .returning();

      return res.status(200).json(updatedWithdrawal);
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      return res.status(500).json({ message: "Failed to update withdrawal" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
