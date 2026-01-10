// Service Worker for Music Player PWA
const CACHE_NAME = 'music-player-v31-playlist-album-art';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './config.js',
  './css/main.css',
  './css/home.css',
  './css/player.css',
  './css/library.css',
  './css/playlists.css',
  './js/app.js',
  './assets/icons/icon-tape-black.png',
  './assets/icons/icon-song-black..png',
  './assets/placeholder-cover.svg'
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error caching app shell:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for:
  // - Dropbox API calls
  // - Audio streaming
  // - OAuth callbacks
  if (
    url.hostname.includes('dropbox') ||
    url.hostname.includes('dropboxapi') ||
    request.url.includes('/callback') ||
    request.destination === 'audio'
  ) {
    return; // Let browser handle normally
  }

  // For app shell and assets: Cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              // Clone the response
              const responseToCache = networkResponse.clone();
              
              // Cache for next time
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            
            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            // Could return a fallback page here
            throw error;
          });
      })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
