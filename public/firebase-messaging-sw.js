// // importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
// // importScripts(
// //   "https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js"
// // );

// // firebase.initializeApp({
// //   apiKey: "AIzaSyDdn0UcHek6pdZjJgvhL_r7hbFtiq_R8QM", // Ganti dengan API Key Anda dari Firebase Console
// //   projectId: "flow-iot-1", // Ganti dengan Project ID Anda
// //   messagingSenderId: "1016161486914", // Ganti dengan Messaging Sender ID Anda
// //   appId: "1:1016161486914:web:00290bf017cfc022fe85db", // Ganti dengan App ID Anda
// // });

// // const messaging = firebase.messaging();

// // // Menangani notifikasi saat tab ditutup
// // messaging.onBackgroundMessage((payload) => {
// //   const notificationTitle = payload.notification.title;
// //   const notificationOptions = {
// //     body: payload.notification.body,
// //     icon: "/favicon.ico", // Pastikan ada file ikon di folder public
// //   };

// //   self.registration.showNotification(notificationTitle, notificationOptions);
// // });

// importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
// importScripts(
//   "https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js"
// );

// self.addEventListener("push", function (event) {
//   const payload = event.data ? event.data.json() : {};
//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: payload.notification.icon || "/logo.png",
//     badge: "/badge-icon.png",
//     vibrate: [100, 50, 100],
//     requireInteraction: true,
//     actions: [{ action: "open", title: "Buka" }],
//     data: {
//       ...payload.data,
//       url: payload.data?.url || "https://water-control-six.vercel.app/", // default URL jika tidak ada
//     },
//   };

//   // Tambahkan channelId jika ada
//   if (payload.data && payload.data.channelId) {
//     notificationOptions.channelId = payload.data.channelId;
//   }

//   event.waitUntil(
//     self.registration.showNotification(notificationTitle, notificationOptions)
//   );
// });

// // Tambahkan event listener untuk klik notifikasi
// self.addEventListener("notificationclick", function (event) {
//   event.notification.close();

//   const targetUrl =
//     event.notification.data?.url || "https://siapkerja-frontent.vercel.app/";

//   event.waitUntil(
//     clients
//       .matchAll({ type: "window", includeUncontrolled: true })
//       .then((windowClients) => {
//         // Jika sudah ada tab terbuka, fokus ke tab tersebut
//         for (let client of windowClients) {
//           if (client.url.includes(targetUrl) && "focus" in client) {
//             return client.focus();
//           }
//         }
//         // Kalau belum ada, buka tab baru
//         if (clients.openWindow) {
//           return clients.openWindow(targetUrl);
//         }
//       })
//   );
// });

// public/firebase-messaging-sw.js
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js"
);

// Initialize Firebase di Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDdn0UcHek6pdZjJgvhL_r7hbFtiq_R8QM",
  authDomain: "flow-iot-1.firebaseapp.com",
  databaseURL:
    "https://flow-iot-1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flow-iot-1",
  storageBucket: "flow-iot-1.firebasestorage.app",
  messagingSenderId: "1016161486914",
  appId: "1:1016161486914:web:00290bf017cfc022fe85db",
});

const messaging = firebase.messaging();

// Handle background messages
// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Full payload:", JSON.stringify(payload, null, 2));
  console.log("[SW] payload.notification:", payload.notification);
  console.log("[SW] payload.data:", payload.data);

  const notificationTitle = payload.notification?.title || payload.data?.title || "AquaControl";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "Notifikasi baru",
    icon: payload.notification?.icon || "/logo192.png",
    badge: "/logo192.png",
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: "aquacontrol-notification",
    data: {
      url: payload.data?.url || self.location.origin,
      ...payload.data,
    },
  };

  console.log("[SW] Showing notification:", notificationTitle);

  // PENTING: Harus return Promise!
  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

// Handle notification click
self.addEventListener("notificationclick", function (event) {
  console.log("[firebase-messaging-sw.js] Notification clicked:", event);
  event.notification.close();

  const targetUrl = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Cek apakah sudah ada window yang terbuka
        for (let client of windowClients) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        // Buka window baru jika belum ada
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
