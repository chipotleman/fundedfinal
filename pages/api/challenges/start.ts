import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { and, desc, eq } from "drizzle-orm";
import { authOptions } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { profiles, userChallenges } from "../../../shared/schema";

const INITIAL_PROFILE_STATS = {
  totalWins: 0,
  totalLosses: 0,
  biggestWin: 0,
  biggestLoss: 0,
  averageBetSize: 0,
  longestWinStreak: 0,
  currentWinStreak: 0,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : {};
  const requestedChallengeId =
    typeof body.challengeId === "string" ? body.challengeId : null;

  try {
    // Refuse to (re)start if the caller's profile already has a challenge
    // initialized. Without this guard, a signed-in user could repeatedly POST
    // here to reset their own bankroll/pnl/betsHistory back to the starting
    // state. Once a challenge has been started, only server-side bet
    // settlement (which flips status to 'completed' / 'failed' / 'inactive')
    // or admin tooling may reopen the door to starting another one.
    const [existingProfile] = await db
      .select({
        status: profiles.status,
        challenge: profiles.challenge,
        challengeStartDate: profiles.challengeStartDate,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existingProfile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (
      existingProfile.status === "active" &&
      existingProfile.challengeStartDate
    ) {
      return res.status(409).json({
        message:
          "A challenge is already active for this account. Finish or fail the current challenge before starting a new one.",
      });
    }

    let challengeRow:
      | (typeof userChallenges.$inferSelect)
      | null = null;

    if (requestedChallengeId) {
      const [row] = await db
        .select()
        .from(userChallenges)
        .where(
          and(
            eq(userChallenges.id, requestedChallengeId),
            eq(userChallenges.userId, userId),
          ),
        )
        .limit(1);
      challengeRow = row ?? null;

      // Even with ownership confirmed, the requested row must itself be in a
      // start-eligible state. Completed/failed/cancelled rows can't be
      // reused to re-initialize a profile.
      if (
        challengeRow &&
        challengeRow.status !== "active" &&
        challengeRow.status !== "pending"
      ) {
        return res.status(409).json({
          message: "This challenge is no longer eligible to be started.",
        });
      }
    } else {
      // Deterministic pick: most recently purchased eligible row, breaking
      // ties by id so the choice is stable if two rows share a timestamp.
      const [row] = await db
        .select()
        .from(userChallenges)
        .where(
          and(
            eq(userChallenges.userId, userId),
            eq(userChallenges.status, "active"),
          ),
        )
        .orderBy(desc(userChallenges.purchasedAt), desc(userChallenges.id))
        .limit(1);
      challengeRow = row ?? null;
    }

    if (!challengeRow) {
      return res
        .status(404)
        .json({ message: "No active challenge available to start" });
    }

    // Belt-and-suspenders: if the chosen userChallenges row has already been
    // wired up to this profile (i.e. its activatedAt is set AND we've already
    // initialized the profile against it at some point), refuse. The earlier
    // profile.status check covers the common case; this catches edge cases
    // where status drifts back to non-active without the row being closed.
    if (
      challengeRow.activatedAt &&
      existingProfile.challenge &&
      typeof existingProfile.challenge === "object" &&
      (existingProfile.challenge as { id?: unknown }).id === challengeRow.id &&
      existingProfile.challengeStartDate
    ) {
      return res.status(409).json({
        message: "This challenge has already been started.",
      });
    }

    const startingBalance = Number(challengeRow.startingBalance);
    if (!Number.isFinite(startingBalance) || startingBalance <= 0) {
      console.error(
        "[CHALLENGES START] invalid starting balance for challenge",
        challengeRow.id,
      );
      return res
        .status(500)
        .json({ message: "Challenge has invalid starting balance" });
    }

    const profitTarget =
      challengeRow.profitTarget !== null && challengeRow.profitTarget !== undefined
        ? Number(challengeRow.profitTarget)
        : startingBalance * 0.2;
    const maxDailyLoss =
      challengeRow.maxDailyLoss !== null && challengeRow.maxDailyLoss !== undefined
        ? Number(challengeRow.maxDailyLoss)
        : startingBalance * 0.08;

    const challengeJson = {
      id: challengeRow.id,
      type: challengeRow.challengeType,
      name: challengeRow.challengeName,
      startingBalance,
      target: profitTarget,
      userSplit: challengeRow.userSplit,
      pricePaid: Number(challengeRow.pricePaid),
      purchasedAt: challengeRow.purchasedAt,
    };

    if (challengeRow.status !== "active" || !challengeRow.activatedAt) {
      await db
        .update(userChallenges)
        .set({
          status: "active",
          activatedAt: challengeRow.activatedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userChallenges.id, challengeRow.id));
    }

    const [updatedProfile] = await db
      .update(profiles)
      .set({
        bankroll: startingBalance.toString(),
        challenge: challengeJson,
        challengeStartDate: new Date(),
        challengePhase: 1,
        status: "active",
        pnl: "0",
        totalBets: 0,
        winRate: "0",
        betsHistory: [],
        dailyLoss: "0",
        maxDailyLoss: maxDailyLoss.toString(),
        profitTarget: profitTarget.toString(),
        lastBetDate: null,
        bettingDays: 0,
        achievements: [],
        profileStats: INITIAL_PROFILE_STATS,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId))
      .returning();

    if (!updatedProfile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res
      .status(200)
      .json({ success: true, profile: updatedProfile, challenge: challengeRow });
  } catch (error) {
    console.error("[CHALLENGES START] error:", error);
    return res.status(500).json({ message: "Failed to start challenge" });
  }
}
