import React, { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { ref, onValue, set, push, serverTimestamp } from "firebase/database";
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

  // States Monitoring - Sesuai JSON
  const [dataMonitoring, setDataMonitoring] = useState({
    ketinggian: 0,
    flowRate: 0,
    totalVolume: 0,
    statusIsi: "Standby",
  });

  // States Pengaturan
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

  const VAPID_KEY =
    "BEG3uTuon198nsVSm-cy7D7b8cKGSrlhq6TbQysmsIh3e0dfsggHjOef1W3pUXvx1Fegh0SUpQCWSqWKf99bmY4";

  const requestPermissionAndToken = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const messaging = getMessaging();
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          set(ref(db, "tokens/admin"), currentToken);
        }
      }
    } catch (err) {
      console.error("FCM Error:", err);
    }
  }, []);

  useEffect(() => {
    requestPermissionAndToken();
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      new Notification(payload.notification.title, {
        body: payload.notification.body,
      });
    });

    // 1. Ambil Monitoring & Update Grafik
    onValue(ref(db, "monitoring"), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setDataMonitoring({
          ketinggian: val.tandon.ketinggian_cm,
          statusIsi: val.tandon.status_isi,
          flowRate: val.kolam.laju_aliran_mls,
          totalVolume: val.kolam.total_aliran_ml,
        });

        // Tambahkan data ke grafik (maksimal 15 data terakhir)
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

    // 2. Ambil History
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

    // 3. Ambil Pengaturan
    onValue(ref(db, "pengaturan/tandon"), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setThresholdSettings({
          atas: Number(val.threshold_atas),
          bawah: Number(val.threshold_bawah),
        });
      }
    });

    // 4. Ambil Kontrol
    onValue(ref(db, "kontrol/solenoid_1"), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setIsMasterOn(val.master_switch);
        setSelectedMode(val.mode_aktif);
        setPartialSettings({
          durasi: val.set_partial.durasi_menit,
          interval: val.set_partial.interval_menit,
        });
        setRandomSettings({
          mulai: val.set_random.jam_mulai,
          selesai: val.set_random.jam_selesai,
        });
      }
    });
  }, [requestPermissionAndToken]);

  const saveAllSettings = () => {
    const vAtas = parseInt(thresholdSettings.atas);
    const vBawah = parseInt(thresholdSettings.bawah);
    if (vBawah >= vAtas) {
      alert("Error: Batas Bawah tidak boleh melebihi Batas Atas!");
      return;
    }

    set(ref(db, "pengaturan/tandon"), {
      threshold_atas: vAtas,
      threshold_bawah: vBawah,
      max_safety_limit: 140,
    });
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
      status_relay: isMasterOn,
    });
    alert("Pengaturan Berhasil Disimpan!");
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
            <button className="ac-noti-btn" onClick={requestPermissionAndToken}>
              🔔
            </button>
            <span className="ac-status-online">● Online</span>
          </div>
        </header>

        {activePage === "dashboard" && (
          <div className="ac-dashboard-grid ac-fade-in">
            {/* Tandon Card */}
            <div className="ac-card">
              <h3>Level Air Tandon</h3>
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
              <p>
                Status: <strong>{dataMonitoring.statusIsi}</strong>
              </p>
            </div>

            {/* Flow Card & Grafik */}
            <div className="ac-card">
              <h3>Debit Aliran</h3>
              <div className="ac-flow-value">
                {dataMonitoring.flowRate} <small>L/min</small>
              </div>
              <div
                style={{ width: "100%", height: "150px", marginTop: "15px" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#ddd"
                    />
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={[0, "auto"]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="flow"
                      stroke="#007bff"
                      strokeWidth={3}
                      dot={false}
                      animationDuration={500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p>Total: {dataMonitoring.totalVolume} ml</p>
            </div>
          </div>
        )}

        {activePage === "controls" && (
          <div className="ac-card ac-full-width ac-fade-in">
            <div className="ac-master-control-header">
              <h3>Solenoid Control</h3>
              <div className="ac-master-switch-container">
                <span>{isMasterOn ? "Sistem Aktif" : "Sistem Nonaktif"}</span>
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
                  >
                    {m === "C" ? "Continue" : m === "P" ? "Partial" : "Random"}
                  </button>
                ))}
              </div>
              <div className="ac-settings-grid">
                <div
                  className={`ac-setting-box ${
                    selectedMode === "P" ? "highlight" : ""
                  }`}
                >
                  <h4>⏱️ Mode Partial</h4>
                  <div className="ac-input-group">
                    <label>ON (Min)</label>
                    <input
                      type="number"
                      value={partialSettings.durasi}
                      onChange={(e) =>
                        setPartialSettings({
                          ...partialSettings,
                          durasi: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="ac-input-group">
                    <label>OFF (Min)</label>
                    <input
                      type="number"
                      value={partialSettings.interval}
                      onChange={(e) =>
                        setPartialSettings({
                          ...partialSettings,
                          interval: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div
                  className={`ac-setting-box ${
                    selectedMode === "R" ? "highlight" : ""
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
                    />
                  </div>
                </div>
                <div className="ac-setting-box highlight">
                  <h4>🚀 Batas Atas (%)</h4>
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
                  <h4>💧 Batas Bawah (%)</h4>
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
              💾 Simpan Pengaturan
            </button>
          </div>
        )}

        {activePage === "history" && (
          <div className="ac-card ac-full-width ac-fade-in">
            <h3>📜 Riwayat Penggunaan</h3>
            <div className="ac-table-container">
              <table className="ac-history-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Mode</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.length > 0 ? (
                    historyData.map((item) => (
                      <tr key={item.id}>
                        <td>{item.tanggal}</td>
                        <td>
                          <span
                            className={`ac-badge ${
                              item.mode.includes("OFF") ? "off" : "on"
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
                      <td colSpan="3" style={{ textAlign: "center" }}>
                        Tidak ada riwayat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
