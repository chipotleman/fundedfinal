# Messenger / Notifications Click-Trap Regression Checklist

## First line of defense: the automated smoke test

The WebKit smoke test runs automatically in CI on every pull request via
the **Messenger click-trap E2E** GitHub Actions workflow
(`.github/workflows/messenger-click-trap.yml`). Reviewers should check
that the workflow is green on the PR before approving — if it's red, the
regression is back and the PR is blocked from merging until it's fixed.
Failed runs upload the Playwright HTML report and traces as workflow
artifacts so you can download and inspect them directly from the PR's
Checks tab.

The workflow caches the Playwright browser binaries
(`~/.cache/ms-playwright`) keyed on the resolved `@playwright/test`
version, so on a cache hit the "Install Playwright browsers" step is
skipped entirely and only a quick system-deps install runs in its place.
That's expected — if you don't see the usual "Downloading WebKit…"
output in the logs, the cache hit just saved you ~30–60s. The cache is
automatically invalidated whenever `@playwright/test` is bumped in
`package.json` / `package-lock.json`.

On top of that, the workflow also caches the resolved `node_modules`
directory keyed on `${{ runner.os }}-node-modules-<hash of
package-lock.json>`. On a cache hit the "Install dependencies" step is
skipped entirely (no `npm ci` link/write pass), shaving another chunk of
time off the smoke test. The cache is automatically invalidated whenever
`package-lock.json` changes, so any dependency bump produces a fresh
install on the next run.

The workflow itself is split into two jobs. A single **`build`** job
runs `next build` once and uploads the resulting `.next/` directory as
a workflow artifact; the matrix **`e2e`** jobs (`needs: build`)
download that artifact and boot it with `next start` via Playwright's
`webServer`. The matrix currently has eight entries — six for the
click-trap suite (one per browser × desktop/mobile) plus two for the
broader page-smoke suite (Chromium desktop + Chromium mobile). This
means:

- The smoke test runs against the same production bundle real users
  load — so a `getStaticProps` failure, a missing dependency that only
  shows up in the production tree, or a build-time crash now blocks
  the PR instead of slipping through behind `next dev`'s on-demand
  compiler.
- Each matrix job no longer pays the per-request `next dev` compile
  pass on first hit to `/messenger` and `/notifications`. `next start`
  serves the prebuilt output immediately, so the long Playwright
  `webServer` warm-up window collapses from minutes to seconds.
- We build exactly once per workflow run instead of once per matrix
  job — every e2e entry shares the artifact rather than each racing
  to populate the same build cache.

The `build` job also enforces a bundle-size budget after `next build`
finishes. It runs `scripts/measure-bundle.js` to record the size of
`.next/static` and the per-page chunk sizes from the build manifest,
then `scripts/check-bundle-budget.js` compares those numbers against
the committed baseline in `docs/bundle-baseline.json`. If the total
bundle grows by more than 50 KB or any single page grows by more than
20%, the `build` job fails the PR and a Markdown report is added to
the workflow's step summary. See [`bundle-budget.md`](./bundle-budget.md)
for how to investigate a regression and how to refresh the baseline
when the growth is intentional.

The `build` job caches **only** Next.js's incremental compiler cache at
`.next/cache` (SWC transforms, the webpack module graph, etc.) keyed on
`${{ runner.os }}-nextjs-cache-<hash of package-lock.json>-<commit sha>`,
with `restore-keys` falling back to the same key without the sha and
then to any `${{ runner.os }}-nextjs-cache-` entry. The commit sha in
the primary key guarantees a fresh write of `.next/cache` after every
successful build, while the restore-keys give us the warmest available
previous cache to start from. We deliberately do **not** cache the
full `.next/` output — that would risk reusing a stale production
build whenever a source file outside our cache-key glob changes
(`utils/`, `shared/`, `tailwind.config.js`, `instrumentation.js`,
`_app.js`, …). The incremental cache is purely an accelerator;
`next build` runs on every workflow run and produces the source of
truth that the matrix jobs actually test against.

If you want to reproduce a CI failure locally (or run the suite before
pushing), the same flow CI uses is:

```bash
npm run test:e2e:install   # one-time: installs the browser binaries
npm run test:e2e:ci        # next build + next start + the click-trap suite
```

`npm run test:e2e:ci` is just a shortcut for `next build` followed by
`E2E_PROD_BUILD=1 playwright test`. If you want a faster inner-loop
iteration cycle while debugging a spec, `npm run test:e2e` still works
and falls back to `next dev` (no build required, but the per-request
compile cost is back).

The suite lives in `tests/e2e/`:
- `messenger-click-trap.spec.js` — desktop Safari (>= 1024px wide), exercises
  the bell + messages dropdowns, the bell "View all" navigation to
  `/notifications`, browser back to `/messenger`, a scrolled-state
  pass that asserts no leftover full-screen overlay sits on top of the
  page, the page-level scroll-lock watchdog, and a stubbed voice-note
  upload-url failure.
- `messenger-click-trap.mobile.spec.js` — iPhone 14 Pro viewport, exercises
  the hamburger drawer + body scroll-lock, drawer-link navigation between
  `/messenger` and `/notifications` (both directions), and a scrolled-state
  pass with the same overlay check.
- `page-smoke.spec.js` — broader build-time smoke for the highest-traffic
  authenticated routes AND the public-facing marketing pages a brand-new
  visitor lands on before signing in. Mounts `/` (dashboard / home),
  `/battle`, and `/withdrawal` (the balance flow) with a fake
  `current_user` + NextAuth session via `setupSmokeStubs`, then
  separately mounts `/login`, `/how-it-works`, and `/pricing` with NO
  fake session via `setupSignedOutStubs` so a regression that only
  crashes for unauthenticated visitors still blocks the PR. Runs in
  both a desktop and a mobile Chromium project off the same prebuilt
  `.next/` artifact as the click-trap suite, so the added wall-clock
  cost is roughly five more `next start` page mounts per matrix entry.
  Each page fails the PR if it returns a 4xx/5xx, throws an uncaught
  JS error, logs a `console.error`, or fails to render a stable
  page-specific marker.
  - **Pages currently covered:** `/messenger`, `/notifications` (full
    click-trap suite), `/`, `/battle`, and `/withdrawal` (signed-in
    smoke — mount + no-error assertion), plus `/login`,
    `/how-it-works`, and `/pricing` (signed-out smoke — mount + no-error
    assertion with no fake session). When you add a new top-level
    route that's hit on app open, please extend `SMOKE_PAGES` (or
    `SIGNED_OUT_PAGES` if it's a marketing / pre-auth route) in
    `page-smoke.spec.js` and update this list.
- `helpers/clickTrap.js` — shared API stubs (`setupStubs`,
  `setupSmokeStubs`, `setupSignedOutStubs`), the console-error / pageerror / 5xx watcher
  (`attachConsoleErrorWatcher` + `expectNoConsoleErrors`), `<body>`
  style assertions, the full-screen overlay check, and a `scrollPage()`
  helper that pads the page with a spacer and scrolls down so the
  dropdown checks run in a scrolled state.

The click-trap specs open `/messenger` and `/notifications` in WebKit,
open and dismiss each top-bar dropdown / the mobile nav drawer, then
assert that the next icon tap registers, that `document.body` has no
leftover scroll-lock styles, and that no fixed-position element covering
the viewport is left in the DOM. The page-smoke spec runs in parallel
on Chromium against the signed-in routes (`/`, `/battle`, `/withdrawal`)
and the signed-out marketing routes (`/login`, `/how-it-works`,
`/pricing`). If any spec fails, the regression is back — fix it before
shipping and before bothering with the manual checklist.

The automated test is configured to start a Next.js server on port 3100
via Playwright's `webServer`. By default that's `npm run dev`, but with
`E2E_PROD_BUILD=1` set it switches to `npm run start` (which is what
`npm run test:e2e:ci` and the GitHub Actions workflow use). To run
against an already-running server instead, set
`E2E_BASE_URL=http://localhost:3000` (or wherever the server is) and
Playwright will skip booting its own.

## When to still run the manual checklist

