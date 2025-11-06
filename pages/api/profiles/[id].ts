import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/db";
import { profiles } from "../../../shared/schema";
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
        return res.status(404).json({ message: "Profile not found" });
      }

      return res.status(200).json(profile);
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
