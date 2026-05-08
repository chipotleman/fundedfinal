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
 *
 * Bot opponents are also driven from this endpoint: if the matchup is
 * against a fake opponent, the bot is auto-readied (3s after the
 * ready_check phase opens) and auto-answers each question after a
 * randomized 4–12s delay so the human never sits waiting on a stub.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups, profiles } from '../../../../../shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
const {
  buildInitialRushState,
  resolveVotingIfReady,
  markReady,
  resolveReadyIfReady,
  advanceIfReady,
  gradeAnswer,
  publicView,
  shouldCancelStaleReady,
  cancelStaleMatchup,
  BOT_READY_DELAY_MS,
  QUESTION_DURATION_MS,
} = require('../../../../../lib/rush');
const { settleRushMatchup } = require('../../../../../lib/rushSettlement');
const { publishBattleEvent } = require('../../../../../lib/battle-events');

// Bot answer delay window — kept tight so the human isn't watching
// "OPP …" sit there for 10s after they've already locked in. Bot
// still takes long enough to feel like it's "thinking" and not auto.
const BOT_ANSWER_MIN_MS = 1500;
const BOT_ANSWER_MAX_MS = 4000;

function applyBotAutomation(state, matchup) {
  if (!matchup?.isFakeOpponent) return state;
  const botId = matchup.user2Id;
  if (!botId) return state;

  // Apply a delayed bot vote (queued by /vote). The 3–5s pause makes
  // the bot's pick feel human — the player sees their own check land
  // first, then the bot's badge animates in a moment later instead of
  // both flashing in at the same instant.
  if (state.phase === 'voting' && state.pendingBotVote) {
    const pv = state.pendingBotVote;
    const applyAt = pv.applyAt ? new Date(pv.applyAt).getTime() : 0;
    if (Date.now() >= applyAt && pv.botId === botId && !state.gameVotes?.[botId]) {
      const newVotes = {
        ...(state.gameVotes || {}),
        [botId]: {
          gameId: pv.gameId,
          gameSnapshot: pv.gameSnapshot,
          votedAt: new Date().toISOString(),
        },
      };
      const { pendingBotVote, ...rest } = state;
      return { ...rest, gameVotes: newVotes };
    }
  }

  // Auto-ready the bot 3s after ready_check began.
  if (state.phase === 'ready_check') {
    const startedAt = state.readyStartedAt
      ? new Date(state.readyStartedAt).getTime()
      : Date.now();
    if (Date.now() - startedAt >= BOT_READY_DELAY_MS && !state.readyVotes?.[botId]) {
      return markReady(state, botId);
    }
    return state;
  }

  // Auto-answer the current question after a randomized delay.
  if (state.phase === 'playing') {
    const idx = state.currentQuestionIndex;
    const question = state.questions?.[idx];
    if (!question) return state;
    const existing = state.answers?.[botId]?.[question.id];
    if (existing) return state;

    const startedAt = state.questionStartedAt
      ? new Date(state.questionStartedAt).getTime()
      : Date.now();
    const elapsed = Date.now() - startedAt;
    if (elapsed < BOT_ANSWER_MIN_MS) return state;

    // Deterministic delay per question so multiple state reads agree
    // on when the bot "answers" — derived from the question id so it
    // doesn't shift between polls on the same question.
    const seed = (question.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const rng = (seed % 1000) / 1000; // 0..1
    const delay = BOT_ANSWER_MIN_MS + rng * (BOT_ANSWER_MAX_MS - BOT_ANSWER_MIN_MS);
    if (elapsed < delay) return state;

    const optionKeys = (question.options || []).map(o => o.key);
    if (optionKeys.length === 0) return state;
    // Bot picks "randomly" — but seeded per question id so multiple
    // reads on the same question pick the same answer (preventing
    // race-condition flickering between polls).
    const pickIdx = (seed + 7) % optionKeys.length;
    const botPick = optionKeys[pickIdx];
    const graded = gradeAnswer(question, botPick, elapsed);
    return {
      ...state,
      answers: {
        ...state.answers,
        [botId]: {
          ...(state.answers?.[botId] || {}),
          [question.id]: graded,
        },
      },
    };
  }

  return state;
}

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
    if (!state) {
      state = buildInitialRushState({ hostUserId: matchup.user1Id });
      await db.update(matchups).set({ rushState: state, updatedAt: new Date() }).where(eq(matchups.id, matchupId));
    }

    // Backfill: very old ready_check states from before stale-cancel
    // shipped may not have a readyStartedAt timestamp. Without it the
    // stale-cancel timer never starts, so a user could still be stuck
    // forever. If we land in ready_check with no startedAt, set it now
    // so the timer begins from this poll instead of never. New states
    // get this set inside resolveVotingIfReady.
    if (state.phase === 'ready_check' && !state.readyStartedAt) {
      state = { ...state, readyStartedAt: new Date().toISOString() };
    }

    // Roll forward through any expired phases. All helpers are pure and
    // idempotent — running them on every read is cheap.
    let next = resolveVotingIfReady(state, ctx);
    next = applyBotAutomation(next, matchup);
    // The bot vote may have just landed — re-resolve voting so we
    // transition to ready_check in the same tick instead of waiting
    // an extra poll cycle.
    next = resolveVotingIfReady(next, ctx);
    next = resolveReadyIfReady(next, ctx);
    next = applyBotAutomation(next, matchup);
    next = advanceIfReady(next, ctx);
    // Hard escape: if the ready_check has been stuck for too long
    // (opponent ghosted), auto-cancel so the user isn't trapped on the
    // ready screen forever. Bot opponents auto-ready well before this
    // fires, so this only matters for human-vs-human.
    const wantsCancel = shouldCancelStaleReady(next);
    if (wantsCancel) {
      next = cancelStaleMatchup(next);
    }

    const stateChanged = JSON.stringify(next) !== JSON.stringify(state);

    if (wantsCancel) {
      // Race-safe cancellation: only commit if the on-disk row is still
      // in ready_check (i.e. a concurrent /ready POST hasn't just
      // advanced us to 'playing'). The conditional WHERE prevents us
      // from clobbering a legitimate playing/completed/cancelled row
      // with a stale snapshot. If the row already moved on, we re-read
      // and use that as the source of truth.
      const updated = await db
        .update(matchups)
        .set({ rushState: next, status: 'cancelled', endsAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(matchups.id, matchupId),
          sql`${matchups.rushState}->>'phase' = 'ready_check'`,
        ))
        .returning({ id: matchups.id });
      if (updated.length > 0) {
        state = next;
        // Reflect the persisted status locally so the JSON response
        // we build below is internally consistent (rush.phase ===
        // 'cancelled' AND matchup.status === 'cancelled').
        matchup.status = 'cancelled';
        try {
          const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
          publishBattleEvent(recipients, {
            type: 'matchup:rush:update',
            matchupId,
            phase: 'cancelled',
          });
        } catch (_e) {}
      } else {
        // Concurrent advance won — re-read and use that.
        const [fresh] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
        if (fresh) {
          matchup.status = fresh.status;
          matchup.rushState = fresh.rushState;
          state = fresh.rushState || state;
        }
      }
    } else if (stateChanged) {
      await db.update(matchups).set({ rushState: next, updatedAt: new Date() }).where(eq(matchups.id, matchupId));
      state = next;
    }

    // If we just transitioned to 'completed' and the matchup hasn't been
    // settled yet, settle it now. settleRushMatchup is idempotent.
    if (state.phase === 'completed' && matchup.status !== 'completed') {
      await settleRushMatchup(matchup.id);
    }

    const view = publicView(state, { ...ctx, viewerId: userId });

    // Surface lightweight player profiles so the rush voting overlay
    // can render a real "VS lobby" header (avatars + usernames) for
    // both players. Without this the overlay can only label slots
    // "YOU"/"OPP" — fine for state badges but bland as a lobby.
    const playerIds = [matchup.user1Id, matchup.user2Id].filter(Boolean);
    let player1 = null;
    let player2 = null;
    if (playerIds.length > 0) {
      try {
        const rows = await db
          .select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
          .from(profiles)
          .where(inArray(profiles.id, playerIds));
        player1 = rows.find(r => r.id === matchup.user1Id) || null;
        player2 = rows.find(r => r.id === matchup.user2Id) || null;
      } catch (_e) {}
    }
    if (matchup.isFakeOpponent && !player2 && matchup.user2Id) {
      // Bot opponent fallback — give the lobby something to render.
      player2 = { id: matchup.user2Id, username: 'Bot Opponent', avatar: null };
    }

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
        isFakeOpponent: !!matchup.isFakeOpponent,
        player1,
        player2,
      },
      rush: view,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[rush/state] error:', err);
    return res.status(500).json({ error: 'Failed to load rush state' });
  }
}
