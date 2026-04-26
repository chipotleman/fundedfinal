#!/usr/bin/env node
/*
 * Compare a fresh bundle measurement against the committed baseline.
 *
 * Inputs:
 *   --current path/to/bundle.json     (output of measure-bundle.js)
 *   --baseline docs/bundle-baseline.json
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
 * New pages (routes present in current but not baseline) are reported
 * but never fail — adding a page is a deliberate change that the
 * baseline refresh covers. Removed pages are reported informationally
 * only.
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    current: null,
    baseline: 'docs/bundle-baseline.json',
    mode: 'fail',
    githubSummary: null,
    markdownOut: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--current') args.current = argv[++i];
    else if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--github-summary') args.githubSummary = argv[++i];
    else if (a === '--markdown-out') args.markdownOut = argv[++i];
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: node scripts/check-bundle-budget.js --current bundle.json ' +
          '[--baseline docs/bundle-baseline.json] [--mode warn|fail] ' +
          '[--github-summary path] [--markdown-out path]\n',
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

function compare(current, baseline) {
  const t = baseline.thresholds || {};
  const totalLimit = t.totalStaticBytesIncreaseAbsolute ?? 50 * 1024;
  const ratioLimit = t.perPageIncreaseRatio ?? 0.2;
  const floor = t.perPageIncreaseAbsoluteFloor ?? 5 * 1024;

  const failures = [];
  const warnings = [];
  const informational = [];

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
    }
  }

  for (const route of Object.keys(baselinePages)) {
    if (!(route in (current.perPage || {}))) {
      informational.push(`Removed page \`${route}\` from the bundle.`);
    }
  }

  return { totalDelta, totalLimit, failures, warnings, informational };
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
  const result = compare(current, baseline);

  // Always print a concise summary to the console.
  process.stdout.write(
    `bundle budget: total Δ=${result.totalDelta >= 0 ? '+' : ''}` +
      `${kb(result.totalDelta)}KB (limit +${kb(result.totalLimit)}KB), ` +
      `failures=${result.failures.length}, ` +
      `info=${result.informational.length}\n`,
  );
  for (const f of result.failures) process.stdout.write(`  FAIL: ${f}\n`);
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

module.exports = { compare };
