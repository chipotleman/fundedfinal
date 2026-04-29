export const PROMO_SLOT_TYPES = [
  { id: 'reload_match', label: 'Reload / First Deposit Match' },
  { id: 'trending', label: 'Trending Now' },
  { id: 'deposit_match_applied', label: 'Deposit Match Applied' },
  { id: 'casino_match', label: 'Casino Deposit Match' },
  { id: 'fire_battle', label: 'Fire Battle' },
  { id: 'pool', label: 'Pool' },
  { id: 'referral', label: 'Referral Bonus' },
  { id: 'most_shared_badge', label: 'Most Shared Badge (this week)' },
  { id: 'rush_explainer', label: 'Rush Mode Explainer' },
  { id: 'pick_battles', label: '1v1 Pick Battles' },
  { id: 'premium_discord', label: 'Premium Discord (VIP)' },
  { id: 'free_pick', label: 'Free Pick of the Day' },
  { id: 'top_cappers', label: 'Top Cappers (this week)' },
  { id: 'empty', label: 'Empty placeholder' },
];

const VALID_TYPE_IDS = new Set(PROMO_SLOT_TYPES.map((t) => t.id));

export const PROMO_SLOT_KEY = 'promoSlots';

// Defaults define the carousel order. `reload_match` (the 50% deposit
// match) sits between `premium_discord` (purple VIP tile) and
// `free_pick` (green Pick of the Day tile) so the orange/yellow money
// banner breaks up the purple → green color sequence visually.
export const DEFAULT_PROMO_SLOTS = [
  { enabled: true, containerType: 'trending' },
  { enabled: true, containerType: 'deposit_match_applied' },
  { enabled: true, containerType: 'rush_explainer' },
  { enabled: true, containerType: 'pick_battles' },
  { enabled: true, containerType: 'premium_discord' },
  { enabled: true, containerType: 'reload_match' },
  { enabled: true, containerType: 'free_pick' },
  { enabled: true, containerType: 'top_cappers' },
];

export const PROMO_SLOT_COUNT = DEFAULT_PROMO_SLOTS.length;

export function normalizePromoSlots(value) {
  if (!Array.isArray(value)) return DEFAULT_PROMO_SLOTS.map((s) => ({ ...s }));
  const out = [];
  for (let i = 0; i < PROMO_SLOT_COUNT; i++) {
    const incoming = value[i] || {};
    const containerType = VALID_TYPE_IDS.has(incoming.containerType)
      ? incoming.containerType
      : DEFAULT_PROMO_SLOTS[i].containerType;
    const enabled =
      typeof incoming.enabled === 'boolean'
        ? incoming.enabled
        : DEFAULT_PROMO_SLOTS[i].enabled;
    out.push({ enabled, containerType });
  }
  return out;
}
