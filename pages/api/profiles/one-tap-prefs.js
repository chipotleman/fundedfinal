import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

// Homepage "Play Now" one-tap card defaults (preferred buy-in and game
// mode). Persisted to the user's profile so the choice follows them
// across devices instead of living only in localStorage. Validation
// must stay in lockstep with the chip options rendered in
// `components/battle/LiveBattlesSection.js` (`ONE_TAP_BUY_IN_OPTIONS`
// and `ONE_TAP_GAME_MODE_OPTIONS`); a mismatch here would mean the
// user's pick on one device silently fails to save when synced.
const VALID_MODES = new Set(['rush', 'original', 'tournament']);
const VALID_BUY_INS = new Set([5, 10, 25]);

function normalize(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  const buyIn = Number(value.buyIn);
  if (Number.isFinite(buyIn) && VALID_BUY_INS.has(buyIn)) out.buyIn = buyIn;
  if (typeof value.gameMode === 'string' && VALID_MODES.has(value.gameMode)) {
    out.gameMode = value.gameMode;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const [row] = await db
        .select({ oneTapPrefs: profiles.oneTapPrefs })
        .from(profiles)
        .where(eq(profiles.id, userId));
      return res.status(200).json({ oneTapPrefs: normalize(row?.oneTapPrefs) });
    } catch (err) {
      console.error('[one-tap-prefs] GET error:', err);
      return res.status(500).json({ error: 'Failed to load one-tap prefs' });
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const next = normalize(req.body);
    if (!next) {
      return res.status(400).json({ error: 'Invalid buyIn or gameMode' });
    }
    try {
      // Merge with any existing stored prefs so a partial update (e.g.
      // only the buy-in changed) doesn't drop the other field. Writing
      // the merged object back keeps the column shape stable for any
      // future reader.
      const [existing] = await db
        .select({ oneTapPrefs: profiles.oneTapPrefs })
        .from(profiles)
        .where(eq(profiles.id, userId));
      const merged = { ...(existing?.oneTapPrefs || {}), ...next };
      await db
        .update(profiles)
        .set({ oneTapPrefs: merged, updatedAt: new Date() })
        .where(eq(profiles.id, userId));
      return res.status(200).json({ oneTapPrefs: merged });
    } catch (err) {
      console.error('[one-tap-prefs] PUT error:', err);
      return res.status(500).json({ error: 'Failed to save one-tap prefs' });
    }
  }

  res.setHeader('Allow', 'GET, PUT, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
