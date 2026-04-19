import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { matchups, profiles } from '../../../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../../lib/battle-events');

const ALLOWED_TYPES = new Set([
  'voice:invite',
  'voice:accept',
  'voice:decline',
  'voice:offer',
  'voice:answer',
  'voice:ice',
  'voice:leave',
  'voice:cancel',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const { type, matchupId, payload } = req.body || {};

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  if (!matchupId) {
    return res.status(400).json({ error: 'matchupId required' });
  }

  try {
    const [matchup] = await db
      .select({
        id: matchups.id,
        user1Id: matchups.user1Id,
        user2Id: matchups.user2Id,
        status: matchups.status,
        isFakeOpponent: matchups.isFakeOpponent,
      })
      .from(matchups)
      .where(eq(matchups.id, matchupId))
      .limit(1);

    if (!matchup) {
      return res.status(404).json({ error: 'Matchup not found' });
    }
    if (matchup.isFakeOpponent) {
      return res.status(400).json({ error: 'Voice chat not available against bot opponents' });
    }
    if (matchup.status !== 'active' && matchup.status !== 'matched') {
      return res.status(400).json({ error: 'Matchup is not active' });
    }
    if (userId !== matchup.user1Id && userId !== matchup.user2Id) {
      return res.status(403).json({ error: 'Not a participant in this matchup' });
    }
    const opponentId = userId === matchup.user1Id ? matchup.user2Id : matchup.user1Id;
    if (!opponentId) {
      return res.status(400).json({ error: 'No opponent yet' });
    }

    let senderProfile = null;
    if (type === 'voice:invite') {
      const [p] = await db
        .select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      senderProfile = p || null;
    }

    publishBattleEvent(opponentId, {
      type,
      matchupId,
      fromUserId: userId,
      sender: senderProfile,
      payload: payload || null,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('voice/signal error', err);
    return res.status(500).json({ error: 'Failed to relay voice signal' });
  }
}
