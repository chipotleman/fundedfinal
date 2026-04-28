/**
 * GET /api/battles/rush/:matchupId/state
 *
 * Returns the current Rush mini-game state for a matchup, with the
 * current viewer's perspective applied (correct answers hidden for
 * questions still in flight).
 *
 * This endpoint is also the workhorse "tick" — every read advances the
 * server-authoritative timer if the active question's deadline has
 * passed (or if both players have answered). When the 6th question is
 * graded, the matchup is settled here (winner declared, payout written,
 * SSE matchup:end fan-out fired) so the existing /battle page result
 * popup picks up the rush completion through the same plumbing as
 * regular matchups.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups } from '../../../../../shared/schema';
import { eq } from 'drizzle-orm';
const {
  buildInitialRushState,
  resolveVotingIfReady,
  advanceIfReady,
  publicView,
} = require('../../../../../lib/rush');
const { settleRushMatchup } = require('../../../../../lib/rushSettlement');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const { matchupId } = req.query;

  try {
    const [matchup] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
    if (!matchup) return res.status(404).json({ error: 'Matchup not found' });
    if (matchup.user1Id !== userId && matchup.user2Id !== userId) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    if (matchup.durationType !== 'rush') {
      return res.status(400).json({ error: 'Not a rush matchup' });
    }

    const ctx = { user1Id: matchup.user1Id, user2Id: matchup.user2Id };
    let state = matchup.rushState;

    // Lazy-init: the rushState column is null until the first state read.
    // Anchoring init here (rather than at matchup creation) keeps the
    // matchmaking endpoints untouched.
    if (!state) {
      state = buildInitialRushState({ hostUserId: matchup.user1Id });
      await db.update(matchups).set({ rushState: state, updatedAt: new Date() }).where(eq(matchups.id, matchupId));
    }

    // Roll forward through any expired phases. Both helpers are pure and
    // idempotent — running them on every read is cheap.
    let next = resolveVotingIfReady(state, ctx);
    next = advanceIfReady(next, ctx);

    if (JSON.stringify(next) !== JSON.stringify(state)) {
      await db.update(matchups).set({ rushState: next, updatedAt: new Date() }).where(eq(matchups.id, matchupId));
      state = next;
    }

    // If we just transitioned to 'completed' and the matchup hasn't been
    // settled yet, settle it now. settleRushMatchup is idempotent.
    if (state.phase === 'completed' && matchup.status !== 'completed') {
      await settleRushMatchup(matchup.id);
    }

    const view = publicView(state, { ...ctx, viewerId: userId });
    return res.status(200).json({
      matchup: {
        id: matchup.id,
        user1Id: matchup.user1Id,
        user2Id: matchup.user2Id,
        startingBalance: matchup.startingBalance,
        potSize: matchup.potSize,
        winnerPayout: matchup.winnerPayout,
        durationType: matchup.durationType,
        status: state.phase === 'completed' ? 'completed' : matchup.status,
        winnerId: matchup.winnerId,
        winnerType: matchup.winnerType,
      },
      rush: view,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[rush/state] error:', err);
    return res.status(500).json({ error: 'Failed to load rush state' });
  }
}
