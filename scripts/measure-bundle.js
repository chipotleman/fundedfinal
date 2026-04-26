#!/usr/bin/env node
/*
 * Measure the production JavaScript bundle produced by `next build`.
 *
 * Reads `.next/build-manifest.json` and the file sizes under `.next/static`
 * and emits a JSON summary describing:
 *   - totalStaticBytes  : on-disk size of every file under `.next/static`
 *                          EXCLUDING `.js.map` source-map files. Source maps
 *                          are debug-only artifacts that we ship in CI to
 *                          power the per-module breakdown below; they are
 *                          not user-served bundle bytes, so the budget
 *                          tracks bundle size, not map size.
 *   - totalJsBytes      : on-disk size of every `.js` file under
 *                          `.next/static` (the part that runs on the
 *                          client). This is the headline number we trend.
 *   - totalMapBytes     : informational — the on-disk weight of the
 *                          `.js.map` files (the "extra build size" cost
 *                          of `productionBrowserSourceMaps: true`).
 *   - perPage           : map of route -> { totalBytes, pageChunkBytes,
 *                          chunks: [{ file, bytes }],
 *                          modules: { '<source>': bytes, ... } }, where:
 *                            totalBytes      = sum of every chunk the
 *                                              build manifest lists for
 *                                              that page (shared +
 *                                              page-specific). This is
 *                                              what a fresh visitor
 *                                              downloads.
 *                            pageChunkBytes  = size of just the per-page
 *                                              chunk under
 *                                              `static/chunks/pages/<route>-<hash>.js`,
 *                                              i.e. the marginal cost of
 *                                              the page itself.
 *                            modules         = per-source-file byte
 *                                              attribution aggregated
 *                                              across every chunk that
 *                                              the page loads, derived
 *                                              from the chunk's source
 *                                              map via
 *                                              `source-map-explorer`.
 *                                              Capped to the heaviest
 *                                              `MODULES_PER_PAGE` entries
 *                                              that meet `MIN_MODULE_BYTES`
 *                                              so the JSON stays readable.
 *                                              Empty if no source map was
 *                                              found (e.g. when the build
 *                                              ran without
 *                                              `productionBrowserSourceMaps`).
 *   - largestPage       : { route, totalBytes } — the heaviest page by
 *                          totalBytes, which is the metric the budget
 *                          enforces a per-page cap on.
 *
 * Usage:
 *   node scripts/measure-bundle.js [--out path/to/out.json] [--next .next]
 *                                   [--no-modules]
 *
 * If --out is omitted the JSON is written to stdout.
 * `--no-modules` skips the source-map analysis (faster; produces no
 * per-page module breakdown).
 */

const fs = require('fs');
const path = require('path');

// How much per-page module detail to keep in the output JSON. The cap
// keeps `bundle-current.json` and the committed
// `docs/bundle-baseline-modules.json` small while still capturing every
// module heavy enough to plausibly cause a budget regression.
const MODULES_PER_PAGE = 30;
const MIN_MODULE_BYTES = 1024;

function parseArgs(argv) {
  const args = { out: null, nextDir: '.next', withModules: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--next') args.nextDir = argv[++i];
    else if (a === '--no-modules') args.withModules = false;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: node scripts/measure-bundle.js [--out file] [--next dir] [--no-modules]\n',
      );
      process.exit(0);
    }
  }
  return args;
}

function walkSize(dir) {
  let total = 0;
  let jsTotal = 0;
  let mapTotal = 0;
  if (!fs.existsSync(dir)) return { total, jsTotal, mapTotal };
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
        if (entry.name.endsWith('.js.map') || entry.name.endsWith('.map')) {
          mapTotal += size;
        } else {
          total += size;
          if (entry.name.endsWith('.js')) jsTotal += size;
        }
      }
    }
  }
  return { total, jsTotal, mapTotal };
}

function safeStatSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/*
 * Normalize source paths returned by source-map-explorer / webpack so
 * the same dependency surfaces with the same key on every machine and
 * in every chunk. Examples:
 *   "webpack:///./node_modules/firebase/app/dist/index.esm.js"
 *     -> "node_modules/firebase/app/dist/index.esm.js"
 *   "webpack:///./components/messages/MessagesPanel.js"
 *     -> "components/messages/MessagesPanel.js"
 *   "webpack:///./node_modules/next/dist/client/app-router.js?123"
 *     -> "node_modules/next/dist/client/app-router.js"
 * Sentinel keys ("[unmapped]", "[no source]", "[sourceMappingURL]") are
 * passed through unchanged.
 */
