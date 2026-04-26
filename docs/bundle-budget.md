# Bundle-size budget

We run `next build` on every push and pull request as part of the
**Messenger click-trap E2E** workflow
(`.github/workflows/messenger-click-trap.yml`). After the build, two
extra steps measure the resulting client bundle and compare it against a
committed baseline. The goal is to catch the kind of accidental
regression that does not break any test but doubles the JS a visitor
downloads — e.g. a stray `import 'firebase'` in a shared component, a
polyfill being pulled into every page, or a giant chart library landing
in `_app.js`.

## What gets measured

`scripts/measure-bundle.js` reads `.next/build-manifest.json` and the
file sizes under `.next/static`, then writes a JSON summary with:

- `totalStaticBytes` — sum of every file under `.next/static`
  **excluding `.js.map` source-map files**. This is the headline number
  the budget caps. Source maps are debug artifacts (see below); they
  are not user-served bundle bytes.
- `totalJsBytes` — JS-only subset of the above, reported for context.
- `totalMapBytes` — informational; the on-disk weight of the `.js.map`
  files emitted because `next.config.js` sets
  `productionBrowserSourceMaps: true`. CI gets these "for free" but
  ships them only as a workflow artifact, never to end users.
- `perPage[route].totalBytes` — sum of every chunk the build manifest
  lists for that route (shared framework chunks + the page chunk). This
  is what a fresh visitor of that page actually downloads.
- `perPage[route].pageChunkBytes` — size of just the per-page
  `static/chunks/pages/...` file, useful when isolating "this page got
  fatter" from "the shared chunks got fatter".
