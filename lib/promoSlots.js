export const PROMO_SLOT_TYPES = [
  { id: 'reload_match', label: 'Reload / First Deposit Match' },
  { id: 'trending', label: 'Trending Now' },
  { id: 'deposit_match_applied', label: 'Deposit Match Applied' },
  { id: 'casino_match', label: 'Casino Deposit Match' },
  { id: 'fire_battle', label: 'Fire Battle' },
  { id: 'pool', label: 'Pool' },
  { id: 'referral', label: 'Referral Bonus' },
  { id: 'empty', label: 'Empty placeholder' },
];

const VALID_TYPE_IDS = new Set(PROMO_SLOT_TYPES.map((t) => t.id));

export const PROMO_SLOT_KEY = 'promoSlots';

// Defaults match the current dashboard order so nothing visibly changes
// for users until an admin edits the slots.
export const DEFAULT_PROMO_SLOTS = [
  { enabled: true, containerType: 'reload_match' },
  { enabled: true, containerType: 'trending' },
  { enabled: true, containerType: 'deposit_match_applied' },
  { enabled: false, containerType: 'empty' },
];

export function normalizePromoSlots(value) {
  if (!Array.isArray(value)) return DEFAULT_PROMO_SLOTS.map((s) => ({ ...s }));
  const out = [];
  for (let i = 0; i < 4; i++) {
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