function normalizeSourcePath(raw) {
  if (!raw) return raw;
  if (raw.startsWith('[')) return raw;
  let p = raw;
  // Strip the `webpack://` prefix and the optional bundle name segment
  // (e.g. `_N_E` for Next.js's edge-renderer chunks, empty for the
  // default `webpack:///./foo` form).
  p = p.replace(/^webpack:\/\/[^/]*\/?/, '');
  p = p.replace(/^\.\//, '');
  // Strip query strings webpack adds for loaders / hot-update markers.
  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  return p;
}

/*
 * Run source-map-explorer on a single chunk file and return a map of
 * normalized source path -> bytes contributed to that chunk. Returns
 * null if no source map is available for the chunk (e.g. older build,
 * `productionBrowserSourceMaps` disabled, or webpack runtime chunk that
 * has no map).
 */
async function analyzeChunk(absChunkPath) {
  const mapPath = absChunkPath + '.map';
  if (!fs.existsSync(mapPath)) return null;
  // Lazy require so callers using --no-modules don't pay the load cost.
  const { explore } = require('source-map-explorer');
  // Read the chunk + map content and hand them to sme as buffers
  // rather than passing the path. Some Next.js dynamic-route chunks
  // live at paths like `.../pages/profile/[id]-<hash>.js`; passing
  // such paths to sme has it run them through `glob`, which treats
  // `[id]` as a character class and finds zero matches.
  const code = fs.readFileSync(absChunkPath);
  const map = fs.readFileSync(mapPath);
  let result;
  try {
    // `noBorderChecks: true` because Next.js's webpack source maps
    // occasionally reference a generated column past the end of the
    // line (`InvalidMappingColumn` from sme). It is purely a strict-
    // validation issue; the byte attribution is still accurate.
    result = await explore(
      { code, map },
      {
        output: { format: 'json' },
        noBorderChecks: true,
        gzip: false,
      },
    );
  } catch (err) {
    // source-map-explorer rejects with the same `{ bundles, errors }`
    // shape it returns on success when EVERY bundle errors out.
    const errors = (err && err.errors) || [];
    const summary = errors.length
      ? errors
          .map((e) => `${e.code || 'Error'}: ${(e.message || '').split('\n')[0]}`)
          .join('; ')
      : err && err.message
      ? err.message
      : String(err);
    process.stderr.write(
      `measure-bundle: source-map-explorer failed for ${path.basename(
        absChunkPath,
      )}: ${summary}\n`,
    );
    return null;
  }
  const bundle =
    result && result.bundles && result.bundles[0] ? result.bundles[0] : null;
  if (!bundle || !bundle.files) return null;
  const out = {};
  for (const [src, info] of Object.entries(bundle.files)) {
    // source-map-explorer returns either a number or { size: number }
    // depending on the `output.format` setting. With `format: 'json'`
    // it gives `{ size: number }`.
    const bytes = typeof info === 'number' ? info : info && info.size;
    if (!bytes) continue;
    const key = normalizeSourcePath(src);
    out[key] = (out[key] || 0) + bytes;
  }
  return out;
}

/*
 * Limit a `{ source: bytes }` object to the heaviest entries that meet
 * MIN_MODULE_BYTES, keeping at most MODULES_PER_PAGE keys. Sentinel
 * "[unmapped]" / "[no source]" buckets are kept regardless of size when
 * non-zero so reviewers can see that some bytes weren't attributed.
 */
function topModules(modules) {
  const entries = Object.entries(modules);
  // Always keep sentinel buckets if present.
  const sentinels = entries.filter(([k]) => k.startsWith('['));
  const concrete = entries
    .filter(([k]) => !k.startsWith('['))
    .filter(([, v]) => v >= MIN_MODULE_BYTES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MODULES_PER_PAGE);
  const out = {};
  for (const [k, v] of concrete) out[k] = v;
  for (const [k, v] of sentinels) {
    if (v > 0) out[k] = v;
  }
  return out;
}

async function measure(nextDir, { withModules = true } = {}) {
  const staticDir = path.join(nextDir, 'static');
  const manifestPath = path.join(nextDir, 'build-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `build-manifest.json not found at ${manifestPath}. Did \`next build\` run?`,
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { total: totalStaticBytes, jsTotal: totalJsBytes, mapTotal: totalMapBytes } =
    walkSize(staticDir);

  // First pass: find every unique chunk file the manifest references
  // and record per-page chunk totals as before.
  const perPage = {};
  const chunkSet = new Set();
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
      if (rel.startsWith('static/chunks/pages/')) {
        pageChunkBytes += size;
      }
      if (rel.endsWith('.js')) chunkSet.add(rel);
    }
    perPage[route] = { totalBytes, pageChunkBytes, chunks, modules: {} };
    if (totalBytes > largestPage.totalBytes) {
      largestPage = { route, totalBytes };
    }
  }

  // Second pass: analyze each unique chunk once, in parallel, then
  // aggregate per-page module attribution.
  let modulesAvailable = false;
  if (withModules) {
    const chunkList = [...chunkSet];
    const results = await Promise.all(
      chunkList.map(async (rel) => {
        const abs = path.join(nextDir, rel);
        const breakdown = await analyzeChunk(abs);
        return [rel, breakdown];
      }),
    );
    const chunkModules = new Map();
    for (const [rel, breakdown] of results) {
      if (breakdown) {
        modulesAvailable = true;
        chunkModules.set(rel, breakdown);
      }
    }
    for (const [route, info] of Object.entries(perPage)) {
      const agg = {};
      for (const { file } of info.chunks) {
        const breakdown = chunkModules.get(file);
        if (!breakdown) continue;
        for (const [src, bytes] of Object.entries(breakdown)) {
          agg[src] = (agg[src] || 0) + bytes;
        }
      }
      info.modules = topModules(agg);
    }
  }

  return {
    measuredAt: new Date().toISOString(),
    totalStaticBytes,
    totalJsBytes,
    totalMapBytes,
    modulesAvailable,
    largestPage,
    perPage,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await measure(args.nextDir, { withModules: args.withModules });
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
        `(${kb(result.largestPage.totalBytes)}KB) ` +
        `modules=${result.modulesAvailable ? 'yes' : 'no'}\n`,
    );
  } else {
    process.stdout.write(json + '\n');
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`measure-bundle: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { measure, normalizeSourcePath, topModules };
