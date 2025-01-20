self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    event.waitUntil(
      caches.open('static-cache').then((cache) => 
        cache.addAll(['./', './index.html', './manifest.json'])
      )
    );
  });
  
  self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => 
        response || fetch(event.request)
      )
    );
  });
  