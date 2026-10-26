// Mit Internet immer die neueste Version (max. 4 Sek. warten), ohne Internet die gespeicherte.
// Alle Reisen liegen unter derselben Adresse: darum trägt jeder Cache den Pfad seiner Reise im Namen.
// Fotos von Wikimedia werden einmal geladen und bleiben offline verfügbar. Wetter läuft am Cache vorbei.
const VERSION = 'v5';
const CACHE = 'reise-' + VERSION + ':' + self.registration.scope;
const BILDER = 'reise-fotos';
const DATEIEN = ['./', './index.html', './reise.enc.json', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(DATEIEN.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

// Nur eigene ältere Versionen löschen, nie die Caches anderer Reisen
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('reise-v') && k.endsWith(':' + self.registration.scope) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'upload.wikimedia.org' || url.hostname === 'thumb.wikimedia.org') {
    e.respondWith(caches.open(BILDER).then(async (cache) => {
      const hit = await cache.match(e.request.url);
      if (hit) return hit;
      try {
        const res = await fetch(e.request.url, { mode: 'cors' });
        if (res.ok) cache.put(e.request.url, res.clone());
        return res;
      } catch (err) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(e.request, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      clearTimeout(timer);
      return (await cache.match(e.request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
