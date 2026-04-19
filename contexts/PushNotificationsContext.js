import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

const PushContext = createContext(null);

const STORAGE_KEYS = {
  promptDismissed: 'piks_push_prompt_dismissed_v1',
  firstBattlePrompted: 'piks_push_first_battle_prompted_v1',
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function detectIsIOSStandalone() {
  if (typeof window === 'undefined') return { ios: false, standalone: false };
  const ua = window.navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return { ios, standalone };
}

export function PushNotificationsProvider({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthed = status === 'authenticated' && !!session?.user?.id;
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [endpoint, setEndpoint] = useState(null);
  const [devices, setDevices] = useState([]);
  const [iosInfo, setIosInfo] = useState({ ios: false, standalone: false });
  const [vapidKey, setVapidKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);
  const initRef = useRef(false);

  // Listen for messages from the service worker (push click deep links).
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (event) => {
      const msg = event.data || {};
      if (msg.type === 'push:click' && msg.url) {
        try { router.push(msg.url); } catch (_e) {}
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [router]);

  // Detect support + initial state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    setIosInfo(detectIsIOSStandalone());
    if (ok) setPermission(Notification.permission);
  }, []);

  // Fetch VAPID public key once.
  useEffect(() => {
    if (!supported || vapidKey) return;
    fetch('/api/notifications/push/vapid-key')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.publicKey) setVapidKey(d.publicKey); })
      .catch(() => {});
  }, [supported, vapidKey]);

  const refreshSubscriptionState = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
      setEndpoint(sub ? sub.endpoint : null);
    } catch (_e) {
      setSubscribed(false);
      setEndpoint(null);
    }
  }, [supported]);

  const refreshDevices = useCallback(async () => {
    if (!isAuthed) { setDevices([]); return; }
    try {
      const res = await fetch('/api/notifications/push/preferences');
      if (!res.ok) return;
      const json = await res.json();
      setDevices(json.devices || []);
    } catch (_e) {}
  }, [isAuthed]);

  useEffect(() => {
    if (!supported) return;
    refreshSubscriptionState();
    if (isAuthed) refreshDevices();
  }, [supported, isAuthed, refreshSubscriptionState, refreshDevices]);

  // Ensure SW is registered (next-pwa registers automatically, but be defensive).
  const ensureRegistration = useCallback(async () => {
    if (!supported) return null;
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      try { reg = await navigator.serviceWorker.register('/sw.js'); } catch (_e) {}
    }
    return reg || null;
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !isAuthed || !vapidKey) return { ok: false, reason: 'unsupported' };
    setBusy(true);
    try {
      // Request permission first if needed.
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') return { ok: false, reason: 'denied' };
      } else if (Notification.permission === 'denied') {
        return { ok: false, reason: 'denied' };
      } else {
        setPermission('granted');
      }

      const reg = await ensureRegistration();
      if (!reg) return { ok: false, reason: 'no-registration' };

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      const json = sub.toJSON();
      const res = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: json }),
      });
      if (!res.ok) return { ok: false, reason: 'server' };
      setSubscribed(true);
      setEndpoint(sub.endpoint);
      refreshDevices();
      return { ok: true };
    } catch (e) {
      console.error('[push] subscribe error', e);
      return { ok: false, reason: 'error' };
    } finally {
      setBusy(false);
    }
  }, [supported, isAuthed, vapidKey, ensureRegistration, refreshDevices]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return { ok: false };
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await fetch('/api/notifications/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: ep }),
        }).catch(() => {});
      }
      setSubscribed(false);
      setEndpoint(null);
      refreshDevices();
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [supported, refreshDevices]);

  const updatePreferences = useCallback(async (patch, deviceId) => {
    if (!isAuthed) return false;
    try {
      const body = { ...(deviceId ? { deviceId } : {}), ...patch };
      const res = await fetch('/api/notifications/push/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      refreshDevices();
      return true;
    } catch { return false; }
  }, [isAuthed, refreshDevices]);

  const removeDevice = useCallback(async (deviceId) => {
    try {
      await fetch('/api/notifications/push/preferences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      refreshDevices();
      // If we just removed the current device, also unsubscribe locally.
      const current = devices.find(d => d.id === deviceId);
      if (current && current.endpoint === endpoint) {
        await unsubscribe();
      }
      return true;
    } catch { return false; }
  }, [refreshDevices, devices, endpoint, unsubscribe]);

  // One-time soft prompt after the first battle. We listen for a custom event
  // that pages can dispatch when a battle completes; we never re-prompt if the
  // user denied permission or dismissed it.
  useEffect(() => {
    if (!supported || !isAuthed) return;
    if (typeof window === 'undefined') return;
    const handler = () => {
      try {
        if (Notification.permission !== 'default') return;
        if (subscribed) return;
        if (localStorage.getItem(STORAGE_KEYS.promptDismissed)) return;
        if (localStorage.getItem(STORAGE_KEYS.firstBattlePrompted)) return;
        localStorage.setItem(STORAGE_KEYS.firstBattlePrompted, '1');
        setShowSoftPrompt(true);
      } catch (_e) {}
    };
    window.addEventListener('piks:firstBattleCompleted', handler);
    return () => window.removeEventListener('piks:firstBattleCompleted', handler);
  }, [supported, isAuthed, subscribed]);

  const dismissSoftPrompt = useCallback((permanent) => {
    setShowSoftPrompt(false);
    if (permanent) {
      try { localStorage.setItem(STORAGE_KEYS.promptDismissed, '1'); } catch {}
    }
  }, []);

  const value = {
    supported,
    permission,
    subscribed,
    endpoint,
    devices,
    iosInfo,
    vapidKey,
    busy,
    showSoftPrompt,
    subscribe,
    unsubscribe,
    updatePreferences,
    removeDevice,
    refreshDevices,
    dismissSoftPrompt,
  };

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePushNotifications() {
  const ctx = useContext(PushContext);
  if (!ctx) {
    return {
      supported: false,
      permission: 'default',
      subscribed: false,
      endpoint: null,
      devices: [],
      iosInfo: { ios: false, standalone: false },
      vapidKey: null,
      busy: false,
      showSoftPrompt: false,
      subscribe: async () => ({ ok: false }),
      unsubscribe: async () => ({ ok: false }),
      updatePreferences: async () => false,
      removeDevice: async () => false,
      refreshDevices: async () => {},
      dismissSoftPrompt: () => {},
    };
  }
  return ctx;
}
