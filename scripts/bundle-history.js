#!/usr/bin/env node
/*
 * Build a time series of bundle-size baselines from the git history
 * of `docs/bundle-baseline.json`.
 *
 * The baseline file is auto-refreshed after every successful build on
 * the default branch (see `docs/bundle-budget.md` and the
 * `refresh-baseline` job in `.github/workflows/messenger-click-trap.yml`),
 * so its git history is itself a time series of the headline numbers
 * `totalStaticBytes`, `totalJsBytes`, the `largestPageRoute`, and that
 * route's `totalBytes`. Reading that history straight out of
 * `git log -p` requires eyeballing JSON diffs, which is exactly the
 * kind of friction that lets the bundle creep up by 1–2 KB per merge
 * inside the per-PR cap.
 *
 * This script walks the git log, parses each historical version of
 * the baseline, and emits the trend in one of three shapes:
 *   - `markdown` (default): a small table of the most recent N
 *     baselines, suitable for pasting into `docs/bundle-budget.md`
 *     between `<!-- BUNDLE_HISTORY:START -->` /
 *     `<!-- BUNDLE_HISTORY:END -->` marker comments. Pass
 *     `--update-doc docs/bundle-budget.md` to do the splice
 *     in-place — that is what the `refresh-baseline` workflow job
 *     uses.
 *   - `csv`: full time series, one row per baseline, suitable for
 *     loading into a spreadsheet / charting tool.
 *   - `json`: the same time series as a JSON array.
 *
 * The most recent entry is the current working-tree copy of the
 * baseline file (tagged `(uncommitted)` when it differs from the
 * newest committed version), so the freshly-refreshed numbers show
 * up in the same commit that refreshed them. Pass
 * `--no-include-uncommitted` to read purely from the committed
 * history.
 *
 * Usage:
 *   node scripts/bundle-history.js                       # markdown table to stdout
 *   node scripts/bundle-history.js --format csv --out bundle-history.csv
 *   node scripts/bundle-history.js --update-doc docs/bundle-budget.md --limit 10
 *   node scripts/bundle-history.js --update-doc docs/bundle-budget.md --check
 *
 * Exit codes:
 *   0 — output written (or, with --check, no change would be made)
 *   1 — IO / parse / git error
 *   2 — usage error
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_BASELINE = 'docs/bundle-baseline.json';
const DEFAULT_LIMIT = 90;
const DEFAULT_DOC_LIMIT = 10;
const MARKER_START = '<!-- BUNDLE_HISTORY:START -->';
const MARKER_END = '<!-- BUNDLE_HISTORY:END -->';

function parseArgs(argv) {
  const args = {
    baseline: DEFAULT_BASELINE,
    limit: null,
    format: null,
    out: null,
    updateDoc: null,
    check: false,
    includeUncommitted: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--format') args.format = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--update-doc') args.updateDoc = argv[++i];
    else if (a === '--check') args.check = true;
    else if (a === '--include-uncommitted') args.includeUncommitted = true;
    else if (a === '--no-include-uncommitted') args.includeUncommitted = false;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(usage());
      process.exit(0);
    } else {
      process.stderr.write(`bundle-history: unknown argument ${a}\n`);
      process.exit(2);
    }
  }

  if (args.updateDoc && args.out) {
    process.stderr.write(
      'bundle-history: --update-doc and --out are mutually exclusive\n',
    );
    process.exit(2);
  }
  if (args.updateDoc) {
    if (args.format && args.format !== 'markdown') {
      process.stderr.write(
        'bundle-history: --update-doc requires --format markdown ' +
          `(got ${args.format})\n`,
      );
      process.exit(2);
    }
    args.format = 'markdown';
    if (args.limit == null) args.limit = DEFAULT_DOC_LIMIT;
  }
  if (!args.format) args.format = 'markdown';
  if (args.limit == null) args.limit = DEFAULT_LIMIT;
  if (!Number.isFinite(args.limit) || args.limit < 0) {
    process.stderr.write(
      `bundle-history: --limit must be a non-negative integer (got ${args.limit})\n`,
    );
    process.exit(2);
  }
  if (!['markdown', 'csv', 'json'].includes(args.format)) {
    process.stderr.write(
      `bundle-history: --format must be markdown|csv|json (got ${args.format})\n`,
    );
    process.exit(2);
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/bundle-history.js [options]',
    '',
    '  --baseline <path>           Baseline file whose git history to walk.',
    `                              Default: ${DEFAULT_BASELINE}`,
    '  --limit <N>                 Max entries to include (newest first).',
    `                              Default: ${DEFAULT_LIMIT} (or ${DEFAULT_DOC_LIMIT} with --update-doc).`,
    '                              Pass 0 for no limit.',
    '  --format <markdown|csv|json> Output format. Default: markdown.',
    '  --out <path>                Write output to file. Default: stdout.',
    '  --update-doc <path>         Splice a markdown table into <path>',
    '                              between <!-- BUNDLE_HISTORY:START --> and',
    '                              <!-- BUNDLE_HISTORY:END --> markers.',
    '                              Implies --format markdown.',
    '  --check                     Print whether --update-doc / --out would',
    '                              change anything; exit 0 without writing.',
    '  --no-include-uncommitted    Skip the working-tree copy of the',
    '                              baseline (read only committed history).',
    '',
  ].join('\n');
}

/**
 * Run a git command from the repo root and return stdout as a string.
 * Throws on non-zero exit so the caller can surface a meaningful error.
 */
