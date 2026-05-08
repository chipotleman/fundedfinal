// Single source of truth for "where do I send the user after a battle has
// been created/matched/accepted?". RUSH is a dedicated 6-question gameshow
// played at /battle/rush/[id] (vote on a live game, then race through six
// auto-generated props on a server-authoritative 15s-per-question timer).
// Original and tournament battles instead drop the user back on the
// dashboard (`/?battleStarted=true`) where they place real bets that
// resolve the matchup balance.
//
// Every place that handles "battle just started" (matchmaking match-found,
// invite-accepted, presetMatch popup continue, etc.) must route through
// this helper so a RUSH match never silently lands on the original-mode
// pick flow. See pages/battle.js, pages/notifications.js, components/
// notifications/NotificationsDropdown.js, components/battle/
// IncomingInviteModal.js, and components/battle/LiveBattlesSection.js.
export function getBattleStartHref(matchup) {
  if (matchup && matchup.durationType === 'rush' && matchup.id) {
    return `/battle/rush/${matchup.id}`;
  }
  return '/?battleStarted=true';
}

// Convenience wrapper for the common `router.push` call site so the rule
// stays in one place even if a future mode (e.g. tournament) needs its
// own dedicated landing page.
export function navigateToBattleStart(router, matchup) {
  if (!router) return;
  router.push(getBattleStartHref(matchup));
}

// Should we show the dashboard's <MatchLobby> celebration card before
// routing to the battle? RUSH has its own dedicated multiplayer lobby
// (voting → ready_check → playing) at /battle/rush/[id] — showing
// MatchLobby first would (1) delay the inviter ~2.5s while the acceptor
// races ahead alone (the bug we're fixing — they were never in the same
// place at the same time), and (2) duplicate the experience. For
// ORIGINAL/TOURNAMENT, MatchLobby IS the only lobby, so keep it.
export function shouldShowMatchLobbyForMode(matchup) {
  return matchup?.durationType !== 'rush';
}
