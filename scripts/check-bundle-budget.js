#!/usr/bin/env node
/*
 * Compare a fresh bundle measurement against the committed baseline.
 *
 * Inputs:
 *   --current path/to/bundle.json     (output of measure-bundle.js)
 *   --baseline docs/bundle-baseline.json
 *   --baseline-modules path/to/bundle-baseline-modules.json
 *                                     optional; per-page module
 *                                     baseline used to identify what
 *                                     newly landed in an offending
 *                                     page. Defaults to
 *                                     `docs/bundle-baseline-modules.json`
 *                                     when present, otherwise skipped.
 *   --mode warn|fail                  (default fail)
 *   --github-summary path             optional, also append a Markdown
 *                                     report to this file (used in CI for
 *                                     $GITHUB_STEP_SUMMARY).
 *   --markdown-out path               optional, also write (overwrite) the
 *                                     same Markdown report to this file.
 *                                     Used in CI to feed the sticky PR
 *                                     comment so reviewers see the diff in
 *                                     the PR conversation, not just the
 *                                     Checks tab. The file is written
 *                                     BEFORE the script exits non-zero on
 *                                     a regression, so the comment can
 *                                     still be posted on a failed build.
 *
 * Exit codes:
 *   0 — no regression, or `--mode warn` regardless of regressions
 *   1 — at least one regression and `--mode fail`
 *   2 — usage / IO error
 *
 * Two budgets are enforced:
 *   1. Total `.next/static` size must not grow by more than
 *      `thresholds.totalStaticBytesIncreaseAbsolute` bytes.
 *   2. No single page's total bundle (sum of every chunk the build
 *      manifest lists for that route) may grow by more than
 *      `thresholds.perPageIncreaseRatio` (e.g. 0.2 = 20%) AND
 *      `thresholds.perPageIncreaseAbsoluteFloor` bytes. The absolute
 *      floor prevents tiny pages (a few KB) from tripping the check on
 *      noise like a chunk-hash rename that shifted a few hundred bytes.
 *
 * When the per-page check fails, and the current measurement carries a
 * `modules` breakdown (from `measure-bundle.js` parsing source maps),
 * the report also lists the top 3 modules that grew the most on each
 * offending page versus the per-page module baseline. This is what
 * tells reviewers *why* the page got bigger — e.g. "new module
 * `node_modules/firebase/app/...` (+62 KB)" — without forcing them to
 * run `next build` locally and dig through chunk hashes.
 *
 * New pages (routes present in current but not baseline) are reported
 * but never fail — adding a page is a deliberate change that the
 * baseline refresh covers. Removed pages are reported informationally
 * only.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_BASELINE_MODULES = 'docs/bundle-baseline-modules.json';
const TOP_MODULE_DELTAS = 3;

function parseArgs(argv) {
  const args = {
    current: null,
    baseline: 'docs/bundle-baseline.json',
    baselineModules: undefined,
    mode: 'fail',
    githubSummary: null,
    markdownOut: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--current') args.current = argv[++i];
    else if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--baseline-modules') args.baselineModules = argv[++i];
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--github-summary') args.githubSummary = argv[++i];
    else if (a === '--markdown-out') args.markdownOut = argv[++i];
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: node scripts/check-bundle-budget.js --current bundle.json ' +
          '[--baseline docs/bundle-baseline.json] ' +
          '[--baseline-modules docs/bundle-baseline-modules.json] ' +
          '[--mode warn|fail] [--github-summary path] [--markdown-out path]\n',
      );
      process.exit(0);
    }
  }
  if (!args.current) {
    process.stderr.write('check-bundle-budget: --current is required\n');
    process.exit(2);
  }
  if (args.mode !== 'warn' && args.mode !== 'fail') {
    process.stderr.write(`check-bundle-budget: invalid --mode ${args.mode}\n`);
    process.exit(2);
  }
  if (args.baselineModules === undefined) {
    args.baselineModules = fs.existsSync(DEFAULT_BASELINE_MODULES)
      ? DEFAULT_BASELINE_MODULES
      : null;
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function kb(n) {
  return (n / 1024).toFixed(1);
}

function pct(n) {
  return (n * 100).toFixed(1);
}

/*
 * Pick the modules that grew the most on a single page. Returns an
 * array of { source, currentBytes, baselineBytes, delta, isNew } sorted
 * by delta descending, capped to `limit`. Sentinel buckets like
 * "[unmapped]" are filtered out; they are not actionable.
 */
