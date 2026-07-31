import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { 
  Map, 
  List, 
  Compass, 
  Info, 
  User as UserIcon, 
  LayoutDashboard, 
  Database, 
  CheckSquare, 
  History, 
  ClipboardList, 
  Menu, 
  X, 
  Users, 
  MessageSquare, 
  Sun, 
  Moon, 
  Briefcase, 
  ChevronDown, 
  LogIn, 
  LogOut,
  Settings,
  Globe,
  Calendar,
  Edit3,
  Check,
  Upload,
  UserPlus,
  Bell,
  CheckCheck,
  Minimize2,
  Mail,
  Eye,
  EyeOff,
  Bot,
  Sparkles
} from "lucide-react";
import { User, UserRole, AdminNotification } from "../types";
import { MOCK_USERS, LocalDB, enforceDefaultAccount, isDefaultAdminUtama } from "../data";
import { AiConfigModal } from "./AiConfigModal";
import { handleRequestEmailChange } from "../lib/authEmailManager";

// Translation dictionary for Bahasa Indonesia (ID) and English (EN)
const t = {
  id: {
    destinations: "Peta Destinasi",
    placesList: "Daftar Tempat",
    tourPackages: "Paket Wisata",
    userServices: "Layanan Pengguna",
    myDashboard: "Dashboard Saya",
    itineraryTrip: "Itinerari Trip",
    proposePlace: "Usulkan Tempat",
    adminPanel: "Panel Admin",
    slaAdmin: "SLA Admin",
    reviewQueue: "Antrean Usulan",
    managePlaces: "Kelola Tempat",
    manageUsers: "Kelola Pengelola",
    notifBroadcast: "Siaran Pesan",
    auditLog: "Audit Log",
    gallery: "Galeri",
    about: "Tentang Explore Pacitan",
    simulationRole: "Simulasi Peran Kontributor:",
    simulLabel: "Simulasi:",
    verifiedUser: "Akun Google",
    simulationUser: "Akun Simulasi",
    settings: "Pengaturan Akun",
    signOut: "Keluar Akun Google",
    signIn: "Masuk Google",
    changeProfile: "Profil & Pengaturan",
    profileSettings: "Pengaturan Profil & Akun",
    subSettings: "Sesuaikan preferensi akun Explore Pacitan Anda di bawah ini.",
    displayLang: "Bahasa Tampilan",
    changeUsername: "Ubah Username",
    usernameHelp: "Sesuai ketentuan, username hanya dapat diubah sekali dalam 30 hari.",
    usernameAllowed: "Username dapat diubah sekarang",
    usernameRestricted: "Dapat diubah kembali dalam",
    saveChanges: "Simpan Perubahan",
    cancel: "Batal",
    avatarChoice: "Pilih Avatar Khas Pacitan",
    customAvatar: "Atau gunakan URL Foto Kustom",
    avatarPreview: "Pratinjau Foto Profil",
    resetSimulation: "Reset Timer (Test)",
    resetTimerSuccess: "Waktu pembatasan username berhasil di-reset untuk pengujian!",
    langChanged: "Bahasa berhasil diubah!",
    profileSaved: "Profil berhasil diperbarui!",
    emailAddress: "Alamat Email",
    emailPlaceholder: "Masukkan alamat email Anda...",
    emailHelp: "Email digunakan untuk korespondensi dan pemulihan akun."
  },
  en: {
    destinations: "Destination Map",
    placesList: "Places List",
    tourPackages: "Tour Packages",
    userServices: "User Services",
    myDashboard: "My Dashboard",
    itineraryTrip: "Itinerary Trip",
    proposePlace: "Propose Place",
    adminPanel: "Admin Panel",
    slaAdmin: "SLA Dashboard",
    reviewQueue: "Review Queue",
    managePlaces: "Manage Places",
    manageUsers: "Manage Managers",
    notifBroadcast: "Broadcast Notifs",
    auditLog: "Audit Logs",
    gallery: "Gallery",
    about: "About Explore Pacitan",
    simulationRole: "Simulate Contributor:",
    simulLabel: "Simulation:",
    verifiedUser: "Google Account",
    simulationUser: "Simulated Account",
    settings: "Account Settings",
    signOut: "Sign Out Google",
    signIn: "Sign In Google",
    changeProfile: "Profile & Settings",
    profileSettings: "Profile & Account Settings",
    subSettings: "Customize your Explore Pacitan account preferences below.",
    displayLang: "Display Language",
    changeUsername: "Change Username",
    usernameHelp: "Under terms, username can only be changed once every 30 days.",
    usernameAllowed: "Username can be updated now",
    usernameRestricted: "Can be changed again in",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    avatarChoice: "Choose Pacitan Special Avatar",
    customAvatar: "Or use custom Photo URL",
    avatarPreview: "Profile Photo Preview",
    resetSimulation: "Reset Timer (Test)",
    resetTimerSuccess: "Username restriction timer successfully reset for testing!",
    langChanged: "Language changed!",
    profileSaved: "Profile updated successfully!",
    emailAddress: "Email Address",
    emailPlaceholder: "Enter your email address...",
    emailHelp: "Email is used for correspondence and account recovery."
  }
};

