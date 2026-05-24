// Custom service worker code injected by next-pwa.
// Adds web push handlers for incoming notifications + click navigation.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    try { payload = { title: 'Piks', body: event.data?.text() || '' }; } catch (_ee) { payload = {}; }
  }

  const title = payload.title || 'Piks';
  const tag = payload.tag || payload.category || 'piks';
  const url = payload.url || '/';

  const showPromise = (async () => {
    // Foreground suppression: if any visible client of the app is already on
    // the deep-link target (or any matching path), skip the OS notification
    // and let the in-app toast/modal handle it instead.
    try {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const targetPath = (() => {
        try { return new URL(url, self.location.origin).pathname; } catch { return url; }
      })();
      const focused = clientsList.find(c => c.visibilityState === 'visible' && c.focused);
      if (focused) {
        try {
          const focusedPath = new URL(focused.url).pathname;
          if (focusedPath === targetPath || targetPath === '/') {
            // Tell the page so it can refresh state if it wants to.
            focused.postMessage({ type: 'push:foreground', payload });
            return;
          }
        } catch (_e) {}
      }
    } catch (_e) {}

    const notificationOptions = {
      body: payload.body || '',
      tag,
      renotify: true,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/icon-192x192.png',
      data: { url, ...(payload.data || {}), category: payload.category || null },
      requireInteraction: false,
    };
    // Android/Chrome render `image` as a large hero preview below the body —
    // for social shares this is the sender's avatar so the recipient can
    // recognize who shared something at a glance. Other platforms (iOS Safari,
    // Firefox) safely ignore the field.
    if (payload.image) {
      notificationOptions.image = payload.image;
    }
    return self.registration.showNotification(title, notificationOptions);
  })();

  event.waitUntil(showPromise);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Prefer focusing an existing tab on the same origin, then navigate it.
    for (const client of allClients) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          await client.focus();
          // Use postMessage so React can route to the deep-link without a hard reload.
          client.postMessage({ type: 'push:click', url: targetUrl, data });
          if ('navigate' in client && new URL(client.url).pathname !== new URL(targetUrl, self.location.origin).pathname) {
            try { await client.navigate(targetUrl); } catch (_e) {}
          }
          return;
        }
      } catch (_e) {}
    }
    // No existing tab — open one.
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
