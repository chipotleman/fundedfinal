import { verifyAdminAuth } from '../../../lib/adminAuth';
import { getSetting, setSetting } from '../../../lib/settingsStore';
import { requireAdmin } from '../../../lib/adminAuth';
import {
  PROMO_SLOT_KEY,
  DEFAULT_PROMO_SLOTS,
  normalizePromoSlots,
} from '../../../lib/promoSlots';

const SITE_FLAGS_KEY = 'site_flags';

const STATIC_DEFAULTS = {
  siteName: 'Piks',
  betaMode: true,
  maintenanceMode: false,
  demoEnabled: true,
  promoRowEnabled: true,
  challengeTiers: {
    starter: { price: 149, funding: 5000, profitSplit: 90 },
    pro: { price: 249, funding: 10000, profitSplit: 90 },
    elite: { price: 399, funding: 25000, profitSplit: 90 },
  },
  challengeRules: {
    minPicks: 20,
    minRiskPercent: 1,
    maxRiskPercent: 5,
    maxDailyLoss: 10,
    maxDrawdown: 15,
    profitTarget: 20,
    cashoutFee: 10,
    inactivityDays: 5,
  },
};

function hasSettingsPermission(admin) {
  if (!admin) return false;
  if (admin.type === 'admin') return true;
  if (admin.role === 'admin') return true;
  const perms = Array.isArray(admin.permissions) ? admin.permissions : [];
  return perms.includes('all') || perms.includes('settings');
}

function pickSiteFlags(input) {
  const out = {};
  if (input && typeof input === 'object') {
    if (typeof input.siteName === 'string') out.siteName = input.siteName.slice(0, 64);
    if (typeof input.betaMode === 'boolean') out.betaMode = input.betaMode;
    if (typeof input.maintenanceMode === 'boolean') out.maintenanceMode = input.maintenanceMode;
    if (typeof input.demoEnabled === 'boolean') out.demoEnabled = input.demoEnabled;
    if (typeof input.promoRowEnabled === 'boolean') out.promoRowEnabled = input.promoRowEnabled;
    if (input.challengeTiers && typeof input.challengeTiers === 'object') {
      out.challengeTiers = input.challengeTiers;
    }
    if (input.challengeRules && typeof input.challengeRules === 'object') {
      out.challengeRules = input.challengeRules;
    }
  }
  return out;
}

async function handler(req, res) {
  const auth = await verifyAdminAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error || 'Unauthorized' });
  }
  if (!hasSettingsPermission(auth.admin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    let promoSlots = DEFAULT_PROMO_SLOTS.map((s) => ({ ...s }));
    try {
      const stored = await getSetting(PROMO_SLOT_KEY);
      if (stored) promoSlots = normalizePromoSlots(stored);
    } catch (err) {
      console.error('Failed to load promo slots for admin settings:', err);
    }
    let storedFlags = {};
    try {
      const stored = await getSetting(SITE_FLAGS_KEY);
      if (stored && typeof stored === 'object') storedFlags = pickSiteFlags(stored);
    } catch (err) {
      console.error('Failed to load site flags for admin settings:', err);
    }
    return res.status(200).json({ ...STATIC_DEFAULTS, ...storedFlags, promoSlots });
  }

  if (req.method === 'POST') {
    const newSettings = req.body || {};
    if (Array.isArray(newSettings.promoSlots)) {
      const normalized = normalizePromoSlots(newSettings.promoSlots);
      const ok = await setSetting(PROMO_SLOT_KEY, normalized);
      if (!ok) {
        return res
          .status(500)
          .json({ success: false, error: 'Failed to persist promo slots' });
      }
    }
    const flagsPatch = pickSiteFlags(newSettings);
    if (Object.keys(flagsPatch).length > 0) {
      let existing = {};
      try {
        const stored = await getSetting(SITE_FLAGS_KEY);
        if (stored && typeof stored === 'object') existing = stored;
      } catch (_e) {}
      const merged = { ...existing, ...flagsPatch };
      const ok = await setSetting(SITE_FLAGS_KEY, merged);
      if (!ok) {
        return res
          .status(500)
          .json({ success: false, error: 'Failed to persist site flags' });
      }
    }
    return res.status(200).json({ success: true, message: 'Settings saved' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
