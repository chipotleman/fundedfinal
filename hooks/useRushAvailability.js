import { useEffect, useState } from 'react';

// Polls /api/battles/rush/availability and returns the live-game
// availability for Rush mode. Rush requires an in-progress game (its
// 6 prop questions are pulled from one) so every entry point that
// lets a user pick Rush — PreMatchPopup, QuickMatchModal,
// PlayFriendModal, PrivateMatchModal — uses this hook to lock the
// chip and surface a short explainer when no live games exist.
//
// `enabled` should be true while the consuming modal/popup is open.
// Pass `false` when the modal is closed so we stop polling.
//
// Returns `null` while the first response is in flight (consumers
// should treat `null` as "still loading — don't change anything"),
// `true` if at least one live game is available, `false` otherwise.
//
// Fails open: if the endpoint can't be reached we return `true` so
// a network blip doesn't permanently lock the user out of Rush. The
// match-start path is responsible for surfacing a clean error if the
// game state has truly gone away by the time the user tries to
// start the match.
export default function useRushAvailability(enabled = true, refreshMs = 60_000) {
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/battles/rush/availability', { credentials: 'include' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        setAvailable(!!data?.available);
      } catch (_e) {
        if (!cancelled) setAvailable(true);
      }
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, refreshMs]);
  return available;
}
