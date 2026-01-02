// export default App;

import React, { useState, useEffect, useCallback, useRef } from "react";
import { db, messaging } from "./firebase";
import {
  ref,
  onValue,
  set,
  push,
  remove,
  serverTimestamp,
} from "firebase/database";
import { getToken, onMessage } from "firebase/messaging";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // States Monitoring & Pengaturan
  const [dataMonitoring, setDataMonitoring] = useState({
    ketinggian: 0,
    flowRate: 0,
    totalVolume: 0,
    statusIsi: "Standby",
  });
  const [thresholdSettings, setThresholdSettings] = useState({
    atas: 90,
    bawah: 30,
  });
  const [selectedMode, setSelectedMode] = useState("C");
  const [isMasterOn, setIsMasterOn] = useState(true);
  const [partialSettings, setPartialSettings] = useState({
    durasi: 15,
    interval: 50,
  });
  const [randomSettings, setRandomSettings] = useState({
    mulai: "14:00",
    selesai: "10:30",
  });

  const [historyData, setHistoryData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [notificationStatus, setNotificationStatus] = useState("checking");

  // Ref untuk tracking notifikasi yang sudah dikirim
  const lastNotificationRef = useRef({
    batasAtas: false,
    batasBawah: false, // TAMBAHAN BARU
    timestamp: 0,
  });

  const VAPID_KEY =
    "BMAr4XkoS8aFdSKqEfjxiKGeMRr_EwqzdfxJ77CsanfFqe6YvB6BgW4CDMJNumSqqQCbox-UNzQFrIucnhqk3fk";

  // Fungsi untuk mengirim notifikasi lokal
  const sendLocalNotification = useCallback((title, body, tag) => {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: body,
          icon: "/logo192.png",
          badge: "/logo192.png",
          tag: tag, // Mencegah duplikasi notifikasi dengan tag yang sama
          requireInteraction: true, // Notifikasi tetap muncul sampai user menutup
        });
        console.log("Notifikasi lokal dikirim:", title);
      } catch (error) {
        console.error("Error mengirim notifikasi lokal:", error);
      }
    }
  }, []);

  // Fungsi untuk cek dan kirim notifikasi batas atas
  // 5. UPDATE FUNGSI checkAndNotifyThreshold - Tambah parameter thresholdBawah dan cek batas bawah
  const checkAndNotifyThreshold = useCallback(
    (ketinggian, thresholdAtas, thresholdBawah) => {
      // TAMBAH parameter thresholdBawah
      const now = Date.now();
      const cooldownPeriod = 5 * 60 * 1000; // 5 menit cooldown
      const timeSinceLastNotif = now - lastNotificationRef.current.timestamp;

      sendBrowserNotification(
            "⚠️ PERINGATAN LEVEL AIR TINGGI!",
            `Level air tandon mencapai ${ketinggian}% (Batas Atas: ${thresholdAtas}%)`
          );

      // CEK BATAS ATAS
      if (ketinggian >= thresholdAtas) {
        if (
          !lastNotificationRef.current.batasAtas ||
          timeSinceLastNotif > cooldownPeriod
        ) {
          // Kirim notifikasi browser
          sendBrowserNotification(
            "⚠️ PERINGATAN LEVEL AIR TINGGI!",
            `Level air tandon mencapai ${ketinggian}% (Batas Atas: ${thresholdAtas}%)`
          );

          // Tampilkan alert di UI
          showAlert(
            "danger",
            `⚠️ Level air mencapai ${ketinggian}% - BATAS ATAS (${thresholdAtas}%)`
          );

          // Update ref
          lastNotificationRef.current = {
            ...lastNotificationRef.current,
            batasAtas: true,
            timestamp: now,
          };

          console.log(
            `🚨 Notifikasi batas atas: ${ketinggian}% >= ${thresholdAtas}%`
          );
        }
      } else {
        // Reset flag jika turun di bawah batas atas
        if (lastNotificationRef.current.batasAtas) {
          lastNotificationRef.current.batasAtas = false;
          showAlert("success", `✅ Level air kembali normal (${ketinggian}%)`);
          console.log("✅ Level air kembali normal");
        }
      }

      // CEK BATAS BAWAH - BAGIAN BARU
      if (ketinggian <= thresholdBawah) {
        if (
          !lastNotificationRef.current.batasBawah ||
          timeSinceLastNotif > cooldownPeriod
        ) {
          sendBrowserNotification(
            "⚠️ PERINGATAN LEVEL AIR RENDAH!",
            `Level air tandon turun ke ${ketinggian}% (Batas Bawah: ${thresholdBawah}%)`
          );

          showAlert(
            "warning",
            `⚠️ Level air turun ke ${ketinggian}% - BATAS BAWAH (${thresholdBawah}%)`
          );

          lastNotificationRef.current = {
            ...lastNotificationRef.current,
            batasBawah: true,
            timestamp: now,
          };

          console.log(
            `🚨 Notifikasi batas bawah: ${ketinggian}% <= ${thresholdBawah}%`
          );
        }
      } else {
        if (lastNotificationRef.current.batasBawah) {
          lastNotificationRef.current.batasBawah = false;
        }
      }
    },
    [sendBrowserNotification, showAlert] // TAMBAH dependencies
  );

  // Inisialisasi Notifikasi
  const requestPermissionAndToken = useCallback(async () => {
    if (!messaging) {
      console.warn("Firebase Messaging tidak didukung di browser ini");
      setNotificationStatus("unsupported");
      return;
    }

    try {
      const savedToken = localStorage.getItem("fcmToken");

      if (savedToken) {
        console.log("Menggunakan FCM Token tersimpan:", savedToken);
        setFcmToken(savedToken);
        setNotificationStatus("granted");
        await set(ref(db, "tokens/admin"), savedToken);
        return savedToken;
      }

      if (Notification.permission === "granted") {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          console.log("FCM Token baru:", currentToken);
          localStorage.setItem("fcmToken", currentToken);
          setFcmToken(currentToken);
          await set(ref(db, "tokens/admin"), currentToken);
          setNotificationStatus("granted");
          return currentToken;
        }
      }

      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          console.log("FCM Token baru setelah request:", currentToken);
          localStorage.setItem("fcmToken", currentToken);
          setFcmToken(currentToken);
          await set(ref(db, "tokens/admin"), currentToken);
          setNotificationStatus("granted");
          return currentToken;
        } else {
          console.warn("Tidak dapat mendapatkan FCM token");
          setNotificationStatus("denied");
        }
      } else {
        console.log("Notifikasi ditolak");
        setNotificationStatus("denied");
      }
    } catch (err) {
      console.error("Error FCM:", err);
      setNotificationStatus("error");

      if (err.code === "messaging/permission-blocked") {
        alert(
          "Izin notifikasi diblokir. Silakan aktifkan di pengaturan browser."
        );
      }
    }
  }, []);

  useEffect(() => {
    const monitoringRef = ref(db, "monitoring");
    const unsubscribe = onValue(
      monitoringRef,
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const ketinggianBaru = val.tandon?.ketinggian_cm || 0;

          setDataMonitoring({
            ketinggian: ketinggianBaru,
            statusIsi: val.tandon?.status_isi || "Standby",
            flowRate: val.kolam?.laju_aliran_mls || 0,
            totalVolume: val.kolam?.total_aliran_ml || 0,
          });

          // UPDATE: Cek threshold dengan 3 parameter
          checkAndNotifyThreshold(
            ketinggianBaru,
            thresholdSettings.atas,
            thresholdSettings.bawah // TAMBAHAN BARU
          );

          setChartData((prev) => {
            const newData = [
              ...prev,
              {
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
                flow: val.kolam?.laju_aliran_mls || 0,
                total: val.kolam?.total_aliran_ml || 0,
              },
            ].slice(-20);
            return newData;
          });
        }
      },
      (error) => {
        console.error("Error membaca data monitoring:", error);
      }
    );

    return () => unsubscribe();
  }, [
    thresholdSettings.atas,
    thresholdSettings.bawah,
    checkAndNotifyThreshold,
  ]); // TAMBAH dependencies

  // Ambil Data Monitoring + Cek Threshold
  useEffect(() => {
    const monitoringRef = ref(db, "monitoring");
    const unsubscribe = onValue(
      monitoringRef,
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const ketinggianBaru = val.tandon?.ketinggian_cm || 0;

          setDataMonitoring({
            ketinggian: ketinggianBaru,
            statusIsi: val.tandon?.status_isi || "Standby",
            flowRate: val.kolam?.laju_aliran_mls || 0,
            totalVolume: val.kolam?.total_aliran_ml || 0,
          });

          // Cek threshold dan kirim notifikasi jika perlu
          checkAndNotifyThreshold(ketinggianBaru, thresholdSettings.atas);

          setChartData((prev) => {
            const newData = [
              ...prev,
              {
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
                flow: val.kolam?.laju_aliran_mls || 0,
                total: val.kolam?.total_aliran_ml || 0,
              },
            ].slice(-20);
            return newData;
          });
        }
      },
      (error) => {
        console.error("Error membaca data monitoring:", error);
      }
    );

    return () => unsubscribe();
  }, [thresholdSettings.atas, checkAndNotifyThreshold]);

  // Ambil Data Riwayat
  useEffect(() => {
    const historyRef = ref(db, "history/penggunaan");
    const unsubscribe = onValue(
      historyRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setHistoryData(
            Object.keys(data)
              .map((k) => ({ id: k, ...data[k] }))
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          );
        } else {
          setHistoryData([]);
        }
      },
      (error) => {
        console.error("Error membaca riwayat:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Ambil Pengaturan Tandon
  useEffect(() => {
    const tandonRef = ref(db, "pengaturan/tandon");
    const unsubscribe = onValue(
      tandonRef,
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          setThresholdSettings({
            atas: Number(val.threshold_atas || 90),
            bawah: Number(val.threshold_bawah || 30),
          });
        }
      },
      (error) => {
        console.error("Error membaca pengaturan tandon:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Ambil Status Kontrol Solenoid
  useEffect(() => {
    const solenoidRef = ref(db, "kontrol/solenoid_1");
    const unsubscribe = onValue(
      solenoidRef,
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          setIsMasterOn(val.master_switch ?? true);
          setSelectedMode(val.mode_aktif || "C");
          setPartialSettings({
            durasi: val.set_partial?.durasi_menit || 15,
            interval: val.set_partial?.interval_menit || 50,
          });
          setRandomSettings({
            mulai: val.set_random?.jam_mulai || "14:00",
            selesai: val.set_random?.jam_selesai || "10:30",
          });
        }
      },
      (error) => {
        console.error("Error membaca kontrol solenoid:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSelectItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === historyData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(historyData.map((item) => item.id));
    }
  };

  const deleteSelectedHistory = async () => {
    if (selectedItems.length === 0) return;

    if (
      !window.confirm(`Hapus ${selectedItems.length} data riwayat terpilih?`)
    ) {
      return;
    }

    try {
      const deletePromises = selectedItems.map((id) =>
        remove(ref(db, `history/penggunaan/${id}`))
      );
      await Promise.all(deletePromises);
      setSelectedItems([]);
      alert("Data berhasil dihapus.");
    } catch (err) {
      console.error("Error menghapus data:", err);
      alert("Gagal menghapus data: " + err.message);
    }
  };

  // Simpan Pengaturan
  const saveAllSettings = async () => {
    const vAtas = parseInt(thresholdSettings.atas);
    const vBawah = parseInt(thresholdSettings.bawah);

    if (isNaN(vAtas) || isNaN(vBawah)) {
      alert("Error: Nilai threshold harus berupa angka!");
      return;
    }

    if (vBawah >= vAtas) {
      alert(
        "Error: Batas Bawah tidak boleh melebihi atau sama dengan Batas Atas!"
      );
      return;
    }

    if (vAtas > 100 || vBawah < 0) {
      alert("Error: Nilai threshold harus antara 0-100%!");
      return;
    }

    try {
      await set(ref(db, "pengaturan/tandon"), {
        threshold_atas: vAtas,
        threshold_bawah: vBawah,
        max_safety_limit: 140,
      });

      await set(ref(db, "kontrol/solenoid_1"), {
        mode_aktif: selectedMode,
        master_switch: isMasterOn,
        set_partial: {
          durasi_menit: parseInt(partialSettings.durasi),
          interval_menit: parseInt(partialSettings.interval),
        },
        set_random: {
          jam_mulai: randomSettings.mulai,
          jam_selesai: randomSettings.selesai,
        },
        status_relay: isMasterOn,
      });

      const modeLabel = !isMasterOn
        ? "OFF"
        : selectedMode === "C"
        ? "CONTINUE"
        : selectedMode === "P"
        ? "PARTIAL"
        : "RANDOM";

      const detailLog = !isMasterOn
        ? "SISTEM BERHENTI"
        : selectedMode === "P"
        ? `ON:${partialSettings.durasi}m, OFF:${partialSettings.interval}m`
        : selectedMode === "R"
        ? `Jadwal:${randomSettings.mulai}-${randomSettings.selesai}`
        : "Terus Menerus";

      await push(ref(db, "history/penggunaan"), {
        tanggal: new Date().toLocaleString("id-ID"),
        mode: modeLabel,
        durasi: detailLog,
        timestamp: serverTimestamp(),
      });

      alert("✅ Pengaturan Berhasil Disimpan!");
    } catch (error) {
      console.error("Error menyimpan pengaturan:", error);
      alert("❌ Gagal menyimpan pengaturan: " + error.message);
    }
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        console.log("SW Registration:", registration);
        if (!registration) {
          console.error("Service Worker belum terdaftar!");
        }
      });
    }

    console.log("Notification permission:", Notification.permission);
  }, []);

  const getModeLabel = () => {
    if (!isMasterOn) return "OFF";
    if (selectedMode === "C") return "CONTINUE";
    if (selectedMode === "P") return "PARTIAL";
    if (selectedMode === "R") return "RANDOM";
    return "UNKNOWN";
  };

  const showAlert = useCallback((type, message) => {
    const newAlert = {
      id: Date.now(),
      type, // 'warning', 'danger', 'info', 'success'
      message,
      timestamp: new Date().toLocaleTimeString(),
    };

    setAlerts((prev) => [newAlert, ...prev].slice(0, 5)); // Simpan max 5 alert

    // Auto remove alert setelah 10 detik
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
    }, 10000);
  }, []);

  // 4. FUNGSI BARU - Kirim notifikasi browser
  const sendBrowserNotification = useCallback((title, body) => {
    if (typeof Notification === "undefined") {
      console.warn("Browser tidak mendukung notifikasi");
      return;
    }

    if (Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: "/logo192.png",
          badge: "/logo192.png",
          tag: "water-level-alert",
          requireInteraction: true,
          vibrate: [200, 100, 200],
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        console.log("✅ Notifikasi browser dikirim:", title);
      } catch (error) {
        console.error("❌ Error mengirim notifikasi:", error);
      }
    }
  }, []);

  // 7. FUNGSI BARU - Hapus alert manual
  const removeAlert = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className={`ac-container ${isDarkMode ? "dark-theme" : ""}`}>
      <div
        className={`ac-hamburger-btn ${isMenuOpen ? "active" : ""}`}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <span></span>
        <span></span>
        <span></span>
      </div>

      <aside className={`ac-sidebar ${isMenuOpen ? "open" : ""}`}>
        <div className="ac-sidebar-header">
          <h2>AquaControl</h2>
          <small>BRPI Sukamandi</small>
        </div>
        <nav>
          <div
            className={`ac-nav-item ${
              activePage === "dashboard" ? "active" : ""
            }`}
            onClick={() => {
              setActivePage("dashboard");
              setIsMenuOpen(false);
            }}
          >
            📊 Dashboard
          </div>
          <div
            className={`ac-nav-item ${
              activePage === "controls" ? "active" : ""
            }`}
            onClick={() => {
              setActivePage("controls");
              setIsMenuOpen(false);
            }}
          >
            ⚙️ Controls
          </div>
          <div
            className={`ac-nav-item ${
              activePage === "history" ? "active" : ""
            }`}
            onClick={() => {
              setActivePage("history");
              setIsMenuOpen(false);
            }}
          >
            📜 History
          </div>
          <hr className="ac-divider" />
          <div
            className="ac-nav-item"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? "☀️ Light" : "🌙 Dark"}
          </div>
        </nav>
      </aside>

      <main className="ac-main-content">
        <header className="ac-header">
          <h1>{activePage.toUpperCase()}</h1>
          <div className="ac-header-actions">
            <button
              className="ac-noti-btn"
              onClick={requestPermissionAndToken}
              title={
                notificationStatus === "granted"
                  ? "Notifikasi Aktif"
                  : notificationStatus === "denied"
                  ? "Notifikasi Diblokir"
                  : "Aktifkan Notifikasi"
              }
            >
              {notificationStatus === "granted" ? "🔔" : "🔕"}
            </button>
            <span className="ac-status-online">● Online</span>
          </div>
        </header>

        {alerts.length > 0 && (
          <div className="ac-alert-container">
            {alerts.map((alert) => (
              <div key={alert.id} className={`ac-alert ac-alert-${alert.type}`}>
                <div>
                  <p className="ac-alert-message">{alert.message}</p>
                  <small className="ac-alert-time">{alert.timestamp}</small>
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="ac-alert-close"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {activePage === "dashboard" && (
          <div className="ac-dashboard-grid ac-fade-in">
            <div className="ac-card">
              <h3>Level Air Tandon</h3>
              <div className="ac-water-tank">
                <div
                  className={`ac-water-level ${
                    dataMonitoring.ketinggian >= thresholdSettings.atas
                      ? "critical"
                      : ""
                  }`}
                  style={{
                    height: `${Math.min(dataMonitoring.ketinggian, 100)}%`,
                  }}
                ></div>
                <span className="ac-level-text">
                  {dataMonitoring.ketinggian}%
                </span>
              </div>
              <div className="ac-status-info">
                <p>
                  Status Pengisian Tandon:
                  <strong
                    style={{
                      color:
                        dataMonitoring.statusIsi === "Mengisi"
                          ? "#2196f3"
                          : "inherit",
                    }}
                  >
                    {dataMonitoring.statusIsi === "Mengisi"
                      ? " 🔄 Sedang Mengisi (Sel II)"
                      : " ✅ Standby"}
                  </strong>
                </p>
                <p>
                  Status pengisian Kolam:
                  <strong style={{ color: isMasterOn ? "#28a745" : "#dc3545" }}>
                    {isMasterOn ? " RUNNING" : " STOPPED"}
                  </strong>
                </p>
                <p>
                  Mode Sirkulasi Kolam:{" "}
                  <span className="ac-active-mode-label">{getModeLabel()}</span>
                </p>
              </div>
            </div>
            <div className="ac-card">
              <h3>Real-time Flow</h3>
              <div className="ac-flow-value">
                {dataMonitoring.flowRate.toFixed(2)} <small>L/min</small>
              </div>
              <p>
                Total Volume:{" "}
                <strong>{dataMonitoring.totalVolume.toFixed(0)} ml</strong>
              </p>
              <hr className="ac-divider-thin" />
              <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                Sukamandi, Subang, Jawa Barat 41263
              </p>
            </div>
          </div>
        )}

        {activePage === "controls" && (
          <div className="ac-card ac-full-width ac-fade-in">
            <div className="ac-master-control-header">
              <h3>Solenoid Control</h3>
              <div className="ac-master-switch-container">
                <span>
                  {isMasterOn ? "Master Switch ON" : "Master Switch OFF"}
                </span>
                <label className="ac-switch">
                  <input
                    type="checkbox"
                    checked={isMasterOn}
                    onChange={() => setIsMasterOn(!isMasterOn)}
                  />
                  <span className="ac-slider ac-round"></span>
                </label>
              </div>
            </div>
            <div className={isMasterOn ? "" : "ac-disabled-overlay"}>
              <div className="ac-mode-selector">
                {["C", "P", "R"].map((m) => (
                  <button
                    key={m}
                    className={selectedMode === m ? "active" : ""}
                    onClick={() => setSelectedMode(m)}
                    disabled={!isMasterOn}
                  >
                    {m === "C" ? "Continue" : m === "P" ? "Partial" : "Random"}
                  </button>
                ))}
              </div>
              <div className="ac-settings-grid">
                <div
                  className={`ac-setting-box ${
                    selectedMode === "P" && isMasterOn ? "highlight" : ""
                  }`}
                >
                  <h4>⏱️ Mode Partial</h4>
                  <div className="ac-input-group">
                    <label>ON (Min)</label>
                    <input
                      type="number"
                      min="1"
                      value={partialSettings.durasi}
                      onChange={(e) =>
                        setPartialSettings({
                          ...partialSettings,
                          durasi: e.target.value,
                        })
                      }
                      disabled={!isMasterOn}
                    />
                  </div>
                  <div className="ac-input-group">
                    <label>OFF (Min)</label>
                    <input
                      type="number"
                      min="1"
                      value={partialSettings.interval}
                      onChange={(e) =>
                        setPartialSettings({
                          ...partialSettings,
                          interval: e.target.value,
                        })
                      }
                      disabled={!isMasterOn}
                    />
                  </div>
                </div>
                <div
                  className={`ac-setting-box ${
                    selectedMode === "R" && isMasterOn ? "highlight" : ""
                  }`}
                >
                  <h4>📅 Mode Random</h4>
                  <div className="ac-input-group">
                    <label>Mulai</label>
                    <input
                      type="time"
                      value={randomSettings.mulai}
                      onChange={(e) =>
                        setRandomSettings({
                          ...randomSettings,
                          mulai: e.target.value,
                        })
                      }
                      disabled={!isMasterOn}
                    />
                  </div>
                  <div className="ac-input-group">
                    <label>Selesai</label>
                    <input
                      type="time"
                      value={randomSettings.selesai}
                      onChange={(e) =>
                        setRandomSettings({
                          ...randomSettings,
                          selesai: e.target.value,
                        })
                      }
                      disabled={!isMasterOn}
                    />
                  </div>
                </div>
                <div className="ac-setting-box highlight">
                  <h4>🚀 Batas Atas (%)</h4>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholdSettings.atas}
                    onChange={(e) =>
                      setThresholdSettings({
                        ...thresholdSettings,
                        atas: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="ac-setting-box highlight">
                  <h4>💧 Batas Bawah (%)</h4>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholdSettings.bawah}
                    onChange={(e) =>
                      setThresholdSettings({
                        ...thresholdSettings,
                        bawah: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <button className="ac-btn-save-settings" onClick={saveAllSettings}>
              💾 Simpan Pengaturan
            </button>
          </div>
        )}

        {activePage === "history" && (
          <div className="ac-fade-in">
            <div className="ac-dashboard-grid">
              <div className="ac-card">
                <h3>📈 Laju Aliran</h3>
                <div style={{ width: "100%", height: "200px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="flow"
                        stroke="#007bff"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="ac-card">
                <h3>💧 Total Volume</h3>
                <div style={{ width: "100%", height: "200px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#28a745"
                        fill="#d4edda"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div
              className="ac-card ac-full-width"
              style={{ marginTop: "20px" }}
            >
              <div className="ac-history-header">
                <h3>📜 Riwayat Log</h3>
                {selectedItems.length > 0 && (
                  <button
                    className="ac-btn-delete-multi"
                    onClick={deleteSelectedHistory}
                    style={{
                      backgroundColor: "#dc3545",
                      color: "white",
                      padding: "8px 15px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    🗑️ Hapus ({selectedItems.length})
                  </button>
                )}
              </div>
              <div className="ac-table-container">
                <table className="ac-history-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={
                            historyData.length > 0 &&
                            selectedItems.length === historyData.length
                          }
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>Waktu</th>
                      <th>Mode</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.length > 0 ? (
                      historyData.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            selectedItems.includes(item.id)
                              ? "selected-row"
                              : ""
                          }
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item.id)}
                              onChange={() => handleSelectItem(item.id)}
                            />
                          </td>
                          <td>{item.tanggal}</td>
                          <td>
                            <span
                              className={`ac-badge ${
                                item.mode === "OFF" ? "off" : "on"
                              }`}
                            >
                              {item.mode}
                            </span>
                          </td>
                          <td>{item.durasi}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center" }}>
                          Belum ada log.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
