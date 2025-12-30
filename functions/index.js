const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.kirimNotifikasiPenuh = functions.database
  .ref("/monitoring/tandon/alert_status")
  .onUpdate(async (change, context) => {
    const statusBaru = change.after.val();

    // Kirim notifikasi jika status berubah menjadi "penuh"
    if (statusBaru === "penuh") {
      const tokenSnap = await admin
        .database()
        .ref("/tokens/admin")
        .once("value");
      const registrationToken = tokenSnap.val();

      if (registrationToken) {
        const message = {
          notification: {
            title: "⚠️ Peringatan Tandon",
            body: "Air sudah PENUH! Solenoid II otomatis ditutup.",
          },
          token: registrationToken,
        };

        return admin
          .messaging()
          .send(message)
          .then(() => console.log("Notifikasi terkirim"))
          .catch((error) => console.log("Gagal:", error));
      }
    }
    return null;
  });
