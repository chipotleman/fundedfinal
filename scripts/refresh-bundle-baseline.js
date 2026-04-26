#!/usr/bin/env node
/*
 * Refresh `docs/bundle-baseline.json` from a `bundle-current.json`
 * measurement produced by `scripts/measure-bundle.js`.
 *
 * The baseline file is intentionally hand-curated: it carries the
 * `thresholds` block (budget knobs) plus a flat `route -> bytes` map
 * that PRs are compared against. This script preserves the thresholds
 * verbatim, then overwrites the measured numbers from the current
 * build:
 *   - generatedFrom    <- current.measuredAt
 *   - totalStaticBytes <- current.totalStaticBytes
 *   - totalJsBytes     <- current.totalJsBytes
 *   - largestPageRoute <- current.largestPage.route
 *   - perPage          <- { route: current.perPage[route].totalBytes }
 *
 * It is used by:
 *   - maintainers who want to refresh the baseline locally after an
 *     intentional bundle growth (the recommended path right now); and
 *   - any future CI workflow that re-enables automated bundle-budget
 *     enforcement. The previous integration was a `refresh-baseline`
 *     job inside `.github/workflows/messenger-click-trap.yml`, which
 *     was removed alongside the click-trap suite — see the status
 *     banner in `docs/bundle-budget.md` for what a replacement needs
 *     to do.
 *
 * Usage:
 *   node scripts/refresh-bundle-baseline.js \
 *     --current bundle-current.json \
 *     --baseline docs/bundle-baseline.json
 *
 * Exit codes:
 *   0 — baseline written (or already up to date; see --check)
 *   1 — IO / parse error
 *   2 — usage error
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    current: null,
    baseline: 'docs/bundle-baseline.json',
    check: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--current') args.current = argv[++i];
    else if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--check') args.check = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: node scripts/refresh-bundle-baseline.js ' +
          '--current bundle-current.json ' +
          '[--baseline docs/bundle-baseline.json] [--check]\n',
      );
      process.exit(0);
    } else {
      process.stderr.write(
        `refresh-bundle-baseline: unknown argument ${a}\n`,
      );
      process.exit(2);
    }
  }
  if (!args.current) {
    process.stderr.write(
      'refresh-bundle-baseline: --current is required\n',
    );
    process.exit(2);
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Build the refreshed baseline object from `current` while preserving
 * `baseline.thresholds` (and any other unknown fields) verbatim.
 */
function buildRefreshedBaseline(baseline, current) {
  const refreshed = { ...baseline };
  refreshed.generatedFrom = current.measuredAt;
  refreshed.totalStaticBytes = current.totalStaticBytes;
  refreshed.totalJsBytes = current.totalJsBytes;
  refreshed.largestPageRoute =
    current.largestPage && current.largestPage.route
      ? current.largestPage.route
      : null;
  refreshed.perPage = Object.fromEntries(
    Object.entries(current.perPage || {}).map(([route, info]) => [
      route,
      info.totalBytes,
    ]),
  );
  return refreshed;
}

function serialize(obj) {
  // Match the existing baseline file's formatting: 2-space indent,
  // trailing newline.
  return JSON.stringify(obj, null, 2) + '\n';
}

function main() {
  const args = parseArgs(process.argv);
  const current = readJson(args.current);
  const baseline = fs.existsSync(args.baseline)
    ? readJson(args.baseline)
    : { thresholds: {} };

  const refreshed = buildRefreshedBaseline(baseline, current);
  const next = serialize(refreshed);
  const prev = fs.existsSync(args.baseline)
    ? fs.readFileSync(args.baseline, 'utf8')
    : '';

  if (next === prev) {
    process.stdout.write(
      `refresh-bundle-baseline: no change (${args.baseline} already ` +
        `matches ${args.current}).\n`,
    );
    if (args.check) process.exit(0);
    return;
  }

  if (args.check) {
    process.stdout.write(
      `refresh-bundle-baseline: ${args.baseline} would change ` +
        `(run without --check to write).\n`,
    );
    process.exit(0);
    return;
  }

  fs.mkdirSync(path.dirname(args.baseline), { recursive: true });
  fs.writeFileSync(args.baseline, next);
  process.stdout.write(
    `refresh-bundle-baseline: wrote ${args.baseline} ` +
      `(total=${refreshed.totalStaticBytes}B, ` +
      `js=${refreshed.totalJsBytes}B, ` +
      `routes=${Object.keys(refreshed.perPage).length}).\n`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`refresh-bundle-baseline: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { buildRefreshedBaseline };
