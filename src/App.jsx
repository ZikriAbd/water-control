// import React, { useState, useEffect, useCallback } from "react";
// import { db } from "./firebase";
// import {
//   ref,
//   onValue,
//   set,
//   push,
//   remove,
//   serverTimestamp,
// } from "firebase/database";
// import { getMessaging, getToken, onMessage } from "firebase/messaging";
// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   ResponsiveContainer,
//   AreaChart,
//   Area,
// } from "recharts";
// import "./App.css";

// function App() {
//   const [activePage, setActivePage] = useState("dashboard");
//   const [isDarkMode, setIsDarkMode] = useState(false);
//   const [isMenuOpen, setIsMenuOpen] = useState(false);

//   // States Monitoring & Pengaturan
//   const [dataMonitoring, setDataMonitoring] = useState({
//     ketinggian: 0,
//     flowRate: 0,
//     totalVolume: 0,
//     statusIsi: "Standby",
//   });
//   const [thresholdSettings, setThresholdSettings] = useState({
//     atas: 90,
//     bawah: 30,
//   });
//   const [selectedMode, setSelectedMode] = useState("C");
//   const [isMasterOn, setIsMasterOn] = useState(true);
//   const [partialSettings, setPartialSettings] = useState({
//     durasi: 15,
//     interval: 50,
//   });
//   const [randomSettings, setRandomSettings] = useState({
//     mulai: "14:00",
//     selesai: "10:30",
//   });

//   const [historyData, setHistoryData] = useState([]);
//   const [chartData, setChartData] = useState([]);
//   const [selectedItems, setSelectedItems] = useState([]);

//   const VAPID_KEY =
//     "BEG3uTuon198nsVSm-cy7D7b8cKGSrlhq6TbQysmsIh3e0dfsggHjOef1W3pUXvx1Fegh0SUpQCWSqWKf99bmY4";

//   // Inisialisasi Notifikasi
//   const requestPermissionAndToken = useCallback(async () => {
//     try {
//       const permission = await Notification.requestPermission();
//       if (permission === "granted") {
//         const messaging = getMessaging();
//         const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
//         if (currentToken) {
//           set(ref(db, "tokens/admin"), currentToken);
//         }
//       }
//     } catch (err) {
//       console.error("FCM Error:", err);
//     }
//   }, []);

//   useEffect(() => {
//     requestPermissionAndToken();
//     const messaging = getMessaging();
//     onMessage(messaging, (payload) => {
//       new Notification(payload.notification.title, {
//         body: payload.notification.body,
//       });
//     });

//     // Ambil Data Monitoring
//     onValue(ref(db, "monitoring"), (snap) => {
//       if (snap.exists()) {
//         const val = snap.val();
//         setDataMonitoring({
//           ketinggian: val.tandon.ketinggian_cm,
//           statusIsi: val.tandon.status_isi,
//           flowRate: val.kolam.laju_aliran_mls,
//           totalVolume: val.kolam.total_aliran_ml,
//         });
//         setChartData((prev) =>
//           [
//             ...prev,
//             {
//               time: new Date().toLocaleTimeString([], {
//                 hour: "2-digit",
//                 minute: "2-digit",
//                 second: "2-digit",
//               }),
//               flow: val.kolam.laju_aliran_mls,
//               total: val.kolam.total_aliran_ml,
//             },
//           ].slice(-20)
//         );
//       }
//     });

//     // Ambil Data Riwayat
//     onValue(ref(db, "history/penggunaan"), (snap) => {
//       if (snap.exists()) {
//         const data = snap.val();
//         setHistoryData(
//           Object.keys(data)
//             .map((k) => ({ id: k, ...data[k] }))
//             .reverse()
//         );
//       } else {
//         setHistoryData([]);
//       }
//     });

//     // Ambil Pengaturan Tandon
//     onValue(ref(db, "pengaturan/tandon"), (snap) => {
//       if (snap.exists()) {
//         const val = snap.val();
//         setThresholdSettings({
//           atas: Number(val.threshold_atas),
//           bawah: Number(val.threshold_bawah),
//         });
//       }
//     });