function topAddedModules(currentModules, baselineModules, limit) {
  if (!currentModules) return [];
  const baseline = baselineModules || {};
  const rows = [];
  for (const [source, currentBytes] of Object.entries(currentModules)) {
    if (source.startsWith('[')) continue;
    const baselineBytes = baseline[source] || 0;
    const delta = currentBytes - baselineBytes;
    if (delta <= 0) continue;
    rows.push({
      source,
      currentBytes,
      baselineBytes,
      delta,
      isNew: baselineBytes === 0,
    });
  }
  rows.sort((a, b) => b.delta - a.delta);
  return rows.slice(0, limit);
}

function compare(current, baseline, baselineModules) {
  const t = baseline.thresholds || {};
  const totalLimit = t.totalStaticBytesIncreaseAbsolute ?? 50 * 1024;
  const ratioLimit = t.perPageIncreaseRatio ?? 0.2;
  const floor = t.perPageIncreaseAbsoluteFloor ?? 5 * 1024;

  const failures = [];
  const warnings = [];
  const informational = [];
  // Per-page module diffs for offenders, keyed by route. Used by the
  // markdown renderer (and printed to the console summary) so reviewers
  // see *which* modules drove the regression.
  const moduleDeltas = {};
  const baselineModulesByPage =
    (baselineModules && baselineModules.perPage) || {};

  const totalDelta = current.totalStaticBytes - baseline.totalStaticBytes;
  if (totalDelta > totalLimit) {
    failures.push(
      `Total .next/static grew by ${kb(totalDelta)}KB (baseline ${kb(
        baseline.totalStaticBytes,
      )}KB → current ${kb(current.totalStaticBytes)}KB), which is more ` +
        `than the +${kb(totalLimit)}KB budget.`,
    );
  }

  const baselinePages = baseline.perPage || {};
  const failingRoutes = new Set();
  for (const [route, pageInfo] of Object.entries(current.perPage || {})) {
    const currentBytes = pageInfo.totalBytes;
    const baselineBytes = baselinePages[route];
    if (baselineBytes == null) {
      informational.push(
        `New page \`${route}\` weighs ${kb(currentBytes)}KB (no baseline ` +
          `entry — refresh docs/bundle-baseline.json on merge).`,
      );
      continue;
    }
    const delta = currentBytes - baselineBytes;
    if (delta <= 0) continue;
    const ratio = delta / baselineBytes;
    if (delta >= floor && ratio > ratioLimit) {
      failures.push(
        `Page \`${route}\` grew by ${kb(delta)}KB (+${pct(ratio)}%, ` +
          `baseline ${kb(baselineBytes)}KB → current ${kb(currentBytes)}KB), ` +
          `which is more than the +${pct(ratioLimit)}% budget.`,
      );
      failingRoutes.add(route);
    }
  }

  for (const route of Object.keys(baselinePages)) {
    if (!(route in (current.perPage || {}))) {
      informational.push(`Removed page \`${route}\` from the bundle.`);
    }
  }

  // Compute top-added-modules per failing page, but only when the
  // current measurement actually carries module data. With no module
  // data we silently skip (the rest of the report is unaffected).
  if (current.modulesAvailable) {
    for (const route of failingRoutes) {
      const currentMods = (current.perPage[route] || {}).modules || {};
      const baselineMods = baselineModulesByPage[route] || {};
      const top = topAddedModules(currentMods, baselineMods, TOP_MODULE_DELTAS);
      if (top.length) moduleDeltas[route] = top;
    }
  }

  return {
    totalDelta,
    totalLimit,
    failures,
    warnings,
    informational,
    moduleDeltas,
    modulesAvailable: !!current.modulesAvailable,
    hasModuleBaseline: !!baselineModules,
  };
}

function renderModuleDeltaLine(row) {
  const tag = row.isNew ? 'new module' : 'grew';
  const baselinePart = row.isNew
    ? ''
    : ` (baseline ${kb(row.baselineBytes)}KB → current ${kb(row.currentBytes)}KB)`;
  return `${tag} \`${row.source}\` +${kb(row.delta)}KB${baselinePart}`;
}

