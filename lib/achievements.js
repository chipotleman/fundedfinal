import { db } from './db';
import { profiles, userBets } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { getFrameForAchievement } from './profileFrames';
const { publishBattleEvent } = require('./battle-events');

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first_win',
    icon: '🏆',
    name: 'First Win',
    description: 'Won your very first bet',
    target: 1,
    progressLabel: 'bets won',
    progress: ({ wins }) => wins,
    check: ({ wins }) => wins >= 1,
  },
  {
    id: 'bets_10',
    icon: '🎯',
    name: 'Getting Started',
    description: 'Settled 10 bets',
    target: 10,
    progressLabel: 'bets settled',
    progress: ({ settled }) => settled,
    check: ({ settled }) => settled >= 10,
  },
  {
    id: 'bets_50',
    icon: '📊',
    name: 'Regular Bettor',
    description: 'Settled 50 bets',
    target: 50,
    progressLabel: 'bets settled',
    progress: ({ settled }) => settled,
    check: ({ settled }) => settled >= 50,
  },
  {
    id: 'bets_100',
    icon: '💯',
    name: 'Century Club',
    description: 'Settled 100 bets',
    target: 100,
    progressLabel: 'bets settled',
    progress: ({ settled }) => settled,
    check: ({ settled }) => settled >= 100,
  },
  {
    id: 'hot_streak_3',
    icon: '🔥',
    name: 'Hot Streak',
    description: 'Won 3 bets in a row',
    target: 3,
    progressLabel: 'win streak',
    progress: ({ longestWinStreak }) => longestWinStreak,
    check: ({ longestWinStreak }) => longestWinStreak >= 3,
  },
  {
    id: 'hot_streak_5',
    icon: '🔥',
    name: 'On Fire',
    description: 'Won 5 bets in a row',
    target: 5,
    progressLabel: 'win streak',
    progress: ({ longestWinStreak }) => longestWinStreak,
    check: ({ longestWinStreak }) => longestWinStreak >= 5,
  },
  {
    id: 'big_payout',
    icon: '💰',
    name: 'Big Payout',
    description: 'Won a single bet for $1,000+ profit',
    target: 1000,
    progressLabel: 'biggest win ($)',
    progress: ({ biggestWinPnl }) => biggestWinPnl,
    formatProgress: (current, target) =>
      `$${Math.floor(current).toLocaleString()} / $${target.toLocaleString()}`,
    check: ({ biggestWinPnl }) => biggestWinPnl >= 1000,
  },
  {
    id: 'huge_payout',
    icon: '💎',
    name: 'Huge Payout',
    description: 'Won a single bet for $5,000+ profit',
    target: 5000,
    progressLabel: 'biggest win ($)',
    progress: ({ biggestWinPnl }) => biggestWinPnl,
    formatProgress: (current, target) =>
      `$${Math.floor(current).toLocaleString()} / $${target.toLocaleString()}`,
    check: ({ biggestWinPnl }) => biggestWinPnl >= 5000,
  },
  {
    id: 'first_battle_win',
    icon: '⚔️',
    name: 'First Battle Win',
    description: 'Won your first 1v1 battle',
    target: 1,
    progressLabel: 'battles won',
    progress: ({ battleWins }) => battleWins,
    check: ({ battleWins }) => battleWins >= 1,
  },
  {
    id: 'battle_wins_10',
    icon: '👑',
    name: 'Battle Veteran',
    description: 'Won 10 battles',
    target: 10,
    progressLabel: 'battles won',
    progress: ({ battleWins }) => battleWins,
    check: ({ battleWins }) => battleWins >= 10,
  },
];

function computeStats(profile, bets) {
  const settledBets = bets.filter(
    (b) => b.status === 'won' || b.status === 'lost' || b.status === 'push'
  );
  const wins = settledBets.filter((b) => b.status === 'won').length;
  const settled = settledBets.length;

  const sortedByDate = [...settledBets].sort((a, b) => {
    const ta = new Date(a.settledAt || a.placedAt || 0).getTime();
    const tb = new Date(b.settledAt || b.placedAt || 0).getTime();
    return ta - tb;
  });

  let longestWinStreak = 0;
  let currentStreak = 0;
  for (const bet of sortedByDate) {
    if (bet.status === 'won') {
      currentStreak += 1;
      if (currentStreak > longestWinStreak) longestWinStreak = currentStreak;
    } else if (bet.status === 'lost') {
      currentStreak = 0;
    }
  }

  let biggestWinPnl = 0;
  for (const bet of settledBets) {
    if (bet.status === 'won' && bet.pnl) {
      const pnl = parseFloat(bet.pnl);
      if (!Number.isNaN(pnl) && pnl > biggestWinPnl) biggestWinPnl = pnl;
    }
  }

  const battleWins = profile?.battleWins || 0;

  return { wins, settled, longestWinStreak, biggestWinPnl, battleWins };
}

