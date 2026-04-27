import { useEffect, useState } from 'react';
import { useGames } from '../contexts/GamesContext';

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
//
// We also OR in the *client-side* games context. The Rush availability
// API only sees what real Goalserve returns; in demo mode (or when
// Goalserve is degraded and the dashboard falls back to simulated
// games) the user still sees a live-games row on the dashboard, so it
// would be confusing for Rush to be locked. By reading `useGames()`
// here we mirror exactly what the dashboard renders as "live" and
// keep the two surfaces in sync.
export default function useRushAvailability(enabled = true, refreshMs = 60_000) {
  const [serverAvailable, setServerAvailable] = useState(null);

  // Pull the live-games signal from the dashboard's source of truth.
  // We guard against the hook being mounted outside of GamesProvider
  // (e.g., older tests) by treating an undefined context as "no client
  // override" rather than throwing.
  let clientHasLiveGame = false;
  try {
    const games = useGames();
    if (games && Array.isArray(games.apiGames)) {
      clientHasLiveGame = games.apiGames.some((g) => g && g.isLive);
    }
  } catch (_e) {
    clientHasLiveGame = false;
  }

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/battles/rush/availability', { credentials: 'include' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        setServerAvailable(!!data?.available);
      } catch (_e) {
        if (!cancelled) setServerAvailable(true);
      }
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, refreshMs]);

  // While the first request is in flight return `null` so consumers
  // keep the existing UI state (don't snap-lock or snap-unlock). Once
  // we have a server answer, OR it with the client-side signal so a
  // demo/simulated live game still unlocks Rush.
  if (serverAvailable === null) {
    // If the client already shows a live game we can answer
    // optimistically while we wait for the server — the server can
    // only ever upgrade us to `true` from here.
    return clientHasLiveGame ? true : null;
  }
  return serverAvailable || clientHasLiveGame;
}
