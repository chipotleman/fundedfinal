import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import authOptions from "../auth/[...nextauth]";
import { db } from "../../../lib/db";
import { paymentMethods } from "../../../shared/schema";
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
    return res.status(400).json({ message: "Payment method ID is required" });
  }

  if (req.method === "GET") {
    try {
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));

      if (!method) {
        return res.status(404).json({ message: "Payment method not found" });
      }

      return res.status(200).json(method);
    } catch (error) {
      console.error("Error fetching payment method:", error);
      return res.status(500).json({ message: "Failed to fetch payment method" });
    }
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    try {
      const { isDefault, ...updateData } = req.body;

      if (isDefault) {
        await db
          .update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.userId, userId));
      }

      const [updatedMethod] = await db
        .update(paymentMethods)
        .set({
          ...updateData,
          isDefault: isDefault || false,
          updatedAt: new Date(),
        })
        .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
        .returning();

      if (!updatedMethod) {
        return res.status(404).json({ message: "Payment method not found" });
      }

      return res.status(200).json(updatedMethod);
    } catch (error) {
      console.error("Error updating payment method:", error);
      return res.status(500).json({ message: "Failed to update payment method" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const [deletedMethod] = await db
        .delete(paymentMethods)
        .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
        .returning();

      if (!deletedMethod) {
        return res.status(404).json({ message: "Payment method not found" });
      }

      return res.status(200).json({ message: "Payment method deleted" });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      return res.status(500).json({ message: "Failed to delete payment method" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
