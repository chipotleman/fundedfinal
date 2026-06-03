---
name: ripgrep shows garbled/minified identifiers
description: Why rg/grep output in this repo sometimes renames symbols (PlayFriendModal→ln, props→n) and how to get the truth
---

In this codebase, `rg`/`grep` tool output sometimes displays source identifiers
**renamed/minified** — e.g. `import PlayFriendModal` shows as `import ln`,
`BattleModeChooser` shows as `n`, and distinct JSX props all render as `n`.
This is a **display artifact of the search tool output**, NOT the real file
contents. The actual files use full, correct names.

**Why it matters:** you can waste time thinking the source is obfuscated or
that props collide (e.g. multiple `n={...}` on one element, which would be
invalid React). It isn't.

**How to apply:** when grep output looks minified/garbled or shows duplicate
single-letter identifiers, do NOT trust it for exact symbol names. Re-open the
file with the `read` tool (with line numbers) to see the real content before
editing. `grep -n` for line numbers is fine; just read the file for the actual
tokens.
