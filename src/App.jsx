import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  AreaChart,
  Area,
} from "recharts";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- State Health Check (Deteksi Online/Offline) ---
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isDeviceOnline, setIsDeviceOnline] = useState(true);

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
  const [volumeHistory, setVolumeHistory] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedVolumeItems, setSelectedVolumeItems] = useState([]);

  // --- 1. Ambil Data Monitoring & Update Status Online ---
  useEffect(() => {
    const monitoringRef = ref(db, "monitoring");
    const unsubscribe = onValue(
      monitoringRef,
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();

          // Update Waktu Terakhir Data Masuk (Health Check)
          setLastUpdate(Date.now());
          setIsDeviceOnline(true);

          const ketinggianBaru = val.tandon?.ketinggian_cm || 0;

          setDataMonitoring({
            ketinggian: ketinggianBaru,
            statusIsi: val.tandon?.status_isi || "Standby",
            flowRate: val.kolam?.laju_aliran_mls || 0,
            totalVolume: val.kolam?.total_aliran_ml || 0,
          });

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
      },
    );

    return () => unsubscribe();
  }, []);

  // --- 2. Timer Deteksi Offline (Jika data diam > 60 detik) ---
  useEffect(() => {
    const interval = setInterval(() => {
      // Jika waktu sekarang dikurang update terakhir > 60.000ms (1 menit)
      if (Date.now() - lastUpdate > 60000) {
        setIsDeviceOnline(false);
      }
    }, 5000); // Cek setiap 5 detik

    return () => clearInterval(interval);
  }, [lastUpdate]);

  // --- 3. Ambil Data Riwayat Penggunaan ---
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
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
          );
        } else {
          setHistoryData([]);
        }
      },
      (error) => {
        console.error("Error membaca riwayat:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  // --- 4. Ambil Data History Volume ---
  useEffect(() => {
    const volumeHistoryRef = ref(db, "history/volume");
    const unsubscribe = onValue(
      volumeHistoryRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setVolumeHistory(
            Object.keys(data)
              .map((k) => ({ id: k, ...data[k] }))
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
          );
        } else {
          setVolumeHistory([]);
        }
      },
      (error) => {
        console.error("Error membaca history volume:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  // --- 5. Ambil Pengaturan Tandon ---
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
      },
    );

    return () => unsubscribe();
  }, []);

  // --- 6. Ambil Status Kontrol Solenoid ---
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
      },
    );

    return () => unsubscribe();
  }, []);

  // --- Fungsi Helper Selection ---
  const handleSelectItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === historyData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(historyData.map((item) => item.id));
    }
  };

  const handleSelectVolumeItem = (id) => {
    setSelectedVolumeItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAllVolume = () => {
    if (selectedVolumeItems.length === volumeHistory.length) {
      setSelectedVolumeItems([]);
    } else {
      setSelectedVolumeItems(volumeHistory.map((item) => item.id));
    }
  };

  // --- Fungsi Hapus Data ---
  const deleteSelectedHistory = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Hapus ${selectedItems.length} data riwayat terpilih?`))
      return;

    try {
      const deletePromises = selectedItems.map((id) =>
        remove(ref(db, `history/penggunaan/${id}`)),
      );
      await Promise.all(deletePromises);
      setSelectedItems([]);
      alert("Data berhasil dihapus.");
    } catch (err) {
      console.error("Error menghapus data:", err);
      alert("Gagal menghapus data: " + err.message);
    }
  };

  const deleteSelectedVolumeHistory = async () => {
    if (selectedVolumeItems.length === 0) return;
    if (
      !window.confirm(
        `Hapus ${selectedVolumeItems.length} data volume terpilih?`,
      )
    )
      return;

    try {
      const deletePromises = selectedVolumeItems.map((id) =>
        remove(ref(db, `history/volume/${id}`)),
      );
      await Promise.all(deletePromises);
      setSelectedVolumeItems([]);
      alert("Data volume berhasil dihapus.");
    } catch (err) {
      console.error("Error menghapus data volume:", err);
      alert("Gagal menghapus data volume: " + err.message);
    }
  };

  // --- Fungsi Reset Volume ---
  const resetTotalVolume = async () => {
    if (dataMonitoring.totalVolume === 0) {
      alert("Total volume sudah 0, tidak perlu direset.");
      return;
    }

    if (
      !window.confirm(
        `Reset total volume ${dataMonitoring.totalVolume.toFixed(
          0,
        )} ml dan simpan ke history?`,
      )
    ) {
      return;
    }

    try {
      await push(ref(db, "history/volume"), {
        total_ml: dataMonitoring.totalVolume,
        tanggal: new Date().toLocaleString("id-ID"),
        timestamp: serverTimestamp(),
      });

      await set(ref(db, "monitoring/kolam/total_aliran_ml"), 0);
      alert("✅ Total volume berhasil direset dan disimpan ke history!");
    } catch (error) {
      console.error("Error reset total volume:", error);
      alert("❌ Gagal reset total volume: " + error.message);
    }
  };

  // --- Fungsi Kontrol Solenoid ---
  const handleMasterSwitchToggle = async (e) => {
    const newState = e.target.checked;
    setIsMasterOn(newState);

    try {
      await set(ref(db, "kontrol/solenoid_1/master_switch"), newState);
      await set(ref(db, "kontrol/solenoid_1/status_relay"), newState);

      await push(ref(db, "history/penggunaan"), {
        tanggal: new Date().toLocaleString("id-ID"),
        mode: newState ? "MASTER ON" : "MASTER OFF",
        durasi: newState ? "Sistem Diaktifkan" : "Sistem Dihentikan",
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error mengubah master switch:", error);
      alert("❌ Gagal mengubah master switch: " + error.message);
      setIsMasterOn(!newState);
    }
  };

  const saveKolamSettings = async () => {
    try {
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

      alert("✅ Pengaturan Kolam Berhasil Disimpan!");
    } catch (error) {
      console.error("Error menyimpan pengaturan kolam:", error);
      alert("❌ Gagal menyimpan pengaturan kolam: " + error.message);
    }
  };

  const saveTandonSettings = async () => {
    const vAtas = parseInt(thresholdSettings.atas);
    const vBawah = parseInt(thresholdSettings.bawah);

    if (isNaN(vAtas) || isNaN(vBawah)) {
      alert("Error: Nilai threshold harus berupa angka!");
      return;
    }
    if (vBawah >= vAtas) {
      alert("Error: Batas Bawah tidak boleh >= Batas Atas!");
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
        max_safety_limit: 100,
      });

      await push(ref(db, "history/penggunaan"), {
        tanggal: new Date().toLocaleString("id-ID"),
        mode: "THRESHOLD UPDATE",
        durasi: `Batas Atas: ${vAtas}%, Batas Bawah: ${vBawah}%`,
        timestamp: serverTimestamp(),
      });

      alert("✅ Pengaturan Tandon Berhasil Disimpan!");
    } catch (error) {
      console.error("Error menyimpan pengaturan tandon:", error);
      alert("❌ Gagal menyimpan pengaturan tandon: " + error.message);
    }
  };

  // --- Fungsi PDF Export ---
  const downloadPDFVolume = () => {
    if (volumeHistory.length === 0) {
      alert("Tidak ada data volume untuk dicetak!");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Riwayat Volume Air", 14, 20);
    doc.setFontSize(10);
    doc.text("Water Control System - BRPI Sukamandi", 14, 26);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 14, 32);

    const tableColumn = ["No", "Waktu", "Total (ml)", "Total (Liter)"];
    const tableRows = volumeHistory.map((item, index) => [
      index + 1,
      item.tanggal,
      item.total_ml,
      (item.total_ml / 1000).toFixed(2),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [26, 35, 126] },
    });
    doc.save("Laporan_Volume_Air.pdf");
  };

  const downloadPDFLogs = () => {
    if (historyData.length === 0) {
      alert("Tidak ada data log untuk dicetak!");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Log Aktivitas Sistem", 14, 20);
    doc.setFontSize(10);
    doc.text("Water Control System - BRPI Sukamandi", 14, 26);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 14, 32);

    const tableColumn = ["No", "Waktu", "Mode", "Keterangan Aktivitas"];
    const tableRows = historyData.map((item, index) => [
      index + 1,
      item.tanggal,
      item.mode,
      item.durasi,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 150, 243] },
    });
    doc.save("Laporan_Log_Aktivitas.pdf");
  };

  const getModeLabel = () => {
    if (!isMasterOn) return "OFF";
    if (selectedMode === "C") return "CONTINUE";
    if (selectedMode === "P") return "PARTIAL";
    if (selectedMode === "R") return "RANDOM";
    return "UNKNOWN";
  };

  const getBadgeClass = (mode) => {
    if (mode === "OFF" || mode === "MASTER OFF") return "off";
    return "on";
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
            {/* INDIKATOR STATUS ONLINE/OFFLINE */}
            <div
              className="ac-status-online"
              style={{
                backgroundColor: isDeviceOnline
                  ? "rgba(76, 175, 80, 0.1)"
                  : "rgba(244, 67, 54, 0.1)",
                color: isDeviceOnline ? "#4caf50" : "#f44336",
                border: `1px solid ${isDeviceOnline ? "#4caf50" : "#f44336"}`,
                transition: "all 0.3s",
              }}
            >
              {isDeviceOnline ? "● Online" : "● Offline / Putus"}
            </div>
            {/* Waktu update terakhir (Opsional) */}
            {isDeviceOnline && (
              <small style={{ fontSize: "0.7rem", color: "#888" }}>
                Up: {new Date(lastUpdate).toLocaleTimeString()}
              </small>
            )}
          </div>
        </header>

        {/* ========== DASHBOARD PAGE ========== */}
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
              <button
                className="ac-btn-reset-volume"
                onClick={resetTotalVolume}
              >
                🔄 Reset Total Volume
              </button>
              <hr className="ac-divider-thin" />
              <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                Sukamandi, Subang, Jawa Barat 41263
              </p>
            </div>
          </div>
        )}

        {/* ========== CONTROLS PAGE ========== */}
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
                    onChange={handleMasterSwitchToggle}
                  />
                  <span className="ac-slider ac-round"></span>
                </label>
              </div>
            </div>

            <div className={isMasterOn ? "" : "ac-disabled-overlay"}>
              <h4 className="ac-section-title">
                🏊 Kontrol Solenoid Kolam (Solenoid I - Otomatis)
              </h4>

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
                    <label>ON (Menit)</label>
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
                    <label>OFF (Menit)</label>
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
                    <label>Jam Mulai</label>
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
                    <label>Jam Selesai</label>
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
              </div>

              <button
                className="ac-btn-save-settings"
                onClick={saveKolamSettings}
                disabled={!isMasterOn}
              >
                💾 Simpan Pengaturan Kolam
              </button>
            </div>

            <hr className="ac-section-divider" />

            <div>
              <h4 className="ac-section-title">
                💧 Pengaturan Threshold Tandon (Solenoid II - Otomatis)
              </h4>
              <p className="ac-threshold-info">
                ℹ️ Pengaturan ini mengontrol solenoid untuk tandon secara
                otomatis.
              </p>

              <div className="ac-settings-grid">
                <div className="ac-setting-box highlight">
                  <h4>🚀 Batas Atas (%)</h4>
                  <p className="ac-threshold-desc">
                    Katup tandon akan <strong>TUTUP</strong> saat air mencapai
                    batas ini
                  </p>
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
                    className="ac-threshold-input"
                  />
                </div>

                <div className="ac-setting-box highlight">
                  <h4>💧 Batas Bawah (%)</h4>
                  <p className="ac-threshold-desc">
                    Katup tandon akan <strong>BUKA</strong> saat air turun ke
                    batas ini
                  </p>
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
                    className="ac-threshold-input"
                  />
                </div>
              </div>

              <button
                className="ac-btn-save-settings ac-btn-save-tandon"
                onClick={saveTandonSettings}
              >
                💾 Simpan Pengaturan Tandon
              </button>
            </div>
          </div>
        )}

        {/* ========== HISTORY PAGE ========== */}
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
                <h3>💧 Riwayat Total Volume</h3>
                {/* Tombol PDF & Hapus Volume */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="ac-btn-save-settings"
                    style={{
                      marginTop: 0,
                      width: "auto",
                      padding: "8px 15px",
                      background: "#673ab7",
                    }}
                    onClick={downloadPDFVolume}
                  >
                    📄 PDF
                  </button>
                  {selectedVolumeItems.length > 0 && (
                    <button
                      className="ac-btn-delete-multi"
                      onClick={deleteSelectedVolumeHistory}
                    >
                      🗑️ Hapus ({selectedVolumeItems.length})
                    </button>
                  )}
                </div>
              </div>
              <div className="ac-table-container">
                <table className="ac-history-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={
                            volumeHistory.length > 0 &&
                            selectedVolumeItems.length === volumeHistory.length
                          }
                          onChange={handleSelectAllVolume}
                        />
                      </th>
                      <th>Waktu</th>
                      <th>Total Volume</th>
                      <th>Total (Liter)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volumeHistory.length > 0 ? (
                      volumeHistory.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            selectedVolumeItems.includes(item.id)
                              ? "selected-row"
                              : ""
                          }
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedVolumeItems.includes(item.id)}
                              onChange={() => handleSelectVolumeItem(item.id)}
                            />
                          </td>
                          <td>{item.tanggal}</td>
                          <td>
                            <strong>{item.total_ml?.toFixed(0) || 0} ml</strong>
                          </td>
                          <td>{((item.total_ml || 0) / 1000).toFixed(2)} L</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center" }}>
                          Belum ada riwayat volume.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              className="ac-card ac-full-width"
              style={{ marginTop: "20px" }}
            >
              <div className="ac-history-header">
                <h3>📜 Riwayat Log Penggunaan</h3>
                {/* Tombol PDF & Hapus Log */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="ac-btn-save-settings"
                    style={{
                      marginTop: 0,
                      width: "auto",
                      padding: "8px 15px",
                      background: "#673ab7",
                    }}
                    onClick={downloadPDFLogs}
                  >
                    📄 PDF
                  </button>
                  {selectedItems.length > 0 && (
                    <button
                      className="ac-btn-delete-multi"
                      onClick={deleteSelectedHistory}
                    >
                      🗑️ Hapus ({selectedItems.length})
                    </button>
                  )}
                </div>
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
                              className={`ac-badge ${getBadgeClass(item.mode)}`}
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
                          Belum ada log penggunaan.
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

export default App;
