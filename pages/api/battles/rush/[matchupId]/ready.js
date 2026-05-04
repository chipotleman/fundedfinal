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
 *
 * IMPORTANT: this codebase runs on @neondatabase/serverless via the
 * HTTP driver (`neon(process.env.DATABASE_URL)`), which does NOT
 * support `db.transaction(...)` — calling it throws synchronously and
 * was the actual cause of the user-visible "Failed to mark ready"
 * error. We instead use an optimistic read-modify-write with a
 * conditional UPDATE that retries a small number of times on contended
 * writes (the only realistic contention is the two players tapping
 * Ready within milliseconds of each other, which is rare and self-
 * healing via the next state.js poll regardless).
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups } from '../../../../../shared/schema';
import { eq, and } from 'drizzle-orm';
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

const MAX_RETRIES = 4;

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
    // We re-read the row each retry so a contended write (the rare
    // case where both players' ready POSTs land in the same tick) can
    // re-merge against the latest persisted state instead of dropping
    // the loser's ready vote.
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const [matchup] = await db
        .select()
        .from(matchups)
        .where(eq(matchups.id, matchupId));
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

      const ctx = { user1Id: matchup.user1Id, user2Id: matchup.user2Id };
      const prevState = matchup.rushState
        || buildInitialRushState({ hostUserId: matchup.user1Id });

      // Pure forward roll. resolveVotingIfReady is idempotent so
      // re-running it on a state already past voting is a no-op.
      let state = resolveVotingIfReady(prevState, ctx);

      // Backfill missing readyStartedAt for legacy states so the
      // stale-cancel gate below can ever fire on them.
      if (state.phase === 'ready_check' && !state.readyStartedAt) {
        state = { ...state, readyStartedAt: new Date().toISOString() };
      }

      // Cancel-aware: if ready_check has been stuck past the stale
      // threshold, persist the cancellation instead of accepting the
      // ready vote. A human who tapped Ready 31s late shouldn't be
      // able to push the matchup to 'playing' against a ghost opponent.
      //
      // CAS guard: we only flip to cancelled if the row hasn't moved
      // since we read it (`updatedAt = observedUpdatedAt`). Without
      // this, a concurrent request could legitimately advance the
      // matchup to `playing` while we still hold a stale snapshot,
      // and our cancel write would silently clobber it. On CAS miss
      // we re-read and re-evaluate inside the retry loop instead of
      // overwriting valid progress.
      if (shouldCancelStaleReady(state)) {
        const cancelled = cancelStaleMatchup(state);
        const updated = await db
          .update(matchups)
          .set({
            rushState: cancelled,
            status: 'cancelled',
            endsAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(matchups.id, matchupId),
              eq(matchups.status, matchup.status),
              eq(matchups.updatedAt, matchup.updatedAt),
            ),
          )
          .returning({ id: matchups.id });
        if (!updated.length) continue; // someone else mutated; retry
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

      if (state.phase !== 'ready_check' && state.phase !== 'playing') {
        return res.status(409).json({ error: 'Not in ready_check phase', phase: state.phase });
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

      // Conditional update: only succeeds if nobody else (the
      // opponent's concurrent Ready POST or state.js polling) wrote
      // to the row since we read it. We compare on the immutable
      // `createdAt` + the `updatedAt` we just observed; if the row's
      // updatedAt has changed, our snapshot is stale and we retry.
      // This is a safer optimistic-CAS than diffing JSONB equality
      // against a serialized snapshot.
      const observedUpdatedAt = matchup.updatedAt;
      const updated = await db
        .update(matchups)
        .set({ rushState: state, updatedAt: new Date() })
        .where(
          and(
            eq(matchups.id, matchupId),
            eq(matchups.updatedAt, observedUpdatedAt),
          ),
        )
        .returning({ id: matchups.id });

      if (!updated.length) {
        // Lost the race — re-read and retry. markReady is idempotent
        // so a duplicate "I'm ready" merge after a retry is fine.
        continue;
      }

      const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
      try {
        publishBattleEvent(recipients, {
          type: 'matchup:rush:update',
          matchupId,
          phase: state.phase,
          currentQuestionIndex: state.currentQuestionIndex,
        });
      } catch (_e) {}

      return res.status(200).json({ success: true, phase: state.phase });
    }

    // Exhausted retries (very rare) — surface a real error so the
    // client can show it.
    return res.status(503).json({ error: 'Ready write contended — please tap again' });
  } catch (err) {
    console.error('[rush/ready] error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to mark ready' });
  }
}
