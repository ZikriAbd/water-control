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

  // State untuk mode yang sedang aktif di database
  const [currentMode, setCurrentMode] = useState("C");
  // State sementara untuk pilihan user di UI sebelum klik simpan
  const [selectedMode, setSelectedMode] = useState("C");

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

    onValue(ref(db, "history/mingguan"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setWeeklyData([
          { hari: "Sen", total: data.senin || 0 },
          { hari: "Sel", total: data.selasa || 0 },
          { hari: "Rab", total: data.rabu || 0 },
          { hari: "Kam", total: data.kamis || 0 },
          { hari: "Jum", total: data.jumat || 0 },
          { hari: "Sab", total: data.sabtu || 0 },
          { hari: "Min", total: data.minggu || 0 },
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
        const formattedData = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .reverse();
        setHistoryData(formattedData);
      } else {
        setHistoryData([]);
      }
    });
  }, []);

  // --- ACTIONS ---
  const handleCheckboxChange = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const deleteSelectedHistory = () => {
    if (window.confirm(`Hapus ${selectedItems.length} data terpilih?`)) {
      selectedItems.forEach((id) =>
        remove(ref(db, `history/penggunaan/${id}`))
      );
      setSelectedItems([]);
    }
  };

  // Fungsi Simpan Gabungan (Mode + Waktu + Log History)
  const saveAllSettings = () => {
    // Gunakan set() ke masing-masing path secara spesifik
    // agar tidak terjadi error invalid key (karakter '/')

    // 1. Simpan Mode Aktif
    set(ref(db, "kontrol/solenoid_1/mode_aktif"), selectedMode);

    // 2. Simpan Pengaturan Partial
    set(ref(db, "kontrol/solenoid_1/set_partial"), {
      durasi_menit: parseInt(partialSettings.durasi),
      interval_menit: parseInt(partialSettings.interval),
    });

    // 3. Simpan Pengaturan Random
    set(ref(db, "kontrol/solenoid_1/set_random"), {
      jam_mulai: randomSettings.mulai,
      jam_selesai: randomSettings.selesai,
    });

    // 4. Catat ke History
    const modeName =
      selectedMode === "C"
        ? "Continue"
        : selectedMode === "P"
        ? "Partial"
        : "Random";
    push(ref(db, "history/penggunaan"), {
      tanggal: new Date().toLocaleString("id-ID"),
      mode: modeName,
      durasi: selectedMode === "C" ? "Non-stop" : "Sesuai Jadwal Baru",
      timestamp: serverTimestamp(),
    })
      .then(() => {
        alert("Pengaturan Berhasil Disimpan & Dicatat di History!");
      })
      .catch((error) => {
        alert("Gagal menyimpan: " + error.message);
      });
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
        <div className="footer-addr">
          Jalan Raya Sukamandi-Pantura, Desa Rancamulya, Kecamatan Patokbeusi,
          Kabupaten Subang, Jawa Barat, 41263
        </div>
      </aside>

      <main className="main-content">
        <header>
          <h1>{activePage.toUpperCase()}</h1>
          <span className="status online">● System Online</span>
        </header>

        {activePage === "dashboard" && (
          <section className="dashboard-grid fade-in">
            <div className="card">
              <h3>Level Air Tandon</h3>
              <div className="water-tank">
                <div
                  className="water-level"
                  style={{ height: `${dataMonitoring.ketinggian}%` }}
                ></div>
                <span className="level-text">{dataMonitoring.ketinggian}%</span>
              </div>
              <p className="card-info">
                Status: <strong>{dataMonitoring.statusIsi}</strong>
              </p>
            </div>
            <div className="card">
              <h3>Debit Aliran</h3>
              <div className="flow-value">
                {dataMonitoring.flowRate} <small>L/min</small>
              </div>
              <p className="card-info">
                Total: <strong>{dataMonitoring.totalVolume} ml</strong>
              </p>
              <div
                className={`badge-mode ${
                  currentMode === "C"
                    ? "Continue"
                    : currentMode === "P"
                    ? "Partial"
                    : "Random"
                }`}
              >
                Mode:{" "}
                {currentMode === "C"
                  ? "Continue"
                  : currentMode === "P"
                  ? "Partial"
                  : "Random"}
              </div>
            </div>
          </section>
        )}

        {activePage === "controls" && (
          <section className="controls-section fade-in">
            <div className="card full-width">
              <h3>Konfigurasi Solenoid Valve</h3>
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
                    <label>Durasi ON (Menit)</label>
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
                    <label>Interval OFF (Menit)</label>
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
