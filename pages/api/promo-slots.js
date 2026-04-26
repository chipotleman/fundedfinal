import { getSetting } from '../../lib/settingsStore';
import {
  PROMO_SLOT_KEY,
  DEFAULT_PROMO_SLOTS,
  normalizePromoSlots,
} from '../../lib/promoSlots';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stored = await getSetting(PROMO_SLOT_KEY);
    const slots = stored
      ? normalizePromoSlots(stored)
      : DEFAULT_PROMO_SLOTS.map((s) => ({ ...s }));
    return res.status(200).json({ slots });
  } catch (err) {
    console.error('Failed to load promo slots:', err);
    return res
      .status(200)
      .json({ slots: DEFAULT_PROMO_SLOTS.map((s) => ({ ...s })) });
  }
}
