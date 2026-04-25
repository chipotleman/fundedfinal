// Per-user "last used" buy-in + game mode for friend battle invites.
// Lets the Friends list expose a one-tap "send last buy-in" shortcut so power
// users can re-challenge the same opponent without reopening the modal.
const KEY_PREFIX = 'piks_last_buyin:';

export function readLastBuyIn(userId) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const buyIn = Number(parsed.buyIn);
    if (!Number.isFinite(buyIn) || buyIn <= 0) return null;
    const gameMode = typeof parsed.gameMode === 'string' && parsed.gameMode
      ? parsed.gameMode
      : 'original';
    return { buyIn, gameMode };
  } catch {
    return null;
  }
}

export function writeLastBuyIn(userId, { buyIn, gameMode }) {
  if (!userId || typeof window === 'undefined') return;
  const numericBuyIn = Number(buyIn);
  if (!Number.isFinite(numericBuyIn) || numericBuyIn <= 0) return;
  try {
    localStorage.setItem(
      KEY_PREFIX + userId,
      JSON.stringify({
        buyIn: numericBuyIn,
        gameMode: typeof gameMode === 'string' && gameMode ? gameMode : 'original',
      })
    );
  } catch {}
}
