/**
 * Optimistic-concurrency persistence for the Rush state machine.
 *
 * Rush state lives as a single JSONB column (`matchups.rushState`). Every
 * action endpoint (accept/pick/continue) AND the `/state` poll tick do a
 * read → roll-forward → mutate → write cycle. Because the Neon HTTP driver
 * has no interactive transactions, two concurrent writers (e.g. a `pick`
 * POST landing while a `/state` poll is mid-flight) could otherwise do a
 * lost update — the later write clobbering the earlier one and changing the
 * round outcome / payout.
 *
 * We guard with a compare-and-swap: the state carries a monotonic `rev`
 * counter; writes only succeed when the row's stored `rev` still matches
 * the value we read (`COALESCE((rushState->>'rev')::int, 0) = prevRev`).
 * On conflict we re-read the fresh state and re-apply the caller's mutator,
 * so no action is ever silently dropped.
 */
const { eq, and, sql } = require('drizzle-orm');
const { db } = require('./db');
const { matchups } = require('../shared/schema');

function revOf(state) {
  if (!state || typeof state !== 'object') return 0;
  const r = Number(state.rev);
  return Number.isFinite(r) ? r : 0;
}

/**
 * Run a guarded read-modify-write against a matchup's rush state.
 *
 * @param {string} matchupId
 * @param {(matchup: object) => ({
 *   next?: object,            // the new rush state to persist
 *   changed?: boolean,        // false ⇒ skip the write (read-only tick)
 *   abort?: boolean,          // true  ⇒ stop, return abort result
 *   status?: number,          // HTTP status to surface on abort
 *   body?: object,            // JSON body to surface on abort
 *   extraSet?: object,        // extra columns to set alongside rushState
 * })} mutate - pure function of the freshly-read matchup row.
 * @param {number} [maxRetries=5]
 * @returns {Promise<{ ok: boolean, changed?: boolean, state?: object,
 *   matchup?: object, abort?: boolean, status?: number, body?: object,
 *   code?: string }>}
 */
async function commitRushMutation(matchupId, mutate, maxRetries = 5) {
  let lastMatchup = null;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const [matchup] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
    if (!matchup) return { ok: false, code: 'not_found' };
    lastMatchup = matchup;

    const result = mutate(matchup) || {};
    if (result.abort) {
      return { ok: false, abort: true, status: result.status, body: result.body, matchup };
    }
    if (!result.next || result.changed === false) {
      return { ok: true, changed: false, state: matchup.rushState, matchup };
    }

    const prevRev = revOf(matchup.rushState);
    const nextState = { ...result.next, rev: prevRev + 1 };
    const setObj = { rushState: nextState, updatedAt: new Date(), ...(result.extraSet || {}) };

    const cond = matchup.rushState == null
      ? and(eq(matchups.id, matchupId), sql`${matchups.rushState} IS NULL`)
      : and(eq(matchups.id, matchupId), sql`COALESCE((${matchups.rushState}->>'rev')::int, 0) = ${prevRev}`);

    const updated = await db.update(matchups).set(setObj).where(cond).returning({ id: matchups.id });
    if (updated.length > 0) {
      return { ok: true, changed: true, state: nextState, matchup };
    }
    // CAS lost — another writer advanced the row. Re-read and re-apply.
  }
  return { ok: false, code: 'conflict', matchup: lastMatchup };
}

module.exports = { commitRushMutation, revOf };
