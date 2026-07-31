import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Bell, Send, Trash2, Users, UserCheck, Clock, CheckCircle, 
  AlertCircle, AlertTriangle, ChevronRight, MessageSquare, ShieldAlert
} from "lucide-react";
import { User, AdminNotification, UserRole } from "../types";
import { LocalDB, isDefaultAdminUtama } from "../data";
import { triggerToast } from "../App";

interface AdminNotificationsManageViewProps {
  users: User[];
  currentUser: User;
}

export default function AdminNotificationsManageView({
  users,
  currentUser
}: AdminNotificationsManageViewProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  
  // Form State
  const [targetRole, setTargetRole] = useState<"all" | "user" | "pengelola" | "specific">("all");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "success" | "warning" | "alert">("info");

  const loadNotifications = () => {
    setNotifications(LocalDB.getNotifications());
  };

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener("sipp_notif_updated", handleUpdate);
    return () => window.removeEventListener("sipp_notif_updated", handleUpdate);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      triggerToast("Judul dan isi pesan notifikasi wajib diisi!", "error");
      return;
    }
    if (targetRole === "specific" && !targetUserId) {
      triggerToast("Silakan pilih akun penerima spesifik terlebih dahulu!", "error");
      return;
    }

    const newNotif: AdminNotification = {
      id: "notif_" + Date.now(),
      senderId: currentUser.id,
      senderName: `${currentUser.name} (Admin Explore Pacitan)`,
      targetRole: targetRole,
      targetUserId: targetRole === "specific" ? targetUserId : undefined,
      title: title.trim(),
      message: message.trim(),
      type: type,
      createdAt: new Date().toISOString(),
      readBy: []
    };

    LocalDB.addNotification(newNotif);
    triggerToast("Notifikasi berhasil dikirimkan ke penerima target!", "success");

    // Reset Form
    setTitle("");
    setMessage("");
    setTargetRole("all");
    setTargetUserId("");
    setType("info");
  };

  const handleDelete = (notifId: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus riwayat notifikasi ini? Pesan akan hilang dari dashboard penerima.")) {
      LocalDB.deleteNotification(notifId);
      triggerToast("Notifikasi berhasil dihapus", "success");
    }
  };

  const getTargetLabel = (notif: AdminNotification) => {
    if (notif.targetRole === "all") return "Semua Pengguna & Pengelola";
    if (notif.targetRole === "user") return "Khusus Wisatawan / User";
    if (notif.targetRole === "pengelola") return "Khusus Mitra Pengelola";
    if (notif.targetRole === "specific" && notif.targetUserId) {
      const target = users.find(u => u.id === notif.targetUserId);
      return `Spesifik: ${target ? target.name : notif.targetUserId}`;
    }
    return "Umum";
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium font-mono">
        <Link to="/admin" className="hover:text-teal-700">SLA Dashboard</Link>
        <ChevronRight size={12} />
        <span className="text-slate-600">Pusat Siaran Notifikasi</span>
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-teal-400 font-mono text-[10px] uppercase font-bold tracking-widest block">ADMIN EXPLORE PACITAN CONSOLE</span>
          <h2 className="font-display font-black text-white text-2xl sm:text-3xl mt-1 flex items-center gap-2">
            📢 Pusat Siaran Notifikasi & Pesan
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl font-sans">
            Kirimkan pemberitahuan sistem, pengumuman pembaruan direktori wisata, atau pesan khusus langsung ke dashboard pengguna dan mitra pengelola tertentu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form (5 Columns) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
              <Send size={16} className="text-teal-600" /> Buat Siaran Baru
            </h3>
            <span className="text-[10px] font-mono bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded font-bold">
              Real-time Sync
            </span>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {/* Target Role Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                🎯 Target Penerima Pesan *
              </label>
              <select
                value={targetRole}
                onChange={(e) => {
                  setTargetRole(e.target.value as any);
                  if (e.target.value !== "specific") setTargetUserId("");
                }}
                className="w-full text-xs sm:text-sm px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 font-medium text-slate-800 dark:text-slate-100"
              >
                <option value="all">🌐 Semua Pengguna & Pengelola Wisata</option>
                <option value="user">🎒 Khusus Wisatawan / User Biasa</option>
                <option value="pengelola">🏷️ Khusus Mitra Pengelola Tempat</option>
                <option value="specific">👤 Spesifik ke 1 Akun Tertentu</option>
              </select>
            </div>

            {/* Specific User Dropdown (Conditional) */}
            {targetRole === "specific" && (
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  Pilih Akun Spesifik *
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg focus:outline-none focus:border-amber-500 font-medium text-slate-800 dark:text-slate-100"
                  required={targetRole === "specific"}
                >
                  <option value="">-- Pilih Nama atau Email Pengguna --</option>
                  {users.map((u, idx) => (
                    <option key={`${u.id}_${idx}`} value={u.id}>
                      {u.name} ({u.role === 'admin' ? (isDefaultAdminUtama(u.email, u.name, u.id) ? "ADMIN UTAMA" : "ADMIN SEKUNDER") : u.role.toUpperCase()}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notification Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                ⚡ Tipe & Prioritas Notifikasi *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "info", label: "ℹ️ Informasi Umum", bg: "bg-sky-50 text-sky-800 border-sky-200" },
                  { id: "success", label: "✅ Kabar Sukses", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                  { id: "warning", label: "⚠️ Peringatan SLA", bg: "bg-amber-50 text-amber-800 border-amber-200" },
                  { id: "alert", label: "🚨 Aturan Penting", bg: "bg-rose-50 text-rose-800 border-rose-200" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as any)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border text-left transition cursor-pointer ${
                      type === item.id 
                        ? `${item.bg} ring-2 ring-teal-500/30 shadow-xs` 
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                📌 Judul Notifikasi *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Misal: Verifikasi Tempat Anda Telah Diterbitkan!"
                className="w-full text-xs sm:text-sm px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 font-medium text-slate-800 dark:text-slate-100"
                required
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                💬 Isi Pesan Lengkap *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Tuliskan pesan instruksi, apresiasi kontribusi, atau pemberitahuan regulasi operasional wisata..."
                className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 font-sans text-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Send size={16} /> Kirim & Terbitkan Notifikasi
            </button>
          </form>
        </div>

        {/* Right Notification History (7 Columns) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <Bell size={16} className="text-teal-600" /> Riwayat Siaran Terkirim
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">Daftar semua notifikasi sistem yang tayang di dashboard pengguna.</p>
            </div>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full font-mono font-bold">
              Total: {notifications.length} Pesan
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="text-center py-16 text-slate-400 italic text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Belum ada riwayat notifikasi yang dikirim oleh administrator.
              </div>
            ) : (
              notifications.map((notif) => {
                const isAlert = notif.type === "alert" || notif.type === "warning";
                return (
                  <div 
                    key={notif.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 transition space-y-2 relative group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                          notif.type === "success" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          notif.type === "warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                          notif.type === "alert" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                          "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                        }`}>
                          {notif.type}
                        </span>
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md font-mono">
                          🎯 {getTargetLabel(notif)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(notif.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title="Hapus Notifikasi Ini"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                      {notif.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800 font-mono">
                      <span>Kirim: {new Date(notif.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold">
                        <UserCheck size={12} /> Dibaca oleh {notif.readBy.length} orang
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