//     // Ambil Status Kontrol Solenoid I
//     onValue(ref(db, "kontrol/solenoid_1"), (snap) => {
//       if (snap.exists()) {
//         const val = snap.val();
//         setIsMasterOn(val.master_switch);
//         setSelectedMode(val.mode_aktif);
//         setPartialSettings({
//           durasi: val.set_partial.durasi_menit,
//           interval: val.set_partial.interval_menit,
//         });
//         setRandomSettings({
//           mulai: val.set_random.jam_mulai,
//           selesai: val.set_random.jam_selesai,
//         });
//       }
//     });
//   }, [requestPermissionAndToken]);

//   const handleSelectItem = (id) => {
//     setSelectedItems((prev) =>
//       prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
//     );
//   };

//   const handleSelectAll = () => {
//     if (selectedItems.length === historyData.length) {
//       setSelectedItems([]);
//     } else {
//       setSelectedItems(historyData.map((item) => item.id));
//     }
//   };

//   const deleteSelectedHistory = async () => {
//     if (selectedItems.length === 0) return;
//     if (
//       window.confirm(`Hapus ${selectedItems.length} data riwayat terpilih?`)
//     ) {
//       try {
//         const deletePromises = selectedItems.map((id) =>
//           remove(ref(db, `history/penggunaan/${id}`))
//         );
//         await Promise.all(deletePromises);
//         setSelectedItems([]);
//         alert("Data berhasil dihapus.");
//       } catch (err) {
//         alert("Gagal menghapus data.");
//       }
//     }
//   };

//   // FUNGSI SIMPAN DENGAN LOGIKA PERBAIKAN "OFF"
//   const saveAllSettings = () => {
//     const vAtas = parseInt(thresholdSettings.atas);
//     const vBawah = parseInt(thresholdSettings.bawah);
//     if (vBawah >= vAtas) {
//       alert("Error: Batas Bawah tidak boleh melebihi Batas Atas!");
//       return;
//     }

//     set(ref(db, "pengaturan/tandon"), {
//       threshold_atas: vAtas,
//       threshold_bawah: vBawah,
//       max_safety_limit: 140,
//     });
//     set(ref(db, "kontrol/solenoid_1"), {
//       mode_aktif: selectedMode,
//       master_switch: isMasterOn,
//       set_partial: {
//         durasi_menit: parseInt(partialSettings.durasi),
//         interval_menit: parseInt(partialSettings.interval),
//       },
//       set_random: {
//         jam_mulai: randomSettings.mulai,
//         jam_selesai: randomSettings.selesai,
//       },
//       status_relay: isMasterOn,
//     });

//     // Logika penulisan label Mode
//     const modeLabel = !isMasterOn
//       ? "OFF"
//       : selectedMode === "C"
//       ? "CONTINUE"
//       : selectedMode === "P"
//       ? "PARTIAL"
//       : "RANDOM";

//     // Logika penulisan Keterangan (Durasi)
//     const detailLog = !isMasterOn
//       ? "SISTEM BERHENTI" // Jika OFF, keterangan langsung "SISTEM BERHENTI"
//       : selectedMode === "P"
//       ? `ON:${partialSettings.durasi}m, OFF:${partialSettings.interval}m`
//       : selectedMode === "R"
//       ? `Jadwal:${randomSettings.mulai}-${randomSettings.selesai}`
//       : "Terus Menerus";

//     push(ref(db, "history/penggunaan"), {
//       tanggal: new Date().toLocaleString("id-ID"),
//       mode: modeLabel,
//       durasi: detailLog, // Menggunakan variabel detailLog yang sudah diringkas
//       timestamp: serverTimestamp(),
//     });
//     alert("Pengaturan Berhasil Disimpan!");
//   };
//   const getModeLabel = () => {
//     if (selectedMode === "C") return "CONTINUE";
//     if (selectedMode === "P") return "PARTIAL";
//     if (selectedMode === "R") return "RANDOM";
//     return "UNKNOWN";
//   };

//   return (
//     <div className={`ac-container ${isDarkMode ? "dark-theme" : ""}`}>
//       <div
//         className={`ac-hamburger-btn ${isMenuOpen ? "active" : ""}`}
//         onClick={() => setIsMenuOpen(!isMenuOpen)}
//       >
//         <span></span>
//         <span></span>
//         <span></span>
//       </div>

