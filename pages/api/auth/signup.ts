import { NextApiRequest, NextApiResponse } from "next";
import { createUserWithProfile } from "../../../lib/auth/service";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: "Password is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    const result = await createUserWithProfile(email, password);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json({
      success: true,
      user: {
        id: result.user!.id,
        email: result.user!.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Failed to create account. Please try again." });
  }
}
