importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDdn0UcHek6pdZjJgvhL_r7hbFtiq_R8QM", // Ganti dengan API Key Anda dari Firebase Console
  projectId: "flow-iot-1", // Ganti dengan Project ID Anda
  messagingSenderId: "1016161486914", // Ganti dengan Messaging Sender ID Anda
  appId: "1:1016161486914:web:00290bf017cfc022fe85db", // Ganti dengan App ID Anda
});

const messaging = firebase.messaging();

// Menangani notifikasi saat tab ditutup
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/favicon.ico", // Pastikan ada file ikon di folder public
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
