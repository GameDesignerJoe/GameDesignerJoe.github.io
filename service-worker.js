// Service Worker for Picture Puzzle Gallery Image Caching
//
// Caching strategy, and why:
//   Gallery sample-pics are cache-first — they never change, and instant
//   thumbnails are the whole point of this worker.
//   Everything else is network-first with a cache fallback. It used to be
//   cache-first for every request, which froze index.html at whatever it
//   looked like when the worker first installed: the cache never revalidated
//   and CACHE_VERSION never moved, so the page could never go stale-free.
//   Now the cache only answers when the network doesn't (i.e. offline).
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const IMAGE_CACHE = `image-cache-${CACHE_VERSION}`;

// Static assets to keep as an offline fallback (not as the primary source)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Gallery images to cache for instant loading
const GALLERY_IMAGES = [
  './picture-puzzle/sample-pics/pp_001.jpg',
  './picture-puzzle/sample-pics/pp_002.jpg',
  './picture-puzzle/sample-pics/pp_003.jpg',
  './picture-puzzle/sample-pics/pp_004.JPG',
  './picture-puzzle/sample-pics/pp_005.png',
  './picture-puzzle/sample-pics/pp_006.png',
  './picture-puzzle/sample-pics/pp_007.png',
  './picture-puzzle/sample-pics/pp_008.png',
  './picture-puzzle/sample-pics/pp_009.png',
  './picture-puzzle/sample-pics/pp_010.png',
  './picture-puzzle/sample-pics/pp_011.png',
  './picture-puzzle/sample-pics/pp_012.png',
  './picture-puzzle/sample-pics/pp_013.png',
  './picture-puzzle/sample-pics/pp_014.png',
  './picture-puzzle/sample-pics/pp_015.png',
  './picture-puzzle/sample-pics/pp_016.png',
  './picture-puzzle/sample-pics/pp_017.png',
  './picture-puzzle/sample-pics/pp_018.png',
  './picture-puzzle/sample-pics/pp_019.png',
  './picture-puzzle/sample-pics/pp_020.png',
  './picture-puzzle/sample-pics/pp_021.png',
  './picture-puzzle/sample-pics/pp_022.png',
  './picture-puzzle/sample-pics/pp_023.png',
  './picture-puzzle/sample-pics/pp_024.png',
  './picture-puzzle/sample-pics/pp_025.png',
  './picture-puzzle/sample-pics/pp_026.png',
  './picture-puzzle/sample-pics/pp_027.png',
  './picture-puzzle/sample-pics/pp_028.png',
  './picture-puzzle/sample-pics/pp_029.png',
  './picture-puzzle/sample-pics/pp_030.png',
  './picture-puzzle/sample-pics/pp_031.png',
  './picture-puzzle/sample-pics/pp_032.png',
  './picture-puzzle/sample-pics/pp_033.png',
  './picture-puzzle/sample-pics/pp_034.png',
  './picture-puzzle/sample-pics/pp_035.png',
  './picture-puzzle/sample-pics/pp_036.png',
  './picture-puzzle/sample-pics/pp_037.png',
  './picture-puzzle/sample-pics/pp_038.png',
  './picture-puzzle/sample-pics/pp_039.png',
  './picture-puzzle/sample-pics/pp_040.png',
  './picture-puzzle/sample-pics/pp_041.png',
  './picture-puzzle/sample-pics/pp_042.png',
  './picture-puzzle/sample-pics/pp_043.png',
  './picture-puzzle/sample-pics/pp_044.png',
  './picture-puzzle/sample-pics/pp_045.png',
  './picture-puzzle/sample-pics/pp_046.png',
  './picture-puzzle/sample-pics/pp_047.png',
  './picture-puzzle/sample-pics/pp_048.png',
  './picture-puzzle/sample-pics/pp_049.png',
  './picture-puzzle/sample-pics/pp_050.png',
  './picture-puzzle/sample-pics/pp_051.png',
  './picture-puzzle/sample-pics/pp_052.png',
  './picture-puzzle/sample-pics/pp_053.png',
  './picture-puzzle/sample-pics/pp_054.png',
  './picture-puzzle/sample-pics/pp_055.png',
  './picture-puzzle/sample-pics/pp_056.png',
  './picture-puzzle/sample-pics/pp_057.png',
  './picture-puzzle/sample-pics/pp_058.png',
  './picture-puzzle/sample-pics/pp_059.png',
  './picture-puzzle/sample-pics/pp_060.png',
  './picture-puzzle/sample-pics/pp_061.png',
  './picture-puzzle/sample-pics/pp_062.png',
  './picture-puzzle/sample-pics/pp_063.png',
  './picture-puzzle/sample-pics/pp_064.png',
  './picture-puzzle/sample-pics/pp_065.png',
  './picture-puzzle/sample-pics/pp_066.png',
  './picture-puzzle/sample-pics/pp_067.png',
  './picture-puzzle/sample-pics/pp_068.png',
  './picture-puzzle/sample-pics/pp_069.png',
  './picture-puzzle/sample-pics/pp_070.png',
  './picture-puzzle/sample-pics/pp_071.png',
  './picture-puzzle/sample-pics/pp_072.png',
  './picture-puzzle/sample-pics/pp_073.png',
  './picture-puzzle/sample-pics/pp_074.png',
  './picture-puzzle/sample-pics/pp_075.png',
  './picture-puzzle/sample-pics/pp_076.png',
  './picture-puzzle/sample-pics/pp_077.png',
  './picture-puzzle/sample-pics/pp_078.png',
  './picture-puzzle/sample-pics/pp_079.png',
  './picture-puzzle/sample-pics/pp_080.png'
];

