#!/usr/bin/env node
/**
 * Scroll-lock discipline guardrail (task #543).
 *
 * Background:
 *   `hooks/useModalScrollLock.js` is the one shared place that owns
 *   the body scroll lock for modals. It maintains a stacked-modal
 *   counter on `body.dataset.scrollLockCount`, plays nicely with the
 *   route-change cleanup in `pages/_app.js`, and respects
 *   reduced-motion preferences when restoring scroll. Every modal in
 *   the app is expected to route through it.
 *
 *   Task #524 ripped a bespoke body-lock + global non-passive
 *   `touchmove` / `wheel` `preventDefault` interceptor pattern out of
 *   the click-trap defense layer. Task #530 then found that
 *   `components/ShareableBetSlip.js` had been quietly reinventing the
 *   same anti-pattern in isolation — the audit missed it because
 *   nothing in the build forces modals to go through the shared hook.
 *
 *   This test is that forcing function. It scans the repo for the two
 *   tell-tale fingerprints of someone reinventing the scroll-lock and
 *   fails the build if a NEW file outside `hooks/useModalScrollLock.js`
 *   either:
 *     (a) installs a non-passive `touchmove` / `wheel` listener that
 *         calls `preventDefault` (the global scroll-blocking pattern), OR
 *     (b) sets `document.body.style.position = 'fixed'` (the bespoke
 *         scrolled-position-saving pattern).
 *
 *   Both are strong signals the shared stacked-modal counter and the
 *   route-change cleanup the rest of the app relies on are being
 *   bypassed.
 *
 * How to run:
 *   node tests/scroll-lock-discipline.test.js
 *
 * Allowlist:
 *   `hooks/useModalScrollLock.js` is the only file allowed to set
 *   `document.body.style.position = 'fixed'`. Nothing is allowed to
 *   install the non-passive touch/wheel preventDefault pattern.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one violation
 *   2 — usage / IO error
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Directories we never want to scan: build output, deps, attached
// reference material the user pasted in (often contains library code
// like LiquidEther that legitimately uses non-passive touchmove on a
// non-document element), and version-control / editor metadata.
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.cache',
  '.local',
  '.canvas',
  '.upm',
  '.config',
  '.replit_integration_files',
  '.github',
  '.agents',
  'attached_assets',
  'public',
  'migrations',
  'playwright-report',
  'test-results',
]);

const SCAN_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

// Files that are explicitly permitted to set
// `document.body.style.position = 'fixed'`. Per the task brief, only
// the shared hook itself qualifies.
const POSITION_FIXED_ALLOWLIST = new Set([
  path.join('hooks', 'useModalScrollLock.js'),
]);

// Nothing is allowlisted for the global non-passive touch/wheel
// preventDefault pattern — the shared hook does not use it, and no
// component in the app should either.
const TOUCH_WHEEL_ALLOWLIST = new Set();

function listFiles(dir) {
  /** @type {string[]} */
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SCAN_EXTENSIONS.has(ext)) out.push(full);
      }
    }
  }
  return out;
}

/**
 * Strip line / block comments and the *contents* of regex literals so
 * we don't false-positive on documentation, error messages, or our
 * own matcher regexes that necessarily quote the forbidden patterns
 * (this very file is the canonical example of why that matters).
 *
 * The implementation is a small character-level state machine:
 *
 *   code   — executable JS
 *   line   — inside `// …` to end of line
 *   block  — inside `/* … *​/`
 *   sq     — inside `'…'`        (kept verbatim)
 *   dq     — inside `"…"`        (kept verbatim)
 *   tmpl   — inside `` `…` ``    (kept verbatim, template substitutions
 *                                  not parsed — good enough here)
 *
 * It also recognises regex literals (`/…/flags`) when the previous
 * non-whitespace token is one that can't be followed by division:
 * operators, punctuation, an opening brace/paren/bracket, etc. Without
 * this, a regex like `/x(['"`])y/g` would put the parser into string
 * mode at the embedded quote and swallow the rest of the file —
 * including legitimate `//` comments, which then leak the patterns
 * we're hunting for back into the scan and self-trigger the rule.
 *
 * Regex bodies are blanked to spaces (we never want to match against
 * the bytes inside a regex literal); strings are kept because that's
 * exactly where a real anti-pattern would write `'fixed'`.
 */