export async function getAchievementsWithProgress(userId) {
  if (!userId) return [];
  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) return [];

    const bets = await db
      .select()
      .from(userBets)
      .where(eq(userBets.userId, userId));

    const stats = computeStats(profile, bets);
    const earned = Array.isArray(profile.achievements) ? profile.achievements : [];
    const earnedById = new Map(
      earned
        .filter((a) => a && typeof a === 'object' && a.id)
        .map((a) => [a.id, a])
    );

    return ACHIEVEMENT_DEFINITIONS.map((def) => {
      let current = 0;
      try {
        current = Number(def.progress ? def.progress(stats) : 0) || 0;
      } catch {
        current = 0;
      }
      const target = Number(def.target) || 1;
      const earnedEntry = earnedById.get(def.id);
      const isEarned = !!earnedEntry || (def.check ? def.check(stats) : false);
      const clamped = Math.max(0, Math.min(current, target));
      const progressText = def.formatProgress
        ? def.formatProgress(current, target)
        : `${Math.floor(clamped).toLocaleString()} / ${target.toLocaleString()}`;
      return {
        id: def.id,
        icon: def.icon,
        name: def.name,
        description: def.description,
        target,
        current: clamped,
        progressLabel: def.progressLabel || '',
        progressText,
        progressPercent: Math.round((clamped / target) * 100),
        earned: isEarned,
        earnedAt: earnedEntry ? earnedEntry.earnedAt || null : null,
      };
    });
  } catch (err) {
    console.error('[ACHIEVEMENTS] progress error:', err);
    return [];
  }
}

export async function evaluateAndAwardAchievements(userId) {
  if (!userId) return [];

  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) return [];

    const bets = await db
      .select()
      .from(userBets)
      .where(eq(userBets.userId, userId));

    const stats = computeStats(profile, bets);
    const existing = Array.isArray(profile.achievements) ? profile.achievements : [];
    const existingIds = new Set(existing.map((a) => a && a.id).filter(Boolean));

    const newlyEarned = [];
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (existingIds.has(def.id)) continue;
      try {
        if (def.check(stats)) {
          newlyEarned.push({
            id: def.id,
            icon: def.icon,
            name: def.name,
            description: def.description,
            earnedAt: new Date().toISOString(),
            // null = celebration popup not yet shown to the user.
            // markAchievementsCelebrated() flips this to a timestamp once
            // the unlock overlay is dismissed, preventing replays across
            // refreshes / SSE reconnects / multiple tabs.
            celebratedAt: null,
            // null = user hasn't actually viewed the achievements section
            // yet. Independent from celebratedAt: a player may close the
            // unlock popup quickly without ever browsing their badges, and
            // we still want a lingering "you've got something new" dot on
            // the Profile tab + Achievements header until they open it.
            // markAchievementsViewed() flips this to a timestamp once the
            // section is actually rendered into view.
            viewedAt: null,
          });
        }
      } catch (err) {
        console.error(`[ACHIEVEMENTS] check error for ${def.id}:`, err);
      }
    }

    if (newlyEarned.length === 0) return [];

    const updated = [...existing, ...newlyEarned];

    const existingFrames = Array.isArray(profile.unlockedFrames)
      ? profile.unlockedFrames.filter((f) => typeof f === 'string')
      : [];
    const frameSet = new Set(existingFrames);
    const newlyUnlockedFrames = [];
    for (const ach of newlyEarned) {
      const frame = getFrameForAchievement(ach.id);
      if (frame && !frameSet.has(frame.id)) {
        frameSet.add(frame.id);
        newlyUnlockedFrames.push(frame.id);
      }
    }
    const updatedFrames = Array.from(frameSet);

    await db
      .update(profiles)
      .set({
        achievements: updated,
        unlockedFrames: updatedFrames,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));

    console.log(
      `[ACHIEVEMENTS] Awarded ${newlyEarned.length} to ${userId}: ${newlyEarned
        .map((a) => a.id)
        .join(', ')}`
    );

    try {
      for (const ach of newlyEarned) {
        const frame = getFrameForAchievement(ach.id);
        publishBattleEvent(userId, {
          type: 'achievement:earned',
          achievement: ach,
          frame: frame
            ? { id: frame.id, name: frame.name, icon: frame.icon }
            : null,
        });
      }
    } catch (pubErr) {
      console.error('[ACHIEVEMENTS] publish event error:', pubErr);
    }

    return newlyEarned;
  } catch (err) {
    console.error('[ACHIEVEMENTS] evaluation error:', err);
    return [];
  }
}

