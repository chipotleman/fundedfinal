import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
// @ts-ignore - JS module without types
import { verifyAdminAuth } from "../../../lib/adminAuth";
import { db } from "../../../lib/db";
import { profiles, userBets, fakeOpponents } from "../../../shared/schema";
import { desc, eq } from "drizzle-orm";
import { evaluateAndAwardAchievements, getAchievementsWithProgress } from "../../../lib/achievements";
import { buildFrameCatalog, deriveUnlockedFrameIds } from "../../../lib/profileFrames";
import { normalizeFavoriteTeams, findTeam, BANNER_LIBRARY } from "../../../lib/teamCatalog";

// Fields that may be written through this generic profile-update endpoint.
// Anything not in this set is silently ignored. Sensitive identity fields
// (id, createdAt, updatedAt, username, avatar, bannerUrl, equippedFrame,
// unlockedFrames, favoriteTeams, lastBattleBuyIn, lastSeenAt, isFakeAccount,
// firstDepositMatch*) are intentionally excluded — they have their own
// dedicated endpoints with proper validation, or should not be writable here.
const ALLOWED_UPDATE_FIELDS = new Set<string>([
  "bio",
  "challenge",
  "challengeStartDate",
  "status",
  "bankroll",
  "pnl",
  "totalBets",
  "winRate",
  "betsHistory",
  "challengePhase",
  "dailyLoss",
  "maxDailyLoss",
  "profitTarget",
  "lastBetDate",
  "bettingDays",
  "achievements",
  "profileStats",
  "oddsFormat",
  "notificationPrefs",
  "notificationsFilter",
  "privacyPrefs",
  "sportPreferences",
  "bettingStyle",
  "experienceLevel",
  "onboardingCompleted",
  "instagramHandle",
  "facebookUrl",
]);

