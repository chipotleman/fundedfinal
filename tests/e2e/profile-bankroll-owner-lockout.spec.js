/**
 * Behavioural regression test for task #393: a signed-in regular user
 * must NOT be able to mutate financial / settlement fields on their
 * own profile by PATCHing `/api/profiles/{me}`. The legitimate way to
 * (re)initialize a bankroll is `POST /api/challenges/start`, which
 * derives the new value from a server-side `userChallenges` row owned
 * by the caller — never from the request body.
 *
 * Before #393 the owner allow-list in `pages/api/profiles/[id].ts`
 * silently included every field this suite tries to mutate
 * (`bankroll`, `pnl`, `betsHistory`, `totalBets`, `winRate`,
 * `dailyLoss`, `lastBetDate`, `bettingDays`, `profileStats`,
 * `status`, `profitTarget`, `maxDailyLoss`, `challenge`,
 * `challengeStartDate`, `challengePhase`, `achievements`). Any
 * signed-in user could PATCH their own profile with `{ bankroll:
 * 999999 }` and have it persisted as-is — effectively a self-reset.
 *
 * What this suite does:
 *
 *   1. Seeds a fresh non-admin profile row with known starting values
 *      for every financial field (`STARTING_FINANCIAL_STATE`).
 *   2. Mints a real NextAuth v4 JWT session cookie for that user
 *      using the server's `NEXTAUTH_SECRET`, so the request is
 *      authenticated exactly the way a real signed-in caller would
 *      be — no admin token attached, no impersonation.
 *   3. PATCHes `/api/profiles/{me}` with a payload that tries to
 *      overwrite every financial field, plus one safe field (`bio`)
 *      as a positive control.
 *   4. Re-reads the profile row directly from Postgres (NOT through
 *      the same endpoint, so a buggy GET handler can't mask a real
 *      mutation) and asserts every financial field is byte-for-byte
 *      unchanged, while the safe `bio` field DID persist (proving
 *      the handler ran and the lockout is field-level, not a
 *      blanket no-op).
 *   5. Seeds a `userChallenges` row with a known starting balance
 *      and POSTs to `/api/challenges/start` with a body that tries
 *      to inject `bankroll: 99` / `profitTarget: 99`. Asserts the
 *      persisted bankroll equals the server-side challenge starting
 *      balance, NOT the value supplied in the body — proving the
 *      legitimate writer derives financial state from a trusted row,
 *      not from the request.
 *   6. Probes the auth gate that fronts the allow-list split:
 *      unauthenticated PATCH returns 401, and PATCH from a
 *      different signed-in user against someone else's profile
 *      returns 403.
 *
 * Plus a small set of supplemental source-level guardrails that
 * lock the structural invariants of the fix (which set is consulted
 * for which caller, where the legitimate writer pulls bankroll
 * from). These run alongside the behavioural assertions and catch
 * the regression even before a request flies, but they are NOT the
 * only proof — the behavioural tests above are the deliverable the
 * task asked for.
 *
 * Skip behaviour: the behavioural assertions need a live Postgres
 * (`DATABASE_URL`) and `NEXTAUTH_SECRET`. If either is missing
 * (e.g. on the current `messenger-click-trap` CI matrix, which
 * doesn't yet provision a database), only the supplemental
 * source-level guardrails run. Wiring the behavioural suite into CI
 * with a Postgres service container is filed as a follow-up task.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const parser = require('@babel/parser');
const { test, expect } = require('@playwright/test');

// The full list of financial / settlement fields task #393 removed
// from the owner allow-list. The list itself lives in a shared
// helper module so the supplemental task #472 guardrails below can
// key off the same source of truth — adding a new field there flags
// every profile-write endpoint at once.
const { FINANCIAL_FIELDS } = require('./helpers/financialFields');

// ---------------------------------------------------------------------------
// Source helpers — small, used by the supplemental guardrails below.
// ---------------------------------------------------------------------------
function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', relPath), 'utf8');
}

function extractStringSet(source, constName) {
  const re = new RegExp(
    'const\\s+' + constName + '\\s*=\\s*new\\s+Set<string>\\(\\[([\\s\\S]*?)\\]\\)',
    'm',
  );
  const m = re.exec(source);
  if (!m) {
    throw new Error(
      `Couldn't locate "${constName}" in source — has the constant been renamed or removed?`,
    );
  }
  const entries = m[1].match(/"([^"\\]+)"/g) || [];
  return new Set(entries.map((s) => s.slice(1, -1)));
}

const profilesHandlerSrc = readSource('pages/api/profiles/[id].ts');
const challengesStartSrc = readSource('pages/api/challenges/start.ts');
const ownerSet = extractStringSet(profilesHandlerSrc, 'OWNER_ALLOWED_UPDATE_FIELDS');
const adminSet = extractStringSet(profilesHandlerSrc, 'ADMIN_ONLY_UPDATE_FIELDS');

// ---------------------------------------------------------------------------
// Behavioural setup — only runs when the suite has a live DB + secret.
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const BEHAVIOURAL_ENABLED = Boolean(DATABASE_URL && NEXTAUTH_SECRET);

// All test-data ids share this prefix so cleanup (and any orphaned-row
// audit) can find them deterministically without risk of touching real
// user rows.
const TEST_PREFIX = 'task435-';

// Frozen "before" snapshot we expect to find unchanged after the
// owner attempts to overwrite it. Decimal columns are returned by
// the Postgres driver as strings (matching the Drizzle decimal
// output), so we compare as strings throughout.
const STARTING_FINANCIAL_STATE = {
  bankroll: '1234.56',
  pnl: '-12.34',
  total_bets: 7,
  win_rate: '42.86',
  bets_history: [{ id: 'b1', stake: 100, status: 'won' }],
  challenge_phase: 2,
  daily_loss: '11.11',
  max_daily_loss: '500.00',
  profit_target: '2000.00',
  betting_days: 3,
  achievements: [{ name: 'first_blood' }],
  profile_stats: { totalWins: 4, totalLosses: 3 },
  status: 'active',
  challenge: { id: 'pre-existing-challenge', name: 'Original Pre-Test Challenge' },
  challenge_start_date: new Date('2025-01-15T00:00:00.000Z'),
  last_bet_date: new Date('2025-02-01T00:00:00.000Z'),
};

const PAYLOAD_THE_OWNER_TRIES_TO_INJECT = {
  bankroll: 999999,
  pnl: 999999,
  totalBets: 0,
  winRate: 100,
  betsHistory: [],
  challengePhase: 99,
  dailyLoss: '0',
  maxDailyLoss: '0',
  profitTarget: '0',
  bettingDays: 0,
  achievements: [{ name: 'forged-achievement' }],
  profileStats: { totalWins: 99999 },
  status: 'inactive',
  challenge: { id: 'forged-challenge', name: 'Forged Challenge' },
  challengeStartDate: new Date(0).toISOString(),
  lastBetDate: new Date(0).toISOString(),
  // Plus one safe field as a positive control: this MUST persist,
  // proving the handler executed and the lockout is field-level.
  bio: 'bio-set-by-task435-test',
};

let sql = null;
let encodeJwt = null;

if (BEHAVIOURAL_ENABLED) {
  // Defer-require so a workspace without these packages installed
  // doesn't blow up at module-load time before `test.skip()` fires.
  ({ neon: sql } = require('@neondatabase/serverless'));
  sql = sql(DATABASE_URL);
  ({ encode: encodeJwt } = require('next-auth/jwt'));
}

// NextAuth v4 picks the session-cookie name based on whether
// `NEXTAUTH_URL` is `https://` (or VERCEL is set). We mirror that
// exact rule here, otherwise the dev server (https NEXTAUTH_URL,
// expects `__Secure-next-auth.session-token`) will silently reject
// a non-prefixed cookie and the handler under test will return 401
// — masking the real assertion.
function sessionCookieName() {
  const secure =
    (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith('https://')) ||
    !!process.env.VERCEL;
  return secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

async function mintSessionCookie(userId, email) {
  // The JWT callback in `lib/auth.ts` copies `user.id` onto
  // `token.id`, so we must encode an `id` claim — that's what
  // `getServerSession`'s session callback re-exposes as
  // `session.user.id`. `name`/`email` are needed because
  // NextAuth's session route only constructs `session.user` when
  // the decoded token carries a `name` or `email`.
  const token = await encodeJwt({
    token: {
      id: userId,
      sub: userId,
      email,
      name: 'Task #435 Behavioural Test',
    },
    secret: NEXTAUTH_SECRET,
    maxAge: 60 * 5,
  });
  return `${sessionCookieName()}=${token}`;
}

async function insertTestProfile(userId) {
  const s = STARTING_FINANCIAL_STATE;
  await sql`
    INSERT INTO profiles (
      id, username, bio, bankroll, pnl, total_bets, win_rate, bets_history,
      challenge_phase, daily_loss, max_daily_loss, profit_target,
      betting_days, achievements, profile_stats, status, challenge,
      challenge_start_date, last_bet_date
    ) VALUES (
      ${userId}, ${'task435-' + userId.slice(0, 8)}, ${'starting bio'},
      ${s.bankroll}, ${s.pnl}, ${s.total_bets}, ${s.win_rate},
      ${JSON.stringify(s.bets_history)}::jsonb,
      ${s.challenge_phase}, ${s.daily_loss}, ${s.max_daily_loss}, ${s.profit_target},
      ${s.betting_days},
      ${JSON.stringify(s.achievements)}::jsonb,
      ${JSON.stringify(s.profile_stats)}::jsonb,
      ${s.status},
      ${JSON.stringify(s.challenge)}::jsonb,
      ${s.challenge_start_date.toISOString()},
      ${s.last_bet_date.toISOString()}
    )
  `;
}

async function readProfile(userId) {
  const rows = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
  return rows[0];
}

async function deleteTestRows(userId) {
  await sql`DELETE FROM user_challenges WHERE user_id = ${userId}`;
  await sql`DELETE FROM profiles WHERE id = ${userId}`;
}

// ---------------------------------------------------------------------------
// Behavioural suite — the deliverable.
// ---------------------------------------------------------------------------
test.describe('owner cannot reset their own bankroll via PATCH /api/profiles/{me}', () => {
  test.skip(
    !BEHAVIOURAL_ENABLED,
    'Behavioural suite needs DATABASE_URL and NEXTAUTH_SECRET; running supplemental ' +
      'source-level guardrails only.',
  );

  // Per-test isolation: each behavioural test owns a fresh user id
  // and cleans up afterwards, so failures don't leak rows and tests
  // can run in any order without cross-contamination.
  const userIds = [];

  function newUserId() {
    const id = TEST_PREFIX + crypto.randomUUID();
    userIds.push(id);
    return id;
  }

  test.afterEach(async () => {
    while (userIds.length) {
      const id = userIds.pop();
      try {
        await deleteTestRows(id);
      } catch (err) {
        console.error(`[task435 cleanup] failed to delete ${id}:`, err);
      }
    }
  });

  test('PATCH with every financial field in the body persists none of them', async ({ request }) => {
    const userId = newUserId();
    await insertTestProfile(userId);
    const cookie = await mintSessionCookie(userId, `${userId}@e2e.test`);

    const res = await request.patch(`/api/profiles/${userId}`, {
      data: PAYLOAD_THE_OWNER_TRIES_TO_INJECT,
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(
      res.status(),
      'authenticated owner PATCH must succeed (200) — the financial fields are silently ignored, not 4xx-rejected',
    ).toBe(200);

    // Read the row STRAIGHT FROM POSTGRES so a buggy GET handler
    // can't mask a real mutation. Decimals come back as strings.
    const row = await readProfile(userId);
    expect(row, 'profile row must still exist after PATCH').toBeTruthy();

    const s = STARTING_FINANCIAL_STATE;
    expect(row.bankroll, 'bankroll must be unchanged').toBe(s.bankroll);
    expect(row.pnl, 'pnl must be unchanged').toBe(s.pnl);
    expect(row.total_bets, 'total_bets must be unchanged').toBe(s.total_bets);
    expect(row.win_rate, 'win_rate must be unchanged').toBe(s.win_rate);
    expect(row.bets_history, 'bets_history must be unchanged').toEqual(s.bets_history);
    expect(row.challenge_phase, 'challenge_phase must be unchanged').toBe(s.challenge_phase);
    expect(row.daily_loss, 'daily_loss must be unchanged').toBe(s.daily_loss);
    expect(row.max_daily_loss, 'max_daily_loss must be unchanged').toBe(s.max_daily_loss);
    expect(row.profit_target, 'profit_target must be unchanged').toBe(s.profit_target);
    expect(row.betting_days, 'betting_days must be unchanged').toBe(s.betting_days);
    expect(row.achievements, 'achievements must be unchanged').toEqual(s.achievements);
    expect(row.profile_stats, 'profile_stats must be unchanged').toEqual(s.profile_stats);
    expect(row.status, 'status must be unchanged').toBe(s.status);
    expect(row.challenge, 'challenge must be unchanged').toEqual(s.challenge);
    expect(
      new Date(row.challenge_start_date).toISOString(),
      'challenge_start_date must be unchanged',
    ).toBe(s.challenge_start_date.toISOString());
    expect(
      new Date(row.last_bet_date).toISOString(),
      'last_bet_date must be unchanged',
    ).toBe(s.last_bet_date.toISOString());

    // Positive control: the same handler that ignored every financial
    // field DID persist the safe `bio` field — the lockout is
    // field-level, not a blanket no-op.
    expect(
      row.bio,
      'bio must have been updated, proving the handler executed and the lockout is per-field',
    ).toBe(PAYLOAD_THE_OWNER_TRIES_TO_INJECT.bio);
  });

  test('POST /api/challenges/start uses server-side starting balance, ignoring body bankroll', async ({
    request,
  }) => {
    const userId = newUserId();
    await insertTestProfile(userId);
    // Reset profile.status / challenge_start_date so the start
    // handler's "already-active" guard doesn't reject us.
    await sql`UPDATE profiles SET status = 'inactive', challenge_start_date = NULL WHERE id = ${userId}`;

    const challengeStartingBalance = '5000.00';
    const challengeId = TEST_PREFIX + crypto.randomUUID();
    await sql`
      INSERT INTO user_challenges (
        id, user_id, challenge_type, challenge_name,
        starting_balance, current_balance, user_split, price_paid, status
      ) VALUES (
        ${challengeId}, ${userId}, 'standard', 'Task #435 Behavioural Test Challenge',
        ${challengeStartingBalance}, ${challengeStartingBalance}, 80, '100.00', 'active'
      )
    `;

    const cookie = await mintSessionCookie(userId, `${userId}@e2e.test`);
    const res = await request.post('/api/challenges/start', {
      data: {
        challengeId,
        // These three are the values an attacker would try to inject
        // — none of them must end up persisted. The handler must
        // derive bankroll from `challengeRow.startingBalance`, and
        // profitTarget / maxDailyLoss from `challengeRow.profitTarget`
        // / `challengeRow.maxDailyLoss` (or a fallback computed from
        // startingBalance), never from the request body.
        bankroll: 99,
        profitTarget: 99,
        maxDailyLoss: 99,
      },
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status()).toBe(200);

    const row = await readProfile(userId);
    expect(
      row.bankroll,
      'bankroll must come from challengeRow.startingBalance, not from req.body.bankroll',
    ).toBe(challengeStartingBalance);
    // profit_target and max_daily_loss aren't on the userChallenges
    // row in our test seed, so the handler falls back to
    // 20% / 8% of startingBalance respectively.
    expect(
      row.profit_target,
      'profit_target must be derived server-side, not from req.body.profitTarget',
    ).toBe('1000.00');
    expect(
      row.max_daily_loss,
      'max_daily_loss must be derived server-side, not from req.body.maxDailyLoss',
    ).toBe('400.00');
  });

  test('unauthenticated PATCH returns 401 (auth gate fires before any DB write)', async ({
    request,
  }) => {
    const userId = newUserId();
    await insertTestProfile(userId);

    const res = await request.patch(`/api/profiles/${userId}`, {
      data: { bankroll: 999999 },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(401);

    // Belt-and-suspenders: confirm the row actually wasn't touched.
    const row = await readProfile(userId);
    expect(row.bankroll).toBe(STARTING_FINANCIAL_STATE.bankroll);
  });

  test('cross-user PATCH (signed in as a different non-admin) returns 403', async ({
    request,
  }) => {
    const victimId = newUserId();
    const attackerId = newUserId();
    await insertTestProfile(victimId);
    await insertTestProfile(attackerId);

    const cookie = await mintSessionCookie(attackerId, `${attackerId}@e2e.test`);
    const res = await request.patch(`/api/profiles/${victimId}`, {
      data: { bankroll: 999999, bio: 'pwned-by-attacker' },
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status()).toBe(403);

    // Belt-and-suspenders: confirm the victim's row is untouched.
    const row = await readProfile(victimId);
    expect(row.bankroll).toBe(STARTING_FINANCIAL_STATE.bankroll);
    expect(row.bio).toBe('starting bio');
  });
});

// ---------------------------------------------------------------------------
// Supplemental source-level guardrails (always run).
//
// These are NOT the deliverable — the behavioural suite above is.
// They're here to catch the regression at PR-review time, before any
// request flies, and to keep CI matrix entries that don't have a
// database wired up still doing useful work. Per the code-review
// guidance, they are intentionally narrow: they assert the
// structural invariants of the fix (which set is consulted for
// which caller, where the legitimate writer pulls bankroll from),
// not formatting choices.
// ---------------------------------------------------------------------------
test.describe('supplemental source-level guardrails', () => {
  test('OWNER_ALLOWED_UPDATE_FIELDS excludes every financial field from task #393', () => {
    const offenders = FINANCIAL_FIELDS.filter((f) => ownerSet.has(f));
    expect(
      offenders,
      'OWNER_ALLOWED_UPDATE_FIELDS in pages/api/profiles/[id].ts must NOT contain any of the ' +
        'financial / settlement fields task #393 removed. Re-introducing one would let any ' +
        'signed-in user reset their own bankroll / pnl / win rate / settled-bet history.',
    ).toEqual([]);
  });

  test('ADMIN_ONLY_UPDATE_FIELDS still contains every financial field', () => {
    const missing = FINANCIAL_FIELDS.filter((f) => !adminSet.has(f));
    expect(
      missing,
      'ADMIN_ONLY_UPDATE_FIELDS must contain every financial field so admins retain manual ' +
        'fix-up access via the same endpoint when wearing an admin token.',
    ).toEqual([]);
  });

  test('PATCH handler narrows owners to OWNER_ALLOWED_UPDATE_FIELDS, never the union', () => {
    expect(profilesHandlerSrc).toMatch(
      /allowed\s*=\s*isAdmin\s*\?[\s\S]*?ADMIN_ONLY_UPDATE_FIELDS[\s\S]*?:\s*OWNER_ALLOWED_UPDATE_FIELDS/m,
    );
    expect(profilesHandlerSrc).toMatch(/pickAllowed\(req\.body,\s*allowed\)/);
  });

  test('challenges/start derives bankroll from a server-validated userChallenges row, not req.body', () => {
    expect(challengesStartSrc).toMatch(
      /const\s+startingBalance\s*=\s*Number\(challengeRow\.startingBalance\)/,
    );
    expect(challengesStartSrc).toMatch(/bankroll:\s*startingBalance\.toString\(\)/);
    expect(challengesStartSrc).not.toMatch(/body\.bankroll/);
    // userChallenges row must be ownership-checked against the
    // session userId before its starting balance is trusted.
    expect(challengesStartSrc).toMatch(/eq\(userChallenges\.userId,\s*userId\)/);
  });
});

// ---------------------------------------------------------------------------
// Task #472 — every OTHER client-callable profile-write endpoint.
//
// The supplemental guardrails above only cover `pages/api/profiles/[id].ts`
// and `pages/api/challenges/start.ts`. Several other handlers also write
// to the `profiles` table (`pages/api/user/settings.js`,
// `pages/api/user/profile.js`, `pages/api/user/complete-onboarding.js`,
// `pages/api/profiles/update.js`, `pages/api/profiles/last-buyin.js`,
// `pages/api/user/heartbeat.js`, …). None of them currently accept any
// `FINANCIAL_FIELDS` value from the request body — they either don't
// touch those columns, or hardcode `'0'` / `'1000'` for new-account
// initialisation. But there is no automated check asserting that, and a
// future refactor that drops a generic `...req.body` spread into any of
// these would silently re-open the task #393 self-reset vulnerability.
//
// The block below discovers every `pages/api/{user,profiles}/*` handler
// that targets the `profiles` table (so a NEW such file is auto-covered
// the moment it lands), parses each one with @babel/parser, and asserts:
//
//   1. The file never reads any `FINANCIAL_FIELDS` member directly off
//      `req.body` — neither via `req.body.bankroll` nor via destructure
//      `const { bankroll } = req.body`. We also follow the common
//      `const body = req.body || {}` aliasing pattern so accesses on
//      that alias count too.
//
//   2. The file never spreads `req.body` (or any alias of it) anywhere
//      — the explicit "no `...req.body` straight into `.set(...)`"
//      property task #472 calls out, generalised to the whole file
//      because `const updates = { ...req.body }; …set(updates)` is the
//      same vulnerability with one extra hop.
//
//   3. The file never indexes `req.body[<dyn>]` / `<alias>[<dyn>]`
//      directly — that's the dynamic-key version of the same flow
//      (`for (const k of allKeys) updates[k] = body[k]`), and would
//      bypass static checks on named member access.
//
//   4. Every inline ObjectExpression literal passed as the first arg
//      to a `db.update(profiles).set(...)` or `db.insert(profiles)
//      .values(...)` call MAY only set a `FINANCIAL_FIELDS` key to a
//      literal value (string / number / boolean / null / unary-negated
//      numeric / no-substitution template). That preserves the current
//      legitimate `bankroll: '0'` / `bankroll: '1000'` initialisations
//      while rejecting any expression that could carry a request-derived
//      value (`bankroll: body.bankroll`, `bankroll: chosenAmount`, …).
//
// `pages/api/profiles/[id].ts` is excluded because it has its own
// dedicated allow-list-split coverage above.
// ---------------------------------------------------------------------------

// Task #472 covered these two API directories. Task #487 broadens the
// scan to every other directory under `pages/api/` that hosts a
// client-callable handler writing to `profiles`. Adding a new dir here
// auto-enrolls every `update(profiles)` / `insert(profiles)` file
// inside it (the per-file pre-filter below ignores everything else).
const PROFILE_WRITE_SCAN_DIRS = [
  'pages/api/user',
  'pages/api/profiles',
  // Task #487: singular `pages/api/profile/` — currently just
  // `avatar.js`, but future avatar / banner / cover handlers will land
  // here too and are auto-covered by the recursive walk.
  'pages/api/profile',
  // Task #487: `place.js` writes `totalBets` / `lastBetDate` after a
  // bet is recorded; `grade.js` writes `bankroll` after settlement.
  'pages/api/bets',
  // Task #487: `join.js` debits `bankroll` by the pool buy-in.
  'pages/api/pools',
  // Task #487: `forfeit.js` updates the winner's `bankroll` and the
  // loser's `battleLosses` after a battle ends early.
  'pages/api/battles',
  // Task #487: `resolve.js` writes `battleWins` / `battleLosses` after
  // a battle finishes by clock expiry. (Doesn't touch any FINANCIAL
  // field today, but the file is enrolled so it can't silently start.)
  'pages/api/matchups',
  // Task #487: `index.ts` debits `bankroll` on withdrawal request,
  // `[id].ts` refunds `bankroll` on withdrawal cancel.
  'pages/api/withdrawals',
  // Task #487: `validate-impersonation.js` rewrites `status` /
  // `bankroll` / `challenge` / `challengePhase` from a server-derived
  // fakeOpponent matchup balance.
  'pages/api/auth',
];

// Task #487: server-side helpers (not under `pages/api/`) that the
// task explicitly calls out as needing the same guardrails. Listed
// individually because their parent dirs (`lib/`, `lib/auth/`)
// contain many unrelated files and a recursive walk over all of
// `lib/` would pull in dozens of helpers that don't touch `profiles`.
// New helpers that write to `profiles` should be added here so they
// pick up the same four invariants the API handlers do.
const PROFILE_WRITE_EXTRA_FILES = [
  'lib/achievements.js',
  'lib/firstDepositMatch.js',
  path.normalize('lib/auth/service.ts'),
];

const PROFILE_WRITE_ALREADY_COVERED = new Set([
  path.normalize('pages/api/profiles/[id].ts'),
]);

// Task #487: files where the literal-only assertion on FINANCIAL_FIELDS
// inside `db.update(profiles).set(...)` / `db.insert(profiles).values(...)`
// must be relaxed because the handler legitimately needs to write a
// server-derived (NOT body-derived) value to one of these columns. The
// other three guardrails (no FINANCIAL_FIELDS off req.body, no req.body
// spreads, no dynamic-key reads on req.body) STILL run on every file in
// this set — so even an exempt file is locked against the task #393
// self-reset shape; the relaxation is strictly about the inline literal
// check, never about request-body data flow.
//
// Each entry comes with a one-line justification of WHY the file must
// write a non-literal FINANCIAL_FIELD value. Adding a new entry is a
// flag during code review: if there isn't a clean server-side derivation
// you can point at, the right fix is to refactor the writer, not extend
// this set.
// All keys are normalized via `path.normalize` so lookups stay
// deterministic on non-POSIX platforms (Windows-style separators,
// trailing-slash variations, etc.) — the discovery walker also stores
// normalized `rel` paths, so both sides agree.
const PROFILE_WRITE_LITERAL_EXEMPTIONS = new Map([
  // `totalBets` is `(profile.totalBets || 0) + insertedBets.length`
  // and `lastBetDate` is `new Date()`. Both come from the count of
  // rows the handler itself just inserted into `userBets`, never from
  // the request body.
  [path.normalize('pages/api/bets/place.js'), 'increments totalBets / sets lastBetDate from server-side bet insert count'],
  // `bankroll` is `parseFloat(profile.bankroll) + bankrollChange`,
  // where `bankrollChange` is derived from each `userBets` row's
  // settled `pnl` / `stake` (not the request).
  [path.normalize('pages/api/bets/grade.js'), 'credits bankroll from server-side settled-bet pnl + stake'],
  // `bankroll: (userBalance - buyInAmount).toFixed(2)`. `buyInAmount`
  // comes from the trusted `pikPools` row, `userBalance` from the
  // trusted `profiles` row — body only carries `poolId`.
  [path.normalize('pages/api/pools/join.js'), 'debits bankroll by the pool row\'s buy-in, not body'],
  // `bankroll: newBankroll.toFixed(2)` where `newBankroll` is
  // `parseFloat(oppProfile.bankroll || 0) + winnerPayout`, and
  // `winnerPayout` is computed from the matchup's potSize. Body is
  // not even read by this handler.
  [path.normalize('pages/api/battles/forfeit.js'), 'credits opponent bankroll with server-derived winnerPayout'],
  // `bankroll: newBankroll` where `newBankroll = (currentBalance -
  // amountNum).toFixed(2)`. `currentBalance` is from the profiles
  // row; `amountNum` is validated against `availableToWithdraw`
  // (computed from profile + challenge) before the deduction lands.
  [path.normalize('pages/api/withdrawals/index.ts'), 'debits bankroll by validated withdrawal amount'],
  // `bankroll: newBankroll` where `newBankroll = (currentBankroll +
  // refundAmount).toFixed(2)`. Both inputs come from the profile and
  // the previously-persisted `withdrawals` row, not the request.
  [path.normalize('pages/api/withdrawals/[id].ts'), 'refunds bankroll on withdrawal cancel from stored withdrawal row'],
  // `status` / `bankroll` / `challenge` / `challengePhase` are set
  // from the totalBalance summed across the fake opponent's active
  // `matchups` rows (server-side aggregate). The body only carries a
  // signed JWT identifying the impersonation target.
  [path.normalize('pages/api/auth/validate-impersonation.js'), 'syncs profile from server-side fakeOpponent matchup aggregate'],
  // `achievements: updated` is `[...existing, ...newlyEarned]` where
  // both halves are derived from `userBets` / `profiles` rows the
  // helper just read; this is a server-side helper and never even
  // sees a request body.
  [path.normalize('lib/achievements.js'), 'rewrites achievements array from server-computed bet stats (no req.body in scope)'],
]);

function discoverProfileWriteEndpoints() {
  const out = [];
  const repoRoot = path.resolve(__dirname, '..', '..');
  const seen = new Set();
  // Recursive walk so any future nested handler — e.g.
  // `pages/api/user/security/disable-2fa.ts` — is auto-covered the
  // moment it lands. Stays inside PROFILE_WRITE_SCAN_DIRS so we don't
  // wander into unrelated `pages/api/*` trees.
  function walkDir(absDir, relDir) {
    if (!fs.existsSync(absDir)) return;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const childAbs = path.join(absDir, entry.name);
      const childRel = path.normalize(path.join(relDir, entry.name));
      if (entry.isDirectory()) {
        walkDir(childAbs, childRel);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.(js|ts)$/.test(entry.name)) continue;
      if (PROFILE_WRITE_ALREADY_COVERED.has(childRel)) continue;
      const src = fs.readFileSync(childAbs, 'utf8');
      // Cheap pre-filter: only scan files that actually call
      // `update(profiles)` or `insert(profiles)`. Read-only handlers
      // and unrelated files are ignored.
      if (!/\b(?:update|insert)\(\s*profiles\b/.test(src)) continue;
      if (seen.has(childRel)) continue;
      seen.add(childRel);
      out.push({ rel: childRel, src });
    }
  }
  for (const dir of PROFILE_WRITE_SCAN_DIRS) {
    walkDir(path.resolve(repoRoot, dir), dir);
  }
  // Pull in the explicitly-listed `lib/` helpers from
  // PROFILE_WRITE_EXTRA_FILES. We don't recurse into `lib/` wholesale
  // because most files there don't touch `profiles` at all and a blind
  // walk would spam the suite with irrelevant subtests.
  for (const rel of PROFILE_WRITE_EXTRA_FILES) {
    const normRel = path.normalize(rel);
    if (PROFILE_WRITE_ALREADY_COVERED.has(normRel)) continue;
    if (seen.has(normRel)) continue;
    const abs = path.resolve(repoRoot, normRel);
    if (!fs.existsSync(abs)) {
      throw new Error(
        `PROFILE_WRITE_EXTRA_FILES entry "${rel}" does not exist on disk — ` +
          'has the file been moved or deleted? Update the list.',
      );
    }
    const src = fs.readFileSync(abs, 'utf8');
    // Sanity-check the pre-filter so we don't silently retain a stale
    // entry whose `update(profiles)` / `insert(profiles)` call was
    // refactored away — at that point it doesn't need this lockout
    // anymore and should be removed from the list.
    if (!/\b(?:update|insert)\(\s*profiles\b/.test(src)) {
      throw new Error(
        `PROFILE_WRITE_EXTRA_FILES entry "${rel}" no longer calls ` +
          'update(profiles) / insert(profiles). Remove it from the list.',
      );
    }
    seen.add(normRel);
    out.push({ rel: normRel, src });
  }
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

function parseEndpointSource(src) {
  return parser.parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

// Recursive AST walker that doesn't descend into structural metadata
// (locations, ranges, comment arrays attached by @babel/parser).
function walkAst(node, visitor) {
  if (!node || typeof node.type !== 'string') return;
  visitor(node);
  for (const k of Object.keys(node)) {
    if (
      k === 'loc' ||
      k === 'start' ||
      k === 'end' ||
      k === 'range' ||
      k === 'extra' ||
      k === 'comments' ||
      k === 'leadingComments' ||
      k === 'trailingComments' ||
      k === 'innerComments'
    ) {
      continue;
    }
    const v = node[k];
    if (Array.isArray(v)) {
      for (const c of v) walkAst(c, visitor);
    } else if (v && typeof v.type === 'string') {
      walkAst(v, visitor);
    }
  }
}

function isReqBodyExpr(node) {
  return (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.object?.type === 'Identifier' &&
    node.object.name === 'req' &&
    node.property?.type === 'Identifier' &&
    node.property.name === 'body'
  );
}

// Treats `req.body` and the common `req.body || {}` / `req.body ?? {}`
// "default to empty object" pattern as the same passthrough. Anything
// else (e.g. `req.body.foo`, `normalize(req.body)`) is NOT a
// passthrough — those don't preserve the body's keys verbatim.
function isReqBodyPassthrough(node) {
  if (!node) return false;
  if (isReqBodyExpr(node)) return true;
  if (
    node.type === 'LogicalExpression' &&
    (node.operator === '||' || node.operator === '??') &&
    isReqBodyExpr(node.left)
  ) {
    return true;
  }
  return false;
}

// Collects identifier names that point at `req.body` (or a passthrough
// alias of it) via a `const x = req.body[ || {}]` declarator. We treat
// these aliases as equivalent to `req.body` for the rest of the file —
// reads on the alias count as reads on the body, spreads of the alias
// count as body spreads, etc.
function collectReqBodyAliases(ast) {
  const aliases = new Set();
  walkAst(ast, (node) => {
    if (
      node.type === 'VariableDeclarator' &&
      node.init &&
      isReqBodyPassthrough(node.init) &&
      node.id?.type === 'Identifier'
    ) {
      aliases.add(node.id.name);
    }
  });
  return aliases;
}

// Property names read directly off `req.body` (or any alias). Covers:
//   - `req.body.foo`            (MemberExpression on `req.body`)
//   - `body.foo`                (MemberExpression on an alias)
//   - `const { foo } = req.body`  (ObjectPattern destructure)
//   - `const { foo } = body`      (destructure off an alias)
function collectReqBodyPropertyReads(ast, aliases) {
  const props = new Set();
  walkAst(ast, (node) => {
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.property?.type === 'Identifier'
    ) {
      const obj = node.object;
      const fromBody =
        isReqBodyExpr(obj) ||
        (obj?.type === 'Identifier' && aliases.has(obj.name));
      if (fromBody) props.add(node.property.name);
    }
    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'ObjectPattern' &&
      node.init
    ) {
      const init = node.init;
      const fromBody =
        isReqBodyPassthrough(init) ||
        (init.type === 'Identifier' && aliases.has(init.name));
      if (fromBody) {
        for (const p of node.id.properties) {
          if (
            (p.type === 'ObjectProperty' || p.type === 'Property') &&
            p.key?.type === 'Identifier'
          ) {
            props.add(p.key.name);
          }
        }
      }
    }
  });
  return props;
}

// Counts spreads of `req.body` (or a passthrough alias) anywhere in
// the file — `{ ...req.body }`, `{ ...body }`, `[...req.body]`, etc.
// The threat is ANY such spread, not just inside `.set(...)`, because
// `const updates = { ...body }; await db.update(profiles).set(updates)`
// is the same vulnerability with one indirection.
function findReqBodySpreads(ast, aliases) {
  let count = 0;
  walkAst(ast, (node) => {
    if (node.type !== 'SpreadElement' && node.type !== 'SpreadProperty') return;
    const arg = node.argument;
    if (
      isReqBodyExpr(arg) ||
      (arg?.type === 'Identifier' && aliases.has(arg.name))
    ) {
      count++;
    }
  });
  return count;
}

// Counts dynamic indexed reads on `req.body` / alias — `body[k]`,
// `req.body[someKey]`, etc. Static `body.notifications[k]` is NOT
// flagged because the outer object there is `body.notifications`,
// not `body` itself.
function findReqBodyComputedReads(ast, aliases) {
  let count = 0;
  walkAst(ast, (node) => {
    if (node.type !== 'MemberExpression' || !node.computed) return;
    const obj = node.object;
    if (
      isReqBodyExpr(obj) ||
      (obj?.type === 'Identifier' && aliases.has(obj.name))
    ) {
      count++;
    }
  });
  return count;
}

// True if `node` is a value that could not possibly carry information
// from the request body — a string, number, boolean, null, the
// negation of a numeric literal, or an interpolation-free template.
function isLiteralValue(node) {
  if (!node) return false;
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
      return true;
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'UnaryExpression':
      return (
        (node.operator === '-' || node.operator === '+') &&
        isLiteralValue(node.argument)
      );
    default:
      return false;
  }
}

// Returns every `db.update(profiles).set({...})` /
// `db.insert(profiles).values({...})` CallExpression in the AST.
// We walk back the receiver chain on each `.set` / `.values` call
// looking for an inner `.update(profiles)` / `.insert(profiles)` —
// that's the structural marker that tells us this write targets the
// `profiles` table specifically (and not some other Drizzle table).
function findProfileTableSetCalls(ast) {
  const out = [];
  walkAst(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = node.callee;
    if (callee?.type !== 'MemberExpression') return;
    const propName = callee.property?.name;
    if (propName !== 'set' && propName !== 'values') return;
    let cur = callee.object;
    while (cur) {
      if (
        cur.type === 'CallExpression' &&
        cur.callee?.type === 'MemberExpression'
      ) {
        const innerName = cur.callee.property?.name;
        if (innerName === 'update' || innerName === 'insert') {
          const arg = cur.arguments[0];
          if (arg?.type === 'Identifier' && arg.name === 'profiles') {
            out.push(node);
          }
          return;
        }
        cur = cur.callee.object;
      } else {
        return;
      }
    }
  });
  return out;
}

function findFinancialFieldKeysInObjectLiteral(objExpr) {
  if (!objExpr || objExpr.type !== 'ObjectExpression') return [];
  const found = [];
  for (const p of objExpr.properties) {
    if (p.type !== 'ObjectProperty' && p.type !== 'Property') continue;
    let name = null;
    if (!p.computed && p.key?.type === 'Identifier') name = p.key.name;
    else if (p.key?.type === 'StringLiteral') name = p.key.value;
    if (name && FINANCIAL_FIELDS.includes(name)) {
      found.push({ name, value: p.value });
    }
  }
  return found;
}

const PROFILE_WRITE_ENDPOINTS = discoverProfileWriteEndpoints();

test.describe('task #472 — every other client-callable profile-write endpoint stays bankroll-safe', () => {
  test('discovery picks up the three endpoints task #472 explicitly called out', () => {
    const rels = PROFILE_WRITE_ENDPOINTS.map((e) => e.rel);
    for (const must of [
      path.normalize('pages/api/user/settings.js'),
      path.normalize('pages/api/user/profile.js'),
      path.normalize('pages/api/user/complete-onboarding.js'),
    ]) {
      expect(
        rels,
        `${must} must be discovered by the profile-write endpoint scan — if it ` +
          'has been moved or renamed, update PROFILE_WRITE_SCAN_DIRS / the ' +
          'pre-filter regex above accordingly.',
      ).toContain(must);
    }
    // Belt-and-suspenders: at least the three above plus profiles/[id].ts is
    // covered by the existing suite, so the new scan must yield ≥ 3.
    expect(PROFILE_WRITE_ENDPOINTS.length).toBeGreaterThanOrEqual(3);
  });

  test('discovery picks up every endpoint task #487 explicitly called out', () => {
    // Each of these files writes to `profiles` from a path the original
    // task #472 scan didn't cover (different pages/api dir, or under
    // lib/). Re-locating any of them without updating the scan dirs /
    // extra-files list would silently drop coverage — flag that here.
    const rels = PROFILE_WRITE_ENDPOINTS.map((e) => e.rel);
    for (const must of [
      path.normalize('pages/api/profile/avatar.js'),
      path.normalize('pages/api/bets/place.js'),
      path.normalize('pages/api/bets/grade.js'),
      path.normalize('pages/api/pools/join.js'),
      path.normalize('pages/api/battles/forfeit.js'),
      path.normalize('pages/api/matchups/resolve.js'),
      path.normalize('pages/api/withdrawals/index.ts'),
      path.normalize('pages/api/withdrawals/[id].ts'),
      path.normalize('pages/api/auth/validate-impersonation.js'),
      path.normalize('lib/achievements.js'),
      path.normalize('lib/firstDepositMatch.js'),
      path.normalize('lib/auth/service.ts'),
    ]) {
      expect(
        rels,
        `${must} must be discovered by the profile-write endpoint scan — if it ` +
          'has been moved or renamed, update PROFILE_WRITE_SCAN_DIRS / ' +
          'PROFILE_WRITE_EXTRA_FILES accordingly.',
      ).toContain(must);
    }
  });

  test('every literal-only exemption points at a discovered file (no stale entries)', () => {
    // If a file in PROFILE_WRITE_LITERAL_EXEMPTIONS isn't in the scan
    // result, the exemption is silently dead — a future regression in
    // that file wouldn't trigger ANY guardrail. Flag stale entries so
    // they're either re-enrolled or removed.
    const rels = new Set(PROFILE_WRITE_ENDPOINTS.map((e) => e.rel));
    const stale = [];
    for (const key of PROFILE_WRITE_LITERAL_EXEMPTIONS.keys()) {
      // Keys in PROFILE_WRITE_LITERAL_EXEMPTIONS are already normalized
      // at construction time, matching the normalized `rel` paths the
      // discovery walker stores.
      if (!rels.has(key)) stale.push(key);
    }
    expect(
      stale,
      'PROFILE_WRITE_LITERAL_EXEMPTIONS contains entries that the scan no ' +
        'longer discovers. Either re-enroll the file (add its dir to ' +
        'PROFILE_WRITE_SCAN_DIRS / PROFILE_WRITE_EXTRA_FILES) or remove the ' +
        'stale exemption.',
    ).toEqual([]);
  });

  for (const { rel, src } of PROFILE_WRITE_ENDPOINTS) {
    test.describe(rel, () => {
      const ast = parseEndpointSource(src);
      const aliases = collectReqBodyAliases(ast);
      const reqBodyReads = collectReqBodyPropertyReads(ast, aliases);
      const reqBodySpreadCount = findReqBodySpreads(ast, aliases);
      const reqBodyComputedCount = findReqBodyComputedReads(ast, aliases);
      const profileSetCalls = findProfileTableSetCalls(ast);

      test('does not read any FINANCIAL_FIELD off req.body (or an alias of it)', () => {
        const offenders = FINANCIAL_FIELDS.filter((f) => reqBodyReads.has(f));
        expect(
          offenders,
          `${rel} reads financial field(s) ${JSON.stringify(offenders)} from ` +
            'the request body. Any value flowing from req.body into a profiles ' +
            'update payload re-opens the task #393 self-reset vulnerability — ' +
            'derive these server-side (e.g. from a userChallenges row) instead.',
        ).toEqual([]);
      });

      test('does not spread req.body (or an alias) anywhere in the file', () => {
        expect(
          reqBodySpreadCount,
          `${rel} contains ${reqBodySpreadCount} spread(s) of req.body / a body ` +
            'alias. Even one such spread (`{ ...req.body, updatedAt: new Date() }`, ' +
            '`const updates = { ...body }; …set(updates)`) lets a future request ' +
            'silently land any FINANCIAL_FIELD value into the profile.',
        ).toBe(0);
      });

      test('does not index req.body (or an alias) with a dynamic key', () => {
        expect(
          reqBodyComputedCount,
          `${rel} contains ${reqBodyComputedCount} dynamic-key read(s) on ` +
            'req.body / a body alias (`body[k]`, `req.body[someKey]`). That ' +
            'pattern bypasses every static check by funnelling arbitrary body ' +
            'keys through a loop — including FINANCIAL_FIELDS.',
        ).toBe(0);
      });

      const literalExemptionReason = PROFILE_WRITE_LITERAL_EXEMPTIONS.get(rel);

      test('inline `.set(...)` / `.values(...)` literals only set FINANCIAL_FIELDS to literal values', () => {
        test.skip(
          Boolean(literalExemptionReason),
          `Exempt per PROFILE_WRITE_LITERAL_EXEMPTIONS — ${literalExemptionReason ?? ''}. ` +
            'The other three guardrails (no FINANCIAL_FIELDS off req.body, no req.body ' +
            'spreads, no dynamic-key reads) STILL run on this file.',
        );
        const violations = [];
        for (const call of profileSetCalls) {
          const arg = call.arguments[0];
          for (const { name, value } of findFinancialFieldKeysInObjectLiteral(arg)) {
            if (!isLiteralValue(value)) {
              violations.push({ field: name, valueType: value?.type ?? 'unknown' });
            }
          }
        }
        expect(
          violations,
          `${rel} sets one or more FINANCIAL_FIELDS to a non-literal value ` +
            `inside a profiles \`.set(...)\` / \`.values(...)\` call: ` +
            `${JSON.stringify(violations)}. Hardcoded literals like ` +
            "`bankroll: '0'` / `bankroll: '1000'` are the only permitted shape — " +
            'anything else risks pulling a request-derived value into the row. ' +
            'If this file legitimately needs to write a server-derived value to ' +
            'one of these columns, add it to PROFILE_WRITE_LITERAL_EXEMPTIONS ' +
            'with a one-line justification of where the value comes from.',
        ).toEqual([]);
      });
    });
  }
});
