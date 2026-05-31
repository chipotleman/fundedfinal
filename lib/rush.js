/**
 * Rush 1v1 mini-game logic — pure helpers, no I/O.
 *
 * Rush is a fast best-of-3 head-to-head played entirely on simulated
 * data. The flow mirrors the 8-screen product spec:
 *
 *   accept       → both players ACCEPT the match (screen 2)
 *   confirmed    → "Match confirmed!" 3-2-1 countdown (screen 3)
 *   picking      → each round, both PICK A SIDE (a sport w/ American
 *                  odds) on a ~12s timer (screen 4)
 *   live         → the round plays out: simulated play-by-play drives
 *                  each player's running score (screen 5)
 *   round_result → who took the round, +1 point, CONTINUE (screen 6)
 *   ...loop until a player wins 2 rounds (best of 3)...
 *   completed    → match result, winner takes the pot (screen 7)
 *   cancelled    → safety net if a human ghosts the accept screen
 *
 * Round outcomes are sealed deterministically (see lib/rushSim.js) the
 * instant both players lock a pick, so every state read agrees and a
 * refresh never re-rolls the round. The "live" phase is a purely
 * cosmetic reveal of the already-sealed result based on wall-clock
 * elapsed time — there is no per-tick server scoring.
 */

const {
  buildRoundOptions,
  sealRound,
  makeRng,
} = require('./rushSim');

// --- timing constants -------------------------------------------------

// Accept screen: both players must tap ACCEPT. No auto-accept on
// timeout — if a human ghosts, the stale-cancel below frees the other
// player. Bots auto-accept after BOT_ACCEPT_DELAY_MS.
const ACCEPT_TIMEOUT_MS = 30000; // UI countdown hint on the ACCEPT button
const ACCEPT_STALE_CANCEL_MS = 30000; // hard escape for a ghosted accept
const BOT_ACCEPT_DELAY_MS = 1800;

// "Match confirmed!" countdown before the first pick screen.
const CONFIRM_COUNTDOWN_MS = 3000;

// Pick-a-side timer. On expiry any un-picked player is auto-assigned the
// middle (basketball) option so the round always resolves.
const PICK_DURATION_MS = 12000;
const BOT_PICK_DELAY_MS = 3000;

// How long the round "plays out" before the round-result screen.
const LIVE_DURATION_MS = 12000;

// Round-result screen: both tap CONTINUE. Auto-advances after the
// fallback timer so nobody is ever stuck; bots continue sooner.
const ROUND_RESULT_AUTO_MS = 9000;
const BOT_CONTINUE_DELAY_MS = 2500;

// Best of three.
const ROUNDS_TO_WIN = 2;
const MAX_ROUNDS = 3;

function nowIso() {
  return new Date().toISOString();
}

function ms(iso) {
  return iso ? new Date(iso).getTime() : 0;
}

// --- initial state ----------------------------------------------------

function buildInitialRushState({ hostUserId }) {
  return {
    version: 2,
    phase: 'accept',
    hostUserId,
    acceptStartedAt: nowIso(),
    accepts: {},
    confirmedStartedAt: null,
    roundIndex: 0,
    roundWins: {},
    rounds: [],
    winnerUserId: null,
    winnerType: null,
    completedAt: null,
    cancelledAt: null,
  };
}

function currentRound(state) {
  return state.rounds?.[state.roundIndex] || null;
}

function makeRound(matchupId, index) {
  return {
    index,
    options: buildRoundOptions(matchupId, index),
    picks: {},
    pickStartedAt: nowIso(),
    sealed: false,
    liveStartedAt: null,
    durationMs: LIVE_DURATION_MS,
    players: null,
    roundWinnerId: null,
    roundWinnerType: null,
    resolved: false,
    resultStartedAt: null,
    continues: {},
  };
}

// --- accept phase -----------------------------------------------------

function markAccept(state, userId) {
  if (state.phase !== 'accept') return state;
  if (state.accepts?.[userId]) return state;
  return {
    ...state,
    accepts: { ...(state.accepts || {}), [userId]: nowIso() },
  };
}

function resolveAcceptIfReady(state, { user1Id, user2Id }) {
  if (state.phase !== 'accept') return state;
  const both = !!state.accepts?.[user1Id] && !!state.accepts?.[user2Id];
  if (!both) return state;
  return {
    ...state,
    phase: 'confirmed',
    confirmedStartedAt: nowIso(),
  };
}