function git(args, opts = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

/**
 * Read the on-disk content of a path as parsed JSON, or null if the
 * file does not exist / cannot be parsed.
 */
function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    process.stderr.write(
      `bundle-history: failed to parse ${file}: ${err.message}\n`,
    );
    return null;
  }
}

/**
 * Pull the headline numbers we trend out of a parsed baseline object.
 * Returns null if the object does not look like a baseline (e.g. an
 * older commit predating the file's introduction).
 */
function extractMetrics(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const total =
    typeof parsed.totalStaticBytes === 'number'
      ? parsed.totalStaticBytes
      : null;
  const js =
    typeof parsed.totalJsBytes === 'number' ? parsed.totalJsBytes : null;
  if (total == null && js == null) return null;
  const largestRoute =
    typeof parsed.largestPageRoute === 'string'
      ? parsed.largestPageRoute
      : null;
  const largestBytes =
    largestRoute && parsed.perPage && typeof parsed.perPage === 'object'
      ? typeof parsed.perPage[largestRoute] === 'number'
        ? parsed.perPage[largestRoute]
        : null
      : null;
  const generatedFrom =
    typeof parsed.generatedFrom === 'string' ? parsed.generatedFrom : null;
  return {
    totalStaticBytes: total,
    totalJsBytes: js,
    largestPageRoute: largestRoute,
    largestPageBytes: largestBytes,
    generatedFrom,
  };
}

/**
 * Walk `git log` for the baseline file and return one entry per
 * commit, newest first. Each entry is a plain object with the metrics
 * plus commit metadata. Commits whose blob doesn't parse as a
 * recognisable baseline are silently skipped.
 *
 * `--follow` is used so renames (none today, but cheap insurance)
 * don't truncate the history.
 */
function readCommittedHistory(baselinePath) {
  let logOut = '';
  try {
    logOut = git([
      'log',
      '--follow',
      '--format=%H%x09%aI%x09%an%x09%ae%x09%s',
      '--',
      baselinePath,
    ]);
  } catch (err) {
    process.stderr.write(
      `bundle-history: git log failed for ${baselinePath}: ${err.message}\n`,
    );
    return [];
  }
  const lines = logOut.split('\n').filter(Boolean);
  const entries = [];
  for (const line of lines) {
    const [sha, date, author, email, subject] = line.split('\t');
    if (!sha) continue;
    let raw;
    try {
      raw = git(['show', `${sha}:${baselinePath}`]);
    } catch {
      // File may not have existed at this commit if git follows
      // through a merge it can't render; skip silently.
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const metrics = extractMetrics(parsed);
    if (!metrics) continue;
    entries.push({
      commit: sha,
      shortCommit: sha.slice(0, 7),
      date,
      author,
      email,
      subject,
      uncommitted: false,
      ...metrics,
    });
  }
  return entries;
}

/**
 * If the working-tree copy of the baseline differs from the newest
 * committed version, prepend it as a synthetic newest entry tagged
 * `(uncommitted)` so the just-refreshed numbers show up in the same
 * commit that refreshes them.
 */
function maybePrependUncommitted(entries, baselinePath) {
  if (!fs.existsSync(baselinePath)) return entries;
  const onDisk = readJsonIfExists(baselinePath);
  const metrics = extractMetrics(onDisk);
  if (!metrics) return entries;
  const newest = entries[0];
  const sameAsNewest =
    newest &&
    newest.totalStaticBytes === metrics.totalStaticBytes &&
    newest.totalJsBytes === metrics.totalJsBytes &&
    newest.largestPageRoute === metrics.largestPageRoute &&
    newest.largestPageBytes === metrics.largestPageBytes &&
    newest.generatedFrom === metrics.generatedFrom;
  if (sameAsNewest) return entries;
  return [
    {
      commit: '(uncommitted)',
      shortCommit: '(uncommitted)',
      date: metrics.generatedFrom || new Date().toISOString(),
      author: '(uncommitted)',
      email: '',
      subject: '(working-tree copy of baseline)',
      uncommitted: true,
      ...metrics,
    },
    ...entries,
  ];
}

function gatherEntries(args) {
  const committed = readCommittedHistory(args.baseline);
  const entries = args.includeUncommitted
    ? maybePrependUncommitted(committed, args.baseline)
    : committed;
  return args.limit > 0 ? entries.slice(0, args.limit) : entries;
}

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDelta(curr, prev) {
  if (curr == null || prev == null) return '—';
  const delta = curr - prev;
  if (delta === 0) return '±0 B';
  const sign = delta > 0 ? '+' : '−';
  const abs = Math.abs(delta);
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)} KB`;
  return `${sign}${abs} B`;
}

function formatDate(iso) {
  if (!iso) return '—';
  // YYYY-MM-DD is enough for trend reading; the full ISO is in the
  // CSV/JSON output if you need it.
  return iso.slice(0, 10);
}

function renderMarkdown(entries) {
  if (entries.length === 0) {
    return [
      '_No bundle baselines have been committed yet — the table will',
      'populate after the first push to the default branch refreshes',
      '`docs/bundle-baseline.json`._',
      '',
    ].join('\n');
  }
  const header = [
    '| Date | Commit | Total static | Total JS | Largest page | Δ total vs prev |',
    '| --- | --- | ---: | ---: | --- | ---: |',
  ];
  // Newest first; "previous" for the delta column is the next-older
  // entry in the time series (i.e. entries[i + 1] in this list).
  const rows = entries.map((e, i) => {
    const prev = entries[i + 1];
    const deltaTotal = formatDelta(
      e.totalStaticBytes,
      prev ? prev.totalStaticBytes : null,
    );
    const commitCell = e.uncommitted
      ? '`(uncommitted)`'
      : `\`${e.shortCommit}\``;
    const largest = e.largestPageRoute
      ? `\`${e.largestPageRoute}\` (${formatBytes(e.largestPageBytes)})`
      : '—';
    return `| ${formatDate(e.date)} | ${commitCell} | ${formatBytes(e.totalStaticBytes)} | ${formatBytes(e.totalJsBytes)} | ${largest} | ${deltaTotal} |`;
  });
  return [...header, ...rows, ''].join('\n');
}

