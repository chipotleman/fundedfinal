// Lightweight session-storage cache that lets the bell-dropdown hand off
// a result-notification payload to /battle so the win/loss popup can open
// instantly, without waiting for a history fetch round-trip.
const KEY_PREFIX = 'piks_battle_result:';
const TTL_MS = 5 * 60 * 1000;

export function cacheBattleResult(matchupId, payload) {
  if (!matchupId || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      KEY_PREFIX + matchupId,
      JSON.stringify({ at: Date.now(), payload })
    );
  } catch {}
}

export function readBattleResult(matchupId) {
  if (!matchupId || typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + matchupId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - (parsed.at || 0) > TTL_MS) {
      sessionStorage.removeItem(KEY_PREFIX + matchupId);
      return null;
    }
    return parsed.payload || null;
  } catch {
    return null;
  }
}

export function clearBattleResult(matchupId) {
  if (!matchupId || typeof window === 'undefined') return;
  try { sessionStorage.removeItem(KEY_PREFIX + matchupId); } catch {}
}
