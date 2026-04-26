const { EventEmitter } = require('events');

const GLOBAL_KEY = '__piks_battle_event_bus__';

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
  if (recipients.length === 0) return;
  publishBattleEvent(recipients, {
    type: 'matchup:start',
    matchupId: matchup.id,
    user1Id: matchup.user1Id || null,
    user2Id: matchup.user2Id || null,
    status: matchup.status || 'active',
    ...extra,
  });
}

// Fired when a matchup transitions to `completed` (winner declared, expired,
// or forfeit). Lets the /battle page surface the result popup within ~1s
// instead of polling for the active→ended transition.
function publishMatchupEnd(matchup, extra = {}) {
  if (!matchup) return;
  const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
  if (recipients.length === 0) return;
  publishBattleEvent(recipients, {
    type: 'matchup:end',
    matchupId: matchup.id,
    reason: extra?.reason || 'completed',
    ...extra,
  });
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
};