function stripComments(source) {
  const out = [];
  let i = 0;
  const n = source.length;
  let mode = 'code';
  // Last non-whitespace character emitted in code mode. Used to
  // disambiguate `/` as the start of a regex literal vs. a division
  // operator. Initialised to a value in the regex-allowed set so a
  // file that opens with a regex (rare, but possible) parses correctly.
  let prevCodeChar = '\n';
  // Characters that legally precede a regex literal. After any of
  // these, a `/` cannot be division. After an identifier, number,
  // `)`, or `]` it must be division — which is what we want, because
  // a misclassified regex would blank executable code we need to
  // scan.
  const regexPrefixSet = '=(,:;!&|?{}[\n+-*%~^<>';

  while (i < n) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : '';

    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line';
        out.push('  ');
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block';
        out.push('  ');
        i += 2;
        continue;
      }
      if (ch === '/' && regexPrefixSet.indexOf(prevCodeChar) !== -1) {
        // Consume a regex literal: everything up to the unescaped
        // closing `/`, respecting `\` escapes and `[…]` character
        // classes (where `/` is literal). Body and flags are blanked
        // so the matcher regexes never see the bytes that live inside
        // another regex literal.
        out.push(' ');
        i += 1;
        let inClass = false;
        while (i < n) {
          const c = source[i];
          if (c === '\n') {
            // Unterminated regex on this line — bail back to code so
            // we don't eat the rest of the file. Newlines are
            // preserved so line numbers stay stable.
            out.push('\n');
            i += 1;
            break;
          }
          if (c === '\\' && i + 1 < n) {
            out.push(' ', ' ');
            i += 2;
            continue;
          }
          if (c === '[') {
            inClass = true;
            out.push(' ');
            i += 1;
            continue;
          }
          if (c === ']') {
            inClass = false;
            out.push(' ');
            i += 1;
            continue;
          }
          if (c === '/' && !inClass) {
            out.push(' ');
            i += 1;
            // Skip flag characters.
            while (i < n && /[gimsuy]/.test(source[i])) {
              out.push(' ');
              i += 1;
            }
            break;
          }
          out.push(' ');
          i += 1;
        }
        prevCodeChar = '/';
        continue;
      }
      if (ch === "'") { mode = 'sq'; out.push(ch); prevCodeChar = ch; i += 1; continue; }
      if (ch === '"') { mode = 'dq'; out.push(ch); prevCodeChar = ch; i += 1; continue; }
      if (ch === '`') { mode = 'tmpl'; out.push(ch); prevCodeChar = ch; i += 1; continue; }
      out.push(ch);
      if (!/\s/.test(ch)) prevCodeChar = ch;
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; out.push('\n'); prevCodeChar = '\n'; i += 1; continue; }
      out.push(' ');
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; out.push('  '); i += 2; continue; }
      out.push(ch === '\n' ? '\n' : ' ');
      i += 1;
      continue;
    }
    if (mode === 'sq' || mode === 'dq' || mode === 'tmpl') {
      const closer = mode === 'sq' ? "'" : mode === 'dq' ? '"' : '`';
      if (ch === '\\' && i + 1 < n) {
        out.push(ch, source[i + 1]);
        i += 2;
        continue;
      }
      if (ch === closer) { mode = 'code'; out.push(ch); prevCodeChar = ch; i += 1; continue; }
      out.push(ch);
      i += 1;
      continue;
    }
  }
  return out.join('');
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

