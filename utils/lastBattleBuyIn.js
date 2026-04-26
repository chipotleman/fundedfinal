// Per-user "last used" buy-in + game mode for friend battle invites.
// Lets the Friends list expose a one-tap "send last buy-in" shortcut so power
// users can re-challenge the same opponent without reopening the modal.
//
// Storage strategy:
//   - Signed-in users persist the value to their profile so the shortcut
//     follows them across devices, browsers, and reinstalls.
//   - localStorage is kept as a synchronous cache so the shortcut renders
//     instantly on page load (no flicker while the network request resolves)
//     and so guests / offline users still get the convenience.
const KEY_PREFIX = 'piks_last_buyin:';
const VALID_MODES = new Set(['rush', 'original', 'tournament']);

function normalize(value) {
  if (!value || typeof value !== 'object') return null;
  const buyIn = Number(value.buyIn);
  if (!Number.isFinite(buyIn) || buyIn <= 0) return null;
  const gameMode = typeof value.gameMode === 'string' && VALID_MODES.has(value.gameMode)
    ? value.gameMode
    : 'original';
  return { buyIn, gameMode };
}

export function readLastBuyIn(userId) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLastBuyIn(userId, { buyIn, gameMode } = {}) {
  if (!userId || typeof window === 'undefined') return;
  const next = normalize({ buyIn, gameMode });
  if (!next) return;
  try {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(next));
  } catch {}
}

// Hydrate the remembered buy-in from the user's profile so it follows them
// across devices. Falls back to the local cache if the request fails so the
// shortcut still works offline / during transient errors. Refreshes the
// local cache on success so subsequent reads stay instant.
export async function fetchLastBuyIn(userId) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/profiles/last-buyin', { credentials: 'include' });
    if (!res.ok) return readLastBuyIn(userId);
    const data = await res.json().catch(() => null);
    const next = normalize(data?.lastBuyIn);
    if (next) {
      writeLastBuyIn(userId, next);
      return next;
    }
    // Server explicitly says "no remembered value" — clear any stale local
    // cache so we don't keep showing an old shortcut after a profile reset.
    try { localStorage.removeItem(KEY_PREFIX + userId); } catch {}
    return null;
  } catch {
    return readLastBuyIn(userId);
  }
}

// Persist the remembered buy-in. Writes the per-user local cache (keyed on
// userId so cross-account use on shared devices stays separate) and, when
// the user is signed in, mirrors it to their profile so the shortcut
// survives device changes. Without a userId there is no per-user cache key
// to write to, so the call no-ops. Returns the normalized value (or null
// if the input was invalid) so callers can update local state without
// re-reading.
export async function saveLastBuyIn(userId, { buyIn, gameMode } = {}) {
  const next = normalize({ buyIn, gameMode });
  if (!next) return null;
  if (!userId) return next;
  writeLastBuyIn(userId, next);
  if (typeof window === 'undefined') return next;
  try {
    await fetch('/api/profiles/last-buyin', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
  } catch {}
  return next;
}
