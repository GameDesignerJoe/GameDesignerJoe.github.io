// Service Worker for Picture Puzzle Gallery Image Caching
const CACHE_VERSION = 'v1.1';
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const IMAGE_CACHE = `image-cache-${CACHE_VERSION}`;

// Static assets to cache
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
      // Cache gallery images
      caches.open(IMAGE_CACHE).then((cache) => {
        console.log('🖼️ Service Worker: Caching gallery thumbnails...');
        return cache.addAll(GALLERY_IMAGES).then(() => {
          console.log(`✅ Service Worker: Cached ${GALLERY_IMAGES.length} gallery images`);
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
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== STATIC_CACHE && cacheName !== IMAGE_CACHE) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activation complete');
      // Take control of all pages immediately
      return self.clients.claim();
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
    // For other requests, use cache-first strategy with network fallback
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
