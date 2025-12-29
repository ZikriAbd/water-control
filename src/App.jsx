import React, { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  ref,
  onValue,
  set,
  push,
  remove,
  serverTimestamp,
} from "firebase/database";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // States
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
  const [currentMode, setCurrentMode] = useState("C");
  const [selectedMode, setSelectedMode] = useState("C");
  const [isMasterOn, setIsMasterOn] = useState(true);
  const [partialSettings, setPartialSettings] = useState({
    durasi: 10,
    interval: 60,
  });
  const [randomSettings, setRandomSettings] = useState({
    mulai: "08:00",
    selesai: "08:30",
  });
  const [historyData, setHistoryData] = useState([]);
  const [chartData, setChartData] = useState([]);

  // --- LOGIKA CLOUD MESSAGING (PUSH NOTIF) ---
  const VAPID_KEY =
    "BEG3uTuon198nsVSm-cy7D7b8cKGSrlhq6TbQysmsIh3e0dfsggHjOef1W3pUXvx1Fegh0SUpQCWSqWKf99bmY4";

  const requestPermissionAndToken = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const messaging = getMessaging();
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          console.log("FCM Token:", currentToken);
          // Simpan token ke database agar server bisa mengirim push
          set(ref(db, "tokens/admin"), currentToken);
        }
      }
    } catch (err) {
      console.error("Gagal mendapatkan Token FCM", err);
    }
  }, []);

  useEffect(() => {
    requestPermissionAndToken();

    // Foreground listener (saat aplikasi sedang dibuka)
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      new Notification(payload.notification.title, {
        body: payload.notification.body,
      });
    });

    // Realtime Data Monitoring
    onValue(ref(db, "monitoring"), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setDataMonitoring({
          ketinggian: val.tandon.ketinggian_cm,
          statusIsi: val.tandon.status_isi,
          flowRate: val.kolam.laju_aliran_mls,
          totalVolume: val.kolam.total_aliran_ml,
        });
        setChartData((prev) =>
          [
            ...prev,
            {
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              flow: val.kolam.laju_aliran_mls,
            },
          ].slice(-15)
        );
      }
    });

    onValue(
      ref(db, "pengaturan/tandon"),
      (s) => s.exists() && setThresholdSettings(s.val())
    );
    onValue(
      ref(db, "kontrol/solenoid_1/master_switch"),
      (s) => s.exists() && setIsMasterOn(s.val())
    );
    onValue(ref(db, "history/penggunaan"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setHistoryData(
          Object.keys(data)
            .map((k) => ({ id: k, ...data[k] }))
            .reverse()
        );
      }
    });
  }, [requestPermissionAndToken]);

  // --- AUTO-OFF PROTEKSI ---
  useEffect(() => {
    if (dataMonitoring.ketinggian >= thresholdSettings.atas && isMasterOn) {
      set(ref(db, "kontrol/solenoid_1/master_switch"), false);
      push(ref(db, "history/penggunaan"), {
        tanggal: new Date().toLocaleString("id-ID"),
        mode: "AUTO-OFF",
        durasi: `Batas Maks ${thresholdSettings.atas}% Tercapai`,
        timestamp: serverTimestamp(),
      });
    }
  }, [dataMonitoring.ketinggian, isMasterOn, thresholdSettings.atas]);

  const saveAllSettings = () => {
    set(ref(db, "kontrol/solenoid_1"), {
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
    });
    set(ref(db, "pengaturan/tandon"), thresholdSettings);
    alert("Berhasil disimpan!");
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
            onClick={() => setActivePage("dashboard")}
          >
            📊 Dashboard
          </div>
          <div
            className={`ac-nav-item ${
              activePage === "controls" ? "active" : ""
            }`}
            onClick={() => setActivePage("controls")}
          >
            ⚙️ Controls
          </div>
          <div
            className={`ac-nav-item ${
              activePage === "history" ? "active" : ""
            }`}
            onClick={() => setActivePage("history")}
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
        <div className="ac-footer-addr">Bogor - Sukamandi Control System</div>
      </aside>

      <main className="ac-main-content">
        <header className="ac-header">
          <h1>{activePage.toUpperCase()}</h1>
          <div className="ac-header-actions">
            <button className="ac-noti-btn" onClick={requestPermissionAndToken}>
              🔔
            </button>
            <span className="ac-status-online">● Online</span>
          </div>
        </header>

        {activePage === "dashboard" && (
          <div className="ac-dashboard-grid ac-fade-in">
            <div className="ac-card">
              <h3>Level Air</h3>
              <div className="ac-water-tank">
                <div
                  className={`ac-water-level ${
                    dataMonitoring.ketinggian >= thresholdSettings.atas
                      ? "critical"
                      : ""
                  }`}
                  style={{ height: `${dataMonitoring.ketinggian}%` }}
                ></div>
                <span className="ac-level-text">
                  {dataMonitoring.ketinggian}%
                </span>
              </div>
            </div>
            <div className="ac-card">
              <h3>Debit Aliran</h3>
              <div className="ac-flow-value">
                {dataMonitoring.flowRate} <small>L/min</small>
              </div>
            </div>
          </div>
        )}

        {activePage === "controls" && (
          <div className="ac-card ac-full-width ac-fade-in">
            <div className="ac-master-control-header">
              <h3>Solenoid Valve</h3>
              <label className="ac-switch">
                <input
                  type="checkbox"
                  checked={isMasterOn}
                  onChange={() => setIsMasterOn(!isMasterOn)}
                />
                <span className="ac-slider"></span>
              </label>
            </div>
            <div className={isMasterOn ? "" : "ac-disabled-overlay"}>
              <div className="ac-mode-selector">
                {["C", "P", "R"].map((m) => (
                  <button
                    key={m}
                    className={selectedMode === m ? "active" : ""}
                    onClick={() => setSelectedMode(m)}
                  >
                    {m === "C" ? "Cont." : m === "P" ? "Part." : "Rand."}
                  </button>
                ))}
              </div>
              <div className="ac-settings-grid">
                <div className="ac-setting-box highlight">
                  <h4>Atas (%)</h4>
                  <input
                    type="number"
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
                  <h4>Bawah (%)</h4>
                  <input
                    type="number"
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
              💾 Simpan
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
