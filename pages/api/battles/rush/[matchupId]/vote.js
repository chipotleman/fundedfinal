/**
 * POST /api/battles/rush/:matchupId/vote
 * Body: { gameId, gameSnapshot }
 *
 * Records the viewer's pick during the voting phase. The actual
 * voting-resolution logic (host wins ties; both voted = advance; vote
 * timeout = whichever single player picked) lives in lib/rush.js and
 * runs on every /state read, but we trigger it eagerly here so the
 * SSE-triggered refetch picks up the freshly-resolved 'playing' state
 * with no extra round-trip.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups } from '../../../../../shared/schema';
import { eq } from 'drizzle-orm';
const {
  buildInitialRushState,
  resolveVotingIfReady,
  resolveReadyIfReady,
  advanceIfReady,
} = require('../../../../../lib/rush');
const { publishBattleEvent } = require('../../../../../lib/battle-events');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const { matchupId } = req.query;
  const { gameId, gameSnapshot } = req.body || {};

  if (!gameId || !gameSnapshot) {
    return res.status(400).json({ error: 'gameId and gameSnapshot required' });
  }

  try {
    const [matchup] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
    if (!matchup) return res.status(404).json({ error: 'Matchup not found' });
    if (matchup.user1Id !== userId && matchup.user2Id !== userId) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    if (matchup.durationType !== 'rush') {
      return res.status(400).json({ error: 'Not a rush matchup' });
    }
    if (matchup.status === 'completed') {
      return res.status(409).json({ error: 'Matchup already completed' });
    }

    let state = matchup.rushState || buildInitialRushState({ hostUserId: matchup.user1Id });
    if (state.phase !== 'voting') {
      return res.status(409).json({ error: 'Voting phase already ended' });
    }

    const newVotes = {
      ...(state.gameVotes || {}),
      [userId]: { gameId: String(gameId), gameSnapshot, votedAt: new Date().toISOString() },
    };

    // Bot opponents auto-vote for the same live game the human picked,
    // so the matchup never stalls in the voting phase against a fake
    // opponent. The human is always user1 for matchmaking-assigned
    // bots, so user2Id is the bot id.
    if (matchup.isFakeOpponent) {
      const botId = matchup.user2Id;
      if (botId && botId !== userId && !newVotes[botId]) {
        newVotes[botId] = {
          gameId: String(gameId),
          gameSnapshot,
          votedAt: new Date().toISOString(),
        };
      }
    }

    state = { ...state, gameVotes: newVotes };

    const ctx = { user1Id: matchup.user1Id, user2Id: matchup.user2Id };
    state = resolveVotingIfReady(state, ctx);
    state = resolveReadyIfReady(state, ctx);
    state = advanceIfReady(state, ctx);

    await db.update(matchups).set({ rushState: state, updatedAt: new Date() }).where(eq(matchups.id, matchupId));

    const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
    publishBattleEvent(recipients, {
      type: 'matchup:rush:update',
      matchupId,
      phase: state.phase,
      currentQuestionIndex: state.currentQuestionIndex,
    });

    return res.status(200).json({ success: true, phase: state.phase });
  } catch (err) {
    console.error('[rush/vote] error:', err);
    return res.status(500).json({ error: 'Failed to record vote' });
  }
}
