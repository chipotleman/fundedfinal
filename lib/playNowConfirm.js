// Shared localStorage contract for the homepage "Play Now" spend
// confirmation gate. The Live Battles section reads/writes this key
// when a user opts out of the "Tap to confirm $5 RUSH" warning, and
// the Settings page imports the same constants so a user can flip
// the warning back on without clearing site data.
//
// We store the *version* the user opted out against (rather than a
// plain boolean) so bumping PLAY_NOW_SKIP_CONFIRM_VERSION will
// re-prompt every existing user the next time they tap Play Now.

export const PLAY_NOW_SKIP_CONFIRM_KEY = 'playnow:skipConfirmVersion';
export const PLAY_NOW_SKIP_CONFIRM_VERSION = '1';

// True when the user has opted out under the *current* version. Used
// by Live Battles to bypass the confirm step, and by Settings to
// reflect the current state of the toggle.
export function isPlayNowConfirmSkipped() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(PLAY_NOW_SKIP_CONFIRM_KEY) ===
      PLAY_NOW_SKIP_CONFIRM_VERSION
    );
  } catch {
    return false;
  }
}

// Persist the user's "Don't ask again" choice. Removes the key when
// the warning should be re-enabled so future deploys with a bumped
// version still work correctly (no stale value lingers).
export function setPlayNowConfirmSkipped(skip) {
  if (typeof window === 'undefined') return;
  try {
    if (skip) {
      window.localStorage.setItem(
        PLAY_NOW_SKIP_CONFIRM_KEY,
        PLAY_NOW_SKIP_CONFIRM_VERSION,
      );
    } else {
      window.localStorage.removeItem(PLAY_NOW_SKIP_CONFIRM_KEY);
    }
  } catch {
    // Best-effort: storage may be unavailable (private mode, etc).
  }
}
