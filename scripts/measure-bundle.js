#!/usr/bin/env node
/*
 * Measure the production JavaScript bundle produced by `next build`.
 *
 * Reads `.next/build-manifest.json` and the file sizes under `.next/static`
 * and emits a small JSON summary describing:
 *   - totalStaticBytes  : on-disk size of every file under `.next/static`
 *                          (JS + CSS + media + manifest), the user-visible
 *                          asset surface area.
 *   - totalJsBytes      : on-disk size of every `.js` file under
 *                          `.next/static` (the part that runs on the
 *                          client). This is the headline number we trend.
 *   - perPage           : map of route -> { totalBytes, pageChunkBytes,
 *                          chunks: [{ file, bytes }] }, where:
 *                            totalBytes      = sum of every chunk the
 *                                              build manifest lists for
 *                                              that page (shared +
 *                                              page-specific). This is
 *                            what a fresh visitor downloads.
 *                            pageChunkBytes  = size of just the per-page
 *                                              chunk under
 *                                              `static/chunks/pages/<route>-<hash>.js`,
 *                                              i.e. the marginal cost of
 *                                              the page itself.
 *   - largestPage       : { route, totalBytes } — the heaviest page by
 *                          totalBytes, which is the metric the budget
 *                          enforces a per-page cap on.
 *
 * Usage:
 *   node scripts/measure-bundle.js [--out path/to/out.json] [--next .next]
 *
 * If --out is omitted the JSON is written to stdout.
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { out: null, nextDir: '.next' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--next') args.nextDir = argv[++i];
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: node scripts/measure-bundle.js [--out file] [--next dir]\n',
      );
      process.exit(0);
    }
  }
  return args;
}

function walkSize(dir) {
  let total = 0;
  let jsTotal = 0;
  if (!fs.existsSync(dir)) return { total, jsTotal };
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const { size } = fs.statSync(full);
        total += size;
        if (entry.name.endsWith('.js')) jsTotal += size;
      }
    }
  }
  return { total, jsTotal };
}

function safeStatSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function measure(nextDir) {
  const staticDir = path.join(nextDir, 'static');
  const manifestPath = path.join(nextDir, 'build-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `build-manifest.json not found at ${manifestPath}. Did \`next build\` run?`,
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { total: totalStaticBytes, jsTotal: totalJsBytes } = walkSize(staticDir);

  const perPage = {};
  let largestPage = { route: null, totalBytes: 0 };
  for (const [route, files] of Object.entries(manifest.pages || {})) {
    let totalBytes = 0;
    let pageChunkBytes = 0;
    const chunks = [];
    for (const rel of files) {
      const abs = path.join(nextDir, rel);
      const size = safeStatSize(abs);
      totalBytes += size;
      chunks.push({ file: rel, bytes: size });
      // The per-page chunk lives at static/chunks/pages/<route>-<hash>.js
      // (or, for nested routes, static/chunks/pages/<segment>/<segment>-<hash>.js).
      if (rel.startsWith('static/chunks/pages/')) {
        pageChunkBytes += size;
      }
    }
    perPage[route] = { totalBytes, pageChunkBytes, chunks };
    if (totalBytes > largestPage.totalBytes) {
      largestPage = { route, totalBytes };
    }
  }

  return {
    measuredAt: new Date().toISOString(),
    totalStaticBytes,
    totalJsBytes,
    largestPage,
    perPage,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const result = measure(args.nextDir);
  const json = JSON.stringify(result, null, 2);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, json + '\n');
    // Also print a one-line human summary so the CI log is useful at a glance.
    const kb = (n) => (n / 1024).toFixed(1);
    process.stdout.write(
      `bundle: total=${kb(result.totalStaticBytes)}KB ` +
        `js=${kb(result.totalJsBytes)}KB ` +
        `largestPage=${result.largestPage.route} ` +
        `(${kb(result.largestPage.totalBytes)}KB)\n`,
    );
  } else {
    process.stdout.write(json + '\n');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`measure-bundle: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { measure };