//       {/* Sidebar Navigation */}
//       <aside className={`ac-sidebar ${isMenuOpen ? "open" : ""}`}>
//         <div className="ac-sidebar-header">
//           <h2>AquaControl</h2>
//           <small>BRPI Sukamandi</small>
//         </div>
//         <nav>
//           <div
//             className={`ac-nav-item ${
//               activePage === "dashboard" ? "active" : ""
//             }`}
//             onClick={() => {
//               setActivePage("dashboard");
//               setIsMenuOpen(false);
//             }}
//           >
//             📊 Dashboard
//           </div>
//           <div
//             className={`ac-nav-item ${
//               activePage === "controls" ? "active" : ""
//             }`}
//             onClick={() => {
//               setActivePage("controls");
//               setIsMenuOpen(false);
//             }}
//           >
//             ⚙️ Controls
//           </div>
//           <div
//             className={`ac-nav-item ${
//               activePage === "history" ? "active" : ""
//             }`}
//             onClick={() => {
//               setActivePage("history");
//               setIsMenuOpen(false);
//             }}
//           >
//             📜 History
//           </div>
//           <hr className="ac-divider" />
//           <div
//             className="ac-nav-item"
//             onClick={() => setIsDarkMode(!isDarkMode)}
//           >
//             {isDarkMode ? "☀️ Light" : "🌙 Dark"}
//           </div>
//         </nav>
//       </aside>

//       <main className="ac-main-content">
//         <header className="ac-header">
//           <h1>{activePage.toUpperCase()}</h1>
//           <div className="ac-header-actions">
//             <button className="ac-noti-btn" onClick={requestPermissionAndToken}>
//               🔔
//             </button>
//             <span className="ac-status-online">● Online</span>
//           </div>
//         </header>

//         {/* DASHBOARD PAGE */}
//         {activePage === "dashboard" && (
//           <div className="ac-dashboard-grid ac-fade-in">
//             <div className="ac-card">
//               <h3>Level Air Tandon</h3>
//               <div className="ac-water-tank">
//                 <div
//                   className={`ac-water-level ${
//                     dataMonitoring.ketinggian >= thresholdSettings.atas
//                       ? "critical"
//                       : ""
//                   }`}
//                   style={{ height: `${dataMonitoring.ketinggian}%` }}
//                 ></div>
//                 <span className="ac-level-text">
//                   {dataMonitoring.ketinggian}%
//                 </span>
//               </div>
//               <div className="ac-status-info">
//                 <p>
//                   Status Pengisian Tandon:
//                   <strong
//                     style={{
//                       color:
//                         dataMonitoring.statusIsi === "Mengisi"
//                           ? "#2196f3"
//                           : "inherit",
//                     }}
//                   >
//                     {dataMonitoring.statusIsi === "Mengisi"
//                       ? " 🔄 Sedang Mengisi (Sel II)"
//                       : " ✅ Standby"}
//                   </strong>
//                 </p>
//                 <p>
//                   Status pengisian Kolam:
//                   <strong style={{ color: isMasterOn ? "#28a745" : "#dc3545" }}>
//                     {isMasterOn ? " RUNNING" : " STOPPED"}
//                   </strong>
//                 </p>
//                 <p>
//                   Mode Sirkulasi Kolam:{" "}
//                   <span className="ac-active-mode-label">{getModeLabel()}</span>
//                 </p>
//               </div>
//             </div>
//             <div className="ac-card">
//               <h3>Real-time Flow</h3>
//               <div className="ac-flow-value">
//                 {dataMonitoring.flowRate} <small>L/min</small>
//               </div>
//               <p>
//                 Total Volume: <strong>{dataMonitoring.totalVolume} ml</strong>
//               </p>
//               <hr className="ac-divider-thin" />
//               <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
//                 Sukamandi, Subang, Jawa Barat 41263
//               </p>
//             </div>
//           </div>
//         )}