const AVATAR_PRESETS = [
  { name: "Petualang Pacitan", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Aditya" },
  { name: "Pecinta Pantai", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=PacitanBeach" },
  { name: "Penjelajah Gua", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=CaveExplorer" },
  { name: "Admin Explore Pacitan", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=ExploreAdmin" },
  { name: "Mitra Pengelola", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Pengelola" },
  { name: "Backpacker Pacitan", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Backpacker" }
];

interface NavigationBarProps {
  currentUser: User;
  onRoleChange: (newUser: User) => void;
  pendingSubmissionsCount: number;
  isDark: boolean;
  onToggleDark: () => void;
  realGoogleUser: User | null;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onRegisterUser?: (name: string, email: string, password?: string) => boolean;
  onLoginUser?: (email: string, password?: string) => boolean;
  usersList?: User[];
}

export default function NavigationBar({
  currentUser,
  onRoleChange,
  pendingSubmissionsCount,
  isDark,
  onToggleDark,
  realGoogleUser,
  onGoogleLogin,
  onGoogleLogout,
  onRegisterUser,
  onLoginUser,
  usersList = MOCK_USERS
}: NavigationBarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const routerLocation = useLocation();

  const lang = currentUser.language === "en" ? "en" : "id";

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>(() => LocalDB.getNotifications());

  React.useEffect(() => {
    const updateNotifs = () => {
      setNotifications(LocalDB.getNotifications());
    };
    updateNotifs();
    const interval = setInterval(updateNotifs, 3000);
    window.addEventListener("sipp_notif_updated", updateNotifs);
    return () => {
      clearInterval(interval);
      window.removeEventListener("sipp_notif_updated", updateNotifs);
    };
  }, []);

  // Auto-minimize popups on route change
  React.useEffect(() => {
    setShowNotifDropdown(false);
    setShowProfileDropdown(false);
    setIsMobileMenuOpen(false);
  }, [routerLocation.pathname]);

  // Auto-minimize popups on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNotifDropdown(false);
        setShowProfileDropdown(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [notifTab, setNotifTab] = useState<"all" | "unread" | "read">("all");

  const relevantNotifs = notifications.filter(n => {
    if (n.targetRole === "all") return true;
    if (n.targetRole === "user" && currentUser.role === "user") return true;
    if (n.targetRole === "pengelola" && (currentUser.role === "pengelola" || currentUser.role === "admin")) return true;
    if (n.targetRole === "admin" && currentUser.role === "admin") return true;
    if (n.targetUserId && n.targetUserId === currentUser.id) return true;
    return false;
  });

  const unreadNotifs = relevantNotifs.filter(n => !n.readBy || !n.readBy.includes(currentUser.id));
  const readNotifs = relevantNotifs.filter(n => n.readBy && n.readBy.includes(currentUser.id));

  const displayedNotifs = notifTab === "unread" ? unreadNotifs : notifTab === "read" ? readNotifs : relevantNotifs;

  // Form states for Login & Register Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);

  // Form states for settings
  const [tempUsername, setTempUsername] = useState(currentUser.name);
  const [tempAvatar, setTempAvatar] = useState(currentUser.avatarUrl || "");
  const [tempLang, setTempLang] = useState<"id" | "en">(currentUser.language || "id");
  const [tempEmail, setTempEmail] = useState(currentUser.email || "");

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword || loginPassword.length < 6) {
      triggerToast("Kata sandi minimal 6 karakter!", "error");
      return;
    }
    if (onLoginUser) {
      const ok = onLoginUser(loginEmail, loginPassword);
      if (ok) {
        setShowAuthModal(false);
        setLoginEmail("");
        setLoginPassword("");
      }
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerPassword || registerPassword.length < 6) {
      triggerToast("Kata sandi minimal 6 karakter!", "error");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      triggerToast("Verifikasi kata sandi gagal! Konfirmasi kata sandi tidak cocok dengan kata sandi yang Anda buat.", "error");
      return;
    }
    if (onRegisterUser) {
      const ok = onRegisterUser(registerName, registerEmail, registerPassword);
      if (ok) {
        setShowAuthModal(false);
        setRegisterName("");
        setRegisterEmail("");
        setRegisterPassword("");
        setRegisterConfirmPassword("");
      }
    }
  };

  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    window.dispatchEvent(new CustomEvent("show-toast", { detail: { message, type } }));
  };

  const handleOpenSettings = () => {
    setTempUsername(currentUser.name);
    setTempAvatar(currentUser.avatarUrl || "");
    setTempLang(currentUser.language || "id");
    setTempEmail(currentUser.email || "");
    setShowSettingsModal(true);
    setShowProfileDropdown(false);
  };

  const canChangeUsername = (lastChangeDate?: string) => {
    if (!lastChangeDate) return { can: true, daysLeft: 0 };
    const lastChange = new Date(lastChangeDate).getTime();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const nextAllowedTime = lastChange + thirtyDaysInMs;
    const currentTime = new Date().getTime();
    if (currentTime >= nextAllowedTime) {
      return { can: true, daysLeft: 0 };
    } else {
      const msDiff = nextAllowedTime - currentTime;
      const daysLeft = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      return { can: false, daysLeft };
    }
  };

  const handleSaveSettings = () => {
    const cleanUsername = tempUsername.trim();
    const cleanAvatar = tempAvatar.trim();
    const cleanEmail = tempEmail.trim().toLowerCase();

    if (!cleanUsername) {
      triggerToast(
        tempLang === "en" ? "Username cannot be empty!" : "Username tidak boleh kosong!",
        "error"
      );
      return;
    }

    if (cleanEmail && (!cleanEmail.includes("@") || !cleanEmail.includes("."))) {
      triggerToast(
        tempLang === "en" ? "Please enter a valid email address!" : "Silakan masukkan alamat email yang valid!",
        "error"
      );
      return;
    }

    if (cleanAvatar && !cleanAvatar.startsWith("http://") && !cleanAvatar.startsWith("https://") && !cleanAvatar.startsWith("data:image/")) {
      triggerToast(
        tempLang === "en" 
          ? "Avatar URL must start with http://, https:// or be a valid uploaded image" 
          : "URL Avatar harus diawali dengan http://, https:// atau gambar unggahan lokal",
        "error"
      );
      return;
    }

    const usernameChanged = cleanUsername !== currentUser.name;
    
    if (usernameChanged) {
      const restriction = canChangeUsername(currentUser.lastUsernameChange);
      if (!restriction.can) {
        triggerToast(
          currentUser.language === "en"
            ? `Username can only be changed once every 30 days! Please wait ${restriction.daysLeft} more days.`
            : `Username hanya dapat diubah sekali setiap 30 hari! Harap tunggu ${restriction.daysLeft} hari lagi.`,
          "error"
        );
        return;
      }
    }

    const finalAvatar = cleanAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(cleanUsername)}`;

    const updatedUser: User = enforceDefaultAccount({
      ...currentUser,
      name: cleanUsername,
      email: cleanEmail,
      avatarUrl: finalAvatar,
      language: tempLang,
      lastUsernameChange: usernameChanged 
        ? new Date().toISOString() 
        : currentUser.lastUsernameChange
    });

    onRoleChange(updatedUser);
    
    if (tempLang !== currentUser.language) {
      triggerToast(t[tempLang].langChanged, "success");
    } else {
      triggerToast(t[tempLang].profileSaved, "success");
    }
    
    setShowSettingsModal(false);
  };

  const handleResetTimer = () => {
    const updatedUser: User = enforceDefaultAccount({
      ...currentUser,
      lastUsernameChange: undefined
    });
    onRoleChange(updatedUser);
    triggerToast(t[lang].resetTimerSuccess, "success");
  };

  const handleRoleSwitch = (user: User) => {
    onRoleChange(user);
    setIsMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    return routerLocation.pathname === path;
  };

  const isPathPrefix = (prefix: string) => {
    return routerLocation.pathname.startsWith(prefix);
  };

  return (
    <nav className="bg-slate-900/95 backdrop-blur-md text-white shadow-lg sticky top-0 z-[1050] border-b border-teal-900/60">
      <div className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 relative items-center gap-2">
          {/* Left: Brand and Logo */}
          <div className="flex items-center flex-shrink-0 z-50">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group flex-shrink-0">
              <span className="text-xl sm:text-2xl transition-transform group-hover:scale-110">🌊</span>
              <div>
                <span className="font-display font-black text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg tracking-tight text-white block">
                  EXPLORE PACITAN
                </span>
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wider block text-teal-400 font-mono -mt-1 font-bold">
                  explorepacitan.com
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex flex-1 justify-center items-center px-1 xl:px-2 z-50">
            <div className="flex h-10 items-center bg-slate-950/45 p-1 rounded-xl border border-slate-800/80 lg:gap-[1px] xl:gap-[3px] 2xl:gap-1.5 lg:text-[10px] xl:text-[11.5px] 2xl:text-[14px] font-display font-bold">
              <Link
                to="/"
                className={`lg:px-1 xl:px-1.5 2xl:px-3 h-8 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
                  isActive("/") 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Map size={15} className="hidden 2xl:block shrink-0" />
                <span>{t[lang].destinations}</span>
              </Link>

              <Link
                to="/locations"
                className={`lg:px-1 xl:px-1.5 2xl:px-3 h-8 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
                  isActive("/locations") 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <List size={15} className="hidden 2xl:block shrink-0" />
                <span>{t[lang].placesList}</span>
              </Link>

              {/* Portal Wisatawan Dropdown (For User, Pengelola, or Admin) */}
              {(currentUser.role === "user" || currentUser.role === "pengelola" || currentUser.role === "admin") && (
                <div className="relative group">
                  <button 
                    className={`lg:px-1 xl:px-1.5 2xl:px-3 h-8 rounded-lg flex items-center gap-1 transition-all text-slate-300 hover:text-white hover:bg-slate-800/50 cursor-pointer font-bold whitespace-nowrap ${
                      isActive("/itinerary") || isActive("/dashboard") || isPathPrefix("/dashboard/submit")
                        ? "bg-teal-600 text-white shadow-sm font-bold"
                        : ""
                    }`}
                  >
                    <Compass size={15} className="hidden 2xl:block shrink-0" />
                    <span>{t[lang].userServices}</span>
                    <ChevronDown size={11} className="transition-transform duration-200 group-hover:rotate-180 shrink-0" />
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-48 bg-slate-800/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[1100]">
                    <Link
                      to="/dashboard"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/dashboard") ? "bg-teal-800/60 text-white font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <LayoutDashboard size={14} />
                      {t[lang].myDashboard}
                    </Link>
                    <Link
                      to="/itinerary"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/itinerary") ? "bg-teal-800/60 text-white font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <Compass size={14} />
                      {t[lang].itineraryTrip}
                    </Link>
                    <Link
                      to="/packages"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/packages") ? "bg-teal-800/60 text-white font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <Briefcase size={14} />
                      {t[lang].tourPackages}
                    </Link>
                    {currentUser.role === "pengelola" && (
                      <Link
                        to="/dashboard/submit"
                        className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                          isPathPrefix("/dashboard/submit") ? "bg-teal-800/60 text-white font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        <ClipboardList size={14} />
                        {t[lang].proposePlace}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Panel Admin Dropdown (For Admin) */}
              {currentUser.role === "admin" && (
                <div className="relative group">
                  <button 
                    className={`lg:px-1 xl:px-1.5 2xl:px-3 h-8 rounded-lg flex items-center gap-1 transition-all text-slate-300 hover:text-white hover:bg-slate-800/50 cursor-pointer font-bold relative whitespace-nowrap ${
                      isActive("/admin") || isActive("/admin/queue") || isActive("/admin/locations") || isActive("/admin/logs")
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                        : ""
                    }`}
                  >
                    <LayoutDashboard size={15} className="hidden 2xl:block shrink-0" />
                    <span>{t[lang].adminPanel}</span>
                    {pendingSubmissionsCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center font-bold font-sans animate-bounce shrink-0">
                        {pendingSubmissionsCount}
                      </span>
                    )}
                    <ChevronDown size={11} className="transition-transform duration-200 group-hover:rotate-180 shrink-0" />
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-48 bg-slate-800/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[1100]">
                    <Link
                      to="/admin"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/admin") ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <LayoutDashboard size={14} />
                      {t[lang].slaAdmin}
                    </Link>
                    <Link
                      to="/admin/queue"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors justify-between ${
                        isActive("/admin/queue") ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CheckSquare size={14} />
                        {t[lang].reviewQueue}
                      </span>
                      {pendingSubmissionsCount > 0 && (
                        <span className="bg-red-600 text-white rounded-full text-[9px] px-1.5 py-0.5 font-bold font-sans">
                          {pendingSubmissionsCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/admin/locations"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/admin/locations") ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <Database size={14} />
                      {t[lang].managePlaces}
                    </Link>
                    <Link
                      to="/admin/users"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/admin/users") ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <Users size={14} />
                      {t[lang].manageUsers}
                    </Link>
                    <Link
                      to="/admin/notifications"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/admin/notifications") ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <Bell size={14} />
                      {t[lang].notifBroadcast}
                    </Link>
                    <Link
                      to="/admin/logs"
                      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        isActive("/admin/logs") ? "bg-amber-500/20 text-amber-300 font-bold" : "text-slate-200 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <History size={14} />
                      {t[lang].auditLog}
                    </Link>
                  </div>
                </div>
              )}

              <Link
                to="/gallery"
                className={`lg:px-1 xl:px-1.5 2xl:px-3 h-8 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
                  isActive("/gallery") 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <span>{t[lang].gallery}</span>
              </Link>

              <Link
                to="/about"
                className={`lg:px-1 xl:px-1.5 2xl:px-3 h-8 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
                  isActive("/about") 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <span>{t[lang].about.replace(" Explore Pacitan", "")}</span>
              </Link>
            </div>
          </div>

          {/* Right side: Theme Toggle and User Info */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Notification Bell Button & Badge */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!showNotifDropdown) {
                    setShowProfileDropdown(false);
                  }
                  setShowNotifDropdown(!showNotifDropdown);
                }}
                className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer border border-slate-800 relative shadow-sm bg-slate-950/20"
                title="Pesan & Notifikasi"
              >
                <Bell size={17} />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-[1990]"
                    onClick={() => setShowNotifDropdown(false)}
                  />
                  <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-14 sm:-right-2 sm:left-auto sm:w-96 sm:max-w-none bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-[2000] text-slate-800 dark:text-slate-100 max-h-[calc(100dvh-5rem)] sm:max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <Bell size={16} className="text-teal-600 dark:text-teal-400" />
                        <h4 className="font-display font-bold text-sm">Pesan Notifikasi</h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {unreadNotifs.length > 0 && (
                          <button
                            onClick={() => LocalDB.markAllNotificationsRead(currentUser.id)}
                            className="text-[11px] text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            <CheckCheck size={13} /> <span className="hidden xs:inline">Tandai Dibaca</span>
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotifDropdown(false)}
                          className="p-1 px-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          title="Minimize / Tutup Popup"
                        >
                          <Minimize2 size={13} />
                          <span>Minimize</span>
                        </button>
                      </div>
                    </div>

                    {/* Notification Filter Tabs */}
                    <div className="flex items-center gap-1.5 mb-3 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
                      <button
                        onClick={() => setNotifTab("all")}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition cursor-pointer text-center ${
                          notifTab === "all"
                            ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        Semua ({relevantNotifs.length})
                      </button>
                      <button
                        onClick={() => setNotifTab("unread")}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition cursor-pointer text-center ${
                          notifTab === "unread"
                            ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        Belum Dibaca ({unreadNotifs.length})
                      </button>
                      <button
                        onClick={() => setNotifTab("read")}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition cursor-pointer text-center ${
                          notifTab === "read"
                            ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        Sudah Dibaca ({readNotifs.length})
                      </button>
                    </div>

                    {displayedNotifs.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        {notifTab === "unread"
                          ? "✨ Tidak ada pesan belum dibaca."
                          : notifTab === "read"
                          ? "Belum ada riwayat pesan yang telah dibaca."
                          : "Belum ada pesan notifikasi untuk akun Anda."}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {displayedNotifs.map((notif) => {
                          const isRead = notif.readBy && notif.readBy.includes(currentUser.id);
                          return (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (!isRead) {
                                  LocalDB.markNotificationRead(notif.id, currentUser.id);
                                }
                              }}
                              className={`p-3 rounded-xl border transition-all text-left cursor-pointer relative ${
                                !isRead
                                  ? "bg-teal-50/80 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700/80 shadow-xs"
                                  : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {!isRead ? (
                                    <span className="inline-flex items-center gap-1 bg-rose-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                      Baru
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[9px] px-1.5 py-0.5 rounded-md">
                                      ✓ Sudah Dibaca
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 shrink-0">
                                    {notif.type}
                                  </span>
                                </div>
                                {!isRead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      LocalDB.markNotificationRead(notif.id, currentUser.id);
                                    }}
                                    className="text-[10px] text-teal-700 dark:text-teal-300 font-bold hover:underline shrink-0"
                                  >
                                    Tandai Dibaca
                                  </button>
                                )}
                              </div>

                              <h5 className={`text-xs mt-1 ${!isRead ? "font-extrabold text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-300"}`}>
                                {notif.title}
                              </h5>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
                                {notif.message}
                              </p>
                              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>Dari: {notif.senderName}</span>
                                <span>{new Date(notif.createdAt).toLocaleDateString("id-ID")}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Popup Footer with Minimize action */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      {currentUser.role === "admin" ? (
                        <Link
                          to="/admin/notifications"
                          onClick={() => setShowNotifDropdown(false)}
                          className="text-teal-600 dark:text-teal-400 hover:underline font-bold text-[11px]"
                        >
                          Kelola Semua Pesan →
                        </Link>
                      ) : (
                        <span className="text-[10px] text-slate-400">Total {relevantNotifs.length} Pesan</span>
                      )}
                      <button
                        onClick={() => setShowNotifDropdown(false)}
                        className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                      >
                        <Minimize2 size={12} /> Tutup
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Global Theme Toggle */}
            <button
              onClick={onToggleDark}
              className="hidden lg:flex h-10 w-10 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer border border-slate-800 shadow-sm bg-slate-950/20"
              title={isDark ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
            </button>

            {/* Interactive User Profile Dropdown */}
            <div className="hidden lg:block relative border-l border-slate-800 pl-2 sm:pl-3">
              <button
                onClick={() => {
                  if (!showProfileDropdown) {
                    setShowNotifDropdown(false);
                  }
                  setShowProfileDropdown(!showProfileDropdown);
                }}
                className="flex items-center gap-2 cursor-pointer text-left hover:opacity-90 group transition-all"
                title={t[lang].changeProfile}
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover aspect-square shrink-0 bg-slate-800 border border-slate-700 p-0.5 group-hover:border-teal-500 transition-colors"
                />
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-bold font-display max-w-[110px] truncate text-slate-200 flex items-center gap-1">
                    <span>{currentUser.name}</span>
                    <ChevronDown size={12} className={`text-slate-400 group-hover:text-white transition-transform duration-200 ${showProfileDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`inline-block px-1 rounded text-[8px] font-bold tracking-wider uppercase font-mono ${
                      currentUser.role === 'admin'
                        ? (isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) ? 'bg-red-500 text-white' : 'bg-orange-500 text-white')
                        : currentUser.role === 'pengelola'
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-teal-500 text-white'
                    }`}>
                      {currentUser.role === 'admin' 
                        ? (isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) ? "ADMIN UTAMA" : "ADMIN SEKUNDER")
                        : currentUser.role === 'pengelola' ? "PENGELOLA" : "WISATAWAN"}
                    </span>
                    {realGoogleUser && currentUser.id === realGoogleUser.id ? (
                      <span className="text-[8px] font-mono text-teal-400 bg-teal-950/50 px-1 rounded border border-teal-800/30">Google</span>
                    ) : (
                      <span className="text-[8px] font-mono text-slate-400 bg-slate-800 px-1 rounded border border-slate-700/50">Mock</span>
                    )}
                  </div>
                </div>
              </button>

              {showProfileDropdown && (
                <>
                  {/* Overlay to close on outside click */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowProfileDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2.5 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-200">
                    {/* User Summary Info block */}
                    <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
                      <img 
                        src={currentUser.avatarUrl} 
                        alt={currentUser.name} 
                        className="w-10 h-10 rounded-full object-cover aspect-square shrink-0 bg-slate-800 border border-slate-700 p-0.5"
                      />
                      <div className="truncate flex-1">
                        <div className="font-bold text-sm text-white truncate">{currentUser.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{currentUser.email || "Email tidak tersedia"}</div>
                        <div className="flex gap-1.5 items-center mt-1">
                          <span className={`text-[8px] font-black uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
                            currentUser.role === 'admin' 
                              ? (isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30') :
                            currentUser.role === 'pengelola' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                          }`}>
                            {currentUser.role === 'admin' 
                              ? (isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) ? 'ADMIN UTAMA' : 'ADMIN SEKUNDER')
                              : currentUser.role === 'pengelola' ? 'PENGELOLA' : 'WISATAWAN'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="p-1">
                      <button
                        onClick={handleOpenSettings}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                      >
                        <Settings size={14} className="text-teal-400" />
                        <span className="font-medium">{t[lang].settings}</span>
                      </button>

                      <div className="h-px bg-slate-800 my-1 mx-2" />

                      {currentUser.id === "guest_empty" ? (
                        <button
                          onClick={() => {
                            setAuthTab("login");
                            setShowAuthModal(true);
                            setShowProfileDropdown(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-teal-400 hover:text-teal-300 hover:bg-teal-950/30 rounded-lg cursor-pointer transition-colors font-bold"
                        >
                          <LogIn size={14} />
                          <span>Masuk / Daftar Akun</span>
                        </button>
                      ) : realGoogleUser ? (
                        <button
                          onClick={() => {
                            onGoogleLogout();
                            setShowProfileDropdown(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg cursor-pointer transition-colors font-bold"
                        >
                          <LogOut size={14} />
                          <span>{t[lang].signOut}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onGoogleLogout();
                            setShowProfileDropdown(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 rounded-lg cursor-pointer transition-colors font-bold"
                        >
                          <LogOut size={14} />
                          <span>Keluar ke Mode Tamu</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-slate-900 px-2 pt-2 pb-4 space-y-1 max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              isActive("/") ? "bg-teal-800 text-white" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t[lang].destinations}
          </Link>

          <Link
            to="/locations"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              isActive("/locations") ? "bg-teal-800 text-white" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t[lang].placesList}
          </Link>

          <Link
            to="/packages"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              isActive("/packages") ? "bg-teal-800 text-white" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t[lang].tourPackages}
          </Link>

          {(currentUser.role === "user" || currentUser.role === "pengelola" || currentUser.role === "admin") && (
            <>
              <Link
                to="/itinerary"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive("/itinerary") ? "bg-teal-800 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].itineraryTrip}
              </Link>
              
              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive("/dashboard") ? "bg-teal-800 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].myDashboard}
              </Link>

              {currentUser.role === "pengelola" && (
                <Link
                  to="/dashboard/submit"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base ${
                    isPathPrefix("/dashboard/submit") ? "bg-teal-800 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {t[lang].proposePlace}
                </Link>
              )}
            </>
          )}

          {currentUser.role === "admin" && (
            <>
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive("/admin") ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].slaAdmin}
              </Link>

              <Link
                to="/admin/queue"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base relative ${
                  isActive("/admin/queue") ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].reviewQueue}
                {pendingSubmissionsCount > 0 && (
                  <span className="ml-2 bg-red-600 text-white rounded-full text-xs px-2 py-0.5 font-bold">
                    {pendingSubmissionsCount}
                  </span>
                )}
              </Link>

              <Link
                to="/admin/locations"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive("/admin/locations") ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].managePlaces}
              </Link>

              <Link
                to="/admin/users"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive("/admin/users") ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].manageUsers}
              </Link>

              <Link
                to="/admin/notifications"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive("/admin/notifications") ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].notifBroadcast}
              </Link>

              <Link
                to="/admin/logs"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base ${
                  isActive("/admin/logs") ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t[lang].auditLog}
              </Link>
            </>
          )}

          <Link
            to="/gallery"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              isActive("/gallery") ? "bg-teal-800 text-white" : "text-slate-300"
            }`}
          >
            {t[lang].gallery}
          </Link>

          <Link
            to="/about"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base ${
              isActive("/about") ? "bg-teal-800 text-white" : "text-slate-300"
            }`}
          >
            {t[lang].about}
          </Link>

          {/* Account Settings for Mobile */}
          <div className="pt-3 pb-2 border-t border-slate-800 mt-2 space-y-2">
            {currentUser.id !== "guest_empty" && (
              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 flex items-center gap-3">
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="w-10 h-10 rounded-full object-cover aspect-square shrink-0 bg-slate-900 border border-slate-700 p-0.5"
                />
                <div className="truncate flex-1">
                  <div className="font-bold text-sm text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{currentUser.email || "Email tidak tersedia"}</div>
                  <div className="flex gap-1.5 items-center mt-1">
                    <span className={`text-[8px] font-black uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
                      currentUser.role === 'admin' 
                        ? (isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30') :
                      currentUser.role === 'pengelola' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                    }`}>
                      {currentUser.role === 'admin' 
                        ? (isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) ? 'ADMIN UTAMA' : 'ADMIN SEKUNDER')
                        : currentUser.role === 'pengelola' ? 'PENGELOLA' : 'WISATAWAN'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {currentUser.id !== "guest_empty" && (
                <button
                  onClick={() => {
                    handleOpenSettings();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-teal-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-semibold transition-colors"
                >
                  <Settings size={16} />
                  <span>{t[lang].settings}</span>
                </button>
              )}

              <button
                onClick={() => {
                  onToggleDark();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
              >
                {isDark ? (
                  <>
                    <Sun size={16} className="text-amber-400" />
                    <span>Mode Terang</span>
                  </>
                ) : (
                  <>
                    <Moon size={16} />
                    <span>Mode Gelap</span>
                  </>
                )}
              </button>

              {currentUser.id === "guest_empty" ? (
                <button
                  onClick={() => {
                    setAuthTab("login");
                    setShowAuthModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-teal-400 hover:bg-slate-800/80 bg-teal-950/20 border border-teal-800/30 flex items-center gap-2 cursor-pointer font-bold transition-colors"
                >
                  <LogIn size={16} />
                  <span>Masuk / Daftar Akun</span>
                </button>
              ) : realGoogleUser ? (
                <button
                  onClick={() => {
                    onGoogleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-rose-400 hover:bg-rose-950/20 flex items-center gap-2 cursor-pointer font-bold transition-colors"
                >
                  <LogOut size={16} />
                  <span>{t[lang].signOut}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onGoogleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-amber-400 hover:bg-amber-950/20 flex items-center gap-2 cursor-pointer font-bold transition-colors"
                >
                  <LogOut size={16} />
                  <span>Keluar ke Mode Tamu</span>
                </button>
              )}
            </div>
          </div>


        </div>
      )}

      {/* Account Settings Modal */}
      {showSettingsModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[20000] overflow-y-auto flex justify-center items-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl my-auto max-h-[95vh] sm:max-h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                   <Settings className="text-teal-500 w-4 h-4 sm:w-5 sm:h-5" />
                  {t[lang].profileSettings}
                </h3>
                <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t[lang].subSettings}
                </p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-3.5 sm:p-6 space-y-3 sm:space-y-6 flex-1 overflow-y-auto">
              {/* Language Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  {t[lang].displayLang}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setTempLang("id")}
                    className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      tempLang === "id"
                        ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 font-bold"
                        : "bg-transparent border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-lg sm:text-xl">🇮🇩</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-950 dark:text-white font-bold truncate">Bahasa Indonesia</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 hidden sm:block">Gunakan Bahasa Indonesia</div>
                    </div>
                    {tempLang === "id" && <Check size={14} className="text-teal-500 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTempLang("en")}
                    className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      tempLang === "en"
                        ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 font-bold"
                        : "bg-transparent border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-lg sm:text-xl">🇺🇸</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-950 dark:text-white font-bold truncate">English (US)</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 hidden sm:block">Use English Language</div>
                    </div>
                    {tempLang === "en" && <Check size={14} className="text-teal-500 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Username Input with 30-Day Restriction Check */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    {t[lang].changeUsername}
                  </label>
                  {currentUser.lastUsernameChange && (
                    <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(currentUser.lastUsernameChange).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    disabled={!canChangeUsername(currentUser.lastUsernameChange).can && tempUsername.trim() === currentUser.name}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed font-medium transition-all"
                    placeholder="Masukkan username baru..."
                  />
                  <div className="absolute right-3 top-2.5 sm:top-3.5 text-slate-400">
                    <Edit3 size={12} />
                  </div>
                </div>

                {/* Status Notice & Simulasi Reset */}
                {(() => {
                  const restriction = canChangeUsername(currentUser.lastUsernameChange);
                  if (!restriction.can) {
                    return (
                      <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 dark:border-amber-500/20 rounded-xl p-2 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex-1">
                          <p className="text-[10px] sm:text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            {t[lang].usernameHelp}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-medium">
                            {t[lang].usernameRestricted} <span className="font-bold text-amber-600 dark:text-amber-400">{restriction.daysLeft}</span> hari.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetTimer}
                          className="bg-amber-650 hover:bg-amber-700 text-white dark:bg-amber-950 dark:hover:bg-amber-900 border border-amber-500/20 text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md transition-all whitespace-nowrap cursor-pointer text-center"
                        >
                          {t[lang].resetSimulation}
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Check size={12} />
                        {t[lang].usernameAllowed}
                      </p>
                    );
                  }
                })()}
              </div>

              {/* Email Address Input */}
              <div className="space-y-1.5" id="settings-email-group">
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  {t[lang].emailAddress}
                </label>
                <div className="relative">
                  <input
                    id="settings-email-input"
                    type="email"
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium transition-all"
                    placeholder={t[lang].emailPlaceholder}
                  />
                  <div className="absolute right-3 top-2.5 sm:top-3.5 text-slate-400">
                    <Mail size={12} />
                  </div>
                </div>
                {tempEmail && tempEmail.toLowerCase() !== (currentUser.email || "").toLowerCase() && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleRequestEmailChange(tempEmail, triggerToast);
                    }}
                    className="mt-1 w-full text-left text-[11px] sm:text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors flex items-center gap-1.5 cursor-pointer bg-teal-500/5 dark:bg-teal-500/10 px-2.5 py-1.5 rounded-xl border border-teal-500/10 dark:border-teal-500/20"
                  >
                    <span>📧</span> 
                    <span className="truncate">{tempLang === "en" ? "Verify & Change Email with Firebase" : "Verifikasi & Ubah Email dengan Firebase"}</span>
                  </button>
                )}
                <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  {t[lang].emailHelp}
                </p>
              </div>

              {/* Avatar Photo URL & Presets */}
              <div className="space-y-2.5">
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  {t[lang].avatarChoice}
                </label>
                
                {/* 6 Grid of Explore Pacitan Travel themed presets */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
                  {AVATAR_PRESETS.map((p) => {
                    const isSelected = tempAvatar === p.url;
                    return (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => setTempAvatar(p.url)}
                        className={`p-1 sm:p-1.5 rounded-xl border flex flex-col items-center justify-center transition-all hover:scale-105 cursor-pointer relative group ${
                          isSelected
                            ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                            : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <img src={p.url} alt={p.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full" />
                        <span className="text-[7px] sm:text-[8px] font-bold mt-1 text-center truncate w-full text-slate-600 dark:text-slate-300">
                          {p.name.split(" ")[0]}
                        </span>
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 bg-teal-500 text-white rounded-full p-0.5">
                            <Check size={8} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Avatar Input */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">
                    {t[lang].customAvatar}
                  </span>
                  <input
                    type="text"
                    value={tempAvatar}
                    onChange={(e) => setTempAvatar(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="https://example.com/avatar.png"
                  />
                </div>

                {/* Local File Upload Support & Preview grouped for compactness on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Local File Upload Support */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">
                      {lang === "en" ? "Or Upload Local Photo" : "Atau Unggah Foto Lokal"}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-xl text-xs font-bold cursor-pointer border border-teal-500/30 transition-all">
                        <Upload size={12} />
                        <span>{lang === "en" ? "Choose File..." : "Pilih File..."}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                triggerToast(
                                  lang === "en"
                                    ? "Image size cannot exceed 2MB!"
                                    : "Ukuran gambar tidak boleh melebihi 2MB!",
                                  "error"
                                );
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === "string") {
                                  setTempAvatar(reader.result);
                                  triggerToast(
                                    lang === "en"
                                      ? "Local image loaded successfully!"
                                      : "Gambar lokal berhasil dimuat!",
                                    "success"
                                  );
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {tempAvatar.startsWith("data:image/") && (
                        <button
                          type="button"
                          onClick={() => setTempAvatar("")}
                          className="text-[9px] font-bold text-red-500 hover:text-red-600 cursor-pointer hover:underline"
                        >
                          {lang === "en" ? "Remove" : "Hapus"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Avatar Preview */}
                  <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-xl">
                    <img
                      src={tempAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=fallback"}
                      alt="Pratinjau"
                      className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-800 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/adventurer/svg?seed=fallback";
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide block">
                        {t[lang].avatarPreview}
                      </span>
                      <span className="text-[8px] text-slate-500 dark:text-slate-400 block truncate font-mono">
                        {tempAvatar || "Default Fallback"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 sm:gap-3.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg sm:rounded-xl transition-all cursor-pointer"
              >
                {t[lang].cancel}
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-4 py-1.5 sm:px-5 sm:py-2 text-[11px] sm:text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {t[lang].saveChanges}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Login & Register Auth Modal */}
      {showAuthModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[20000] overflow-y-auto flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header & Tabs */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAuthTab("login")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    authTab === "login"
                      ? "bg-teal-600 text-white shadow-md"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  Masuk (Login)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab("register")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    authTab === "register"
                      ? "bg-teal-600 text-white shadow-md"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  Daftar Baru
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab 1: LOGIN */}
            {authTab === "login" && (
              <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Selamat Datang Kembali</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Masuk ke akun Explore Pacitan Anda</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alamat Email Google (Gmail)
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="namaanda@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan kata sandi (minimal 6 karakter)"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      title={showLoginPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn size={15} />
                  <span>Masuk ke Akun</span>
                </button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono">
                    <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">atau</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onGoogleLogin();
                    setShowAuthModal(false);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Masuk dengan Google</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Belum punya akun?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthTab("register")}
                      className="text-teal-500 font-bold hover:underline cursor-pointer"
                    >
                      Daftar Akun Baru
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* Tab 2: REGISTER */}
            {authTab === "register" && (
              <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Pendaftaran Akun Wisatawan</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Buat akun pengguna baru untuk menjelajah dan berinteraksi di Explore Pacitan</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alamat Email Google (Gmail)
                  </label>
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="namaanda@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Buat Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      title={showRegisterPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
                    >
                      {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Konfirmasi / Verifikasi Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      type={showRegisterConfirm ? "text" : "password"}
                      required
                      minLength={6}
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi Anda"
                      className={`w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                        registerConfirmPassword && registerConfirmPassword !== registerPassword
                          ? "border-red-500 focus:ring-red-500/50"
                          : registerConfirmPassword && registerConfirmPassword === registerPassword
                          ? "border-emerald-500 focus:ring-emerald-500/50"
                          : "border-slate-300 dark:border-slate-800 focus:ring-teal-500/50"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterConfirm(!showRegisterConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      title={showRegisterConfirm ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
                    >
                      {showRegisterConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {registerConfirmPassword && (
                    <p className={`text-[10px] mt-1 font-medium ${
                      registerConfirmPassword === registerPassword ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                    }`}>
                      {registerConfirmPassword === registerPassword
                        ? "✓ Kata sandi cocok!"
                        : "✗ Konfirmasi kata sandi tidak cocok!"}
                    </p>
                  )}
                </div>

                {/* Role Badge / Info */}
                <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 p-3 rounded-xl flex items-center gap-2.5 text-xs text-teal-800 dark:text-teal-300">
                  <UserPlus size={18} className="shrink-0 text-teal-500" />
                  <div>
                    <span className="font-bold block">Peran Akun: Wisatawan (User)</span>
                    <span className="text-[11px] opacity-90">Setiap pendaftaran akun publik otomatis dikategorikan sebagai akun Wisatawan.</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus size={15} />
                  <span>Daftar & Masuk Akun</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sudah punya akun?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthTab("login")}
                      className="text-teal-500 font-bold hover:underline cursor-pointer"
                    >
                      Masuk ke Akun
                    </button>
                  </p>
                </div>
              </form>
            )}

            </div>
        </div>,
        document.body
      )}

      {/* AI Config Modal */}
      <AiConfigModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
      />
    </nav>
  );
}