- `perPage[route].modules` — the heaviest source files contributing to
  that page's chunks, derived by running
  [`source-map-explorer`](https://www.npmjs.com/package/source-map-explorer)
  on every chunk's `.js.map`. Capped to the top 30 entries ≥ 1 KB so
  the JSON stays scannable. This is what powers the per-module diff
  the budget check prints when a regression hits (see below).
- `largestPage` — the heaviest route by `totalBytes`.
- `modulesAvailable` — `true` when at least one chunk had a usable
  source map and the per-page module breakdown is populated; `false`
  when the build ran without source maps and the breakdown is empty.

Run it locally after `npm run build`:

```bash
node scripts/measure-bundle.js --out bundle-current.json
```

Pass `--no-modules` to skip the source-map analysis (faster; produces
no per-page module breakdown — useful for ad-hoc spot-checks where you
only need the totals).

## Current baseline

Stored in [`docs/bundle-baseline.json`](./bundle-baseline.json) (totals
+ thresholds + per-page byte totals) and
[`docs/bundle-baseline-modules.json`](./bundle-baseline-modules.json)
(per-page module breakdown used for the regression diff).

| Metric                          | Baseline value |
| ------------------------------- | -------------- |
| Total `.next/static`            | **2851.3 KB**  |
| Total JS only                   | **2735.7 KB**  |
| Largest page (`/`)              | **788.1 KB**   |
| `_app` shared shell             | **743.3 KB**   |

The full per-route table lives in `bundle-baseline.json`; the per-page
module table lives in `bundle-baseline-modules.json`. Each value is
on-disk byte size (uncompressed) of the files Next.js wrote to
`.next/static` during a CI-equivalent build.

## Budget thresholds

Defined inline in `bundle-baseline.json` under `thresholds`:

| Threshold                              | Default       | Meaning                                                                                                                                                                              |
| -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `totalStaticBytesIncreaseAbsolute`     | **51200**     | A PR fails if `totalStaticBytes` grows by more than this many bytes (50 KB) compared to the baseline.                                                                                |
| `perPageIncreaseRatio`                 | **0.20**      | A PR fails if any single page's `totalBytes` grows by more than this fraction (20%) compared to its baseline entry.                                                                  |
| `perPageIncreaseAbsoluteFloor`         | **5120**      | The 20% rule only triggers once the absolute increase is also at least this many bytes (5 KB), so chunk-hash renames that shift a few hundred bytes through the manifest are quiet. |

You can edit the thresholds in `bundle-baseline.json` if the project's
appetite changes — the CI step reads them at runtime, no workflow edit
needed.

## What CI does

In the `build` job:

1. `next build` runs as before. Because `next.config.js` sets
   `productionBrowserSourceMaps: true`, every client chunk now also
   gets a `.js.map` file under `.next/static`. This adds roughly **15–25 %
   to total build time** (the SWC pipeline emits maps in parallel) and
   ~6.5 MB of `.map` files. Maps are excluded from `totalStaticBytes`
   so the budget itself is unaffected.
2. `node scripts/measure-bundle.js --out bundle-current.json` writes
   the measurement, including the per-page module breakdown.
3. `node scripts/check-bundle-budget.js --current bundle-current.json
   --baseline docs/bundle-baseline.json --github-summary
   "$GITHUB_STEP_SUMMARY" --markdown-out bundle-report.md --mode fail`
   compares them. On every run it:
   - Prints a one-line summary (and any `FAIL:` / `INFO:` lines) to the
     step log.
   - For every per-page failure, also prints (and includes in the
     Markdown report) the **top 3 modules behind the regression** —
     either modules that grew vs. baseline or modules that did not
     exist in the baseline at all (the common case for a stray new
     dependency).
   - Appends a Markdown report to the GitHub Actions step summary so
     reviewers see the numbers in the PR's Checks tab.
   - Writes the same Markdown report to `bundle-report.md` so the
     sticky-comment step below can post it to the PR conversation.
   - On a regression, exits non-zero, which fails the `build` job and
     blocks the PR. The report file is written *before* the non-zero
     exit, so the PR comment still gets posted on a failed budget.
4. On `pull_request` events only, the `Comment bundle-size report on
   PR` step (`marocchino/sticky-pull-request-comment@v2`) posts
   `bundle-report.md` as a single comment on the PR — keyed on the
   `bundle-size-report` header so subsequent runs update the existing
   comment instead of spamming a new one. Skipped on `push` events.
   Runs with `if: always()` so a regression that fails the check still
   gets commented. Skipped on PRs opened from forks
   (`github.event.pull_request.head.repo.full_name != github.repository`)
   because the workflow's `GITHUB_TOKEN` is read-only for fork PRs and
   the comment API call would otherwise fail; the report is still
   visible in `$GITHUB_STEP_SUMMARY` (the Checks tab) and the budget
   itself still passes/fails the build exactly the same way.
5. `bundle-current.json` is uploaded as a workflow artifact
   (`bundle-size`) regardless of pass/fail, so you can download the raw
   numbers — including the full per-page module table — from any run.

`scripts/check-bundle-budget.js` auto-discovers
`docs/bundle-baseline-modules.json` next to the byte baseline; pass
`--baseline-modules path/to/file.json` to override or
`--baseline-modules ''` to skip the diff entirely (it falls back to
listing only that the breakdown was unavailable).

## When the check fails

You will see something like this in the failed job:

```text
bundle budget: total Δ=+80.0KB (limit +50.0KB), failures=2, info=0
  FAIL: Total .next/static grew by 80.0KB (baseline 2851.3KB → current 2931.3KB),
  which is more than the +50.0KB budget.
  FAIL: Page `/messenger` grew by 80.0KB (+11.5%, baseline 695.3KB → current 775.3KB),
  which is more than the +20.0% budget.
  TOP MODULES on /messenger:
    - new module `node_modules/firebase/app/dist/index.esm.js` +62.0KB
    - new module `node_modules/firebase/firestore/dist/index.esm.js` +14.0KB
    - grew `components/messages/MessagesPanel.js` +4.0KB (baseline 35.0KB → current 39.0KB)
```

That tells you exactly which import landed where: a `firebase/app`
pull-in via `MessagesPanel.js`, costing 76 KB on `/messenger`. There
are three reasonable responses, in order of preference:

1. **It's a real regression — fix it.** The TOP MODULES list points at
   the offender directly; you usually don't need to run anything
   locally. If you want more detail, grab the `bundle-size` workflow
   artifact and inspect `bundle-current.json[perPage][route].modules`,
   or rerun `node scripts/measure-bundle.js --out bundle-current.json`
   locally after `npm run build`. Common causes: a heavy library got
   pulled into a shared component, an `import` was made eager that
   should have been `dynamic()`, or a polyfill landed in `_app.js`.
2. **It's an intentional, justified growth.** Refresh both baseline
   files:
   ```bash
   npm run build
   node scripts/measure-bundle.js --out /tmp/bundle.json
   node -e "
     const fs = require('fs');
     const baseline = JSON.parse(fs.readFileSync('docs/bundle-baseline.json','utf8'));
     const current  = JSON.parse(fs.readFileSync('/tmp/bundle.json','utf8'));
     baseline.generatedFrom    = current.measuredAt;
     baseline.totalStaticBytes = current.totalStaticBytes;
     baseline.totalJsBytes     = current.totalJsBytes;
     baseline.largestPageRoute = current.largestPage.route;
     baseline.perPage          = Object.fromEntries(
       Object.entries(current.perPage).map(([k, v]) => [k, v.totalBytes])
     );
     fs.writeFileSync('docs/bundle-baseline.json', JSON.stringify(baseline, null, 2) + '\n');
     const modules = {
       generatedFrom: current.measuredAt,
       perPage: Object.fromEntries(
         Object.entries(current.perPage).map(([k, v]) => [k, v.modules || {}])
       ),
     };
     fs.writeFileSync('docs/bundle-baseline-modules.json', JSON.stringify(modules, null, 2) + '\n');
   "
   ```
   Commit `docs/bundle-baseline.json` **and**
   `docs/bundle-baseline-modules.json` along with the change that
   caused the growth and call it out in the PR description.
3. **It's noise from a chunk-hash rename you can't pin down.** This
   should be very rare given the 5 KB absolute floor on the per-page
   rule and the 50 KB total cap, but if it happens, refresh the
   baseline as in (2) and note it in the PR.

## Auto-refresh on push to the default branch

To keep the committed baseline honest without relying on a maintainer
remembering to regenerate it, the `Messenger click-trap E2E` workflow
runs an extra `refresh-baseline` job after every successful build on a
**push to the default branch** (`main`). That job:

1. Downloads the `bundle-size` artifact uploaded by the `build` job.
2. Runs `node scripts/refresh-bundle-baseline.js --current
   bundle-current.json --baseline docs/bundle-baseline.json`, which
   preserves the `thresholds` block and overwrites the measured
   numbers from the build that just shipped.
3. Runs `node scripts/bundle-history.js --update-doc
   docs/bundle-budget.md --limit 10` to splice the just-stamped
   numbers into the [Recent baselines](#recent-baselines) trend table
   below.
4. If `docs/bundle-baseline.json` or `docs/bundle-budget.md` actually
   changed, commits both together as `github-actions[bot]` with a
   `[skip ci]` marker and pushes the commit directly back to the
   default branch.

This means **`docs/bundle-baseline.json` may show up in `git log`
authored by `github-actions[bot]`** with no human author. That is
expected — the bot is just stamping in the new numbers from the build
that shipped on the previous merge so the next PR gets compared
against an up-to-date baseline. PR runs themselves are unchanged: they
still compare the PR's measurement against the committed baseline and
fail loudly if it busts the budget. The auto-refresh job only runs on
`push` events targeting the default branch, never on pull-request
runs, forks, or pushes to other branches.

A few operational notes:

- The job uses the workflow's default `GITHUB_TOKEN` with
  `permissions: contents: write`. GitHub Actions disables recursive
  workflow triggers from `GITHUB_TOKEN`, so the bot's commit does not
  re-trigger CI; the `[skip ci]` marker in the commit message is
  belt-and-suspenders.
- The job uses a `concurrency: bundle-baseline-refresh` group with
  `cancel-in-progress: false`, so two near-simultaneous merges to the
  default branch are processed one at a time instead of racing the
  same `git push`.
- Before committing, the job runs a **freshness guard**: it fetches
  the default branch and walks `git log` looking for the most recent
  *non-bot* commit. If that commit is not the SHA this workflow ran
  on, the job exits cleanly with a `::notice::` and lets the newer
  push's own refresh job produce the canonical baseline. This
  prevents a slow build for an older commit from racing in after a
  faster build for a newer commit and stamping a stale measurement
  on top.
- If the push is rejected anyway (because something else landed on the
  default branch in between), the job re-runs the freshness guard. If
  a newer code commit has appeared, it defers; otherwise it lost the
  race to a parallel bot refresh and retries: reset onto the new tip,
  re-apply the refresh script on top of the freshly-fetched baseline
  (our measurement is still the truth for the SHA this workflow ran
  on), re-commit, push. Up to three attempts before failing loudly.
- If the freshly-measured numbers happen to match the committed
  baseline byte-for-byte, the script reports `no change` and the
  commit step exits cleanly without pushing.
- The refresh job depends on the `build` job succeeding, which
  includes the budget check itself. In the normal merge flow this is
  exactly what we want — every PR is checked against the (recent)
  committed baseline before merge, so the post-merge build comes in
  within budget and the refresh fires. If someone bypasses PR review
  and pushes a bundle-busting commit directly to the default branch,
  the build (and therefore the refresh) will fail, and a maintainer
  has to either revert the offending change or refresh the baseline
  manually using the recipe above. That is intentional: the
  auto-refresh is a convenience for tracking real, reviewed growth,
  not a way to silently absorb regressions that skipped review.

### Opting out of the auto-refresh on a given PR

The auto-refresh is a convenience, not a requirement. If you would
rather the baseline change ship under your name (e.g. an intentional
growth that you want auditable on the same commit as the code that
caused it, or a sensitive change you want a human reviewer to eyeball
the byte diff on), **hand-edit the baseline in the same PR** using the
"intentional, justified growth" recipe in [When the check
fails](#when-the-check-fails) — the same script the bot uses,
runnable locally:

```bash
npm run build
node scripts/measure-bundle.js --out /tmp/bundle.json
node scripts/refresh-bundle-baseline.js \
  --current /tmp/bundle.json \
  --baseline docs/bundle-baseline.json
```

Commit the resulting `docs/bundle-baseline.json` (and, if the
per-module breakdown materially shifted, regenerate
`docs/bundle-baseline-modules.json` with the inline-`node` recipe in
[When the check fails](#when-the-check-fails)) along with the change
that caused the growth. After the PR merges, the post-merge refresh
job will re-measure the same build, see that the committed baseline
already matches byte-for-byte, log `no change`, and exit without
pushing. There is no flag to disable the job entirely on a per-PR
basis — pre-stamping the baseline is the supported opt-out, and it
also makes the byte delta visible during code review instead of
landing as a follow-up bot commit.

## Recent baselines

Each row below is one commit to `docs/bundle-baseline.json` (newest
first), so this *is* the bundle-size trend over time. The "Δ total vs
prev" column makes 1–2 KB-per-merge creep visible at a glance — the
kind of bloat that the per-PR cap intentionally allows but that no
single PR check will ever flag. Refreshed automatically by the
`refresh-baseline` workflow job (see above) after every merge to the
default branch, in the same commit that refreshes the baseline JSON.

To regenerate the table locally (e.g. after a manual baseline refresh):

```bash
node scripts/bundle-history.js --update-doc docs/bundle-budget.md --limit 10
```

`scripts/bundle-history.js` walks the git history of
`docs/bundle-baseline.json` and can also emit the full series as CSV
or JSON for spreadsheets / charting tools:

```bash
node scripts/bundle-history.js --format csv --out bundle-history.csv
node scripts/bundle-history.js --format json --limit 0
```

Pass `--check` to verify the table is in sync with history without
writing (handy in pre-commit checks).

<!-- BUNDLE_HISTORY:START -->

| Date | Commit | Total static | Total JS | Largest page | Δ total vs prev |
| --- | --- | ---: | ---: | --- | ---: |
| 2026-04-26 | `5843def` | 2.78 MB | 2.67 MB | `/` (788.1 KB) | +51.4 KB |
| 2026-04-26 | `d5be040` | 2.73 MB | 2.62 MB | `/` (778.6 KB) | — |

<!-- BUNDLE_HISTORY:END -->

## Running the check locally

```bash
npm run build
node scripts/measure-bundle.js --out bundle-current.json
node scripts/check-bundle-budget.js \
  --current bundle-current.json \
  --baseline docs/bundle-baseline.json \
  --mode fail
```

Use `--mode warn` to print the diff without exiting non-zero.

## Dependencies

The per-module breakdown depends on
[`source-map-explorer`](https://www.npmjs.com/package/source-map-explorer)
(devDependency in `package.json`). It is invoked only by
`scripts/measure-bundle.js`, never at runtime, and never bundled into
the application.
