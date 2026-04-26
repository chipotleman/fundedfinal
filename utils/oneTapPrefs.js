// Per-user homepage "Play Now" one-tap defaults (buy-in + game mode).
// The YouVsCard on the homepage lets users pick a chip for their preferred
// stake and mode; this module keeps that preference synced to the user's
// profile so it follows them across devices.
//
// Storage strategy mirrors `lastBattleBuyIn`:
//   - Signed-in users persist the value to their profile so the choice
//     follows them across devices, browsers, and reinstalls.
//   - localStorage is kept as a synchronous cache so the chip selection
//     renders instantly on page load (no flicker while the network
//     request resolves) and so guests / offline users still get the
//     convenience that pre-existed this task.
const STORAGE_KEY = 'piks:onetap-prefs:v1';
const VALID_MODES = new Set(['rush', 'original', 'tournament']);
const VALID_BUY_INS = new Set([5, 10, 25]);

function normalize(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  const buyIn = Number(value.buyIn);
  if (Number.isFinite(buyIn) && VALID_BUY_INS.has(buyIn)) out.buyIn = buyIn;
  if (typeof value.gameMode === 'string' && VALID_MODES.has(value.gameMode)) {
    out.gameMode = value.gameMode;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function readLocalOneTapPrefs() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalOneTapPrefs(buyIn, gameMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ buyIn, gameMode }));
  } catch {}
}

// Hydrate the remembered prefs from the user's profile so they follow them
// across devices. Falls back to the local cache if the request fails so the
// chip selection still works offline / during transient errors. Refreshes
// the local cache on success so subsequent reads stay instant.
export async function fetchOneTapPrefs() {
  if (typeof window === 'undefined') return readLocalOneTapPrefs();
  try {
    const res = await fetch('/api/profiles/one-tap-prefs', { credentials: 'include' });
    if (!res.ok) return readLocalOneTapPrefs();
    const data = await res.json().catch(() => null);
    const next = normalize(data?.oneTapPrefs);
    if (next) {
      // Merge with any existing local prefs so a partial server value
      // (e.g. only buyIn set) doesn't blow away the other field.
      const local = readLocalOneTapPrefs() || {};
      const merged = { ...local, ...next };
      writeLocalOneTapPrefs(merged.buyIn, merged.gameMode);
      return merged;
    }
    return readLocalOneTapPrefs();
  } catch {
    return readLocalOneTapPrefs();
  }
}

// Persist the remembered prefs. Always writes the local cache for instant
// future reads; when `isSignedIn` is true, also mirrors to the user's
// profile so the choice survives device changes. Signed-out callers stay
// on the localStorage-only behaviour. Returns the normalized value (or
// null if the input was invalid).
export async function saveOneTapPrefs({ buyIn, gameMode, isSignedIn = false } = {}) {
  const next = normalize({ buyIn, gameMode });
  if (!next) return null;
  // Merge with any existing local prefs so callers that only update one
  // field (e.g. just the buy-in) don't drop the other.
  const local = readLocalOneTapPrefs() || {};
  const merged = { ...local, ...next };
  writeLocalOneTapPrefs(merged.buyIn, merged.gameMode);
  if (!isSignedIn || typeof window === 'undefined') return merged;
  try {
    await fetch('/api/profiles/one-tap-prefs', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
  } catch {}
  return merged;
}
