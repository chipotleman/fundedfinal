/**
 * Profile avatar frames catalog.
 *
 * Each frame entry is mapped to an existing achievement id from
 * `lib/achievements.js`. When a user earns the achievement, the matching
 * frame id is added to their `unlocked_frames` array on the profile.
 *
 * Frames are rendered as a colored ring around the avatar by the
 * shared `UserAvatar` component (see `components/UserAvatar.js`).
 */

export const PROFILE_FRAMES = [
  {
    id: 'rookie',
    achievementId: 'first_win',
    name: 'Rookie Ring',
    description: 'A clean blue ring earned for your first win.',
    rarity: 'Common',
    icon: '🥉',
    ring: { type: 'solid', color: '#3b82f6' },
  },
  {
    id: 'starter',
    achievementId: 'bets_10',
    name: 'Starter Frame',
    description: 'A subtle silver ring for placing your first 10 bets.',
    rarity: 'Common',
    icon: '🎯',
    ring: { type: 'solid', color: '#94a3b8' },
  },
  {
    id: 'regular',
    achievementId: 'bets_50',
    name: 'Regular Frame',
    description: 'An emerald ring for grinding 50 bets.',
    rarity: 'Uncommon',
    icon: '📊',
    ring: { type: 'solid', color: '#10b981' },
  },
  {
    id: 'century',
    achievementId: 'bets_100',
    name: 'Century Frame',
    description: 'A cyan ring honoring your 100th bet.',
    rarity: 'Rare',
    icon: '💯',
    ring: { type: 'gradient', from: '#06b6d4', to: '#3b82f6' },
  },
  {
    id: 'hot_streak',
    achievementId: 'hot_streak_3',
    name: 'Hot Streak',
    description: 'An orange ring for winning 3 in a row.',
    rarity: 'Uncommon',
    icon: '🔥',
    ring: { type: 'solid', color: '#f97316' },
  },
  {
    id: 'on_fire',
    achievementId: 'hot_streak_5',
    name: 'On Fire',
    description: 'A blazing red-to-orange ring for a 5-win streak.',
    rarity: 'Rare',
    icon: '🔥',
    ring: { type: 'gradient', from: '#ef4444', to: '#f59e0b' },
  },
  {
    id: 'big_payout',
    achievementId: 'big_payout',
    name: 'Big Payout',
    description: 'A gold ring earned for a $1,000+ single-bet win.',
    rarity: 'Rare',
    icon: '💰',
    ring: { type: 'solid', color: '#eab308' },
  },
  {
    id: 'huge_payout',
    achievementId: 'huge_payout',
    name: 'Huge Payout',
    description: 'A diamond ring for a $5,000+ single-bet win.',
    rarity: 'Epic',
    icon: '💎',
    ring: { type: 'gradient', from: '#22d3ee', to: '#a78bfa' },
  },
  {
    id: 'first_battle',
    achievementId: 'first_battle_win',
    name: "Warrior's Crest",
    description: 'A blue-cyan ring for your first 1v1 battle win.',
    rarity: 'Uncommon',
    icon: '⚔️',
    ring: { type: 'gradient', from: '#3b82f6', to: '#06b6d4' },
  },
  {
    id: 'battle_veteran',
    achievementId: 'battle_wins_10',
    name: "Champion's Crown",
    description: 'A regal gold ring for winning 10 battles.',
    rarity: 'Epic',
    icon: '👑',
    ring: { type: 'gradient', from: '#fbbf24', to: '#f97316' },
  },
];

const FRAMES_BY_ID = new Map(PROFILE_FRAMES.map((f) => [f.id, f]));
const FRAMES_BY_ACHIEVEMENT = new Map(
  PROFILE_FRAMES.map((f) => [f.achievementId, f])
);

export function getFrameById(id) {
  if (!id) return null;
  return FRAMES_BY_ID.get(id) || null;
}

export function getFrameForAchievement(achievementId) {
  if (!achievementId) return null;
  return FRAMES_BY_ACHIEVEMENT.get(achievementId) || null;
}

export function getAllFrameIds() {
  return PROFILE_FRAMES.map((f) => f.id);
}

/**
 * Returns the set of frame ids derivable from the user's earned
 * achievements. Used to backfill `unlocked_frames` for legacy users
 * whose achievements predate the frames system.
 */
export function deriveUnlockedFrameIds({ unlockedFrames = [], achievements = [] } = {}) {
  const set = new Set(
    Array.isArray(unlockedFrames) ? unlockedFrames.filter((x) => typeof x === 'string') : []
  );
  const earnedAchIds = new Set(
    (Array.isArray(achievements) ? achievements : [])
      .map((a) => (a && typeof a === 'object' ? a.id : null))
      .filter(Boolean)
  );
  for (const frame of PROFILE_FRAMES) {
    if (earnedAchIds.has(frame.achievementId)) set.add(frame.id);
  }
  return Array.from(set);
}

/**
 * Build the public catalog (with unlock state) for a given user.
 */
export function buildFrameCatalog({ unlockedFrames = [], achievements = [] } = {}) {
  const unlocked = new Set(
    Array.isArray(unlockedFrames) ? unlockedFrames.filter(Boolean) : []
  );
  const earnedAchievementIds = new Set(
    (Array.isArray(achievements) ? achievements : [])
      .map((a) => (a && typeof a === 'object' ? a.id : null))
      .filter(Boolean)
  );

  return PROFILE_FRAMES.map((frame) => {
    const isUnlocked =
      unlocked.has(frame.id) || earnedAchievementIds.has(frame.achievementId);
    return {
      id: frame.id,
      achievementId: frame.achievementId,
      name: frame.name,
      description: frame.description,
      rarity: frame.rarity,
      icon: frame.icon,
      ring: frame.ring,
      unlocked: isUnlocked,
    };
  });
}
