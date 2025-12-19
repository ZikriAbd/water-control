import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  ref,
  onValue,
  set,
  push,
  remove,
  serverTimestamp,
} from "firebase/database";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import "./App.css";

function App() {
  // --- STATES ---
  const [activePage, setActivePage] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [dataMonitoring, setDataMonitoring] = useState({
    ketinggian: 0,
    flowRate: 0,
    totalVolume: 0,
    statusIsi: "Standby",
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
  const [selectedItems, setSelectedItems] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([
    { hari: "Sen", total: 0 },
    { hari: "Sel", total: 0 },
    { hari: "Rab", total: 0 },
    { hari: "Kam", total: 0 },
    { hari: "Jum", total: 0 },
    { hari: "Sab", total: 0 },
    { hari: "Min", total: 0 },
  ]);

  // --- EFFECT: FIREBASE SYNC ---
  useEffect(() => {
    // 1. Sinkronisasi Data Monitoring & Grafik
    onValue(ref(db, "monitoring"), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setDataMonitoring({
          ketinggian: val.tandon.ketinggian_cm,
          statusIsi: val.tandon.status_isi,
          flowRate: val.kolam.laju_aliran_mls,
          totalVolume: val.kolam.total_aliran_ml,
        });
        setChartData((current) => {
          const newData = [
            ...current,
            {
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              flow: val.kolam.laju_aliran_mls,
            },
          ];
          return newData.slice(-15);
        });
      }
    });

    // 2. Sinkronisasi Master Switch
    onValue(ref(db, "kontrol/solenoid_1/master_switch"), (snap) => {
      if (snap.exists()) setIsMasterOn(snap.val());
    });

    // 3. Sinkronisasi Data Lainnya (Mode, Waktu, History, Mingguan)
    onValue(ref(db, "history/mingguan"), (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setWeeklyData([
          { hari: "Sen", total: d.senin || 0 },
          { hari: "Sel", total: d.selasa || 0 },
          { hari: "Rab", total: d.rabu || 0 },
          { hari: "Kam", total: d.kamis || 0 },
          { hari: "Jum", total: d.jumat || 0 },
          { hari: "Sab", total: d.sabtu || 0 },
          { hari: "Min", total: d.minggu || 0 },
        ]);
      }
    });

    onValue(ref(db, "kontrol/solenoid_1"), (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setCurrentMode(val.mode_aktif);
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

    onValue(ref(db, "history/penggunaan"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const formatted = Object.keys(data)
          .map((k) => ({ id: k, ...data[k] }))
          .reverse();
        setHistoryData(formatted);
      } else {
        setHistoryData([]);
      }
    });
  }, []);

  // --- LOGIKA AUTO-OFF ---
  useEffect(() => {
    if (dataMonitoring.ketinggian >= 95 && isMasterOn) {
      set(ref(db, "kontrol/solenoid_1/master_switch"), false);
      if (Notification.permission === "granted") {
        new Notification("⚠️ Aqua Control: AUTO-OFF!", {
          body: "Tandon penuh (95%). Sistem dimatikan otomatis.",
          icon: "/favicon.ico",
        });
      }
      push(ref(db, "history/penggunaan"), {
        tanggal: new Date().toLocaleString("id-ID"),
        mode: "AUTO-OFF",
        durasi: "Tandon Penuh Proteksi",
        timestamp: serverTimestamp(),
      });
    }
  }, [dataMonitoring.ketinggian]);

  // --- ACTIONS ---
  const requestNotification = () => {
    Notification.requestPermission().then((p) => {
      if (p === "granted") alert("Notifikasi Aktif!");
    });
  };

  const handleCheckboxChange = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const deleteSelectedHistory = () => {
    if (window.confirm(`Hapus ${selectedItems.length} data?`)) {
      selectedItems.forEach((id) =>
        remove(ref(db, `history/penggunaan/${id}`))
      );
      setSelectedItems([]);
    }
  };

  const saveAllSettings = () => {
    set(ref(db, "kontrol/solenoid_1/mode_aktif"), selectedMode);
    set(ref(db, "kontrol/solenoid_1/master_switch"), isMasterOn);
    set(ref(db, "kontrol/solenoid_1/set_partial"), {
      durasi_menit: parseInt(partialSettings.durasi),
      interval_menit: parseInt(partialSettings.interval),
    });
    set(ref(db, "kontrol/solenoid_1/set_random"), {
      jam_mulai: randomSettings.mulai,
      jam_selesai: randomSettings.selesai,
    });

    const modeName = isMasterOn
      ? selectedMode === "C"
        ? "Continue"
        : selectedMode === "P"
        ? "Partial"
        : "Random"
      : "OFF (Manual)";
    push(ref(db, "history/penggunaan"), {
      tanggal: new Date().toLocaleString("id-ID"),
      mode: modeName,
      durasi: isMasterOn ? "Update Jadwal" : "Manual Shutdown",
      timestamp: serverTimestamp(),
    }).then(() => alert("Pengaturan Berhasil Disimpan!"));
  };

  return (
    <div className={`container ${isDarkMode ? "dark-theme" : ""}`}>
      <div className="hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <aside className={`sidebar ${isMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2>AquaControl</h2>
          <small>BRPI Sukamandi</small>
        </div>
        <nav>
          <div
            className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
            onClick={() => {
              setActivePage("dashboard");
              setIsMenuOpen(false);
            }}
          >
            📊 Dashboard
          </div>
          <div
            className={`nav-item ${activePage === "controls" ? "active" : ""}`}
            onClick={() => {
              setActivePage("controls");
              setIsMenuOpen(false);
            }}
          >
            ⚙️ Controls
          </div>
          <div
            className={`nav-item ${activePage === "history" ? "active" : ""}`}
            onClick={() => {
              setActivePage("history");
              setIsMenuOpen(false);
            }}
          >
            📜 History
          </div>
          <hr className="divider" />
          <div className="nav-item" onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? "☀️ Light" : "🌙 Dark"}
          </div>
        </nav>
        <div className="footer-addr">Subang, Jawa Barat, 41263</div>
      </aside>

      <main className="main-content">
        <header>
          <h1>{activePage.toUpperCase()}</h1>
          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <button
              onClick={requestNotification}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "1.2rem",
              }}
            >
              🔔
            </button>
            <span className="status online">● System Online</span>
          </div>
        </header>

        {activePage === "dashboard" && (
          <section className="dashboard-grid fade-in">
            <div className="card">
              <h3>Level Air Tandon</h3>
              <div className="water-tank">
                <div
                  className={`water-level ${
                    dataMonitoring.ketinggian >= 90 ? "critical" : ""
                  }`}
                  style={{ height: `${dataMonitoring.ketinggian}%` }}
                ></div>
                <span className="level-text">{dataMonitoring.ketinggian}%</span>
              </div>
              <p>
                Status: <strong>{dataMonitoring.statusIsi}</strong>
              </p>
            </div>
            <div className="card">
              <h3>Debit Aliran</h3>
              <div className="flow-value">
                {dataMonitoring.flowRate} <small>L/min</small>
              </div>
              <p>
                Total: <strong>{dataMonitoring.totalVolume} ml</strong>
              </p>
              <div
                className={`badge-mode ${
                  isMasterOn
                    ? currentMode === "C"
                      ? "Continue"
                      : currentMode === "P"
                      ? "Partial"
                      : "Random"
                    : "OFF"
                }`}
              >
                Mode:{" "}
                {isMasterOn
                  ? currentMode === "C"
                    ? "Continue"
                    : currentMode === "P"
                    ? "Partial"
                    : "Random"
                  : "SISTEM OFF"}
              </div>
            </div>
          </section>
        )}

        {activePage === "controls" && (
          <section className="controls-section fade-in">
            <div className="card full-width">
              <div className="master-control-header">
                <h3>Konfigurasi Solenoid Valve</h3>
                <div className="master-switch-container">
                  <span>{isMasterOn ? "Sistem Aktif" : "Sistem Nonaktif"}</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isMasterOn}
                      onChange={() => setIsMasterOn(!isMasterOn)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
              <div className={isMasterOn ? "" : "disabled-overlay"}>
                <div className="mode-selector">
                  <button
                    className={selectedMode === "C" ? "active" : ""}
                    onClick={() => setSelectedMode("C")}
                  >
                    Continue
                  </button>
                  <button
                    className={selectedMode === "P" ? "active" : ""}
                    onClick={() => setSelectedMode("P")}
                  >
                    Partial
                  </button>
                  <button
                    className={selectedMode === "R" ? "active" : ""}
                    onClick={() => setSelectedMode("R")}
                  >
                    Random
                  </button>
                </div>
                <div className="settings-grid">
                  <div
                    className={`setting-box ${
                      selectedMode === "P" ? "highlight" : ""
                    }`}
                  >
                    <h4>⏱️ Mode Partial</h4>
                    <div className="input-group">
                      <label>ON (Menit)</label>
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
                    <div className="input-group">
                      <label>OFF (Menit)</label>
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
                    className={`setting-box ${
                      selectedMode === "R" ? "highlight" : ""
                    }`}
                  >
                    <h4>📅 Mode Random</h4>
                    <div className="input-group">
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
                    <div className="input-group">
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
                </div>
              </div>
              <button className="btn-save-settings" onClick={saveAllSettings}>
                💾 Simpan Pengaturan & Update History
              </button>
            </div>
          </section>
        )}

        {activePage === "history" && (
          <section className="history-section fade-in">
            <div className="charts-container">
              <div className="card chart-card">
                <h3>Laju Aliran (L/min)</h3>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" fontSize={10} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="flow"
                        stroke="#2196f3"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card chart-card">
                <h3>Total Mingguan (Liter)</h3>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hari" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar
                        dataKey="total"
                        fill="#4caf50"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="card full-width">
              <div className="history-header">
                <h3>Log Aktivitas</h3>
                {selectedItems.length > 0 && (
                  <button
                    className="btn-delete-selected"
                    onClick={deleteSelectedHistory}
                  >
                    🗑️ Hapus ({selectedItems.length})
                  </button>
                )}
              </div>
              <div className="table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Pilih</th>
                      <th>No</th>
                      <th>Waktu</th>
                      <th>Mode</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((item, index) => (
                      <tr
                        key={item.id}
                        className={
                          selectedItems.includes(item.id) ? "row-selected" : ""
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleCheckboxChange(item.id)}
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>{item.tanggal}</td>
                        <td>
                          <span className={`badge ${item.mode}`}>
                            {item.mode}
                          </span>
                        </td>
                        <td>{item.durasi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
