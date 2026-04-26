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

- `totalStaticBytes` — sum of every file under `.next/static` (JS, CSS,
  media, manifests). This is the headline number the budget caps.
- `totalJsBytes` — JS-only subset of the above, reported for context.
- `perPage[route].totalBytes` — sum of every chunk the build manifest
  lists for that route (shared framework chunks + the page chunk). This
  is what a fresh visitor of that page actually downloads.
- `perPage[route].pageChunkBytes` — size of just the per-page
  `static/chunks/pages/...` file, useful when isolating "this page got
  fatter" from "the shared chunks got fatter".
- `largestPage` — the heaviest route by `totalBytes`.

Run it locally after `npm run build`:

```bash
node scripts/measure-bundle.js --out bundle-current.json
```

## Current baseline

Stored in [`docs/bundle-baseline.json`](./bundle-baseline.json).

| Metric                          | Baseline value |
| ------------------------------- | -------------- |
| Total `.next/static`            | **2799.8 KB**  |
| Total JS only                   | **2685.1 KB**  |
| Largest page (`/`)              | **778.6 KB**   |
| `_app` shared shell             | **733.4 KB**   |

The full per-route table lives in `bundle-baseline.json`. Each value is
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

1. `next build` runs as before.
2. `node scripts/measure-bundle.js --out bundle-current.json` writes the
   measurement.
3. `node scripts/check-bundle-budget.js --current bundle-current.json
   --baseline docs/bundle-baseline.json --github-summary
   "$GITHUB_STEP_SUMMARY" --mode fail` compares them. On a regression
   it:
   - Prints a `FAIL: …` line per offending metric to the step log.
   - Appends a Markdown report to the GitHub Actions step summary so
     reviewers see the numbers right in the PR's Checks tab.
   - Exits non-zero, which fails the `build` job and blocks the PR.
4. `bundle-current.json` is uploaded as a workflow artifact
   (`bundle-size`) regardless of pass/fail, so you can download the raw
   numbers from any run.

## When the check fails

You will see something like this in the failed job:

```text
bundle budget: total Δ=+72.3KB (limit +50.0KB), failures=1, info=0
  FAIL: Total .next/static grew by 72.3KB (baseline 2799.8KB → current 2872.1KB),
  which is more than the +50.0KB budget.
```

There are three reasonable responses, in order of preference:

1. **It's a real regression — fix it.** Run `npm run build` locally,
   then `node scripts/measure-bundle.js` and inspect which page or
   shared chunk grew. Common causes: a heavy library got pulled into a
   shared component, an `import` was made eager that should have been
   `dynamic()`, or a polyfill landed in `_app.js`.
2. **It's an intentional, justified growth.** Refresh the baseline:
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
   "
   ```
   Commit `docs/bundle-baseline.json` along with the change that caused
   the growth and call it out in the PR description.
3. **It's noise from a chunk-hash rename you can't pin down.** This
   should be very rare given the 5 KB absolute floor on the per-page
   rule and the 50 KB total cap, but if it happens, refresh the
   baseline as in (2) and note it in the PR.

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