//         {/* CONTROLS PAGE */}
//         {activePage === "controls" && (
//           <div className="ac-card ac-full-width ac-fade-in">
//             <div className="ac-master-control-header">
//               <h3>Solenoid Control</h3>
//               <div className="ac-master-switch-container">
//                 <span>
//                   {isMasterOn ? "Master Switch ON" : "Master Switch OFF"}
//                 </span>
//                 <label className="ac-switch">
//                   <input
//                     type="checkbox"
//                     checked={isMasterOn}
//                     onChange={() => setIsMasterOn(!isMasterOn)}
//                   />
//                   <span className="ac-slider ac-round"></span>
//                 </label>
//               </div>
//             </div>
//             <div className={isMasterOn ? "" : "ac-disabled-overlay"}>
//               <div className="ac-mode-selector">
//                 {["C", "P", "R"].map((m) => (
//                   <button
//                     key={m}
//                     className={selectedMode === m ? "active" : ""}
//                     onClick={() => setSelectedMode(m)}
//                   >
//                     {m === "C" ? "Continue" : m === "P" ? "Partial" : "Random"}
//                   </button>
//                 ))}
//               </div>
//               <div className="ac-settings-grid">
//                 <div
//                   className={`ac-setting-box ${
//                     selectedMode === "P" ? "highlight" : ""
//                   }`}
//                 >
//                   <h4>⏱️ Mode Partial</h4>
//                   <div className="ac-input-group">
//                     <label>ON (Min)</label>
//                     <input
//                       type="number"
//                       value={partialSettings.durasi}
//                       onChange={(e) =>
//                         setPartialSettings({
//                           ...partialSettings,
//                           durasi: e.target.value,
//                         })
//                       }
//                     />
//                   </div>
//                   <div className="ac-input-group">
//                     <label>OFF (Min)</label>
//                     <input
//                       type="number"
//                       value={partialSettings.interval}
//                       onChange={(e) =>
//                         setPartialSettings({
//                           ...partialSettings,
//                           interval: e.target.value,
//                         })
//                       }
//                     />
//                   </div>
//                 </div>
//                 <div
//                   className={`ac-setting-box ${
//                     selectedMode === "R" ? "highlight" : ""
//                   }`}
//                 >
//                   <h4>📅 Mode Random</h4>
//                   <div className="ac-input-group">
//                     <label>Mulai</label>
//                     <input
//                       type="time"
//                       value={randomSettings.mulai}
//                       onChange={(e) =>
//                         setRandomSettings({
//                           ...randomSettings,
//                           mulai: e.target.value,
//                         })
//                       }
//                     />
//                   </div>
//                   <div className="ac-input-group">
//                     <label>Selesai</label>
//                     <input
//                       type="time"
//                       value={randomSettings.selesai}
//                       onChange={(e) =>
//                         setRandomSettings({
//                           ...randomSettings,
//                           selesai: e.target.value,
//                         })
//                       }
//                     />
//                   </div>
//                 </div>
//                 <div className="ac-setting-box highlight">
//                   <h4>🚀 Batas Atas (%)</h4>
//                   <input
//                     type="number"
//                     value={thresholdSettings.atas}
//                     onChange={(e) =>
//                       setThresholdSettings({
//                         ...thresholdSettings,
//                         atas: e.target.value,
//                       })
//                     }
//                   />
//                 </div>
//                 <div className="ac-setting-box highlight">
//                   <h4>💧 Batas Bawah (%)</h4>
//                   <input
//                     type="number"
//                     value={thresholdSettings.bawah}
//                     onChange={(e) =>
//                       setThresholdSettings({
//                         ...thresholdSettings,
//                         bawah: e.target.value,
//                       })
//                     }
//                   />
//                 </div>
//               </div>
//             </div>
//             <button className="ac-btn-save-settings" onClick={saveAllSettings}>
//               💾 Simpan Pengaturan
//             </button>
//           </div>
//         )}

