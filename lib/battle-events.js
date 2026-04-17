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

function subscribeBattleEvents(userId, listener) {
  const bus = getBus();
  const ch = channelFor(userId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}

module.exports = {
  publishBattleEvent,
  subscribeBattleEvents,
};