function renderCsv(entries) {
  const header = [
    'commit',
    'date',
    'author',
    'total_static_bytes',
    'total_js_bytes',
    'largest_page_route',
    'largest_page_bytes',
    'uncommitted',
  ];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = entries.map((e) =>
    [
      e.commit,
      e.date,
      e.author,
      e.totalStaticBytes,
      e.totalJsBytes,
      e.largestPageRoute,
      e.largestPageBytes,
      e.uncommitted ? 'true' : 'false',
    ]
      .map(escape)
      .join(','),
  );
  return [header.join(','), ...rows, ''].join('\n');
}

function renderJson(entries) {
  return JSON.stringify(entries, null, 2) + '\n';
}

function render(args, entries) {
  if (args.format === 'csv') return renderCsv(entries);
  if (args.format === 'json') return renderJson(entries);
  return renderMarkdown(entries);
}

/**
 * Splice `table` into `doc` between MARKER_START and MARKER_END,
 * preserving everything outside the markers verbatim. Throws if the
 * markers are missing or malformed so the workflow fails loudly
 * rather than silently producing a doc with no table.
 */
function spliceMarkers(doc, table) {
  const startIdx = doc.indexOf(MARKER_START);
  const endIdx = doc.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `missing ${MARKER_START} / ${MARKER_END} markers in target doc`,
    );
  }
  if (endIdx < startIdx) {
    throw new Error(
      `${MARKER_END} appears before ${MARKER_START} in target doc`,
    );
  }
  const before = doc.slice(0, startIdx + MARKER_START.length);
  const after = doc.slice(endIdx);
  // Always sandwich the table with blank lines so it renders as a
  // standalone block regardless of what surrounds the markers.
  return `${before}\n\n${table.trimEnd()}\n\n${after}`;
}

function main() {
  const args = parseArgs(process.argv);
  const entries = gatherEntries(args);
  const rendered = render(args, entries);

  if (args.updateDoc) {
    const docPath = args.updateDoc;
    if (!fs.existsSync(docPath)) {
      process.stderr.write(`bundle-history: ${docPath} does not exist\n`);
      process.exit(1);
    }
    const prev = fs.readFileSync(docPath, 'utf8');
    const next = spliceMarkers(prev, rendered);
    if (next === prev) {
      process.stdout.write(
        `bundle-history: no change (${docPath} already up to date).\n`,
      );
      return;
    }
    if (args.check) {
      process.stdout.write(
        `bundle-history: ${docPath} would change ` +
          `(run without --check to write).\n`,
      );
      return;
    }
    fs.writeFileSync(docPath, next);
    process.stdout.write(
      `bundle-history: wrote ${docPath} (${entries.length} entries).\n`,
    );
    return;
  }

  if (args.out) {
    const prev = fs.existsSync(args.out)
      ? fs.readFileSync(args.out, 'utf8')
      : '';
    if (rendered === prev) {
      process.stdout.write(
        `bundle-history: no change (${args.out} already up to date).\n`,
      );
      return;
    }
    if (args.check) {
      process.stdout.write(
        `bundle-history: ${args.out} would change ` +
          `(run without --check to write).\n`,
      );
      return;
    }
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, rendered);
    process.stdout.write(
      `bundle-history: wrote ${args.out} (${entries.length} entries).\n`,
    );
    return;
  }

  process.stdout.write(rendered);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`bundle-history: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  extractMetrics,
  formatBytes,
  formatDelta,
  renderMarkdown,
  renderCsv,
  renderJson,
  spliceMarkers,
  MARKER_START,
  MARKER_END,
};
