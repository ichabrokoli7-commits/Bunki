// Bunki service worker. Installs even if one file fails, so the app stays installable.
const V = 'bunki-v2', RT = 'bunki-rt';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V && k !== RT).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.origin === self.location.origin) {
    // Own files: network first (so updates arrive), fall back to cache when offline.
    e.respondWith((async () => {
      try {
        const res = await fetch(r);
        if (res && res.ok) { const c = await caches.open(V); c.put(r, res.clone()).catch(() => {}); }
        return res;
      } catch (err) {
        return (await caches.match(r)) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    // Fonts: serve from cache when possible, refresh in the background.
    e.respondWith((async () => {
      const c = await caches.open(RT);
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res && res.ok) c.put(r, res.clone()).catch(() => {}); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
  // Everything else (link previews, thumbnails) goes straight to the network.
});
