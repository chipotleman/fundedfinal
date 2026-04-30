/**
 * POST /api/battles/rush/:matchupId/ready
 *
 * Marks the current viewer as ready during the ready_check phase. The
 * matchup advances to 'playing' ONLY when both players have explicitly
 * marked themselves ready — there is no auto-advance on a timeout, so
 * one player can never ambush the other before they're paying
 * attention. If a human stalls, the opponent's escape valve is the
 * standard forfeit endpoint.
 *
 * Bot opponents are auto-readied here too (3s after the ready_check
 * phase started) so the human never has to wait on a fake opponent.
 * The state endpoint also handles bot auto-ready as a backstop in
 * case this endpoint is never hit.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups } from '../../../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
const {
  buildInitialRushState,
  resolveVotingIfReady,
  markReady,
  resolveReadyIfReady,
  advanceIfReady,
  shouldCancelStaleReady,
  cancelStaleMatchup,
  BOT_READY_DELAY_MS,
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
    if (matchup.status === 'cancelled') {
      return res.status(409).json({ error: 'Matchup already cancelled', phase: 'cancelled' });
    }

    // Resolved once outside the transaction since user1Id/user2Id are
    // immutable for the lifetime of a matchup.
    const ctx = { user1Id: matchup.user1Id, user2Id: matchup.user2Id };

    // Run the read-modify-write inside a transaction with SELECT FOR
    // UPDATE so two concurrent Ready POSTs (one per participant) are
    // serialized — without this, both could load the same snapshot,
    // each merge only their own readyVotes entry, and the last writer
    // would silently drop the other player's ready vote. The row lock
    // also prevents us from clobbering a concurrent state.js
    // cancellation (its conditional UPDATE will then race-lose, and
    // we'll see the cancelled state on our locked re-read instead).
    const result = await db.transaction(async (tx) => {
      const lockedRows = await tx.execute(
        sql`SELECT * FROM matchups WHERE id = ${matchupId} FOR UPDATE`
      );
      const fresh = lockedRows.rows?.[0] || lockedRows[0];
      if (!fresh) return { kind: 'not_found' };
      // Drizzle's raw execute returns snake_case columns from PG. Normalize the few we touch.
      const lockedStatus = fresh.status;
      const lockedRushState = fresh.rush_state ?? fresh.rushState;
      if (lockedStatus === 'completed') {
        return { kind: 'http', code: 409, body: { error: 'Matchup already completed' } };
      }
      if (lockedStatus === 'cancelled') {
        return { kind: 'http', code: 409, body: { error: 'Matchup already cancelled', phase: 'cancelled' } };
      }

      let state = lockedRushState || buildInitialRushState({ hostUserId: matchup.user1Id });

      // Roll forward voting -> ready_check first if needed.
      state = resolveVotingIfReady(state, ctx);

      // Backfill missing readyStartedAt for legacy states so the
      // stale-cancel gate below can ever fire on them.
      if (state.phase === 'ready_check' && !state.readyStartedAt) {
        state = { ...state, readyStartedAt: new Date().toISOString() };
      }

      // Cancel-aware: if ready_check has been stuck past the stale
      // threshold, persist the cancellation instead of accepting the
      // ready vote. A human who tapped Ready 31s late shouldn't be
      // able to push the matchup to 'playing' against a ghost opponent.
      if (shouldCancelStaleReady(state)) {
        const cancelled = cancelStaleMatchup(state);
        await tx
          .update(matchups)
          .set({ rushState: cancelled, status: 'cancelled', endsAt: new Date(), updatedAt: new Date() })
          .where(eq(matchups.id, matchupId));
        return { kind: 'cancelled' };
      }

      if (state.phase !== 'ready_check' && state.phase !== 'playing') {
        return { kind: 'http', code: 409, body: { error: 'Not in ready_check phase', phase: state.phase } };
      }

      if (state.phase === 'ready_check') {
        state = markReady(state, userId);

        // Auto-ready the bot once the ready_check phase has been live
        // long enough — the human tapping Ready immediately shouldn't
        // bypass the brief pause that lets the rules slide breathe.
        if (matchup.isFakeOpponent) {
          const botId = matchup.user2Id;
          if (botId && botId !== userId && !state.readyVotes?.[botId]) {
            const startedAt = state.readyStartedAt
              ? new Date(state.readyStartedAt).getTime()
              : Date.now();
            if (Date.now() - startedAt >= BOT_READY_DELAY_MS) {
              state = markReady(state, botId);
            }
          }
        }

        state = resolveReadyIfReady(state, ctx);
      }

      state = advanceIfReady(state, ctx);

      await tx
        .update(matchups)
        .set({ rushState: state, updatedAt: new Date() })
        .where(eq(matchups.id, matchupId));

      return { kind: 'ok', state };
    });

    if (result.kind === 'not_found') return res.status(404).json({ error: 'Matchup not found' });
    if (result.kind === 'http') return res.status(result.code).json(result.body);

    if (result.kind === 'cancelled') {
      try {
        const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
        publishBattleEvent(recipients, {
          type: 'matchup:rush:update',
          matchupId,
          phase: 'cancelled',
        });
      } catch (_e) {}
      return res.status(409).json({ error: 'Matchup cancelled (opponent did not ready)', phase: 'cancelled' });
    }

    const finalState = result.state;
    const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
    publishBattleEvent(recipients, {
      type: 'matchup:rush:update',
      matchupId,
      phase: finalState.phase,
      currentQuestionIndex: finalState.currentQuestionIndex,
    });

    return res.status(200).json({ success: true, phase: finalState.phase });
  } catch (err) {
    console.error('[rush/ready] error:', err);
    return res.status(500).json({ error: 'Failed to mark ready' });
  }
}
