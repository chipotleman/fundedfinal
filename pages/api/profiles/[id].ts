import { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/db";
import { profiles, userBets, fakeOpponents } from "../../../shared/schema";
import { desc, eq } from "drizzle-orm";
import { evaluateAndAwardAchievements, getAchievementsWithProgress } from "../../../lib/achievements";
import { buildFrameCatalog, deriveUnlockedFrameIds } from "../../../lib/profileFrames";
import { normalizeFavoriteTeams, findTeam, BANNER_LIBRARY } from "../../../lib/teamCatalog";

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

      const storedUnlocked = Array.isArray(profile.unlockedFrames)
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
