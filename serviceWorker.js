const CACHE_NAME = `version-${new Date().getTime()}`;
const urlsToCache = ["index.html", "offline.html"];

this.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("open cache");
      return cache.addAll(urlsToCache);
    })
  );

  self.skipWaiting();
});

this.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloneResponse = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, cloneResponse);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cacheResponse) => {
          return cacheResponse || caches.match("offline.html");
        });
      })
  );
});

this.addEventListener("activate", (event) => {
  const cacheWhiteList = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhiteList.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  clients.claim();
});

self.addEventListener("push", (event) => {
  const options = {
    body: event.data.text(),
    icon: "./logo.png", // Replace with your icon path
  };
  event.waitUntil(self.registration.showNotification("SIAPKerja", options));
});

// self.addEventListener('push', (event) => {
//     const options = {
//         body: event.data.text(),
//         icon: './logo192.png',
//         actions: [
//             { action: 'view', title: 'Lihat', icon: './view.png' },
//             { action: 'dismiss', title: 'Tutup', icon: './dismiss.png' }
//         ]
//     };

//     event.waitUntil(
//         self.registration.showNotification('Neja', options)
//     );
// });

// self.addEventListener('notificationclick', (event) => {
//     if (event.action === 'view') {
//         clients.openWindow('https://example.com');
//     }
//     event.notification.close();
// });
