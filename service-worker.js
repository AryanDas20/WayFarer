const CACHE = 'wayfarer-live-v4';
const SHELL = ['./','./index.html','./styles.css','./styles-extra.css','./js/plan.js','./theme-init.js','./js/app.js','./js/config.js','./js/firebase.js','./js/store.js','./js/agent37Adapter.js','./js/agent37Tools.js','./js/providers.js','./js/storage.js','./manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
// Network-first so a new deployment is never hidden behind stale cached code; cache is only an offline fallback.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
});