WebKit emulation does **not** perfectly reproduce real iOS Safari's
click-trap behavior, so after the automated test passes you must still run
this checklist any time you touch:

- `pages/messenger.js`
- `pages/notifications.js`
- `components/TopNavbar.js`
- `components/MobileNavMenu.js`
- `hooks/useModalScrollLock.js`
- `components/messages/MessagesPanel.js` (voice-note recorder & error UI)

Run it on **all three** environments below. Every tap must register on the
**first** try. If you have to tap twice, or if a tap is swallowed by an
invisible overlay, the bug is back.

## Environments

1. Desktop browser (Chrome or Firefox at >= 1024px wide).
2. Mobile-width emulation in desktop devtools (iPhone 14 Pro / 390px).
3. Real iOS Safari (iPhone, current iOS). Devtools emulation does **not**
   reproduce the iOS Safari click-trap bug — you must test on a real device
   or a simulator running mobile Safari.

## Steps (run on each environment)

Steps marked **[automated]** are now covered by the WebKit smoke test
above and only need to be re-checked manually on real iOS Safari.
Steps marked **[manual only]** still need to be exercised by a human
on every environment.

For each environment, sign in as a normal user, then:

1. Navigate to `/messenger`.
2. **[manual only]** Tap every icon in the top bar in order (logo, search,
   bell, messages, profile/avatar, hamburger if present). Each tap must
   register on the first try.
3. **[automated]** Open the bell (notifications) dropdown. Dismiss it by
   tapping outside the dropdown. Confirm the next tap on any top-bar
   icon works on the first try.
4. **[automated]** Open the bell dropdown again. Dismiss it by tapping
   the bell icon itself. Confirm the next tap works on the first try.
5. **[automated]** Repeat steps 3 and 4 with the messages dropdown.
6. **[automated]** Open the mobile nav menu (hamburger). Dismiss it by
   tapping outside, then by tapping the hamburger again. Confirm the
   next tap works on the first try.
7. **[automated]** Navigate from `/messenger` to `/notifications` via
   the bell icon (desktop: open the bell dropdown and tap "View all";
   mobile: open the hamburger drawer and tap the Notifications link).
8. **[automated]** Repeat steps 3–6 on `/notifications`.
9. **[automated]** Navigate back to `/messenger` (desktop: browser back;
   mobile: open the drawer and tap the Messages link). Repeat steps 3–6
   once more — the bug often only surfaces after a back-and-forth
   navigation.
10. **[automated]** Scroll the page, then re-open and dismiss each
    dropdown. Confirm the page is still scrollable and that no invisible
    overlay is left behind (you can verify in Safari Web Inspector by
    toggling "Show Compositing Borders" or by inspecting the DOM for
    any leftover fixed-position backdrop nodes).
11. **[manual only] Bell → message notification → top-bar tap.** Send
    yourself a direct message from a second account. On the test device,
    open the bell dropdown and tap the message-notification row. After
    you land in the thread, immediately tap the bell or the messages
    icon in the top bar — it must respond on the first tap.
12. **[manual only] Voice-note: start, then cancel.** Open a thread,
    hold the mic button to start a voice recording, then tap the cancel
    (X) button. The composer must return to the idle text input.
    Immediately tap a top-bar icon — it must respond on the first tap
    and the body must have no leftover scroll-lock styles.
13. **[automated for /messenger landing] Voice-note: simulated upload
    failure.** In Safari Web Inspector, block requests to
    `/api/uploads/request-url` (Network tab → right click → Block URL).
    Record and release a voice note — it should fail with a single,
    clear error line ("Could not send voice note.") and the composer
    should return to idle. Tap a top-bar icon to confirm it still
    responds on the first tap.

## Pass criteria

- Every tap in steps 2–13 registers on the first attempt.
- After every dropdown / menu dismissal, the page scrolls normally and
  no full-screen overlay is visible or hit-testable in the DOM.
- `document.body` has no leftover `overflow: hidden`, `position: fixed`,
  or scroll-lock styles applied after all dropdowns are closed
  (check in Safari Web Inspector).

If any step fails, file a bug and do **not** ship the change.
