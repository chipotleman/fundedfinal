import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import authOptions from "../auth/[...nextauth]";
import { db } from "../../../lib/db";
import { paymentMethods } from "../../../shared/schema";
import { eq } from "drizzle-orm";

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
      const methods = await db
        .select({
          id: paymentMethods.id,
          methodType: paymentMethods.methodType,
          nickname: paymentMethods.nickname,
          isDefault: paymentMethods.isDefault,
          bankName: paymentMethods.bankName,
          accountNumber: paymentMethods.accountNumber,
          accountType: paymentMethods.accountType,
          cardLast4: paymentMethods.cardLast4,
          cardBrand: paymentMethods.cardBrand,
          cardExpiry: paymentMethods.cardExpiry,
          venmoUsername: paymentMethods.venmoUsername,
          mailingAddress: paymentMethods.mailingAddress,
          createdAt: paymentMethods.createdAt,
        })
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

      if (!methodType) {
        return res.status(400).json({ message: "Method type is required" });
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
          accountNumber: accountNumber?.slice(-4),
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
