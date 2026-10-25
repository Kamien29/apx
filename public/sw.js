/* Offline app shell for a previously visited deployment. Game simulation remains client side. */
const CACHE = 'apex-formula-v3';
const SHELL = ['/', '/icon.svg', '/icon-192.png', '/manifest.webmanifest'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(res => {
      if (res.ok) { const copy=res.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); }
      return res;
    }).catch(() => caches.match('/')));
  } else {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(res => {
      if(res.ok && res.type === 'basic') {const copy=res.clone();caches.open(CACHE).then(cache => cache.put(request, copy));}
      return res;
    })));
  }
});