// Install event - cache all assets
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache gallery images. Added one at a time on purpose: addAll rejects
      // as a unit, so a single renamed or deleted picture would fail the whole
      // install, leave the previous worker in charge, and take its stale
      // index.html with it.
      caches.open(IMAGE_CACHE).then((cache) => {
        console.log('🖼️ Service Worker: Caching gallery thumbnails...');
        return Promise.allSettled(GALLERY_IMAGES.map((url) => cache.add(url))).then((results) => {
          const failed = results.filter((r) => r.status === 'rejected').length;
          console.log(`✅ Service Worker: Cached ${GALLERY_IMAGES.length - failed} gallery images`
            + (failed ? ` (${failed} unavailable)` : ''));
        });
      })
    ]).then(() => {
      console.log('✅ Service Worker: Installation complete');
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const stale = cacheNames.filter((n) => n !== STATIC_CACHE && n !== IMAGE_CACHE);
      return Promise.all(stale.map((cacheName) => {
        console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
        return caches.delete(cacheName);
      })).then(() => stale.length > 0);
    }).then((replacedOlderWorker) => {
      console.log('✅ Service Worker: Activation complete');
      // Take control of all pages immediately
      return self.clients.claim().then(() => {
        // The page on screen right now was served by the previous worker,
        // which answered cache-first — so it is very likely the stale copy,
        // and it predates the reload hook in index.html. Reload it from here
        // instead, so the fix lands on this visit rather than the next one.
        // Only when caches were actually replaced, which cannot repeat.
        if (!replacedOlderWorker) return;
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            if (typeof client.navigate === 'function') {
              client.navigate(client.url).catch(() => { /* client went away */ });
            }
          });
        });
      });
    })
  );
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle gallery image requests with cache-first strategy
  if (url.pathname.includes('/picture-puzzle/sample-pics/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached image immediately
          return cachedResponse;
        }
        
        // If not in cache, fetch from network and cache it
        return fetch(event.request).then((networkResponse) => {
          // Cache the new image for future use
          if (networkResponse && networkResponse.status === 200) {
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => {
          console.log('❌ Service Worker: Failed to fetch image:', url.pathname);
        });
      })
    );
  } else {
    // Everything else: network-first, so a fresh deploy always wins. The cache
    // is only consulted when the network can't answer, which keeps the site
    // usable offline without ever serving a stale page online.
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const copy = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Offline and never cached. Navigations get the shell so the app
          // still opens; anything else is a genuine miss.
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
  }
});

// Let the page ask for a clean slate (the pull-to-refresh gesture on index.html).
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'PURGE_CACHES') return;
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => {
        event.source && event.source.postMessage({ type: 'CACHES_PURGED' });
      })
  );
});