// Catch-up: returns achievement entries the user has already earned but has
// not yet seen the celebratory unlock popup for. Backed by the persistent
// `celebratedAt` field on each entry so the celebration survives refreshes
// and SSE reconnects without replaying old badges.
//
// Backwards-compatible: entries written before this feature shipped have no
// `celebratedAt` field at all (`undefined !== null`) and are NOT returned, so
// historical badges don't retroactively trigger celebrations.
export async function getUncelebratedAchievements(userId, { limit = 5 } = {}) {
  if (!userId) return [];
  try {
    const [profile] = await db
      .select({ achievements: profiles.achievements })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (!profile) return [];
    const list = Array.isArray(profile.achievements) ? profile.achievements : [];
    const pending = list
      .filter(
        (a) =>
          a && typeof a === 'object' && a.id && a.celebratedAt === null
      )
      .sort((a, b) => {
        const ta = new Date(a.earnedAt || 0).getTime();
        const tb = new Date(b.earnedAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, limit);
    return pending.map((a) => ({
      id: a.id,
      icon: a.icon || null,
      name: a.name || null,
      description: a.description || null,
      earnedAt: a.earnedAt || null,
    }));
  } catch (err) {
    console.error('[ACHIEVEMENTS] uncelebrated lookup error:', err);
    return [];
  }
}

// Returns the count of earned achievements the user hasn't actually viewed
// yet (`viewedAt === null`). Powers the small unread dot on the Profile
// tab + Achievements section header so a player who missed the celebration
// popup still has a lingering signal that something new was earned.
//
// Backwards-compatible: entries written before the viewedAt field shipped
// have `viewedAt === undefined` and are NOT counted, so old badges don't
// retroactively light up the dot.
export async function getUnviewedAchievementCount(userId) {
  if (!userId) return 0;
  try {
    const [profile] = await db
      .select({ achievements: profiles.achievements })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (!profile) return 0;
    const list = Array.isArray(profile.achievements) ? profile.achievements : [];
    let count = 0;
    for (const a of list) {
      if (a && typeof a === 'object' && a.id && a.viewedAt === null) count += 1;
    }
    return count;
  } catch (err) {
    console.error('[ACHIEVEMENTS] unviewed count error:', err);
    return 0;
  }
}

// Marks all currently-unviewed achievements as viewed for the given user.
// Idempotent — entries already viewed keep their original timestamp. Returns
// the number flipped. Distinct from markAchievementsCelebrated: dismissing
// the unlock popup does NOT count as viewing the section, so the dot only
// clears once the user actually opens their Achievements grid.
export async function markAchievementsViewed(userId) {
  if (!userId) return 0;
  try {
    const [profile] = await db
      .select({ achievements: profiles.achievements })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (!profile) return 0;
    const list = Array.isArray(profile.achievements) ? profile.achievements : [];
    let changed = 0;
    const nowIso = new Date().toISOString();
    const next = list.map((a) => {
      if (!a || typeof a !== 'object' || !a.id) return a;
      if (a.viewedAt !== null) return a; // already viewed (or pre-feature)
      changed += 1;
      return { ...a, viewedAt: nowIso };
    });
    if (changed === 0) return 0;
    await db
      .update(profiles)
      .set({ achievements: next, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return changed;
  } catch (err) {
    console.error('[ACHIEVEMENTS] mark viewed error:', err);
    return 0;
  }
}

// Marks the given achievement ids as having had their celebration shown.
// Idempotent — entries already celebrated keep their original timestamp,
// and unknown ids are simply ignored. Returns the count flipped.
export async function markAchievementsCelebrated(userId, ids) {
  if (!userId) return 0;
  const targetIds = Array.from(
    new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string'))
  );
  if (targetIds.length === 0) return 0;
  try {
    const [profile] = await db
      .select({ achievements: profiles.achievements })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (!profile) return 0;
    const list = Array.isArray(profile.achievements) ? profile.achievements : [];
    const targetSet = new Set(targetIds);
    let changed = 0;
    const nowIso = new Date().toISOString();
    const next = list.map((a) => {
      if (!a || typeof a !== 'object' || !a.id) return a;
      if (!targetSet.has(a.id)) return a;
      if (a.celebratedAt) return a; // already flipped
      changed += 1;
      return { ...a, celebratedAt: nowIso };
    });
    if (changed === 0) return 0;
    await db
      .update(profiles)
      .set({ achievements: next, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return changed;
  } catch (err) {
    console.error('[ACHIEVEMENTS] mark celebrated error:', err);
    return 0;
  }
}
