import { getSetting } from '../../lib/settingsStore';

const SITE_FLAGS_KEY = 'site_flags';

const PUBLIC_DEFAULTS = {
  siteName: 'Piks',
  betaMode: true,
  maintenanceMode: false,
};

let cache = { value: null, expiresAt: 0 };
const CACHE_TTL_MS = 10_000;

export async function readSiteFlags() {
  const now = Date.now();
  if (cache.value && cache.expiresAt > now) return cache.value;
  let stored = null;
  try {
    stored = await getSetting(SITE_FLAGS_KEY);
  } catch (_e) {}
  const merged = { ...PUBLIC_DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) };
  const publicShape = {
    siteName: typeof merged.siteName === 'string' ? merged.siteName : PUBLIC_DEFAULTS.siteName,
    betaMode: !!merged.betaMode,
    maintenanceMode: !!merged.maintenanceMode,
  };
  cache = { value: publicShape, expiresAt: now + CACHE_TTL_MS };
  return publicShape;
}

export function invalidateSiteFlagsCache() {
  cache = { value: null, expiresAt: 0 };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const flags = await readSiteFlags();
  res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
  return res.status(200).json(flags);
}