//         {/* HISTORY PAGE */}
//         {activePage === "history" && (
//           <div className="ac-fade-in">
//             <div className="ac-dashboard-grid">
//               <div className="ac-card">
//                 <h3>📈 Laju Aliran</h3>
//                 <div style={{ width: "100%", height: "200px" }}>
//                   <ResponsiveContainer width="100%" height="100%">
//                     <LineChart data={chartData}>
//                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
//                       <XAxis dataKey="time" hide />
//                       <YAxis stroke="#888" fontSize={12} />
//                       <Tooltip />
//                       <Line
//                         type="monotone"
//                         dataKey="flow"
//                         stroke="#007bff"
//                         strokeWidth={3}
//                         dot={false}
//                         isAnimationActive={false}
//                       />
//                     </LineChart>
//                   </ResponsiveContainer>
//                 </div>
//               </div>
//               <div className="ac-card">
//                 <h3>💧 Total Volume</h3>
//                 <div style={{ width: "100%", height: "200px" }}>
//                   <ResponsiveContainer width="100%" height="100%">
//                     <AreaChart data={chartData}>
//                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
//                       <XAxis dataKey="time" hide />
//                       <YAxis stroke="#888" fontSize={12} />
//                       <Tooltip />
//                       <Area
//                         type="monotone"
//                         dataKey="total"
//                         stroke="#28a745"
//                         fill="#d4edda"
//                         isAnimationActive={false}
//                       />
//                     </AreaChart>
//                   </ResponsiveContainer>
//                 </div>
//               </div>
//             </div>
//             <div
//               className="ac-card ac-full-width"
//               style={{ marginTop: "20px" }}
//             >
//               <div className="ac-history-header">
//                 <h3>📜 Riwayat Log</h3>
//                 {selectedItems.length > 0 && (
//                   <button
//                     className="ac-btn-delete-multi"
//                     onClick={deleteSelectedHistory}
//                     style={{
//                       backgroundColor: "#dc3545",
//                       color: "white",
//                       padding: "8px 15px",
//                       borderRadius: "5px",
//                       cursor: "pointer",
//                       border: "none",
//                     }}
//                   >
//                     🗑️ Hapus ({selectedItems.length})
//                   </button>
//                 )}
//               </div>
//               <div className="ac-table-container">
//                 <table className="ac-history-table">
//                   <thead>
//                     <tr>
//                       <th style={{ width: "40px" }}>
//                         <input
//                           type="checkbox"
//                           checked={
//                             historyData.length > 0 &&
//                             selectedItems.length === historyData.length
//                           }
//                           onChange={handleSelectAll}
//                         />
//                       </th>
//                       <th>Waktu</th>
//                       <th>Mode</th>
//                       <th>Keterangan</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {historyData.length > 0 ? (
//                       historyData.map((item) => (
//                         <tr
//                           key={item.id}
//                           className={
//                             selectedItems.includes(item.id)
//                               ? "selected-row"
//                               : ""
//                           }
//                         >
//                           <td>
//                             <input
//                               type="checkbox"
//                               checked={selectedItems.includes(item.id)}
//                               onChange={() => handleSelectItem(item.id)}
//                             />
//                           </td>
//                           <td>{item.tanggal}</td>
//                           <td>
//                             <span
//                               className={`ac-badge ${
//                                 item.mode === "OFF" ? "off" : "on"
//                               }`}
//                             >
//                               {item.mode}
//                             </span>
//                           </td>
//                           <td>{item.durasi}</td>
//                         </tr>
//                       ))
//                     ) : (
//                       <tr>
//                         <td colSpan="4" style={{ textAlign: "center" }}>
//                           Belum ada log.
//                         </td>
//                       </tr>
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//         )}
//       </main>
//     </div>
//   );
// }

// export default App;

