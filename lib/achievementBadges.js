/**
 * Achievement badge catalog.
 *
 * Provides a single source of truth describing the unique illustrated
 * award badge for every achievement id from `lib/achievements.js`.
 *
 * Each entry defines the badge shape, color palette, emblem, and rarity
 * tier. The shared `<AchievementBadge />` component reads from this map
 * to render the matching SVG art.
 *
 * Rarity tiers map to visual treatments (matte / glow / shimmer /
 * animated halo) inside the badge component, so a badge can stay
 * visually consistent with its rarity even if the artwork changes.
 */

export const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic'];

export const ACHIEVEMENT_BADGES = {
  first_win: {
    name: 'First Win',
    rarity: 'Common',
    shape: 'medal',
    palette: { base: '#3b82f6', accent: '#1d4ed8', highlight: '#93c5fd' },
    emblem: 'one',
  },
  bets_10: {
    name: 'Getting Started',
    rarity: 'Common',
    shape: 'hex',
    palette: { base: '#94a3b8', accent: '#475569', highlight: '#e2e8f0' },
    emblem: 'target',
  },
  bets_50: {
    name: 'Regular Bettor',
    rarity: 'Uncommon',
    shape: 'shield',
    palette: { base: '#10b981', accent: '#047857', highlight: '#6ee7b7' },
    emblem: 'bars',
  },
  bets_100: {
    name: 'Century Club',
    rarity: 'Rare',
    shape: 'star',
    palette: { base: '#06b6d4', accent: '#0e7490', highlight: '#67e8f9', secondary: '#3b82f6' },
    emblem: 'hundred',
  },
  hot_streak_3: {
    name: 'Hot Streak',
    rarity: 'Uncommon',
    shape: 'flameDisc',
    palette: { base: '#f97316', accent: '#c2410c', highlight: '#fdba74' },
    emblem: 'flame',
  },
  hot_streak_5: {
    name: 'On Fire',
    rarity: 'Rare',
    shape: 'flameDisc',
    palette: { base: '#ef4444', accent: '#b91c1c', highlight: '#fca5a5', secondary: '#f59e0b' },
    emblem: 'flameBig',
  },
  big_payout: {
    name: 'Big Payout',
    rarity: 'Rare',
    shape: 'coin',
    palette: { base: '#eab308', accent: '#a16207', highlight: '#fde68a' },
    emblem: 'dollar',
  },
  huge_payout: {
    name: 'Huge Payout',
    rarity: 'Epic',
    shape: 'gem',
    palette: { base: '#22d3ee', accent: '#0891b2', highlight: '#a5f3fc', secondary: '#3b82f6' },
    emblem: 'diamond',
  },
  first_battle_win: {
    name: 'First Battle Win',
    rarity: 'Uncommon',
    shape: 'shield',
    palette: { base: '#3b82f6', accent: '#1d4ed8', highlight: '#7dd3fc', secondary: '#06b6d4' },
    emblem: 'swords',
  },
  battle_wins_10: {
    name: 'Battle Veteran',
    rarity: 'Epic',
    shape: 'crownDisc',
    palette: { base: '#fbbf24', accent: '#b45309', highlight: '#fde68a', secondary: '#f97316' },
    emblem: 'crown',
  },
};

const FALLBACK_BADGE = {
  name: 'Achievement',
  rarity: 'Common',
  shape: 'medal',
  palette: { base: '#64748b', accent: '#334155', highlight: '#cbd5e1' },
  emblem: 'star',
};

export function getBadgeForAchievement(achievementId) {
  if (!achievementId) return FALLBACK_BADGE;
  return ACHIEVEMENT_BADGES[achievementId] || FALLBACK_BADGE;
}

export function getRarityRank(rarity) {
  const idx = RARITY_ORDER.indexOf(rarity);
  return idx === -1 ? 0 : idx;
}
