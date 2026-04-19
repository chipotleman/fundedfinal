/**
 * Browser-side shared SSE singleton for /api/battles/stream.
 *
 * Opens exactly ONE EventSource per browser tab and fans the events out to
 * all subscribers (MatchupContext, NotificationsContext, etc.).  Keeping a
 * single connection avoids hitting the browser per-origin connection limit
 * (6 for HTTP/1.1) and eliminates the silent-disconnect race that could occur
 * when two parallel SSE connections compete for the same server-side slot.
 *
 * Lifecycle events delivered to subscribers:
 *   { type: 'piks:reconnected' }  — fired when SSE re-establishes after a drop.
 *     Contexts should immediately fetch fresh state on this event.
 *
 * Usage:
 *   import { getBattleStreamClient } from '../lib/battleStreamClient';
 *   const client = getBattleStreamClient();
 *   const unsubscribe = client.subscribe(handler);   // returns cleanup fn
 *   client.reconnectNow();                           // force reconnect
 */

const GLOBAL_KEY = '__piks_bsc__';

function createClient() {
  const listeners = new Set();
  let es = null;
  let reconnectTimer = null;
  // Track whether we have ever successfully established a connection so we
  // can distinguish the initial connect from a reconnect.
  let hasConnectedBefore = false;

  function deliver(data) {
    for (const fn of listeners) {
      try { fn(data); } catch (_e) {}
    }
  }

  function connect() {
    if (es) return;
    if (typeof EventSource === 'undefined') return;
    try {
      es = new EventSource('/api/battles/stream');
    } catch (_e) { return; }

    es.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch (_e) { return; }

      // The server sends { type: 'connected' } at the start of every new SSE
      // session.  On the very first connect we pass it through normally; on
      // subsequent connects (reconnects after a drop) we deliver a synthetic
      // 'piks:reconnected' event so contexts can immediately catch up.
      if (data?.type === 'connected') {
        if (hasConnectedBefore) {
          deliver({ type: 'piks:reconnected', ts: data.ts || Date.now() });
        } else {
          hasConnectedBefore = true;
          deliver(data);
        }
        return;
      }

      deliver(data);
    };

    es.onerror = () => {
      try { es && es.close(); } catch (_e) {}
      es = null;
      if (listeners.size > 0) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };
  }

  function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    try { es && es.close(); } catch (_e) {}
    es = null;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      connect();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) disconnect();
      };
    },

    reconnectNow() {
      if (!es || es.readyState !== EventSource.OPEN) {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        es = null;
        connect();
      }
    },
  };
}

export function getBattleStreamClient() {
  if (typeof window === 'undefined') return null;
  if (!window[GLOBAL_KEY]) {
    window[GLOBAL_KEY] = createClient();
  }
  return window[GLOBAL_KEY];
}
