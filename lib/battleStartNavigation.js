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
