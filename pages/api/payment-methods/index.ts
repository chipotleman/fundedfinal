import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/db";
import { paymentMethods } from "../../../shared/schema";
import { eq } from "drizzle-orm";

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
      const methods = await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.userId, userId));

      return res.status(200).json(methods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      return res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        userId,
        methodType,
        nickname,
        isDefault,
        bankName,
        accountNumber,
        routingNumber,
        accountType,
        cardLast4,
        cardBrand,
        cardExpiry,
        venmoUsername,
        swiftCode,
        mailingAddress,
      } = req.body;

      if (!userId || !methodType) {
        return res.status(400).json({ message: "User ID and method type are required" });
      }

      if (isDefault) {
        await db
          .update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.userId, userId));
      }

      const [newMethod] = await db
        .insert(paymentMethods)
        .values({
          userId,
          methodType,
          nickname,
          isDefault: isDefault || false,
          bankName,
          accountNumber,
          routingNumber,
          accountType,
          cardLast4,
          cardBrand,
          cardExpiry,
          venmoUsername,
          swiftCode,
          mailingAddress,
        })
        .returning();

      return res.status(201).json(newMethod);
    } catch (error) {
      console.error("Error creating payment method:", error);
      return res.status(500).json({ message: "Failed to create payment method" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
