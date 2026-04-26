/**
 * Shared list of profile fields that task #393 removed from the
 * owner allow-list on `pages/api/profiles/[id].ts`.
 *
 * Two specs key off this list:
 *
 *   - tests/e2e/profile-bankroll-owner-lockout.spec.js
 *       The original task #393 regression suite — proves the
 *       owner-vs-admin allow-list split on `/api/profiles/{me}` keeps
 *       these fields out of reach of a signed-in regular user.
 *
 *   - tests/e2e/profile-bankroll-owner-lockout.spec.js (the
 *       supplemental describe block added for task #472) — proves
 *       every OTHER client-callable handler that writes to the
 *       `profiles` table (`pages/api/user/*`, `pages/api/profiles/*`)
 *       neither reads any of these fields off `req.body` nor spreads
 *       `req.body` into a Drizzle `.set(...)` / `.values(...)`.
 *
 * Adding a new financial / settlement field here therefore re-runs
 * both lockouts for every endpoint at once, so the source-level
 * guardrails fail loudly the moment a single endpoint forgets to
 * gate it. Keep this list in sync with the docstring at the top of
 * `pages/api/profiles/[id].ts`.
 */
const FINANCIAL_FIELDS = [
  'bankroll',
  'pnl',
  'betsHistory',
  'totalBets',
  'winRate',
  'dailyLoss',
  'lastBetDate',
  'bettingDays',
  'profileStats',
  'status',
  'profitTarget',
  'maxDailyLoss',
  'challenge',
  'challengeStartDate',
  'challengePhase',
  'achievements',
];

module.exports = { FINANCIAL_FIELDS };
