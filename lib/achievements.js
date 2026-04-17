import { db } from './db';
import { profiles, userBets } from '../shared/schema';
import { eq } from 'drizzle-orm';

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first_win',
    icon: '🏆',
    name: 'First Win',
    description: 'Won your very first bet',
    check: ({ wins }) => wins >= 1,
  },
  {
    id: 'bets_10',
    icon: '🎯',
    name: 'Getting Started',
    description: 'Settled 10 bets',
    check: ({ settled }) => settled >= 10,
  },
  {
    id: 'bets_50',
    icon: '📊',
    name: 'Regular Bettor',
    description: 'Settled 50 bets',
    check: ({ settled }) => settled >= 50,
  },
  {
    id: 'bets_100',
    icon: '💯',
    name: 'Century Club',
    description: 'Settled 100 bets',
    check: ({ settled }) => settled >= 100,
  },
  {
    id: 'hot_streak_3',
    icon: '🔥',
    name: 'Hot Streak',
    description: 'Won 3 bets in a row',
    check: ({ longestWinStreak }) => longestWinStreak >= 3,
  },
  {
    id: 'hot_streak_5',
    icon: '🔥',
    name: 'On Fire',
    description: 'Won 5 bets in a row',
    check: ({ longestWinStreak }) => longestWinStreak >= 5,
  },
  {
    id: 'big_payout',
    icon: '💰',
    name: 'Big Payout',
    description: 'Won a single bet for $1,000+ profit',
    check: ({ biggestWinPnl }) => biggestWinPnl >= 1000,
  },
  {
    id: 'huge_payout',
    icon: '💎',
    name: 'Huge Payout',
    description: 'Won a single bet for $5,000+ profit',
    check: ({ biggestWinPnl }) => biggestWinPnl >= 5000,
  },
  {
    id: 'first_battle_win',
    icon: '⚔️',
    name: 'First Battle Win',
    description: 'Won your first 1v1 battle',
    check: ({ battleWins }) => battleWins >= 1,
  },
  {
    id: 'battle_wins_10',
    icon: '👑',
    name: 'Battle Veteran',
    description: 'Won 10 battles',
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
          });
        }
      } catch (err) {
        console.error(`[ACHIEVEMENTS] check error for ${def.id}:`, err);
      }
    }

    if (newlyEarned.length === 0) return [];

    const updated = [...existing, ...newlyEarned];
    await db
      .update(profiles)
      .set({ achievements: updated, updatedAt: new Date() })
      .where(eq(profiles.id, userId));

    console.log(
      `[ACHIEVEMENTS] Awarded ${newlyEarned.length} to ${userId}: ${newlyEarned
        .map((a) => a.id)
        .join(', ')}`
    );
    return newlyEarned;
  } catch (err) {
    console.error('[ACHIEVEMENTS] evaluation error:', err);
    return [];
  }
}