function renderMarkdown(current, baseline, result) {
  const lines = [];
  lines.push('## Bundle size report');
  lines.push('');
  lines.push(
    `- Total \`.next/static\`: **${kb(current.totalStaticBytes)}KB** ` +
      `(baseline ${kb(baseline.totalStaticBytes)}KB, ` +
      `Δ ${result.totalDelta >= 0 ? '+' : ''}${kb(result.totalDelta)}KB; ` +
      `budget +${kb(result.totalLimit)}KB)`,
  );
  lines.push(
    `- Total JS only: **${kb(current.totalJsBytes)}KB** ` +
      `(baseline ${kb(baseline.totalJsBytes)}KB, Δ ${
        current.totalJsBytes - baseline.totalJsBytes >= 0 ? '+' : ''
      }${kb(current.totalJsBytes - baseline.totalJsBytes)}KB)`,
  );
  lines.push(
    `- Largest page: \`${current.largestPage.route}\` ` +
      `at **${kb(current.largestPage.totalBytes)}KB**`,
  );
  lines.push('');
  if (result.failures.length) {
    lines.push('### ❌ Budget exceeded');
    for (const f of result.failures) lines.push(`- ${f}`);
    lines.push('');
    const offendingRoutes = Object.keys(result.moduleDeltas);
    if (offendingRoutes.length) {
      lines.push(`### 🔍 Top ${TOP_MODULE_DELTAS} modules behind each regression`);
      for (const route of offendingRoutes) {
        lines.push(`- \`${route}\``);
        for (const row of result.moduleDeltas[route]) {
          lines.push(`  - ${renderModuleDeltaLine(row)}`);
        }
      }
      lines.push('');
    } else if (!result.modulesAvailable) {
      lines.push(
        '> ℹ️ No per-module breakdown available — rebuild with ' +
          '`productionBrowserSourceMaps: true` (the default in this repo) ' +
          'so source maps are emitted under `.next/static`.',
      );
      lines.push('');
    } else if (!result.hasModuleBaseline) {
      lines.push(
        '> ℹ️ No `docs/bundle-baseline-modules.json` to diff against — ' +
          'commit one alongside the next baseline refresh so future ' +
          'regressions can be attributed module-by-module.',
      );
      lines.push('');
    }
  } else {
    lines.push('### ✅ Within budget');
    lines.push('');
  }
  if (result.informational.length) {
    lines.push('### ℹ️ Informational');
    for (const i of result.informational) lines.push(`- ${i}`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv);
  const current = readJson(args.current);
  const baseline = readJson(args.baseline);
  const baselineModules = args.baselineModules
    ? readJson(args.baselineModules)
    : null;
  const result = compare(current, baseline, baselineModules);

  // Always print a concise summary to the console.
  process.stdout.write(
    `bundle budget: total Δ=${result.totalDelta >= 0 ? '+' : ''}` +
      `${kb(result.totalDelta)}KB (limit +${kb(result.totalLimit)}KB), ` +
      `failures=${result.failures.length}, ` +
      `info=${result.informational.length}\n`,
  );
  for (const f of result.failures) process.stdout.write(`  FAIL: ${f}\n`);
  for (const [route, rows] of Object.entries(result.moduleDeltas)) {
    process.stdout.write(`  TOP MODULES on ${route}:\n`);
    for (const row of rows) {
      process.stdout.write(`    - ${renderModuleDeltaLine(row)}\n`);
    }
  }
  for (const i of result.informational) process.stdout.write(`  INFO: ${i}\n`);

  if (args.githubSummary || args.markdownOut) {
    const md = renderMarkdown(current, baseline, result);
    if (args.githubSummary) {
      fs.mkdirSync(path.dirname(args.githubSummary), { recursive: true });
      fs.appendFileSync(args.githubSummary, md);
    }
    if (args.markdownOut) {
      const dir = path.dirname(args.markdownOut);
      if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(args.markdownOut, md);
    }
  }

  if (result.failures.length && args.mode === 'fail') {
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`check-bundle-budget: ${err.message}\n`);
    process.exit(2);
  }
}

module.exports = { compare, topAddedModules };