// --- confirmed countdown ---------------------------------------------

function advanceConfirmedIfReady(state, { matchupId }) {
  if (state.phase !== 'confirmed') return state;
  if (Date.now() - ms(state.confirmedStartedAt) < CONFIRM_COUNTDOWN_MS) return state;
  const round = makeRound(matchupId, 0);
  return {
    ...state,
    phase: 'picking',
    roundIndex: 0,
    rounds: [round],
  };
}

// --- picking phase ----------------------------------------------------

function applyPick(state, userId, optionKey) {
  if (state.phase !== 'picking') return state;
  const round = currentRound(state);
  if (!round) return state;
  if (round.picks?.[userId]) return state;
  const valid = round.options.some((o) => o.key === optionKey);
  if (!valid) return state;
  const rounds = state.rounds.slice();
  rounds[state.roundIndex] = {
    ...round,
    picks: { ...(round.picks || {}), [userId]: optionKey },
  };
  return { ...state, rounds };
}

function defaultPickKey(round) {
  // Middle option (basketball) is the neutral default for a player who
  // let the pick timer run out.
  return round.options[1]?.key || round.options[0]?.key;
}

function resolvePickingIfReady(state, { matchupId, user1Id, user2Id }) {
  if (state.phase !== 'picking') return state;
  const round = currentRound(state);
  if (!round) return state;

  const bothPicked = !!round.picks?.[user1Id] && !!round.picks?.[user2Id];
  const expired = Date.now() - ms(round.pickStartedAt) >= PICK_DURATION_MS;
  if (!bothPicked && !expired) return state;

  // Fill any missing pick with the neutral default so the round seals.
  const picks = { ...(round.picks || {}) };
  for (const uid of [user1Id, user2Id]) {
    if (!picks[uid]) picks[uid] = defaultPickKey(round);
  }

  const sealed = sealRound({
    matchupId,
    roundIndex: round.index,
    user1Id,
    user2Id,
    options: round.options,
    picks,
  });

  const rounds = state.rounds.slice();
  rounds[state.roundIndex] = {
    ...round,
    picks,
    sealed: true,
    liveStartedAt: nowIso(),
    durationMs: LIVE_DURATION_MS,
    players: sealed.players,
    roundWinnerId: sealed.roundWinnerId,
    roundWinnerType: sealed.roundWinnerType,
  };
  return { ...state, phase: 'live', rounds };
}

// --- live phase -------------------------------------------------------

function advanceLiveIfReady(state) {
  if (state.phase !== 'live') return state;
  const round = currentRound(state);
  if (!round) return state;
  const elapsed = Date.now() - ms(round.liveStartedAt);
  if (elapsed < (round.durationMs || LIVE_DURATION_MS)) return state;

  const roundWins = { ...(state.roundWins || {}) };
  if (!round.resolved && round.roundWinnerId) {
    roundWins[round.roundWinnerId] = (roundWins[round.roundWinnerId] || 0) + 1;
  }
  const rounds = state.rounds.slice();
  rounds[state.roundIndex] = {
    ...round,
    resolved: true,
    resultStartedAt: nowIso(),
  };
  return {
    ...state,
    phase: 'round_result',
    roundWins,
    rounds,
  };
}

// --- round_result phase ----------------------------------------------

function markContinue(state, userId) {
  if (state.phase !== 'round_result') return state;
  const round = currentRound(state);
  if (!round) return state;
  if (round.continues?.[userId]) return state;
  const rounds = state.rounds.slice();
  rounds[state.roundIndex] = {
    ...round,
    continues: { ...(round.continues || {}), [userId]: nowIso() },
  };
  return { ...state, rounds };
}

function matchDecided(state, { user1Id, user2Id }) {
  const w1 = state.roundWins?.[user1Id] || 0;
  const w2 = state.roundWins?.[user2Id] || 0;
  if (w1 >= ROUNDS_TO_WIN || w2 >= ROUNDS_TO_WIN) return true;
  if (state.roundIndex + 1 >= MAX_ROUNDS) return true;
  return false;
}

function totalPoints(state, uid) {
  let sum = 0;
  for (const r of state.rounds || []) {
    const p = r.players?.[uid];
    if (p?.finalScore) sum += p.finalScore;
  }
  return sum;
}

