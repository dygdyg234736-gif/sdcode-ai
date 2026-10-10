/* SD CODE AI Service Worker */
const CACHE = 'sdcode-v4-' + Date.now();

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/config.js',
    './js/utils.js',
    './js/editor.js',
    './js/terminal.js',
    './js/files.js',
    './js/ai.js',
    './js/ui.js',
    './js/app.js',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    // Don't cache API calls
    if (url.hostname.includes('nvidia') || url.hostname.includes('googleapis')) return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request).then(res => {
                if (res.ok && e.request.method === 'GET') {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return res;
            }).catch(() => cached);
        })
    );
});