import React, { useState, useEffect, useCallback } from "react";
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
  const [notificationStatus, setNotificationStatus] = useState("checking"); // checking, granted, denied

  const VAPID_KEY =
    "BEG3uTuon198nsVSm-cy7D7b8cKGSrlhq6TbQysmsIh3e0dfsggHjOef1W3pUXvx1Fegh0SUpQCWSqWKf99bmY4";

  // Inisialisasi Notifikasi dengan error handling yang lebih baik
  const requestPermissionAndToken = useCallback(async () => {
    if (!messaging) {
      console.warn("Firebase Messaging tidak didukung di browser ini");
      setNotificationStatus("unsupported");
      return;
    }

    try {
      // Cek apakah sudah ada token tersimpan di localStorage
      const savedToken = localStorage.getItem("fcmToken");

      if (savedToken) {
        console.log("Menggunakan FCM Token tersimpan:", savedToken);
        setFcmToken(savedToken);
        setNotificationStatus("granted");
        // Pastikan token masih tersimpan di Firebase
        await set(ref(db, "tokens/admin"), savedToken);
        return savedToken;
      }

      // Cek permission saat ini
      if (Notification.permission === "granted") {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          console.log("FCM Token baru:", currentToken);
          // Simpan token ke localStorage
          localStorage.setItem("fcmToken", currentToken);
          setFcmToken(currentToken);
          await set(ref(db, "tokens/admin"), currentToken);
          setNotificationStatus("granted");
          return currentToken;
        }
      }

      // Request permission jika belum
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          console.log("FCM Token baru setelah request:", currentToken);
          // Simpan token ke localStorage
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

  // Ubah useEffect untuk inisialisasi - tambahkan pengecekan permission awal
  useEffect(() => {
    // Cek permission dan token yang tersimpan saat mount
    const checkNotificationStatus = async () => {
      const savedToken = localStorage.getItem("fcmToken");

      if (Notification.permission === "granted" && savedToken) {
        setNotificationStatus("granted");
        setFcmToken(savedToken);
        console.log("Status notifikasi: Aktif dengan token tersimpan");
      } else if (Notification.permission === "denied") {
        setNotificationStatus("denied");
      } else {
        setNotificationStatus("checking");
      }
    };

    checkNotificationStatus();

    // Inisialisasi notifikasi hanya jika belum ada token
    const savedToken = localStorage.getItem("fcmToken");
    if (!savedToken) {
      requestPermissionAndToken();
    }

    // Listen untuk foreground messages
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("Pesan foreground:", payload);

        if (Notification.permission === "granted") {
          new Notification(payload.notification?.title || "AquaControl", {
            body: payload.notification?.body || "Notifikasi baru",
            icon: payload.notification?.icon || "/logo192.png",
            badge: "/logo192.png",
          });
        }
      });

      return () => unsubscribe();
    }
  }, [requestPermissionAndToken]);

  // Setup listeners
  useEffect(() => {
    // Inisialisasi notifikasi
    requestPermissionAndToken();

    // Listen untuk foreground messages
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("Pesan foreground:", payload);

        // Tampilkan notifikasi manual untuk foreground
        if (Notification.permission === "granted") {
          new Notification(payload.notification?.title || "AquaControl", {
            body: payload.notification?.body || "Notifikasi baru",
            icon: payload.notification?.icon || "/logo192.png",
            badge: "/logo192.png",
          });
        }
      });

      return () => unsubscribe();
    }
  }, [requestPermissionAndToken]);

  // Ambil Data Monitoring
  useEffect(() => {
    const monitoringRef = ref(db, "monitoring");
    const unsubscribe = onValue(
      monitoringRef,
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          setDataMonitoring({
            ketinggian: val.tandon?.ketinggian_cm || 0,
            statusIsi: val.tandon?.status_isi || "Standby",
            flowRate: val.kolam?.laju_aliran_mls || 0,
            totalVolume: val.kolam?.total_aliran_ml || 0,
          });

          // Update chart data
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
            ].slice(-20); // Keep last 20 data points
            return newData;
          });
        }
      },
      (error) => {
        console.error("Error membaca data monitoring:", error);
      }
    );

    return () => unsubscribe();
  }, []);

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
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) // Sort by timestamp
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

    // Validasi
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
      // Simpan pengaturan tandon
      await set(ref(db, "pengaturan/tandon"), {
        threshold_atas: vAtas,
        threshold_bawah: vBawah,
        max_safety_limit: 140,
      });

      // Simpan kontrol solenoid
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

      // Buat log riwayat
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
    // Cek service worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        console.log("SW Registration:", registration);
        if (!registration) {
          console.error("Service Worker belum terdaftar!");
        }
      });
    }

    // Cek notification permission
    console.log("Notification permission:", Notification.permission);
  }, []);

  const getModeLabel = () => {
    if (!isMasterOn) return "OFF";
    if (selectedMode === "C") return "CONTINUE";
    if (selectedMode === "P") return "PARTIAL";
    if (selectedMode === "R") return "RANDOM";
    return "UNKNOWN";
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

      {/* Sidebar Navigation */}
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
              {fcmToken ? "🔔" : "🔕"}
            </button>
            <span className="ac-status-online">● Online</span>
          </div>
        </header>

        {/* DASHBOARD PAGE */}
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

        {/* CONTROLS PAGE */}
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

        {/* HISTORY PAGE */}
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

export default App;
