import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { matchups } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { publishBattleEvent } from '../../../../lib/battle-events';

// Keep this list in lockstep with REACTION_EMOJIS / REACTION_TEXTS in
// components/battle/MatchResult.js — only what the UI exposes is accepted.
const ALLOWED_EMOJIS = new Set(['👍', '🔥', '😂', '🎯', '👏']);
const ALLOWED_TEXTS = new Set(['GG', 'Nice!', 'Close one', 'WP']);

const recentByUser = global.__piks_reaction_rl__ || (global.__piks_reaction_rl__ = new Map());
const COOLDOWN_MS = 400;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Matchup ID required' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji : null;
  const text = typeof req.body?.text === 'string' ? req.body.text : null;
  if (!emoji && !text) {
    return res.status(400).json({ error: 'emoji or text required' });
  }
  if (emoji && !ALLOWED_EMOJIS.has(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  if (text && !ALLOWED_TEXTS.has(text)) {
    return res.status(400).json({ error: 'Invalid text' });
  }

  const rlKey = `${userId}:${id}`;
  const last = recentByUser.get(rlKey) || 0;
  const now = Date.now();
  if (now - last < COOLDOWN_MS) {
    return res.status(429).json({ error: 'Too fast' });
  }
  recentByUser.set(rlKey, now);
  if (recentByUser.size > 5000) {
    for (const [k, t] of recentByUser) {
      if (now - t > 60000) recentByUser.delete(k);
    }
  }

  try {
    const [m] = await db.select().from(matchups).where(eq(matchups.id, id));
    if (!m) return res.status(404).json({ error: 'Matchup not found' });
    if (m.user1Id !== userId && m.user2Id !== userId) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    if (m.status !== 'completed') {
      return res.status(400).json({ error: 'Matchup not completed' });
    }
    if (m.isFakeOpponent) {
      return res.status(400).json({ error: 'Reactions unavailable for this match' });
    }

    const fromSide = m.user1Id === userId ? 'user1' : 'user2';
    const recipients = [m.user1Id, m.user2Id].filter(Boolean);
    const payload = {
      type: 'matchup:reaction',
      matchupId: m.id,
      fromUserId: userId,
      fromSide,
      emoji: emoji || null,
      text: text || null,
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    };
    publishBattleEvent(recipients, payload);
    return res.status(200).json({ ok: true, ...payload });
  } catch (error) {
    console.error('Reaction error:', error);
    return res.status(500).json({ error: 'Failed to send reaction' });
  }
}
