const { EventEmitter } = require('events');

const GLOBAL_KEY = '__piks_battle_event_bus__';
// Channel name for events broadcast to every connected SSE subscriber
// (authenticated or not, once a public stream exists). Currently used by
// the highlights strip on /battle so it can refresh the moment any battle
// starts or ends instead of polling on a 30s timer.
const GLOBAL_CHANNEL = 'global';

function getBus() {
  if (!global[GLOBAL_KEY]) {
    const bus = new EventEmitter();
    bus.setMaxListeners(0);
    global[GLOBAL_KEY] = bus;
  }
  return global[GLOBAL_KEY];
}

function channelFor(userId) {
  return `user:${userId}`;
}

function publishGlobalEvent(event) {
  const bus = getBus();
  const payload = { ...event, ts: event?.ts || Date.now() };
  bus.emit(GLOBAL_CHANNEL, payload);
}

function subscribeGlobalEvents(listener) {
  const bus = getBus();
  bus.on(GLOBAL_CHANNEL, listener);
  return () => bus.off(GLOBAL_CHANNEL, listener);
}

function publishBattleEvent(userIds, event) {
  const bus = getBus();
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const payload = { ...event, ts: event?.ts || Date.now() };
  for (const id of ids) {
    if (!id) continue;
    bus.emit(channelFor(id), payload);
  }
}

function publishMatchupPnlUpdate(matchup, extra = {}) {
  if (!matchup) return;
  const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
  if (recipients.length === 0) return;
  publishBattleEvent(recipients, {
    type: 'matchup:pnl',
    matchupId: matchup.id,
    user1Balance: matchup.user1Balance != null ? matchup.user1Balance.toString() : null,
    user2Balance: matchup.user2Balance != null ? matchup.user2Balance.toString() : null,
    ...extra,
  });
}

// Fired when a new matchup is created from an accepted invite or a queue
// match. Both participants receive it so the sender (whose page was waiting
// on a "pending" invite) can transition into the lobby instantly without
// waiting for the safety poll on /battle.
function publishMatchupStart(matchup, extra = {}) {
  if (!matchup) return;
  const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
  if (recipients.length > 0) {
    publishBattleEvent(recipients, {
      type: 'matchup:start',
      matchupId: matchup.id,
      user1Id: matchup.user1Id || null,
      user2Id: matchup.user2Id || null,
      status: matchup.status || 'active',
      ...extra,
    });
  }
  // Fan out a lightweight signal on the global channel so the /battle
  // highlights strip can refresh the moment a battle starts instead of
  // polling /api/battles/recent every 30s. Fake-opponent matchups never
  // appear in that list, so skip those to avoid spurious refetches.
  if (!matchup.isFakeOpponent) {
    publishGlobalEvent({
      type: 'highlights:refresh',
      reason: 'matchup:start',
      matchupId: matchup.id,
    });
  }
}

// Fired when a matchup transitions to `completed` (winner declared, expired,
// or forfeit). Lets the /battle page surface the result popup within ~1s
// instead of polling for the active→ended transition.
function publishMatchupEnd(matchup, extra = {}) {
  if (!matchup) return;
  const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
  if (recipients.length > 0) {
    publishBattleEvent(recipients, {
      type: 'matchup:end',
      matchupId: matchup.id,
      reason: extra?.reason || 'completed',
      ...extra,
    });
  }
  // Same global fan-out as `publishMatchupStart` — completed battles are
  // exactly what the highlights strip lists, so this is the most important
  // trigger for the strip to refresh in real time.
  if (!matchup.isFakeOpponent) {
    publishGlobalEvent({
      type: 'highlights:refresh',
      reason: 'matchup:end',
      matchupId: matchup.id,
    });
  }
}

function subscribeBattleEvents(userId, listener) {
  const bus = getBus();
  const ch = channelFor(userId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}

module.exports = {
  publishBattleEvent,
  publishMatchupPnlUpdate,
  publishMatchupStart,
  publishMatchupEnd,
  subscribeBattleEvents,
  publishGlobalEvent,
  subscribeGlobalEvents,
};