function pickAllowed(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

function parseAmericanOdds(odds: unknown): number | null {
  if (odds === null || odds === undefined) return null;
  const str = String(odds).trim().replace(/^\+/, '');
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : null;
}

function computeCurrentStreak(settledBets: Array<{ status: string | null }>): number {
  if (!settledBets.length) return 0;
  const first = settledBets[0].status;
  if (first !== 'won' && first !== 'lost') return 0;
  let streak = 0;
  for (const bet of settledBets) {
    if (bet.status === first) streak++;
    else break;
  }
  return first === 'won' ? streak : -streak;
}

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
      let [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, id));

      if (profile) {
        try {
          const newly = await evaluateAndAwardAchievements(id);
          if (newly && newly.length > 0) {
            const [refreshed] = await db
              .select()
              .from(profiles)
              .where(eq(profiles.id, id));
            if (refreshed) profile = refreshed;
          }
        } catch (achErr) {
          console.error("[ACHIEVEMENTS] retroactive grant error:", achErr);
        }
      }

      if (!profile) {
        const [fakeOpp] = await db
          .select()
          .from(fakeOpponents)
          .where(eq(fakeOpponents.id, id));

        if (fakeOpp) {
          return res.status(200).json({
            id: fakeOpp.id,
            username: fakeOpp.displayName,
            avatar: fakeOpp.avatar,
            bio: fakeOpp.bio || '',
            isFakeOpponent: true,
            battleWins: fakeOpp.totalBattles ? Math.floor(fakeOpp.totalBattles * (parseFloat(String(fakeOpp.winRate || '50')) / 100)) : 0,
            battleLosses: fakeOpp.totalBattles ? fakeOpp.totalBattles - Math.floor(fakeOpp.totalBattles * (parseFloat(String(fakeOpp.winRate || '50')) / 100)) : 0,
            winRate: fakeOpp.winRate,
            total_bets: 0,
            wins: 0,
            losses: 0,
          });
        }

        return res.status(404).json({ message: "Profile not found" });
      }

      const bets = await db
        .select()
        .from(userBets)
        .where(eq(userBets.userId, id))
        .orderBy(desc(userBets.placedAt));

      const totalBets = bets.length;
      const wins = bets.filter(b => b.status === 'won').length;
      const losses = bets.filter(b => b.status === 'lost').length;

      const settledBets = bets.filter(b => b.status === 'won' || b.status === 'lost');

      const oddsValues = settledBets
        .map(b => parseAmericanOdds(b.odds))
        .filter((n): n is number => n !== null);
      const avgOdds = oddsValues.length
        ? Math.round(oddsValues.reduce((a, c) => a + c, 0) / oddsValues.length)
        : 0;

      const currentStreak = computeCurrentStreak(settledBets);

      const recentBets = settledBets.slice(0, 5).map(b => ({
        id: b.id,
        game: b.matchupName || 'Unknown matchup',
        bet: b.selection || b.marketType || '—',
        odds: b.odds || '',
        result: b.status,
        amount: Number(b.pnl ?? b.stake ?? 0),
        stake: Number(b.stake ?? 0),
        settledAt: b.settledAt,
      }));

      type Achievement = {
        name?: string;
        title?: string;
        description?: string;
        icon?: string;
      };
      const isAchievement = (value: unknown): value is Achievement => {
        if (!value || typeof value !== 'object') return false;
        const v = value as Record<string, unknown>;
        return typeof v.name === 'string' || typeof v.title === 'string';
      };
      const rawAchievements: unknown[] = Array.isArray(profile.achievements)
        ? profile.achievements
        : [];
      const achievements: Achievement[] = rawAchievements.filter(isAchievement);

      let allAchievements: Awaited<ReturnType<typeof getAchievementsWithProgress>> = [];
      try {
        allAchievements = await getAchievementsWithProgress(id);
      } catch (progErr) {
        console.error("[ACHIEVEMENTS] progress lookup error:", progErr);
      }

      const storedUnlocked: string[] = Array.isArray(profile.unlockedFrames)
        ? profile.unlockedFrames.filter((f): f is string => typeof f === 'string')
        : [];
      const derivedUnlocked = deriveUnlockedFrameIds({
        unlockedFrames: storedUnlocked,
        achievements,
      });

      // Backfill: if we discovered frames the user has earned via achievements
      // that aren't yet stored on the profile, persist them so equip
      // validation doesn't reject legitimate frames.
      if (derivedUnlocked.length > storedUnlocked.length) {
        try {
          await db
            .update(profiles)
            .set({ unlockedFrames: derivedUnlocked, updatedAt: new Date() })
            .where(eq(profiles.id, id));
        } catch (backfillErr) {
          console.error('[FRAMES] backfill error:', backfillErr);
        }
      }

      const unlockedFrames = derivedUnlocked;
      const frames = buildFrameCatalog({
        unlockedFrames,
        achievements,
      });
      const equippedFrameId = profile.equippedFrame || null;
      const equippedIsUnlocked = equippedFrameId
        ? frames.some((f) => f.id === equippedFrameId && f.unlocked)
        : false;

      const rawFavorites = Array.isArray(profile.favoriteTeams)
        ? profile.favoriteTeams
        : [];
      const favoriteTeams = normalizeFavoriteTeams(rawFavorites).map((t) => {
        const meta = findTeam(t.league, t.teamId);
        return {
          league: t.league,
          teamId: t.teamId,
          name: meta?.name || t.teamId,
          logo: meta?.logo || null,
          sport: meta?.sport || null,
        };
      });

      const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
      const lastSeenDate = profile.lastSeenAt ? new Date(profile.lastSeenAt) : null;
      const lastSeenValid = lastSeenDate && !Number.isNaN(lastSeenDate.getTime());
      const lastSeenIso = lastSeenValid ? lastSeenDate!.toISOString() : null;
      const isOnline = lastSeenValid
        ? Date.now() - lastSeenDate!.getTime() <= ONLINE_THRESHOLD_MS
        : false;

      return res.status(200).json({
        ...profile,
        lastSeenAt: lastSeenIso,
        isOnline,
        total_bets: totalBets,
        wins,
        losses,
        recentBets,
        achievements,
        allAchievements,
        currentStreak,
        avgOdds,
        equippedFrame: equippedIsUnlocked ? equippedFrameId : null,
        unlockedFrames,
        favoriteTeams,
        frames,
        bannerLibrary: BANNER_LIBRARY,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      return res.status(500).json({ message: "Failed to fetch profile" });
    }
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    try {
      // Authenticate: must be the owner of the profile, or an admin.
      const session = await getServerSession(req, res, authOptions);
      const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
      const isOwner = !!sessionUserId && sessionUserId === id;

      let isAdmin = false;
      if (!isOwner) {
        try {
          const adminResult = await verifyAdminAuth(req);
          isAdmin = !!adminResult?.valid;
        } catch (adminErr) {
          console.error("[PROFILES PATCH] admin auth check failed:", adminErr);
          isAdmin = false;
        }
      }

      if (!isOwner && !isAdmin) {
        if (!sessionUserId) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        return res.status(403).json({ message: "Forbidden" });
      }

      const updateData = pickAllowed(req.body);

      if (Object.keys(updateData).length === 0) {
        // Nothing valid to write — return the current profile unchanged.
        const [existing] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, id));
        if (!existing) {
          return res.status(404).json({ message: "Profile not found" });
        }
        return res.status(200).json(existing);
      }

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
