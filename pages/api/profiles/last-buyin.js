import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { profiles } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

const VALID_MODES = new Set(['rush', 'original', 'tournament']);

function normalize(value) {
  if (!value || typeof value !== 'object') return null;
  const buyIn = Number(value.buyIn);
  if (!Number.isFinite(buyIn) || buyIn <= 0) return null;
  const gameMode = typeof value.gameMode === 'string' && VALID_MODES.has(value.gameMode)
    ? value.gameMode
    : 'original';
  return { buyIn, gameMode };
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
        .select({ lastBattleBuyIn: profiles.lastBattleBuyIn })
        .from(profiles)
        .where(eq(profiles.id, userId));
      return res.status(200).json({ lastBuyIn: normalize(row?.lastBattleBuyIn) });
    } catch (err) {
      console.error('[last-buyin] GET error:', err);
      return res.status(500).json({ error: 'Failed to load buy-in preference' });
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const next = normalize(req.body);
    if (!next) {
      return res.status(400).json({ error: 'Invalid buyIn or gameMode' });
    }
    try {
      await db
        .update(profiles)
        .set({ lastBattleBuyIn: next, updatedAt: new Date() })
        .where(eq(profiles.id, userId));
      return res.status(200).json({ lastBuyIn: next });
    } catch (err) {
      console.error('[last-buyin] PUT error:', err);
      return res.status(500).json({ error: 'Failed to save buy-in preference' });
    }
  }

  res.setHeader('Allow', 'GET, PUT, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
