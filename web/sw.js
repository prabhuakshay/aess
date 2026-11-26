// Offline support. The app's own files load from the network first (so updates show at once)
// and fall back to the cache offline; pinned CDN libraries and fonts are cached on first use.
const VERSION = 'aess-v0.3.0';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'worker.js', 'aess-core.js', 'aess-export.js',
  'favicon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'fonts/BarlowCondensed-Bold.ttf',
  'presets/aess-lite-a1.json', 'presets/aess-standard-a1.json', 'presets/aess-heavy-a1.json',
];
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (CDN.includes(url.hostname)) {
    // pinned versions never change: cache first
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
  } else if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
  }
});
