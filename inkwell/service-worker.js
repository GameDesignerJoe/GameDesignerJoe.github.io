const CACHE_NAME = 'inkwell-v1';
const SHELL_FILES = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/camera.js',
    './js/capture.js',
    './js/api.js',
    './js/transcript.js',
    './js/feedback.js',
    './js/settings.js',
    './js/ui.js',
    './manifest.json'
];

// Pre-cache app shell on install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_FILES))
            .then(() => self.skipWaiting())
    );
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Cache-first for shell, network-only for API calls
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache API calls
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});