// (a) Non-passive touchmove / wheel listener paired with preventDefault.
//
// We can't fully prove "in the same handler" without parsing, so we
// use a file-level co-occurrence heuristic that mirrors the actual
// anti-pattern. A file is flagged when ALL three of these appear in
// its executable code:
//
//   1. `addEventListener('touchmove', …)` or `addEventListener('wheel', …)`.
//   2. `passive: false` somewhere in the file. The opt-in is the
//      whole point — a passive listener cannot block scrolling, so a
//      legitimate non-blocking handler never needs it.
//   3. `preventDefault()` called somewhere in the file. The two
//      together are the entire reason someone opts out of passive in
//      the first place.
//
// Any single signal is fine in isolation (a `wheel` listener for
// analytics, `passive: false` on a non-scroll event, `preventDefault`
// on a click). The combination on the same file is the fingerprint
// of the bespoke scroll-blocker the shared hook is meant to replace.
// Existing components (DemoPopup, ChallengePopup, demo.js) attach
// `touchmove` for slider tracking but never set `passive: false` and
// never call `preventDefault` from those handlers, so they don't
// trigger the rule.
function findTouchWheelViolations(rel, stripped) {
  /** @type {{ rel: string; line: number; snippet: string }[]} */
  const violations = [];
  const listenerRe = /addEventListener\s*\(\s*(['"`])(touchmove|wheel)\1/g;
  if (!listenerRe.test(stripped)) return violations;
  if (!/passive\s*:\s*false/.test(stripped)) return violations;
  if (!/preventDefault\s*\(/.test(stripped)) return violations;
  // Reset and re-scan to report each individual listener call site.
  listenerRe.lastIndex = 0;
  let m;
  while ((m = listenerRe.exec(stripped)) !== null) {
    const line = lineNumberAt(stripped, m.index);
    const snippet = stripped.slice(m.index, m.index + 120).replace(/\s+/g, ' ');
    violations.push({ rel, line, snippet });
  }
  return violations;
}

// (b) `document.body.style.position = 'fixed'` outside the shared hook.
//
// The whole reason the shared hook exists is to own this assignment in
// one place, with the matching teardown, the stacked-modal counter,
// and the route-change cleanup. Anyone setting position=fixed on the
// body in their own component is reinventing all of that, badly.
function findPositionFixedViolations(rel, stripped) {
  /** @type {{ rel: string; line: number; snippet: string }[]} */
  const violations = [];
  // Match `(document|<some>).body.style.position = 'fixed' | "fixed" | `fixed``.
  // Whitespace is tolerant; the right-hand side must be the literal
  // string "fixed" (so legitimate resets like `position = ''` don't
  // false-positive).
  const re =
    /\bbody\s*\.\s*style\s*\.\s*position\s*=\s*(['"`])fixed\1/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const line = lineNumberAt(stripped, m.index);
    const snippet = stripped.slice(m.index, m.index + 120).replace(/\s+/g, ' ');
    violations.push({ rel, line, snippet });
  }
  return violations;
}

function main() {
  const files = listFiles(REPO_ROOT);
  /** @type {{ rel: string; line: number; snippet: string; rule: string }[]} */
  const allViolations = [];

  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs);
    let source;
    try {
      source = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      continue;
    }
    const stripped = stripComments(source);

    if (!POSITION_FIXED_ALLOWLIST.has(rel)) {
      for (const v of findPositionFixedViolations(rel, stripped)) {
        allViolations.push({ ...v, rule: 'position-fixed-on-body' });
      }
    }
    if (!TOUCH_WHEEL_ALLOWLIST.has(rel)) {
      for (const v of findTouchWheelViolations(rel, stripped)) {
        allViolations.push({ ...v, rule: 'non-passive-touch-or-wheel-preventDefault' });
      }
    }
  }

  if (allViolations.length === 0) {
    console.log(
      '[scroll-lock-discipline] OK — no files outside hooks/useModalScrollLock.js ' +
        'reinvent the body scroll lock.',
    );
    process.exit(0);
  }

  console.error('[scroll-lock-discipline] FAIL — scroll-lock anti-pattern detected.');
  console.error('');
  console.error(
    'These files appear to be reinventing the body scroll lock instead of routing\n' +
      'through the shared hook at hooks/useModalScrollLock.js. That hook owns the\n' +
      'stacked-modal counter on body.dataset.scrollLockCount, the route-change\n' +
      'cleanup in pages/_app.js, and the reduced-motion-aware scroll restore.\n' +
      'Bypassing it leaves the app open to the bug class fixed in tasks #524 / #530.\n',
  );
  for (const v of allViolations) {
    console.error(`  • ${v.rel}:${v.line}  [${v.rule}]`);
    console.error(`      ${v.snippet}`);
  }
  console.error('');
  console.error(
    'Fix: import useModalScrollLock from hooks/useModalScrollLock.js and call it\n' +
      "with the modal's open state (and { restoreScroll: true } if the modal\n" +
      'previously did its own scrollY save/restore). If you genuinely need a new\n' +
      'capability the shared hook lacks, extend the hook rather than forking it.',
  );
  process.exit(1);
}

main();