function completeMatch(state, { user1Id, user2Id }) {
  const w1 = state.roundWins?.[user1Id] || 0;
  const w2 = state.roundWins?.[user2Id] || 0;
  let winnerUserId;
  let winnerType;
  if (w1 > w2) {
    winnerUserId = user1Id;
    winnerType = 'user1';
  } else if (w2 > w1) {
    winnerUserId = user2Id;
    winnerType = 'user2';
  } else {
    // Round wins tied (shouldn't happen in bo3, but guard): break by
    // total points, then host.
    const t1 = totalPoints(state, user1Id);
    const t2 = totalPoints(state, user2Id);
    if (t2 > t1) {
      winnerUserId = user2Id;
      winnerType = 'user2';
    } else {
      winnerUserId = user1Id;
      winnerType = 'user1';
    }
  }
  return {
    ...state,
    phase: 'completed',
    winnerUserId,
    winnerType,
    completedAt: nowIso(),
  };
}

function resolveRoundResultIfReady(state, ctx) {
  if (state.phase !== 'round_result') return state;
  const round = currentRound(state);
  if (!round) return state;

  const bothContinued = !!round.continues?.[ctx.user1Id] && !!round.continues?.[ctx.user2Id];
  const expired = Date.now() - ms(round.resultStartedAt) >= ROUND_RESULT_AUTO_MS;
  if (!bothContinued && !expired) return state;

  if (matchDecided(state, ctx)) {
    return completeMatch(state, ctx);
  }

  const nextIndex = state.roundIndex + 1;
  const next = makeRound(ctx.matchupId, nextIndex);
  const rounds = state.rounds.slice();
  rounds[nextIndex] = next;
  return {
    ...state,
    phase: 'picking',
    roundIndex: nextIndex,
    rounds,
  };
}

// --- stale-cancel (ghosted accept) -----------------------------------

function shouldCancelStaleAccept(state) {
  if (state.phase !== 'accept') return false;
  if (!state.acceptStartedAt) return false;
  return Date.now() - ms(state.acceptStartedAt) >= ACCEPT_STALE_CANCEL_MS;
}

function cancelStaleMatchup(state) {
  return {
    ...state,
    phase: 'cancelled',
    cancelledAt: nowIso(),
  };
}

// --- forward roll -----------------------------------------------------

// Run every pure transition in order until the state stops changing.
// All steps are idempotent so this is safe to call on every read/write.
function rollForward(state, ctx) {
  let next = state;
  for (let i = 0; i < MAX_ROUNDS * 4 + 6; i += 1) {
    let s = next;
    s = resolveAcceptIfReady(s, ctx);
    s = advanceConfirmedIfReady(s, ctx);
    s = resolvePickingIfReady(s, ctx);
    s = advanceLiveIfReady(s);
    s = resolveRoundResultIfReady(s, ctx);
    if (s === next) break;
    next = s;
  }
  return next;
}

// --- bot automation ---------------------------------------------------

function applyBotAutomation(state, matchup) {
  if (!matchup?.isFakeOpponent) return state;
  const botId = matchup.user2Id;
  if (!botId) return state;

  if (state.phase === 'accept') {
    if (state.accepts?.[botId]) return state;
    if (Date.now() - ms(state.acceptStartedAt) >= BOT_ACCEPT_DELAY_MS) {
      return markAccept(state, botId);
    }
    return state;
  }

  if (state.phase === 'picking') {
    const round = currentRound(state);
    if (!round || round.picks?.[botId]) return state;
    if (Date.now() - ms(round.pickStartedAt) < BOT_PICK_DELAY_MS) return state;
    // Deterministic seeded pick so multiple reads agree.
    const rng = makeRng(`${matchup.id}|botpick|${round.index}`);
    const choice = round.options[Math.floor(rng() * round.options.length)] || round.options[0];
    return applyPick(state, botId, choice.key);
  }

  if (state.phase === 'round_result') {
    const round = currentRound(state);
    if (!round || round.continues?.[botId]) return state;
    if (Date.now() - ms(round.resultStartedAt) < BOT_CONTINUE_DELAY_MS) return state;
    return markContinue(state, botId);
  }

  return state;
}

// --- public view (client projection) ---------------------------------

function deadlineFrom(startedAt, durationMs) {
  return startedAt ? new Date(ms(startedAt) + durationMs).toISOString() : null;
}

