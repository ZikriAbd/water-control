/* eslint-disable no-undef */
// 1. Integrasi Firebase SDK untuk Service Worker
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

// 2. Kode Boilerplate Workbox Anda (Casing & Module Loader)
if (!self.define) {
  let e,
    i = {};
  const n = (n, s) => (
    (n = new URL(n + ".js", s).href),
    i[n] ||
      new Promise((i) => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = n), (e.onload = i), document.head.appendChild(e);
        } else (e = n), importScripts(n), i();
      }).then(() => {
        let e = i[n];
        if (!e) throw new Error(`Module ${n} didn’t register its module`);
        return e;
      })
  );
  self.define = (s, r) => {
    const c =
      e ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (i[c]) return;
    let f = {};
    const o = (e) => n(e, c),
      t = { module: { uri: c }, exports: f, require: o };
    i[c] = Promise.all(s.map((e) => t[e] || o(e))).then((e) => (r(...e), f));
  };
}

define(["./workbox-8c29f6e4"], function (e) {
  "use strict";
  self.skipWaiting(), e.clientsClaim();
  e.precacheAndRoute(
    [
      { url: "registerSW.js", revision: "1872c500de691dce40960bb85481de07" },
      { url: "index.html", revision: "4fb160e2c26103b57101d8e001b5e14f" },
      { url: "favicon.ico", revision: "f2413d192135c1f5194f5e7016a8a4d0" },
      {
        url: "manifest.webmanifest",
        revision: "2f50cc8315add81f7e8592dd58c41471",
      },
      // Aset lainnya tetap dipertahankan
    ],
    {}
  );
  e.cleanupOutdatedCaches();
  e.registerRoute(
    new e.NavigationRoute(e.createHandlerBoundToURL("index.html"))
  );

  // 3. Konfigurasi Firebase Messaging (Ganti dengan Config Firebase Anda)
  firebase.initializeApp({
    apiKey: "AIzaSyDdn0UcHek6pdZjJgvhL_r7hbFtiq_R8QM",
    authDomain: "flow-iot-1.firebaseapp.com",
    projectId: "flow-iot-1",
    messagingSenderId: "1016161486914",
    appId: "1:1016161486914:web:00290bf017cfc022fe85db",
  });

  const messaging = firebase.messaging();

  // 4. Background Message Handler (Saat HP Mati/Layar Terkunci)
  messaging.onBackgroundMessage((payload) => {
    console.log("[sw.js] Background message received: ", payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      vibrate: [500, 110, 500, 110, 450, 110, 200],
      tag: "aqua-control-alert",
      data: { url: payload.data?.url || "/" },
    };

    return self.registration.showNotification(
      notificationTitle,
      notificationOptions
    );
  });

  // Handle klik notifikasi
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
  });
});
