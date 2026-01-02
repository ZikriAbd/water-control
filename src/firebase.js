// // src/firebase.js
// import { initializeApp } from "firebase/app";
// import { getDatabase } from "firebase/database"; // Penting untuk IoT

// const firebaseConfig = {
//   apiKey: "AIzaSyDdn0UcHek6pdZjJgvhL_r7hbFtiq_R8QM",
//   authDomain: "flow-iot-1.firebaseapp.com",
//   databaseURL:
//     "https://flow-iot-1-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "flow-iot-1",
//   storageBucket: "flow-iot-1.firebasestorage.app",
//   messagingSenderId: "1016161486914",
//   appId: "1:1016161486914:web:00290bf017cfc022fe85db",
// };

// const app = initializeApp(firebaseConfig);
// const db = getDatabase(app); // Inisialisasi Realtime Database

// export { db };

// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDdn0UcHek6pdZjJgvhL_r7hbFtiq_R8QM",
  authDomain: "flow-iot-1.firebaseapp.com",
  databaseURL:
    "https://flow-iot-1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flow-iot-1",
  storageBucket: "flow-iot-1.firebasestorage.app",
  messagingSenderId: "1016161486914",
  appId: "1:1016161486914:web:00290bf017cfc022fe85db",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Initialize Messaging dengan pengecekan support
let messaging = null;
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
});

export { db, messaging, app };