function projectRound(round, { phase, viewerId, opponentId }) {
  if (!round) return null;
  const revealed = phase === 'live' || phase === 'round_result' || phase === 'completed';
  const out = {
    index: round.index,
    options: round.options,
    pickStartedAt: round.pickStartedAt,
    pickDeadline: deadlineFrom(round.pickStartedAt, PICK_DURATION_MS),
    pickDurationMs: PICK_DURATION_MS,
    myPick: round.picks?.[viewerId] || null,
    oppPicked: !!round.picks?.[opponentId],
    liveStartedAt: round.liveStartedAt,
    liveDeadline: deadlineFrom(round.liveStartedAt, round.durationMs || LIVE_DURATION_MS),
    durationMs: round.durationMs || LIVE_DURATION_MS,
    roundWinnerId: revealed ? round.roundWinnerId : null,
    roundWinnerType: revealed ? round.roundWinnerType : null,
    resultStartedAt: round.resultStartedAt,
    resultAutoMs: ROUND_RESULT_AUTO_MS,
    continues: round.continues || {},
    myContinued: !!round.continues?.[viewerId],
    oppContinued: !!round.continues?.[opponentId],
  };
  if (revealed) {
    // Full picks + sealed performance are safe to expose once the round
    // is live (it's already decided; no further input).
    out.picks = round.picks || {};
    out.players = round.players || null;
  }
  return out;
}

function publicView(state, { user1Id, user2Id, viewerId }) {
  if (!state) return null;
  const opponentId = viewerId === user1Id ? user2Id : user1Id;
  const round = currentRound(state);

  const roundsSummary = (state.rounds || []).map((r) => ({
    index: r.index,
    sealed: !!r.sealed,
    resolved: !!r.resolved,
    roundWinnerId: r.resolved ? r.roundWinnerId : null,
    scores: r.players
      ? {
          [user1Id]: r.players[user1Id]?.finalScore ?? null,
          [user2Id]: r.players[user2Id]?.finalScore ?? null,
        }
      : null,
  }));

  return {
    version: 2,
    phase: state.phase,
    hostUserId: state.hostUserId,

    // accept
    accepts: state.accepts || {},
    myAccepted: !!state.accepts?.[viewerId],
    oppAccepted: !!state.accepts?.[opponentId],
    acceptStartedAt: state.acceptStartedAt,
    acceptDeadline: deadlineFrom(state.acceptStartedAt, ACCEPT_TIMEOUT_MS),
    acceptTimeoutMs: ACCEPT_TIMEOUT_MS,

    // confirmed countdown
    confirmedStartedAt: state.confirmedStartedAt,
    confirmCountdownMs: CONFIRM_COUNTDOWN_MS,
    confirmDeadline: deadlineFrom(state.confirmedStartedAt, CONFIRM_COUNTDOWN_MS),

    // best of 3
    roundIndex: state.roundIndex || 0,
    roundsToWin: ROUNDS_TO_WIN,
    maxRounds: MAX_ROUNDS,
    roundWins: state.roundWins || {},
    round: projectRound(round, { phase: state.phase, viewerId, opponentId }),
    rounds: roundsSummary,

    // result
    winnerUserId: state.winnerUserId || null,
    winnerType: state.winnerType || null,
    completedAt: state.completedAt || null,
    cancelledAt: state.cancelledAt || null,

    user1Id,
    user2Id,
    viewerId,
    opponentId,
  };
}

module.exports = {
  // constants
  ACCEPT_TIMEOUT_MS,
  ACCEPT_STALE_CANCEL_MS,
  BOT_ACCEPT_DELAY_MS,
  CONFIRM_COUNTDOWN_MS,
  PICK_DURATION_MS,
  BOT_PICK_DELAY_MS,
  LIVE_DURATION_MS,
  ROUND_RESULT_AUTO_MS,
  BOT_CONTINUE_DELAY_MS,
  ROUNDS_TO_WIN,
  MAX_ROUNDS,
  // builders
  buildInitialRushState,
  // actions
  markAccept,
  applyPick,
  markContinue,
  // transitions
  resolveAcceptIfReady,
  advanceConfirmedIfReady,
  resolvePickingIfReady,
  advanceLiveIfReady,
  resolveRoundResultIfReady,
  rollForward,
  // bot + projection
  applyBotAutomation,
  publicView,
  // stale-cancel
  shouldCancelStaleAccept,
  cancelStaleMatchup,
  // helpers
  currentRound,
};
