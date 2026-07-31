import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HashRouter as Router, Routes, Route, Link, useNavigate, useParams, Navigate, useLocation } from "react-router-dom";
import { 
  MapPin, Star, Calendar, Clock, Phone, AlertCircle, CheckCircle, XCircle, Search, 
  Map, List, Compass, LayoutDashboard, Database, History, ChevronRight, MessageSquare, 
  ArrowLeft, Eye, Edit3, Clipboard, HelpCircle, EyeOff, Check, Image, AlertTriangle,
  Car, ArrowRight, Upload, Download, Users, Save, RotateCcw, Printer, Share2, Globe, ExternalLink, Crop, FileText, Bot, Power, Trash2
} from "lucide-react";

import { Location, User, LocationSubmission, Itinerary, Review, ModerationLog, LocationCategory, TourPackage, UserRole, AdminNotification } from "./types";
import { LocalDB, MOCK_USERS, EMPTY_GUEST_USER, isDefaultAdminUtama, isDefaultKoordinatorPengelola, isDefaultMitraPengelola, isDefaultWisatawan, enforceDefaultAccount } from "./data";
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db } from "./lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { useFirestoreSync } from "./lib/firestoreSync";
import NavigationBar from "./components/NavigationBar";
import MapComponent from "./components/MapComponent";
import ItineraryBuilder from "./components/ItineraryBuilder";
import { AboutView, GalleryView } from "./components/AboutAndGallery";
import ItineraryMap from "./components/ItineraryMap";
import TourPackagesView from "./components/TourPackagesView";
import ImageCropperModal from "./components/ImageCropperModal";
import AdminNotificationsManageView from "./components/AdminNotificationsManageView";
import { AiChatbotWidget } from "./components/AiChatbotWidget";
import { AiConfigModal } from "./components/AiConfigModal";
import { AiService } from "./lib/aiService";
import { exportAdminPdfReport } from "./lib/pdfExport";

// Global Helper for triggering toasts from components without prop drilling
export function triggerToast(message: string, type: "success" | "error" | "info" = "success") {
  window.dispatchEvent(new CustomEvent("show-toast", { detail: { message, type } }));
}

// Global Helper to convert Google Drive sharing link to a direct raw streaming image link
export function getDirectImageUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();

  // Pattern 1: /file/d/{FILE_ID}/view or similar
  const fileDPattern = /\/file\/d\/([a-zA-Z0-9_-]{25,})/;
  const matchD = trimmed.match(fileDPattern);
  if (matchD && matchD[1]) {
    return `https://lh3.googleusercontent.com/d/${matchD[1]}`;
  }

  // Pattern 2: ?id={FILE_ID} or &id={FILE_ID}
  const idPattern = /[?&]id=([a-zA-Z0-9_-]{25,})/;
  const matchId = trimmed.match(idPattern);
  if (matchId && matchId[1]) {
    return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
  }

  return trimmed;
}

// Helper to downscale and compress images to keep Base64 strings compact for Firestore limits
export function compressImage(file: File, maxWidth = 800, maxHeight = 600, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions to maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string || "");
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Get the compressed base64 data URL as jpeg
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target?.result as string || "");
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}

// Helper to calculate distance in km using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Number(d.toFixed(1));
}

// Estimate driving duration in minutes
function estimateDrivingDuration(distanceKm: number): number {
  let speed = 35; // average speed in km/h on Pacitan roads
  if (distanceKm < 1) speed = 15;
  else if (distanceKm < 5) speed = 30;
  const hours = distanceKm / speed;
  return Math.round(hours * 60);
}

// Category details
const CATEGORY_LABELS: Record<LocationCategory, string> = {
  wisata: "Destinasi Wisata",
  penginapan: "Penginapan",
  makan: "Tempat Makan",
  coffeeshop: "Kafe",
  belanja: "Belanja & Oleh-oleh",
  lainnya: "Fasilitas Lainnya"
};

const CATEGORY_COLORS: Record<LocationCategory, string> = {
  wisata: "bg-teal-105 text-teal-800 border-teal-200",
  penginapan: "bg-amber-100 text-amber-800 border-amber-200",
  makan: "bg-rose-100 text-rose-800 border-rose-200",
  coffeeshop: "bg-purple-100 text-purple-800 border-purple-200",
  belanja: "bg-pink-100 text-pink-800 border-pink-200",
  lainnya: "bg-slate-100 text-slate-800 border-slate-200"
};

const checkIsIvanOrAdmin = (email: string = "", name: string = "", id: string = "") => {
  return isDefaultAdminUtama(email, name, id);
};

export default function App() {
  // 1. Core States connected to mock database
  const [locations, setLocations] = useState<Location[]>(() => LocalDB.getLocations());
  const [submissions, setSubmissions] = useState<LocationSubmission[]>(() => 
    LocalDB.getSubmissions().filter(s => s.submittedBy !== "guest_empty")
  );
  const [reviews, setReviews] = useState<Review[]>(() => 
    LocalDB.getReviews().filter(r => r.userId !== "guest_empty" && r.userName !== "Tamu (Belum Login)")
  );
  const [itineraries, setItineraries] = useState<Itinerary[]>(() => 
    LocalDB.getItineraries().filter(i => i.createdBy !== "guest_empty")
  );
  const [tourPackages, setTourPackages] = useState<TourPackage[]>(() => LocalDB.getTourPackages());
  const [logs, setLogs] = useState<ModerationLog[]>(() => LocalDB.getLogs());
  const [currentUser, setCurrentUser] = useState<User>(() => LocalDB.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => LocalDB.getUsers());
  const [notifications, setNotifications] = useState<AdminNotification[]>(() => LocalDB.getNotifications());
  const [realGoogleUser, setRealGoogleUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const authProcessingRef = useRef<string | null>(null);
  const isManualLoginRef = useRef<boolean>(false);

  // Initialize two-way Firestore synchronization
  useFirestoreSync({
    locations,
    setLocations,
    submissions,
    setSubmissions,
    reviews,
    setReviews,
    itineraries,
    setItineraries,
    tourPackages,
    setTourPackages,
    logs,
    setLogs,
    users,
    setUsers,
    notifications,
    setNotifications
  });

  // Auto-upgrade Ivan / Admin account if currently logged in as normal user
  useEffect(() => {
    if (currentUser) {
      const enforced = enforceDefaultAccount(currentUser);
      if (enforced.role !== currentUser.role || enforced.id !== currentUser.id || enforced.email !== currentUser.email || enforced.name !== currentUser.name) {
        setCurrentUser(enforced);
        LocalDB.saveCurrentUser(enforced);
      }
    }
  }, [currentUser?.id, currentUser?.role, currentUser?.email, currentUser?.name]);

  // Helper to process and persist Google User login
  const processGoogleUser = async (
    email: string,
    name?: string,
    uid?: string,
    photoUrl?: string,
    roleOverride?: UserRole,
    showToast = true
  ) => {
    if (!uid) return;

    // De-duplicate concurrent auth synchronization ticks for the same user
    if (authProcessingRef.current === uid) {
      console.log("[Auth Debug] Already processing user:", uid, "- skipping duplicate invocation.");
      return;
    }

    authProcessingRef.current = uid;

    try {
      const registeredUsers = LocalDB.getUsers();
      const cleanEmail = (email || "").trim().toLowerCase();

      let firestoreUser: User | null = null;
      try {
        if (db) {
          const userDocRef = doc(db, "users", uid);
          const userSnapshot = await getDoc(userDocRef);
          
          if (userSnapshot.exists()) {
            firestoreUser = userSnapshot.data() as User;
            
            // Enforce admin role in Firestore
            if (cleanEmail === "ivanfadhilamaulana1@gmail.com" || uid === "21oQqjjDX0Xfs0ddKRsVJlsxGqm1") {
              if (firestoreUser.role !== "admin") {
                firestoreUser.role = "admin";
                await setDoc(userDocRef, { ...firestoreUser, role: "admin" }, { merge: true });
              }
            }
          } else {
            // New user - create document at /users/{uid}
            const defaultRole: UserRole = (cleanEmail === "ivanfadhilamaulana1@gmail.com" || uid === "21oQqjjDX0Xfs0ddKRsVJlsxGqm1") ? "admin" : (roleOverride || "user");
            const newUserDoc: User = {
              id: uid,
              name: name || email.split("@")[0] || "Pengguna Baru",
              email: email || "",
              role: defaultRole,
              avatarUrl: photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`,
              managedLocations: []
            };
            await setDoc(userDocRef, newUserDoc);
            firestoreUser = newUserDoc;
          }
        }
      } catch (e) {
        console.error("Firestore error in processGoogleUser:", e);
      }

      const isIvanAdmin = isDefaultAdminUtama(cleanEmail, name || "", uid || "");
      const isKoor = isDefaultKoordinatorPengelola(cleanEmail, name || "", uid || "");
      const isMitra = isDefaultMitraPengelola(cleanEmail, name || "", uid || "");
      const isWst = isDefaultWisatawan(cleanEmail, name || "", uid || "");

      const existingUserIndex = registeredUsers.findIndex(
        u => (uid && u.id === uid) || 
             (u.email && u.email.toLowerCase() === cleanEmail) || 
             (isIvanAdmin && u.id === "usr_admin") ||
             (isKoor && u.id === "usr_mgr_koor") ||
             (isMitra && u.id === "usr_mgr_1") ||
             (isWst && u.id === "usr_wst_1")
      );
      const existingUser = existingUserIndex >= 0 ? registeredUsers[existingUserIndex] : null;

      let finalUser: User;
      if (firestoreUser) {
        finalUser = {
          ...firestoreUser,
          id: uid || firestoreUser.id
        };
      } else {
        const rawUser: User = {
          id: existingUser ? existingUser.id : (uid || `google_${Date.now()}`),
          name: (name || "").trim() || existingUser?.name || cleanEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Pengguna Google",
          email: cleanEmail,
          role: existingUser ? existingUser.role : (roleOverride || "user"),
          avatarUrl: photoUrl || existingUser?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid || cleanEmail}`,
          managedLocations: existingUser?.managedLocations || []
        };
        finalUser = enforceDefaultAccount(rawUser);
      }

      if (cleanEmail === "ivanfadhilamaulana1@gmail.com" || (uid && uid === "21oQqjjDX0Xfs0ddKRsVJlsxGqm1")) {
        finalUser.role = "admin";
        if (!finalUser.email) finalUser.email = "ivanfadhilamaulana1@gmail.com";
        if (!finalUser.name || finalUser.name === "Ivan") finalUser.name = "Ivan Fadhila (Admin Utama)";
        if (uid) {
          finalUser.id = uid;
        }
      }

      let updatedUsers: User[];
      if (existingUserIndex >= 0) {
        updatedUsers = [...registeredUsers];
        updatedUsers[existingUserIndex] = finalUser;
      } else {
        updatedUsers = [...registeredUsers, finalUser];
      }

      const clean = LocalDB.saveUsers(updatedUsers);
      setUsers(clean);
      setRealGoogleUser(finalUser);
      setCurrentUser(finalUser);
      LocalDB.saveCurrentUser(finalUser);

      if (showToast) {
        triggerToast(`Selamat datang, ${finalUser.name}! (Login Google)`, "success");
      }
    } finally {
      authProcessingRef.current = null;
    }
  };

  // Monitor Google Authentication State via Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userEmail = (user.email || "").trim().toLowerCase();
        
        // Validasi: Tolak jika bukan @gmail.com
        if (!userEmail.endsWith("@gmail.com")) {
          console.warn(`[Auth Log] Deteksi sesi persisten dengan domain tidak valid, akses ditolak untuk: ${userEmail}`);
          await signOut(auth);
          return;
        }

        const showToast = isManualLoginRef.current;
        isManualLoginRef.current = false; // Reset the manual flag

        // Delegate to the shared helper to ensure Firestore is correctly upserted before setting state
        processGoogleUser(
          user.email || "",
          user.displayName || undefined,
          user.uid,
          user.photoURL || undefined,
          undefined,
          showToast
        );
      } else {
        setRealGoogleUser(null);
        // Reset the session to Guest if the user is unauthenticated but has a stale admin session locally
        const savedUser = LocalDB.getCurrentUser();
        if (savedUser && savedUser.email === "ivanfadhilamaulana1@gmail.com") {
          setCurrentUser(EMPTY_GUEST_USER);
          LocalDB.saveCurrentUser(EMPTY_GUEST_USER);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      if (googleProvider && typeof googleProvider.setCustomParameters === "function") {
        googleProvider.setCustomParameters({});
      }
      isManualLoginRef.current = true;
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        const userEmail = (result.user.email || "").trim().toLowerCase();
        
        // Buatkan log upaya login
        console.log(`[Auth Log] Otorisasi Google Login diterima dari akun: ${userEmail}`);
        
        // Validasi: Wajib berakhiran @gmail.com
        if (!userEmail.endsWith("@gmail.com")) {
          console.warn(`[Auth Log] Akses ditolak: Akun ${userEmail} tidak menggunakan domain @gmail.com.`);
          triggerToast("Gagal masuk! Hanya akun dengan domain @gmail.com yang diizinkan.", "error");
          await signOut(auth);
          return;
        }

        // Await the correct upsert and synchronization process
        await processGoogleUser(
          result.user.email || "",
          result.user.displayName || result.user.email?.split("@")[0],
          result.user.uid,
          result.user.photoURL || undefined,
          undefined,
          true
        );
      }
    } catch (err: any) {
      isManualLoginRef.current = false;
      console.warn("Google popup login exception:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || "";

      if (errCode === "auth/popup-closed-by-user" || errMsg.includes("ditutup sebelum selesai") || errCode === "auth/cancelled-popup-request") {
        triggerToast("Login Google dibatalkan.", "info");
        return;
      }

      triggerToast(`Gagal login Google: ${err?.message || "Terjadi kesalahan"}`, "error");
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
      setRealGoogleUser(null);
      setCurrentUser(EMPTY_GUEST_USER);
      LocalDB.saveCurrentUser(EMPTY_GUEST_USER);
      triggerToast("Berhasil keluar dari akun Google", "success");
    } catch (err: any) {
      console.warn("Google logout notification:", err?.message || err);
      triggerToast(`Gagal keluar: ${err?.message || "Terjadi kesalahan"}`, "error");
    }
  };

  const handleRegisterUser = (name: string, email: string, password?: string): boolean => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || "Wisatawan Baru";
    const cleanPass = (password || "").trim();

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      triggerToast("Silakan masukkan alamat email yang valid dan terdaftar (contoh: nama@gmail.com).", "error");
      return false;
    }

    if (!cleanEmail.endsWith("@gmail.com")) {
      triggerToast("Pendaftaran gagal! Alamat email wajib menggunakan format asli berakhiran @gmail.com.", "error");
      return false;
    }

    if (!cleanPass || cleanPass.length < 6) {
      triggerToast("Kata sandi tidak valid (minimal 6 karakter).", "error");
      return false;
    }

    const registeredUsers = LocalDB.getUsers();
    const isIvanAdmin = checkIsIvanOrAdmin(cleanEmail, cleanName, "");
    const existingUser = registeredUsers.find(
      u => u.email && u.email.toLowerCase() === cleanEmail
    );

    if (existingUser) {
      triggerToast("Email sudah terdaftar! Silakan pindah ke tab Masuk (Login) dan masukkan kata sandi.", "error");
      return false;
    }

    const isDefaultMain = isIvanAdmin;
    const newUserId = isDefaultMain ? "21oQqjjDX0Xfs0ddKRsVJlsxGqm1" : `usr_${Date.now()}`;
    const newUser: User = {
      id: newUserId,
      name: isDefaultMain ? "Ivan Fadhila (Admin Utama)" : cleanName,
      email: isDefaultMain ? "ivanfadhilamaulana1@gmail.com" : cleanEmail,
      role: isIvanAdmin ? "admin" : "user", // STRICTLY LOCKED TO 'user' unless Admin Utama
      avatarUrl: isIvanAdmin ? "https://api.dicebear.com/7.x/adventurer/svg?seed=ivan" : `https://api.dicebear.com/7.x/adventurer/svg?seed=${newUserId}`,
      password: cleanPass,
      managedLocations: []
    };

    const updatedUsers = [...registeredUsers, newUser];
    const clean = LocalDB.saveUsers(updatedUsers);
    setUsers(clean);
    setCurrentUser(newUser);
    LocalDB.saveCurrentUser(newUser);

    if (db) {
      setDoc(doc(db, "users", newUserId), {
        id: newUserId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        avatarUrl: newUser.avatarUrl,
        managedLocations: []
      }).catch(err => {
        console.error("Error creating manual registered user in Firestore:", err);
      });
    }

    triggerToast(`Akun "${newUser.name}" berhasil terdaftar & aktif!`, "success");
    return true;
  };

  const handleLoginUser = (email: string, password?: string): boolean => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = (password || "").trim();
    if (!cleanEmail) {
      triggerToast("Silakan masukkan alamat email atau username Anda.", "error");
      return false;
    }

    if (!cleanEmail.endsWith("@gmail.com")) {
      triggerToast("Format email salah! Alamat email masuk wajib berakhiran dengan @gmail.com.", "error");
      return false;
    }

    if (!cleanPass || cleanPass.length < 6) {
      triggerToast("Kata sandi tidak valid (minimal 6 karakter).", "error");
      return false;
    }

    const registeredUsers = LocalDB.getUsers();
    const foundUser = registeredUsers.find(
      u => u.email && u.email.toLowerCase() === cleanEmail
    );

    if (foundUser) {
      // Check if user has stored password
      if (foundUser.password && foundUser.password !== cleanPass) {
        triggerToast("Kata sandi salah! Silakan periksa kembali kata sandi yang Anda masukkan.", "error");
        return false;
      }
      // If user has no stored password yet, set it now
      if (!foundUser.password) {
        foundUser.password = cleanPass;
      }
      const enforcedUser = enforceDefaultAccount(foundUser);
      setCurrentUser(enforcedUser);
      LocalDB.saveCurrentUser(enforcedUser);
      const clean = LocalDB.saveUsers(registeredUsers);
      setUsers(clean);

      if (db) {
        setDoc(doc(db, "users", enforcedUser.id), {
          id: enforcedUser.id,
          name: enforcedUser.name,
          email: enforcedUser.email,
          role: enforcedUser.role,
          avatarUrl: enforcedUser.avatarUrl,
          managedLocations: enforcedUser.managedLocations || []
        }).catch(err => {
          console.error("Error syncing manual logged-in user in Firestore:", err);
        });
      }

      triggerToast(`Selamat datang kembali, ${enforcedUser.name}!`, "success");
      return true;
    } else {
      // Auto-register and log in new user for manual login with valid Gmail
      const formattedName = cleanEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const isIvanAdmin = checkIsIvanOrAdmin(cleanEmail, formattedName, "");
      const newUserId = isIvanAdmin ? "21oQqjjDX0Xfs0ddKRsVJlsxGqm1" : `usr_${Date.now()}`;
      
      const newUser: User = {
        id: newUserId,
        name: isIvanAdmin ? "Ivan Fadhila (Admin Utama)" : formattedName,
        email: cleanEmail,
        role: isIvanAdmin ? "admin" : "user",
        avatarUrl: isIvanAdmin ? "https://api.dicebear.com/7.x/adventurer/svg?seed=ivan" : `https://api.dicebear.com/7.x/adventurer/svg?seed=${newUserId}`,
        password: cleanPass,
        managedLocations: []
      };

      const updatedUsers = [...registeredUsers, newUser];
      const clean = LocalDB.saveUsers(updatedUsers);
      setUsers(clean);
      setCurrentUser(newUser);
      LocalDB.saveCurrentUser(newUser);

      if (db) {
        setDoc(doc(db, "users", newUserId), {
          id: newUserId,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          avatarUrl: newUser.avatarUrl,
          managedLocations: []
        }).catch(err => {
          console.error("Error creating manual user in Firestore on login:", err);
        });
      }

      triggerToast(`Akun "${newUser.name}" berhasil dibuat & Anda telah berhasil masuk!`, "success");
      return true;
    }
  };

  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setToast({ message: detail.message, type: detail.type || "success" });
      }
    };
    window.addEventListener("show-toast", handleToast);
    return () => window.removeEventListener("show-toast", handleToast);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 2. Synchronize back to LocalStorage on changes
  useEffect(() => {
    LocalDB.saveLocations(locations);
  }, [locations]);

  useEffect(() => {
    LocalDB.saveSubmissions(submissions);
  }, [submissions]);

  useEffect(() => {
    LocalDB.saveReviews(reviews);
  }, [reviews]);

  useEffect(() => {
    LocalDB.saveItineraries(itineraries);
  }, [itineraries]);

  useEffect(() => {
    LocalDB.saveTourPackages(tourPackages);
  }, [tourPackages]);

  useEffect(() => {
    LocalDB.saveLogs(logs);
  }, [logs]);

  useEffect(() => {
    LocalDB.saveUsers(users);
  }, [users]);

  useEffect(() => {
    LocalDB.saveCurrentUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const handleNotifUpdate = () => {
      const freshNotifs = LocalDB.getNotifications();
      setNotifications(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(freshNotifs)) {
          return freshNotifs;
        }
        return prev;
      });
    };
    window.addEventListener("sipp_notif_updated", handleNotifUpdate);
    return () => window.removeEventListener("sipp_notif_updated", handleNotifUpdate);
  }, []);

  useEffect(() => {
    LocalDB.saveNotifications(notifications);
  }, [notifications]);

  // Global Dark Mode State
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? true : false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Handler for Role Selector
  const handleRoleChange = (newUser: User) => {
    setCurrentUser(newUser);
    LocalDB.saveCurrentUser(newUser);
    
    // Also update in registered users list
    const registeredUsers = LocalDB.getUsers();
    const existingUserIndex = registeredUsers.findIndex(u => u.id === newUser.id);
    if (existingUserIndex >= 0) {
      const updatedUsers = [...registeredUsers];
      updatedUsers[existingUserIndex] = newUser;
      const clean = LocalDB.saveUsers(updatedUsers);
      setUsers(clean);
    }
  };

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

// Dynamic SEO Route Updater for SPA
function SeoRouteUpdater({ locations }: { locations: Location[] }) {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let pageTitle = "Explore Pacitan (explorepacitan.com) - Direktori & Panduan Pariwisata Resmi Pacitan";
    let metaDesc = "Explore Pacitan (explorepacitan.com) adalah portal dan direktori pariwisata resmi Kabupaten Pacitan, Jawa Timur. Temukan pesona pantai pasir putih, goa stalaktit ajaib, paket tur, dan itinerari liburan terbaik.";

    if (path === "/" || path === "") {
      pageTitle = "Peta Wisata Interaktif & Direktori Resmi - Explore Pacitan";
    } else if (path === "/locations") {
      pageTitle = "Daftar Tempat Wisata Pacitan Terlengkap - Explore Pacitan";
      metaDesc = "Jelajahi ratusan destinasi wisata pantai, goa, kuliner, dan penginapan terbaik di Kabupaten Pacitan.";
    } else if (path.startsWith("/location/")) {
      const id = path.split("/")[2];
      const loc = locations.find(l => l.id === id);
      if (loc) {
        pageTitle = `${loc.name} - Wisata Pacitan | Explore Pacitan`;
        metaDesc = `Jelajahi keindahan ${loc.name} di Pacitan. ${loc.description.slice(0, 150)}...`;
      }
    } else if (path === "/itinerary") {
      pageTitle = "Perencana Itinerari Liburan Pacitan Otomatis - Explore Pacitan";
      metaDesc = "Rancang rute liburan kustom Anda di Pacitan dengan kalkulator estimasi waktu dan jarak otomatis.";
    } else if (path === "/packages") {
      pageTitle = "Paket Wisata & Tur Unggulan Pacitan - Explore Pacitan";
      metaDesc = "Pilihan paket wisata hemat dan eksklusif keliling pantai dan goa Pacitan bersama guide profesional.";
    } else if (path === "/gallery") {
      pageTitle = "Galeri Lensa Wisata & Foto Keindahan Pacitan - Explore Pacitan";
    } else if (path === "/about") {
      pageTitle = "Tentang Explore Pacitan - Portal Resmi Pariwisata";
    } else if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
      pageTitle = "Panel Pengelola & Moderasi - Explore Pacitan";
    }

    // Update document title
    document.title = pageTitle;

    // Update meta description
    let metaDescEl = document.querySelector('meta[name="description"]');
    if (metaDescEl) {
      metaDescEl.setAttribute("content", metaDesc);
    } else {
      metaDescEl = document.createElement("meta");
      metaDescEl.setAttribute("name", "description");
      metaDescEl.setAttribute("content", metaDesc);
      document.head.appendChild(metaDescEl);
    }

    // Update OG title & description
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", pageTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", metaDesc);

    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    const fullUrl = `https://explorepacitan.com/#${path}`;
    if (canonical) {
      canonical.setAttribute("href", fullUrl);
    } else {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      canonical.setAttribute("href", fullUrl);
      document.head.appendChild(canonical);
    }
  }, [location, locations]);

  return null;
}

  return (
    <Router>
      <SeoRouteUpdater locations={locations} />
      <div className="flex flex-col min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none transition-colors duration-200">
        {/* Beautiful Custom Toast Notification */}
        {toast && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-[9999] max-w-[calc(100vw-2rem)] sm:max-w-xs md:max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-start gap-3 border-l-[3px] sm:border-l-4 border-l-teal-600">
            {toast.type === "success" && (
              <CheckCircle className="text-emerald-500 flex-shrink-0 mt-0.5" size={18} />
            )}
            {toast.type === "error" && (
              <XCircle className="text-rose-500 flex-shrink-0 mt-0.5" size={18} />
            )}
            {toast.type === "info" && (
              <AlertCircle className="text-teal-500 flex-shrink-0 mt-0.5" size={18} />
            )}
            <div className="flex-1 min-w-0 break-words">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Notifikasi Explore Pacitan</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-sm sm:text-base font-bold shrink-0 p-1 -mt-1 -mr-1">
              ✕
            </button>
          </div>
        )}

        {/* Navigations Component */}
        <NavigationBar 
          currentUser={currentUser} 
          onRoleChange={handleRoleChange} 
          pendingSubmissionsCount={pendingCount} 
          isDark={isDark}
          onToggleDark={() => setIsDark(!isDark)}
          realGoogleUser={realGoogleUser}
          onGoogleLogin={handleGoogleLogin}
          onGoogleLogout={handleGoogleLogout}
          onRegisterUser={handleRegisterUser}
          onLoginUser={handleLoginUser}
          usersList={users}
        />



        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            {/* Public Area */}
            <Route path="/" element={<PetaWisataView locations={locations} currentUser={currentUser} />} />
            <Route path="/locations" element={<DaftarTempatView locations={locations} currentUser={currentUser} />} />
            <Route path="/location/:id" element={
              <DetailTempatView 
                locations={locations} 
                reviews={reviews} 
                currentUser={currentUser}
                onAddReview={(rev) => {
                  if (rev.userId === "guest_empty" || rev.userName === "Tamu (Belum Login)") {
                    alert("Akun Tamu tidak diperkenankan mengirim ulasan.");
                    return;
                  }
                  const updatedReviews = [rev, ...reviews];
                  setReviews(updatedReviews);

                  // Recalculate average rating for location
                  const siblingReviews = updatedReviews.filter(r => r.locationId === rev.locationId);
                  const average = siblingReviews.reduce((sum, r) => sum + r.rating, 0) / siblingReviews.length;
                  
                  setLocations(prev => prev.map(loc => {
                    if (loc.id === rev.locationId) {
                      return {
                        ...loc,
                        ratingAverage: Number(average.toFixed(1)),
                        reviewCount: siblingReviews.length
                      };
                    }
                    return loc;
                  }));
                }} 
              />
            } />
            <Route path="/gallery" element={<GalleryView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="/packages" element={
              <TourPackagesView
                packages={tourPackages}
                currentUser={currentUser}
                onAddPackage={(newPkg) => {
                  setTourPackages(prev => [newPkg, ...prev]);
                }}
                onDeletePackage={(id) => {
                  setTourPackages(prev => prev.filter(p => p.id !== id));
                }}
              />
            } />

            {/* Tourist/Pengelola Area */}
            <Route path="/itinerary" element={
              <ItineraryBuilder 
                locations={locations}
                itineraries={itineraries}
                currentUser={currentUser}
                onSaveItinerary={(iti) => {
                  if (iti.createdBy === "guest_empty") {
                    alert("Akun Tamu tidak diperkenankan menyimpan rencana perjalanan.");
                    return;
                  }
                  setItineraries(prev => {
                    const existed = prev.some(i => i.id === iti.id);
                    if (existed) {
                      return prev.map(i => i.id === iti.id ? iti : i);
                    }
                    return [iti, ...prev];
                  });
                }}
                onDeleteItinerary={(id) => {
                  setItineraries(prev => prev.filter(i => i.id !== id));
                }}
              />
            } />
            <Route path="/shared/itinerary/:id" element={<SharedItineraryView locations={locations} itineraries={itineraries} />} />
            <Route path="/dashboard" element={
              <DashboardUserView 
                submissions={submissions} 
                locations={locations} 
                currentUser={currentUser} 
                itineraries={itineraries}
                reviews={reviews}
                tourPackages={tourPackages}
              />
            } />
            <Route path="/dashboard/submit" element={
              <SubmitWisataView 
                currentUser={currentUser}
                locations={locations}
                onSubmit={(sub) => {
                  if (currentUser.role === "admin") {
                    const approvedSub: LocationSubmission = {
                      ...sub,
                      status: "approved",
                      reviewedBy: currentUser.id,
                      reviewedByName: currentUser.name,
                      reviewedAt: new Date().toISOString(),
                      reviewNotes: "Disunting langsung oleh Administrator."
                    };
                    setSubmissions(prev => [approvedSub, ...prev]);

                    if (sub.submissionType === "update" && sub.targetLocationId) {
                      setLocations(prev => prev.map(loc => {
                        if (loc.id === sub.targetLocationId) {
                          return {
                            ...loc,
                            ...sub.payload,
                            updatedAt: new Date().toISOString()
                          };
                        }
                        return loc;
                      }));
                      triggerToast(`Perubahan data tempat "${sub.payload.name}" berhasil diterapkan secara langsung!`, "success");
                    } else {
                      const newLoc: Location = {
                        id: "loc_" + Date.now(),
                        name: sub.payload.name,
                        category: sub.payload.category,
                        description: sub.payload.description,
                        coordinates: sub.payload.coordinates,
                        address: sub.payload.address,
                        photos: sub.payload.photos,
                        status: "approved",
                        createdBy: currentUser.id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        ratingAverage: 4.5,
                        reviewCount: 0,
                        openingHours: sub.payload.openingHours,
                        priceRange: sub.payload.priceRange,
                        contact: sub.payload.contact
                      };
                      setLocations(prev => [...prev, newLoc]);
                      triggerToast(`Tempat baru "${sub.payload.name}" berhasil ditambahkan secara langsung!`, "success");
                    }
                  } else {
                    setSubmissions(prev => [sub, ...prev]);
                    triggerToast(`Usulan kontribusi tempat "${sub.payload.name}" berhasil diajukan ke antrean validasi!`, "success");
                  }
                }}
              />
            } />
            <Route path="/dashboard/edit/:id" element={
              <SubmitWisataView 
                currentUser={currentUser}
                locations={locations}
                submissions={submissions}
                onSubmit={(sub) => {
                  setSubmissions(prev => {
                    const existed = prev.some(s => s.id === sub.id);
                    if (existed) {
                      return prev.map(s => s.id === sub.id ? sub : s);
                    }
                    return [sub, ...prev];
                  });
                }}
              />
            } />

            {/* Admin Area (Wajib Role Admin) */}
            <Route path="/admin" element={
              <AdminSlaDashboardView 
                locations={locations} 
                submissions={submissions} 
                users={users}
                reviews={reviews}
                itineraries={itineraries}
                logs={logs}
                currentUser={currentUser} 
              />
            } />
            <Route path="/admin/queue" element={
              <AdminQueueView 
                submissions={submissions} 
                locations={locations}
                currentUser={currentUser} 
                onProcessBatch={(updatedSubs, updatedLocations, newLogs) => {
                  setSubmissions(prev => {
                    const map = new Map(prev.map(s => [s.id, s]));
                    updatedSubs.forEach(s => map.set(s.id, s));
                    return Array.from(map.values());
                  });
                  if (updatedLocations) {
                    setLocations(updatedLocations);
                  }
                  if (newLogs && newLogs.length > 0) {
                    setLogs(prev => [...newLogs, ...prev]);
                  }
                }}
              />
            } />
            <Route path="/admin/moderation/:id" element={
              <AdminModerationView 
                submissions={submissions}
                locations={locations}
                currentUser={currentUser}
                onProcess={(updatedSub, updatedLocations, newLog) => {
                  setSubmissions(prev => prev.map(s => s.id === updatedSub.id ? updatedSub : s));
                  if (updatedLocations) {
                    setLocations(updatedLocations);
                  }
                  if (newLog) {
                    setLogs(prev => [newLog, ...prev]);
                  }
                }}
              />
            } />
            <Route path="/admin/locations" element={
              <AdminLocationsManageView 
                locations={locations}
                currentUser={currentUser}
                onToggleStatus={(locId, active) => {
                  setLocations(prev => prev.map(l => {
                    if (l.id === locId) {
                      return { ...l, status: active ? "approved" : "inactive" };
                    }
                    return l;
                  }));
                }} 
              />
            } />
            <Route path="/admin/users" element={
              <AdminUsersManageView 
                users={users}
                locations={locations}
                currentUser={currentUser}
                onUpdateUsers={(updatedUsers) => {
                  const clean = LocalDB.saveUsers(updatedUsers);
                  setUsers(clean);
                  const self = clean.find(u => u.id === currentUser.id);
                  if (self && (self.role !== currentUser.role || JSON.stringify(self.managedLocations) !== JSON.stringify(currentUser.managedLocations))) {
                    setCurrentUser(self);
                  }
                }}
              />
            } />
            <Route path="/admin/logs" element={
              <AdminLogsView 
                logs={logs} 
                currentUser={currentUser} 
              />
            } />
            <Route path="/admin/notifications" element={
              <AdminNotificationsManageView 
                users={users} 
                currentUser={currentUser} 
              />
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Beautiful Footer Card */}
        <footer className="bg-slate-900 border-t border-slate-800 text-slate-450 text-xs py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <p className="font-display font-black tracking-tight text-slate-200">EXPLORE PACITAN (explorepacitan.com)</p>
              <p className="text-slate-500 mt-1">© 2026 Dinas Kebudayaan, Kepemudaan, Olahraga dan Pariwisata Pacitan.</p>
            </div>
            <div className="flex gap-4 text-[11px]">
              <Link to="/about" className="hover:text-white transition">Tentang</Link>
              <span>•</span>
              <Link to="/gallery" className="hover:text-white transition">Galeri Lensa Wisata</Link>
              <span>•</span>
              <a href="https://pariwisata.pacitankab.go.id" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Situs Resmi Daerah</a>
            </div>
          </div>
        </footer>
      </div>

      {/* Floating Interactive AI Chatbot Widget */}
      <AiChatbotWidget
        currentUser={currentUser}
        locations={locations}
        itineraries={itineraries}
        onSaveItinerary={(iti) => {
          if (iti.createdBy === "guest_empty") {
            alert("Akun Tamu tidak diperkenankan menyimpan rencana perjalanan.");
            return;
          }
          setItineraries(prev => {
            const existed = prev.some(i => i.id === iti.id);
            if (existed) {
              return prev.map(i => i.id === iti.id ? iti : i);
            }
            return [iti, ...prev];
          });
        }}
      />

    </Router>
  );
}

/* =========================================================================
   PUBLIC DIRECTORY: 1. PetaWisataView (Index Route)
   ========================================================================= */
function PetaWisataView({ locations, currentUser }: { locations: Location[]; currentUser: User }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"semua" | LocationCategory>("semua");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const navigate = useNavigate();

  // Filter approved locations
  const approvedLocations = locations.filter((l) => l.status === "approved");

  const filteredLocations = approvedLocations.filter((loc) => {
    const matchesSearch = 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "semua" || loc.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories: ("semua" | LocationCategory)[] = ["semua", "wisata", "penginapan", "makan", "coffeeshop", "belanja", "lainnya"];

  const handleSelectLocationFromList = (loc: Location) => {
    setSelectedLocation(loc);
  };

  const handleOpenDetailPath = (loc: Location) => {
    navigate(`/location/${loc.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/65 p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-black text-slate-800 text-2xl sm:text-3xl tracking-tight">🗺️ Eksplorasi Surga Bahari Pacitan</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Temukan pantai ombak internasional, goa purba karst megah, serta ragam penginapan pengisi waktu liburan tepercaya.
            </p>
          </div>
          {/* Quick Stats */}
          <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500">
              <span className="text-teal-600 text-xs">🍀</span> Wisata: <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{approvedLocations.filter(l => l.category === 'wisata').length}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500">
              <span className="text-amber-500 text-xs">🏨</span> Penginapan: <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{approvedLocations.filter(l => l.category === 'penginapan').length}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500">
              <span className="text-emerald-600 text-xs">🍛</span> Kuliner: <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{approvedLocations.filter(l => l.category === 'makan').length}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500">
              <span className="text-purple-650 text-xs">☕</span> Kafe: <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{approvedLocations.filter(l => l.category === 'coffeeshop').length}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500">
              <span className="text-rose-500 text-xs">📦</span> Lainnya: <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{approvedLocations.filter(l => l.category === 'belanja' || l.category === 'lainnya').length}</strong>
            </span>
          </div>
        </div>

        {/* Input box */}
        <div className="mt-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pantai klayar, rumah makan rujukan, penginapan terbaik..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-pacitan-primary focus:bg-white font-medium"
            />
          </div>
        </div>

        {/* Filtering Pills */}
        <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-100">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "semua" ? "⭐ Semua" : CATEGORY_EMOJIS[cat] + " " + cat}
            </button>
          ))}
        </div>
      </div>

      {/* TWO PANEL MAP STAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[500px]">
        {/* Left Side: Results Sidebar (5 Columns) */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-md border border-slate-100 flex flex-col max-h-[600px] overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="font-bold text-xs text-slate-600 uppercase tracking-wider font-mono">
              📋 Terdeteksi ({filteredLocations.length} tempat)
            </span>
            {selectedLocation && (
              <button
                onClick={() => setSelectedLocation(null)}
                className="text-[10px] text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
              >
                Reset Pin
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredLocations.length === 0 ? (
              <div className="text-center py-12 px-6 text-slate-450 italic">
                <AlertTriangle size={32} className="mx-auto text-slate-350 mb-1.5" />
                Tidak ada data lokasi publik ditemukan yang cocok untuk kombinasi pencarian ini. Usulkan baru di Dashboard!
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = selectedLocation?.id === loc.id;
                return (
                  <div
                    key={loc.id}
                    onClick={() => handleSelectLocationFromList(loc)}
                    className={`p-3 rounded-xl border flex gap-3 cursor-pointer transition-all ${
                      isSelected 
                        ? "border-teal-500 bg-teal-50/40 shadow-sm ring-1 ring-teal-500" 
                        : "border-slate-100 bg-white hover:bg-slate-50 hover:shadow-xs"
                    }`}
                  >
                    <img
                      src={getDirectImageUrl(loc.photos?.[0])}
                      alt={loc.name}
                      className="w-16 h-16 rounded-lg object-cover bg-slate-100 border border-slate-200/50"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono tracking-wider font-bold uppercase rounded ${CATEGORY_COLORS[loc.category]}`}>
                          {loc.category}
                        </span>
                        <div className="flex items-center text-amber-500 text-[11px] font-bold">
                          ★ <span className="text-slate-700 ml-0.5">{loc.ratingAverage.toFixed(1)}</span>
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mt-1 truncate">{loc.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{loc.address}</p>
                      
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/50">
                        <span className="text-[10px] font-mono font-medium text-teal-700">📌 Lat: {loc.coordinates.lat}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailPath(loc);
                          }}
                          className="text-[10px] font-extrabold text-slate-800 bg-slate-100 hover:bg-teal-700 hover:text-white px-2 py-0.5 rounded transition"
                        >
                          Lihat Detail →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Map Component (7 Columns) */}
        <div className="lg:col-span-7 bg-slate-100 rounded-2xl overflow-hidden shadow-md border border-slate-200 min-h-[400px]">
          <MapComponent
            locations={filteredLocations}
            selectedLocation={selectedLocation}
            onMarkerClick={handleOpenDetailPath}
          />
        </div>
      </div>
    </div>
  );
}

// Help map category icons helper
const CATEGORY_EMOJIS: Record<LocationCategory, string> = {
  wisata: "🏝️",
  penginapan: "🏨",
  makan: "🍲",
  coffeeshop: "☕",
  belanja: "🛍️",
  lainnya: "📍"
};

/* =========================================================================
   PUBLIC DIRECTORY: 2. DaftarTempatView (Grid layout)
   ========================================================================= */
function DaftarTempatView({ locations, currentUser }: { locations: Location[]; currentUser: User }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"semua" | LocationCategory>("semua");
  const navigate = useNavigate();

  const approvedLocations = locations.filter((l) => l.status === "approved");

  const filtered = approvedLocations.filter((loc) => {
    const matchesSearch = 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      loc.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeTab === "semua" || loc.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
        <Link to="/" className="hover:text-teal-700">Explore Pacitan Home</Link>
        <ChevronRight size={12} />
        <span className="text-slate-600">Daftar Destinasi</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-205">
        <div>
          <h2 className="font-display font-black text-slate-800 text-2xl">📋 Jelajahi Destinasi Populer</h2>
          <p className="text-slate-500 text-xs mt-1">Eksplorasi seluruh tempat terdaftar yang telah teruji validitasnya oleh Admin Utama.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
          {/* Search Input inline */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari obyek wisata..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-teal-600 focus:bg-white"
            />
          </div>

          {currentUser.role === "pengelola" && (
            <Link
              to="/dashboard/submit"
              className="bg-pacitan-primary hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 px-4 py-2 rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap"
            >
              <span>➕ Usulkan Tempat Baru</span>
            </Link>
          )}
        </div>
      </div>

      {/* Category Picker Tabs with icons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(["semua", "wisata", "penginapan", "makan", "coffeeshop", "belanja", "lainnya"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
              activeTab === tab 
                ? "bg-pacitan-primary text-white shadow-sm" 
                : "bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-50"
            }`}
          >
            <span>{tab === "semua" ? "⭐" : CATEGORY_EMOJIS[tab]}</span>
            <span>{tab === "semua" ? "Semua Lokasi" : CATEGORY_LABELS[tab]}</span>
          </button>
        ))}
      </div>

      {/* Grid rendering list */}
      {filtered.length === 0 ? (
        <div className="text-center bg-white border rounded-2xl py-16 text-slate-450 italic">
          <AlertCircle className="mx-auto text-slate-300 mb-1.5" size={32} />
          Obyek wisata belum terdaftar. Silakan usulkan kontribusi tempat baru Anda di dashboard user!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((loc) => (
            <div
              key={loc.id}
              onClick={() => navigate(`/location/${loc.id}`)}
              className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col group"
            >
              <div className="relative overflow-hidden aspect-video">
                <img
                  src={getDirectImageUrl(loc.photos?.[0])}
                  alt={loc.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <span className={`absolute top-3 left-3 bg-slate-900/80 text-white font-mono text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded backdrop-blur-xs`}>
                  {loc.category}
                </span>
                {loc.priceRange && (
                  <span className="absolute bottom-3 right-3 bg-emerald-900/90 text-[10px] text-white px-2 py-0.5 rounded font-bold backdrop-blur-xs">
                    🎟️ {loc.priceRange.split(" - ")[0]}
                  </span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider font-mono">Destinasi</span>
                    <div className="flex items-center text-amber-500 text-xs font-bold gap-0.5 bg-amber-50/60 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                      ⭐ {loc.ratingAverage.toFixed(1)} <span className="text-slate-400 text-[10px] font-normal">({loc.reviewCount})</span>
                    </div>
                  </div>
                  <h4 className="font-display font-bold text-slate-800 text-base group-hover:text-teal-700 transition-colors line-clamp-1">{loc.name}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 font-sans leading-relaxed">{loc.description}</p>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3 mt-4 truncate">
                  📍 {loc.address}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   PUBLIC DIRECTORY: 3. DetailTempatView
   ========================================================================= */
function DetailTempatView({ 
  locations, 
  reviews, 
  currentUser,
  onAddReview 
}: { 
  locations: Location[]; 
  reviews: Review[]; 
  currentUser: User;
  onAddReview: (review: Review) => void;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const loc = locations.find((l) => l.id === id);

  // Filter sibling reviews
  const currentReviews = reviews.filter((r) => r.locationId === id);

  // Share handlers & states
  const [copiedLink, setCopiedLink] = useState(false);
  const shareUrl = window.location.href;
  const shareTitle = `${loc?.name || "Destinasi Wisata"} - Explore Pacitan`;
  const shareText = loc ? `Jelajahi keindahan destinasi wisata "${loc.name}" di Pacitan! ${loc.description.slice(0, 110)}...` : "";

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        triggerToast("Destinasi wisata berhasil dibagikan!", "success");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Gagal membagikan:", err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      triggerToast("Tautan destinasi wisata disalin ke clipboard!", "success");
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleShareWA = () => {
    if (!loc) return;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n\nLihat detail selengkapnya di Explore Pacitan: ${shareUrl}`)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareTwitter = () => {
    if (!loc) return;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Jelajahi ${loc.name} di Pacitan!`)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareFB = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer");
  };

  // Review Input Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!loc) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-3" />
        <h4 className="font-display font-bold text-slate-800 text-lg">Obyek Wisata Tidak Ditemukan</h4>
        <p className="text-sm text-slate-500 mt-1 mb-6">Data lokasi destinasi pariwisata yang Anda akses tidak terdaftar dalam database Explore Pacitan.</p>
        <button onClick={() => navigate("/")} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition">
          Kembalikan ke Peta
        </button>
      </div>
    );
  }

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.id === "guest_empty" || currentUser.name === "Tamu (Belum Login)") {
      alert("Akun Tamu tidak dapat mengirim ulasan. Silakan login terlebih dahulu!");
      return;
    }
    if (!comment.trim()) {
      alert("Isi komentar ulasan tidak boleh kosong!");
      return;
    }

    const newRev: Review = {
      id: "rev_" + Date.now(),
      locationId: loc.id,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };

    onAddReview(newRev);
    setComment("");
    setSuccessMsg("Ulasan sukses diterbitkan publik!");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Back to list trigger and quick share */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-xs font-bold text-slate-600 hover:text-slate-950 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white transition hover:shadow-xs cursor-pointer"
        >
          <ArrowLeft size={14} /> Kembali
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Salin Tautan Destinasi Wisata"
          >
            {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Clipboard size={14} />}
            <span>{copiedLink ? "Tautan Tersalin!" : "Salin Link"}</span>
          </button>
          <span className={`text-xs font-mono font-bold uppercase px-3 py-1 rounded-full border ${CATEGORY_COLORS[loc.category]}`}>
            {CATEGORY_LABELS[loc.category]}
          </span>
        </div>
      </div>

      {/* Hero Header with Photos Carousel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side cover */}
        <div className="lg:col-span-8 rounded-2xl overflow-hidden shadow border border-slate-200 aspect-video relative">
          <img
            src={getDirectImageUrl(loc.photos?.[0] || "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800")}
            alt={loc.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-6 sm:p-8">
            <div className="text-white">
              <span className="text-[10px] sm:text-xs uppercase tracking-widest font-mono font-bold text-teal-400">Pacitan Wonderful Destination</span>
              <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-white mt-1.5">{loc.name}</h1>
              <div className="flex items-center gap-1 p-1 inline-flex rounded bg-slate-900/60 mt-3 border border-slate-700/50">
                <span className="text-amber-500 font-bold block text-sm">⭐ {loc.ratingAverage.toFixed(1)}</span>
                <span className="text-xs text-slate-300">({loc.reviewCount} ulasan wisatawan)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Info Block (4 Columns) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h3 className="font-display font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 flex items-center gap-1.5">
              💡 Detail Informasi
            </h3>
            
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="text-teal-600 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <span className="font-semibold block text-slate-500">Alamat Tempat</span>
                <span className="text-slate-800 font-medium">{loc.address}</span>
              </div>
            </div>

            {loc.openingHours && (
              <div className="flex items-start gap-2 text-xs">
                <Clock className="text-teal-600 flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-semibold block text-slate-500">Jam Operasional</span>
                  <span className="text-slate-800 font-medium font-mono">{loc.openingHours}</span>
                </div>
              </div>
            )}

            {loc.priceRange && (
              <div className="flex items-start gap-2 text-xs">
                <span className="text-teal-600 text-sm flex-shrink-0 mt-0.2 select-none">🎟️</span>
                <div>
                  <span className="font-semibold block text-slate-500">Biaya Tiket / Harga</span>
                  <span className="text-slate-800 font-medium font-mono">{loc.priceRange}</span>
                </div>
              </div>
            )}

            {loc.contact && (
              <div className="flex items-start gap-2 text-xs">
                <Phone className="text-teal-600 flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-semibold block text-slate-500">Nomor Kontak</span>
                  <span className="text-slate-800 font-medium font-mono">{loc.contact}</span>
                </div>
              </div>
            )}
          </div>

          {/* Social Share Block - Simplified Copy Link Only */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Share2 size={14} className="text-teal-600" /> Bagikan Wisata Ini
              </span>
              <span className="text-[10px] text-teal-700 dark:text-teal-300 font-mono font-semibold bg-teal-100/80 dark:bg-teal-950/80 px-2 py-0.5 rounded-full">
                Salin Tautan
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 px-3.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                {copiedLink ? <Check size={14} className="text-emerald-200" /> : <Clipboard size={14} />}
                <span>{copiedLink ? "Tersalin!" : "Salin Link"}</span>
              </button>
            </div>
            {copiedLink && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                ✓ Tautan destinasi wisata berhasil disalin ke clipboard!
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <div className="text-[10px] text-slate-400 font-mono">
              Koordinat Peta Explore Pacitan:
            </div>
            <div className="bg-slate-50 border p-2 rounded text-[10px] font-mono text-slate-700 flex justify-between mb-2">
              <span>L: {loc.coordinates.lat}</span>
              <span>B: {loc.coordinates.lng}</span>
            </div>

            {(currentUser.role === "pengelola" || currentUser.role === "admin") && (
              <button
                onClick={() => navigate(`/dashboard/submit?editId=${loc.id}`)}
                className="w-full bg-slate-900 hover:bg-teal-850 text-white text-xs font-bold py-2 rounded-xl border border-slate-700 hover:border-teal-700 transition flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer"
              >
                {currentUser.role === "admin" ? "📝 Edit Data Obyek (Langsung)" : "📝 Usulkan Koreksi Data"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description body content */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-display font-bold text-slate-800 text-lg border-b border-slate-150 pb-2">
          📖 Deskripsi Singkat Obyek wisata
        </h3>
        <p className="text-slate-700 text-sm leading-relaxed font-sans font-light whitespace-pre-line">
          {loc.description}
        </p>

        {/* Thumbnail photos gallery if multi-photos exist */}
        {loc.photos && loc.photos.length > 1 && (
          <div className="pt-4 border-t border-slate-100 mt-6 md:p-1">
            <span className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2.5">📸 Foto Detail Tambahan</span>
            <div className="flex flex-wrap gap-3">
              {loc.photos.slice(1).map((ph, idx) => (
                <img
                  key={idx}
                  src={getDirectImageUrl(ph)}
                  alt={`${loc.name} photo detail ${idx + 1}`}
                  className="w-28 h-20 object-cover rounded-lg border border-slate-200 hover:opacity-85 transition cursor-pointer"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Review Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Users Review List (7 Columns) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <h3 className="font-display font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-1.5">
            💬 Ulasan Pengunjung ({currentReviews.length})
          </h3>

          {currentReviews.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic text-xs">
              Belum ada ulasan untuk tempat ini. Jadilah pengulas pertama!
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {currentReviews.map((rev) => (
                <div key={rev.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm block">{rev.userName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {new Date(rev.createdAt).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    {/* Stars rating */}
                    <div className="flex text-amber-500">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} size={11} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed">
                    {rev.comment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Card: Submit Review Portal (5 Columns) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="font-display font-bold text-slate-800 text-base border-b border-slate-100 pb-3 mb-4 flex items-center gap-1.5">
            ✍️ Bagikan Pengalaman Ulasan Anda
          </h3>

          {currentUser.id === "guest_empty" || currentUser.name === "Tamu (Belum Login)" ? (
            <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-center space-y-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/60 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-300 font-bold text-lg">
                🔒
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Fitur Ulasan Terkunci (Mode Tamu)
              </h4>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Akun Tamu tidak diperkenankan memasukkan ulasan atau data ke dalam sistem. Silakan masuk / login ke akun Anda terlebih dahulu untuk memberikan ulasan &amp; rating pada destinasi ini.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Berikan Skor Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 text-amber-500 hover:scale-110 transition rounded cursor-pointer"
                    >
                      <Star size={24} fill={star <= rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                  <span className="ml-2 font-mono text-sm text-slate-500 font-bold">({rating}/5)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Tulis Ulasan Anda</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Diskusikan akses jalan, keramahan warga lokal, keindahan spot foto, kebersihan toilet lingkungan..."
                  rows={4}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>

              {successMsg && (
                <div className="bg-emerald-50 text-emerald-800 rounded p-2.5 text-xs font-semibold border border-emerald-200 animate-pulse">
                  ✓ {successMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 border text-white text-xs font-bold py-2 rounded-lg hover:bg-teal-700 hover:border-teal-600 transition shadow cursor-pointer uppercase tracking-wider"
              >
                Terbitkan Ulasan Publik
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PUBLIC DIRECTORY: 4. SharedItineraryView (Read-Only Public Shared route)
   ========================================================================= */
function SharedItineraryView({ locations, itineraries }: { locations: Location[]; itineraries: Itinerary[] }) {
  const { id } = useParams();
  const navigate = useNavigate();

  // Find itinerary in passed state or fallback to LocalDB
  const allItineraries = itineraries && itineraries.length > 0 ? itineraries : LocalDB.getItineraries();
  const iti = allItineraries.find((i) => i.id === id) || LocalDB.getItineraries().find((i) => i.id === id);

  const [activeDayTab, setActiveDayTab] = useState<number | "all">(1);
  const [copied, setCopied] = useState(false);

  if (!iti) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 max-w-xl mx-auto space-y-4">
        <XCircle size={52} className="mx-auto text-red-500 animate-pulse" />
        <h4 className="font-display font-bold text-slate-800 text-xl">Itinerari Tidak Ditemukan</h4>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Tautan berbagi unik dengan ID <code className="bg-slate-100 text-rose-600 px-1.5 py-0.5 rounded font-mono text-xs">{id}</code> tidak ditemukan atau telah dihapus oleh pembuatnya.
        </p>
        <div>
          <button onClick={() => navigate("/")} className="bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 cursor-pointer shadow-xs transition">
            Kembali ke Beranda Wisata Pacitan
          </button>
        </div>
      </div>
    );
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      triggerToast("Tautan itinerari berhasil disalin ke clipboard!", "success");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleShareWA = () => {
    const text = `Halo! Lihat rencana perjalanan wisata Pacitan "${iti.title}" (${iti.days.length} hari) yang menarik ini. Buka langsung tanpa login: ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Stats calculation
  const totalSpots = iti.days.reduce((sum, d) => sum + d.items.length, 0);
  
  // Calculate total travel distance across all days
  let totalDistanceKm = 0;
  iti.days.forEach(day => {
    day.items.forEach((item, idx) => {
      const loc = locations.find(l => l.id === item.locationId);
      const nextItem = day.items[idx + 1];
      const nextLoc = nextItem ? locations.find(l => l.id === nextItem.locationId) : null;
      if (loc && nextLoc) {
        totalDistanceKm += calculateDistance(
          loc.coordinates.lat,
          loc.coordinates.lng,
          nextLoc.coordinates.lat,
          nextLoc.coordinates.lng
        );
      }
    });
  });

  const activeDaysList = activeDayTab === "all" 
    ? iti.days 
    : iti.days.filter((d) => d.dayNumber === activeDayTab);

  const activeMapItems = activeDayTab === "all"
    ? iti.days.flatMap(d => d.items)
    : (iti.days.find(d => d.dayNumber === activeDayTab)?.items || []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Read-Only Banner */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-xl border border-teal-500/30 shrink-0">
            <Eye size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400">Mode Baca-Saja (Read-Only)</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-500/30">
                Akses Bebas Tanpa Login
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Anda sedang meninjau tautan publik rencana perjalanan yang dibagikan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            {copied ? <CheckCircle size={14} className="text-emerald-250 animate-bounce" /> : <Clipboard size={14} />}
            <span>{copied ? "Tersalin!" : "Salin Link"}</span>
          </button>
          <button
            onClick={handleShareWA}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Share2 size={14} />
            <span>WA</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-md space-y-6">
        {/* Header Metadata */}
        <div className="text-center border-b border-slate-100 pb-6 max-w-2xl mx-auto space-y-2">
          <span className="text-teal-600 font-mono text-[10px] uppercase font-bold tracking-widest block">
            Shared Travel Itinerary • Explore Pacitan
          </span>
          <h2 className="font-display font-black text-slate-800 text-2xl sm:text-3xl">{iti.title}</h2>
          <p className="text-slate-600 text-xs sm:text-sm">{iti.description}</p>
          
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-500">
            <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-full">
              👤 Pembuat: <b>{iti.createdByName}</b>
            </span>
            <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-full">
              📅 {iti.days.length} Hari Total
            </span>
            <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-full">
              📍 {totalSpots} Destinasi
            </span>
            {totalDistanceKm > 0 && (
              <span className="bg-teal-50 text-teal-800 border border-teal-200/80 font-semibold px-2.5 py-1 rounded-full">
                🚗 Est. ~{totalDistanceKm.toFixed(1)} km Perjalanan
              </span>
            )}
          </div>
        </div>

        {/* Days Tab Selector */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4 justify-center">
          <button
            onClick={() => setActiveDayTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeDayTab === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Compass size={13} />
            <span>Semua Hari ({iti.days.length})</span>
          </button>

          {iti.days.map((day) => (
            <button
              key={day.dayNumber}
              onClick={() => setActiveDayTab(day.dayNumber)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeDayTab === day.dayNumber
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Calendar size={13} />
              <span>Hari Ke-{day.dayNumber}</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                {day.items.length}
              </span>
            </button>
          ))}
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Stop Cards Timeline (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {activeDaysList.map((day) => (
              <div key={day.dayNumber} className="space-y-4">
                {activeDayTab === "all" && (
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
                    <span className="bg-teal-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                      Hari Ke-{day.dayNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      ({day.items.length} destinasi direncanakan)
                    </span>
                  </div>
                )}

                {day.items.length === 0 ? (
                  <div className="text-center py-8 px-4 text-slate-400 italic bg-slate-50 rounded-xl">
                    Belum ada agenda kunjungan untuk hari ini.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {day.items.map((item, idx) => {
                      const loc = locations.find((l) => l.id === item.locationId);
                      if (!loc) return null;

                      const nextItem = day.items[idx + 1];
                      const nextLoc = nextItem ? locations.find((l) => l.id === nextItem.locationId) : null;
                      
                      let distanceText = "";
                      let durationMin = 0;
                      let gmapsRouteUrl = "";

                      if (nextLoc) {
                        const dist = calculateDistance(
                          loc.coordinates.lat,
                          loc.coordinates.lng,
                          nextLoc.coordinates.lat,
                          nextLoc.coordinates.lng
                        );
                        distanceText = `${dist} km`;
                        durationMin = estimateDrivingDuration(dist);
                        gmapsRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${loc.coordinates.lat},${loc.coordinates.lng}&destination=${nextLoc.coordinates.lat},${nextLoc.coordinates.lng}&travelmode=driving`;
                      }

                      return (
                        <div key={idx}>
                          <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start relative pl-10 sm:pl-12 hover:shadow-sm transition">
                            {/* Stop Badge */}
                            <div className="absolute left-2.5 sm:left-3 top-4 w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center font-display font-black text-xs shadow-md border-2 border-white select-none">
                              {idx + 1}
                            </div>

                            <img
                              src={getDirectImageUrl(loc.photos?.[0])}
                              alt={loc.name}
                              className="w-full sm:w-28 h-20 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono tracking-wider font-bold uppercase ${CATEGORY_COLORS[loc.category]}`}>
                                  {loc.category}
                                </span>
                                {item.timeSlot && (
                                  <span className="text-xs text-slate-500 font-semibold font-mono flex items-center gap-1">
                                    <Clock size={11} /> {item.timeSlot}
                                  </span>
                                )}
                              </div>

                              <h4 className="font-bold text-slate-800 text-base">{loc.name}</h4>
                              <p className="text-xs text-slate-500 line-clamp-2">{loc.description}</p>

                              {loc.address && (
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-0.5">
                                  <MapPin size={11} className="text-teal-600 shrink-0" /> {loc.address}
                                </p>
                              )}
                              
                              {item.note && (
                                <div className="mt-2 text-xs text-slate-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg font-medium inline-block">
                                  📝 <b>Catatan:</b> {item.note}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Drive Connection to Next Stop */}
                          {nextLoc && (
                            <div className="my-2.5 ml-6 pl-6 border-l-2 border-dashed border-teal-500/40 relative py-1.5">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-500">
                                <div className="flex items-center gap-2">
                                  <div className="bg-white border border-slate-200 rounded-full p-1.5 flex items-center justify-center text-teal-600 shadow-xs">
                                    <Car size={12} />
                                  </div>
                                  <span className="font-medium">
                                    Ke Pemberhentian {idx + 2}: berkendara <b>~{durationMin} mnt</b> ({distanceText})
                                  </span>
                                </div>
                                <a
                                  href={gmapsRouteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-600 hover:underline font-bold text-[10px] flex items-center gap-0.5 sm:ml-auto border border-teal-200 px-2.5 py-1 rounded-lg bg-white shadow-xs cursor-pointer"
                                >
                                  Navigasi Peta <ArrowRight size={10} />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: Map View (5 Cols) */}
          <div className="lg:col-span-5 h-full lg:sticky lg:top-24">
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-2 shadow-xs">
              <ItineraryMap
                items={activeMapItems}
                locations={locations}
                activeDay={typeof activeDayTab === "number" ? activeDayTab : 1}
              />
            </div>
          </div>
        </div>

        {/* Footer Banner CTA */}
        <div className="border-t border-slate-100 pt-6 text-center space-y-2 bg-slate-50/60 p-6 rounded-xl border border-slate-200/80">
          <h4 className="font-display font-bold text-slate-800 text-base">Inspirasi Liburan di Pacitan?</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Rancang itinerari kustom liburanmu sendiri secara fleksibel dengan optimasi rute peta otomatis Explore Pacitan.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate("/itinerary")}
              className="bg-teal-600 text-white hover:bg-teal-700 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-md cursor-pointer inline-flex items-center gap-2"
            >
              <Compass size={15} /> Buat Itinerari Saya Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   USER BACKEND PANEL: 5. DashboardUserView (List location submission & managed locations)
   ========================================================================= */
function DashboardUserView({ 
  submissions, 
  locations, 
  currentUser,
  itineraries = [],
  reviews = [],
  tourPackages = []
}: { 
  submissions: LocationSubmission[]; 
  locations: Location[]; 
  currentUser: User;
  itineraries?: Itinerary[];
  reviews?: Review[];
  tourPackages?: TourPackage[];
}) {
  const navigate = useNavigate();

  // Submissions submitted by current logged in session
  const userSubmissions = submissions.filter((s) => s.submittedBy === currentUser.id);

  // Managed locations by local business operators (pengelolas)
  const managedLocs = locations.filter((l) => {
    if (currentUser.role === "admin") return l.status === "approved";
    return currentUser.managedLocations?.includes(l.id) && l.status === "approved";
  });

  // User's own itineraries and reviews
  const myItineraries = itineraries.filter(i => i.createdBy === currentUser.id);
  const myReviews = reviews.filter(r => r.userId === currentUser.id);

  return (
    <div className="space-y-6">
      {/* Welcome Board */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-teal-650 font-mono text-[10px] uppercase font-bold tracking-widest">Explore Pacitan User Console</span>
          <h2 className="font-display font-black text-slate-800 text-2xl sm:text-3xl mt-1">🏷️ Dashboard Saya</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            {currentUser.role === "user" ? (
              <>Halo, <b>{currentUser.name}</b>. Selamat datang di portal wisatawan Explore Pacitan. Kelola rencana perjalanan dan ulasan Anda di sini.</>
            ) : (
              <>Halo, <b>{currentUser.name}</b>. Kelola pendaftaran obyek wisata binaan serta usulan moderasi kontribusi di Pacitan.</>
            )}
          </p>
        </div>

        {(currentUser.role === "pengelola" || currentUser.role === "admin") && (
          <button
            onClick={() => navigate("/dashboard/submit")}
            className="bg-pacitan-primary text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-teal-800 transition shadow flex items-center gap-1 cursor-pointer flex-shrink-0 uppercase"
          >
            + Usulkan Tempat Baru
          </button>
        )}
      </div>

      {/* Grid panels */}
      <div className="space-y-6">
        {/* For Pengelola & Admin: Show Usulan Lokasi List */}
        {currentUser.role !== "user" && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base">🔖 Daftar Usulan Kontribusi Lokasi</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Semua data usulan penambahan/perubahan tempat yang menunggu keputusan validasi Admin Utama.</p>
                </div>
                <span className="text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-1 rounded-full font-bold font-mono">
                  Total Usulan: {userSubmissions.length} draf
                </span>
              </div>

              <div className="divide-y divide-slate-100 p-2 sm:p-4">
                {userSubmissions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic text-xs">
                    Belum pernah berkontribusi usulan lokasi di Explore Pacitan. Ayolah mari, dukung promosi pariwisata daerah Anda!
                  </div>
                ) : (
                  userSubmissions.map((sub) => {
                    return (
                      <div key={sub.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex gap-3.5 items-start">
                          <img
                            src={getDirectImageUrl(sub.payload.photos?.[0] || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=150')}
                            alt={sub.payload.name}
                            className="w-16 h-16 rounded-lg object-cover border border-slate-205"
                            referrerPolicy="no-referrer"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-850 text-base">{sub.payload.name}</h4>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-mono tracking-wider font-bold uppercase ${CATEGORY_COLORS[sub.payload.category]}`}>
                                {sub.payload.category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                [{sub.submissionType.toUpperCase()} SUBMISSION]
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">{sub.payload.description}</p>
                            <div className="text-[11px] text-slate-400">
                              Diajukan: {new Date(sub.createdAt).toLocaleDateString("id-ID")} • Status akhir diubah: {new Date(sub.updatedAt).toLocaleDateString("id-ID")}
                            </div>

                            {/* Admin comment section if revision requested or rejected */}
                            {(sub.status === "revision_requested" || sub.status === "rejected") && sub.reviewNotes && (
                              <div className="mt-3.5 bg-purple-50/50 border border-purple-200/60 p-3 rounded-lg text-xs">
                                <span className="font-bold text-purple-900 block flex items-center gap-1">
                                  💬 Catatan Tulis & Revisi Admin Utama ({sub.reviewedByName}):
                                </span>
                                <span className="text-purple-950 font-sans italic block mt-0.5">{sub.reviewNotes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-start sm:items-end gap-2 shrink-0">
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase font-mono tracking-wider rounded-md border py-0.5 ${
                            sub.status === "approved" 
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                              : sub.status === "pending"
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : sub.status === "revision_requested"
                              ? "bg-purple-100 text-purple-800 border-purple-300 animate-pulse"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}>
                            {sub.status === "revision_requested" ? "REVISI DIWajibKAN" : sub.status}
                          </span>

                          {/* Edit option ONLY if revision requested */}
                          {sub.status === "revision_requested" && (
                            <button
                              onClick={() => navigate(`/dashboard/edit/${sub.id}`)}
                              className="bg-purple-600 border border-purple-500 text-white rounded text-[11px] font-bold px-3 py-1 hover:bg-purple-700 transition flex items-center gap-1 shadow-sm cursor-pointer mt-1"
                            >
                              <Edit3 size={11} /> Lakukan Revisi Data
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Managed Approved Locations */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base">🏪 Kelola Tempat Usaha Saya</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Daftar lokasi aktif binaan yang sudah lolos kurasi dan live di peta publik.</p>
                </div>
                <span className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full font-bold font-mono">
                  Jumlah Tempat: {managedLocs.length}
                </span>
              </div>

              <div className="p-3 sm:p-4 divide-y divide-slate-150/40">
                {managedLocs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 italic text-xs">
                    Belum ada tempat usaha terdaftar atas nama pengelola Anda. Silakan usulkan kontribusi baru.
                  </div>
                ) : (
                  managedLocs.map((loc) => (
                    <div key={loc.id} className="p-3 sm:p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="flex gap-3 items-center">
                        <img src={getDirectImageUrl(loc.photos?.[0])} alt={loc.name} className="w-14 h-14 object-cover rounded-lg border border-slate-200/60" referrerPolicy="no-referrer" />
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{loc.name}</h4>
                          <p className="text-xs text-slate-500 font-mono uppercase text-[9px]">{loc.address}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-450 border border-slate-200 px-2.5 py-0.5 rounded bg-slate-50 font-mono">
                          LIVE DI PETA 🏝️
                        </span>
                        <button
                          onClick={() => navigate(`/dashboard/submit?editId=${loc.id}`)}
                          className="bg-slate-900 shadow-xs border border-slate-700 font-bold hover:bg-teal-700 hover:border-teal-650 text-white rounded text-[11px] px-3 py-1 cursor-pointer transition uppercase"
                        >
                          Usulkan Update Data
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Show Itineraries & Reviews for EVERYONE (User, Pengelola, Admin) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Itineraries */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">🗺️ Rencana Perjalanan Saya</h3>
                <p className="text-slate-400 text-xs">Itinerari wisata Pacitan yang telah Anda simpan.</p>
              </div>
              <span className="text-xs bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full font-bold font-mono border border-teal-200">
                {myItineraries.length} Rencana
              </span>
            </div>
            <div className="space-y-3">
              {myItineraries.length === 0 ? (
                <p className="text-slate-400 text-xs italic text-center py-6">
                  Belum ada rencana perjalanan tersimpan. Mulai susun perjalanan liburan Anda di Pacitan!
                </p>
              ) : (
                myItineraries.slice(0, 5).map(iti => (
                  <div key={iti.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{iti.title}</h4>
                      <p className="text-xs text-slate-500 font-mono">{iti.days.length} Hari Perjalanan • {iti.days.reduce((acc, d) => acc + d.items.length, 0)} Lokasi</p>
                    </div>
                    <button
                      onClick={() => navigate("/itinerary")}
                      className="text-xs text-teal-700 font-bold hover:underline cursor-pointer"
                    >
                      Buka
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={() => navigate("/itinerary")}
                className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-teal-700 transition cursor-pointer"
              >
                Buat / Kelola Itinerari →
              </button>
            </div>
          </div>

          {/* User Reviews */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">💬 Ulasan & Rating Saya</h3>
                <p className="text-slate-400 text-xs">Ulasan publik yang telah Anda terbitkan.</p>
              </div>
              <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full font-bold font-mono border border-amber-200">
                {myReviews.length} Ulasan
              </span>
            </div>
            <div className="space-y-3">
              {myReviews.length === 0 ? (
                <p className="text-slate-400 text-xs italic text-center py-6">
                  Belum ada ulasan yang Anda terbitkan. Kunjungi halaman detail destinasi untuk memberikan penilaian!
                </p>
              ) : (
                myReviews.slice(0, 5).map(rev => (
                  <div key={rev.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">Rating: ⭐ {rev.rating}/5</span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(rev.createdAt).toLocaleDateString("id-ID")}</span>
                    </div>
                    <p className="text-xs text-slate-600 italic line-clamp-2">"{rev.comment}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Paket Wisata Section (For Everyone, Custom Views per Role) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
            <div>
              <h3 className="font-display font-bold text-slate-800 text-base">🎒 Layanan Paket Wisata Pacitan</h3>
              <p className="text-slate-400 text-xs">
                {currentUser.role === "user" 
                  ? "Rekomendasi paket wisata unggulan terpercaya keliling Pacitan."
                  : "Kelola daftar penawaran paket wisata yang dipublikasikan atas nama Anda."
                }
              </p>
            </div>
            {currentUser.role !== "user" ? (
              <button
                onClick={() => navigate("/packages")}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                + Kelola & Tambah Paket
              </button>
            ) : (
              <button
                onClick={() => navigate("/packages")}
                className="text-xs text-teal-700 font-bold hover:underline cursor-pointer"
              >
                Lihat Semua Paket Wisata →
              </button>
            )}
          </div>

          {/* List or grid of packages */}
          {(() => {
            const displayPkgs = currentUser.role === "user" 
              ? tourPackages.slice(0, 3) 
              : currentUser.role === "admin"
                ? tourPackages
                : tourPackages.filter(p => p.createdBy === currentUser.id);

            if (displayPkgs.length === 0) {
              return (
                <div className="text-center py-8 text-slate-400 italic text-xs">
                  {currentUser.role === "user" 
                    ? "Belum ada paket wisata yang tersedia saat ini." 
                    : "Belum ada paket wisata buatan Anda. Silakan tambah paket wisata baru di halaman Paket Wisata."
                  }
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {displayPkgs.slice(0, 3).map((pkg) => (
                  <div key={pkg.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="h-24 w-full bg-slate-200 rounded-lg overflow-hidden">
                        <img src={pkg.photo} alt={pkg.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-teal-600 uppercase font-mono">{pkg.provider}</span>
                        <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{pkg.title}</h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{pkg.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 flex-wrap gap-1">
                      <span className="font-bold text-slate-800 text-[11px] font-mono">{pkg.price}</span>
                      {currentUser.role === "user" ? (
                        <a
                          href={pkg.contactWhatsApp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 text-white rounded px-2.5 py-1 text-[10px] font-bold hover:bg-emerald-700 transition flex items-center gap-1 shrink-0"
                        >
                          Tanya Agen 💬
                        </a>
                      ) : (
                        <button
                          onClick={() => navigate("/packages")}
                          className="bg-slate-900 text-white rounded px-2.5 py-1 text-[10px] font-bold hover:bg-teal-700 transition shrink-0"
                        >
                          Kelola ⚙️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   USER BACKEND PANEL: 6. SubmitWisataView (Create or revise submission)
   ========================================================================= */
function SubmitWisataView({ 
  currentUser, 
  locations,
  submissions,
  onSubmit 
}: { 
  currentUser: User; 
  locations: Location[];
  submissions?: LocationSubmission[];
  onSubmit: (sub: LocationSubmission) => void;
}) {
  const navigate = useNavigate();
  const { id } = useParams(); // submissionId for revise revision_requested
  
  // Custom query parameter editId for submitting updates to original active locations
  const queryParams = new URLSearchParams(window.location.hash.split("?")[1]);
  const editOriginalLocationId = queryParams.get("editId");

  const isRevisionFlow = !!id;
  const isUpdateFlow = !!editOriginalLocationId;

  const draftKey = `sipp_draft_submit_wisata_${isRevisionFlow ? 'rev_' + id : isUpdateFlow ? 'edit_' + editOriginalLocationId : 'new'}`;

  // Retrieve existing targets
  const targetRevision = isRevisionFlow ? submissions?.find(s => s.id === id) : null;
  const targetOriginalLocation = isUpdateFlow ? locations.find(l => l.id === editOriginalLocationId) : null;

  // Form states pre-filled smartly
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LocationCategory>("wisata");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(-8.21);
  const [lng, setLng] = useState(111.03);
  const [photoInput, setPhotoInput] = useState("");
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);
  const [openingHours, setOpeningHours] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [contact, setContact] = useState("");

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isRestoredFromDraft, setIsRestoredFromDraft] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Hook for pre-filling original values or restoring auto-saved draft
  useEffect(() => {
    const savedDraftRaw = localStorage.getItem(draftKey);
    let hasRestoredDraft = false;

    if (savedDraftRaw) {
      try {
        const draft = JSON.parse(savedDraftRaw);
        if (draft && typeof draft === "object" && (draft.name !== undefined || draft.description !== undefined)) {
          setName(draft.name || "");
          setCategory(draft.category || "wisata");
          setDescription(draft.description || "");
          setAddress(draft.address || "");
          setLat(typeof draft.lat === "number" ? draft.lat : -8.21);
          setLng(typeof draft.lng === "number" ? draft.lng : 111.03);
          setPhotoInput(draft.photoInput || "");
          setAdditionalPhotos(draft.additionalPhotos || []);
          setOpeningHours(draft.openingHours || "");
          setPriceRange(draft.priceRange || "");
          setContact(draft.contact || "");
          if (draft.savedAt) {
            setLastSaved(draft.savedAt);
          }
          setIsRestoredFromDraft(true);
          hasRestoredDraft = true;
        }
      } catch (err) {
        console.warn("Gagal membaca draft otomatis dari localStorage:", err);
      }
    }

    if (!hasRestoredDraft) {
      setIsRestoredFromDraft(false);
      setLastSaved(null);
      if (isRevisionFlow && targetRevision) {
        setName(targetRevision.payload.name || "");
        setCategory(targetRevision.payload.category || "wisata");
        setDescription(targetRevision.payload.description || "");
        setAddress(targetRevision.payload.address || "");
        setLat(targetRevision.payload.coordinates?.lat ?? -8.21);
        setLng(targetRevision.payload.coordinates?.lng ?? 111.03);
        const revisionPhotos = targetRevision.payload.photos || [];
        setPhotoInput(revisionPhotos[0] || "");
        setAdditionalPhotos(revisionPhotos.slice(1));
        setOpeningHours(targetRevision.payload.openingHours || "");
        setPriceRange(targetRevision.payload.priceRange || "");
        setContact(targetRevision.payload.contact || "");
      } else if (isUpdateFlow && targetOriginalLocation) {
        setName(targetOriginalLocation.name || "");
        setCategory(targetOriginalLocation.category || "wisata");
        setDescription(targetOriginalLocation.description || "");
        setAddress(targetOriginalLocation.address || "");
        setLat(targetOriginalLocation.coordinates?.lat ?? -8.21);
        setLng(targetOriginalLocation.coordinates?.lng ?? 111.03);
        const originalPhotos = targetOriginalLocation.photos || [];
        setPhotoInput(originalPhotos[0] || "");
        setAdditionalPhotos(originalPhotos.slice(1));
        setOpeningHours(targetOriginalLocation.openingHours || "");
        setPriceRange(targetOriginalLocation.priceRange || "");
        setContact(targetOriginalLocation.contact || "");
      } else {
        setName("");
        setCategory("wisata");
        setDescription("");
        setAddress("");
        setLat(-8.21);
        setLng(111.03);
        setPhotoInput("https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800");
        setAdditionalPhotos([]);
        setOpeningHours("");
        setPriceRange("");
        setContact("");
      }
    }

    setIsInitialized(true);
  }, [draftKey, isRevisionFlow, targetRevision, isUpdateFlow, targetOriginalLocation]);

  // Auto-save form input values to localStorage whenever changes occur
  useEffect(() => {
    if (!isInitialized) return;

    const timeString = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const draftObj = {
      name,
      category,
      description,
      address,
      lat,
      lng,
      photoInput,
      additionalPhotos,
      openingHours,
      priceRange,
      contact,
      savedAt: timeString
    };

    localStorage.setItem(draftKey, JSON.stringify(draftObj));
    setLastSaved(timeString);
  }, [
    isInitialized,
    draftKey,
    name,
    category,
    description,
    address,
    lat,
    lng,
    photoInput,
    additionalPhotos,
    openingHours,
    priceRange,
    contact
  ]);

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftKey);
    setIsRestoredFromDraft(false);
    setLastSaved(null);

    if (isRevisionFlow && targetRevision) {
      setName(targetRevision.payload.name || "");
      setCategory(targetRevision.payload.category || "wisata");
      setDescription(targetRevision.payload.description || "");
      setAddress(targetRevision.payload.address || "");
      setLat(targetRevision.payload.coordinates?.lat ?? -8.21);
      setLng(targetRevision.payload.coordinates?.lng ?? 111.03);
      const revisionPhotos = targetRevision.payload.photos || [];
      setPhotoInput(revisionPhotos[0] || "");
      setAdditionalPhotos(revisionPhotos.slice(1));
      setOpeningHours(targetRevision.payload.openingHours || "");
      setPriceRange(targetRevision.payload.priceRange || "");
      setContact(targetRevision.payload.contact || "");
    } else if (isUpdateFlow && targetOriginalLocation) {
      setName(targetOriginalLocation.name || "");
      setCategory(targetOriginalLocation.category || "wisata");
      setDescription(targetOriginalLocation.description || "");
      setAddress(targetOriginalLocation.address || "");
      setLat(targetOriginalLocation.coordinates?.lat ?? -8.21);
      setLng(targetOriginalLocation.coordinates?.lng ?? 111.03);
      const originalPhotos = targetOriginalLocation.photos || [];
      setPhotoInput(originalPhotos[0] || "");
      setAdditionalPhotos(originalPhotos.slice(1));
      setOpeningHours(targetOriginalLocation.openingHours || "");
      setPriceRange(targetOriginalLocation.priceRange || "");
      setContact(targetOriginalLocation.contact || "");
    } else {
      setName("");
      setCategory("wisata");
      setDescription("");
      setAddress("");
      setLat(-8.21);
      setLng(111.03);
      setPhotoInput("https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800");
      setAdditionalPhotos([]);
      setOpeningHours("");
      setPriceRange("");
      setContact("");
    }

    triggerToast("Draf berhasil dibuang dan formulir di-reset", "info");
  };

  // Adjust placeholder image dynamically based on selected category to keep UI beautiful
  const handleCategoryChange = (cat: LocationCategory) => {
    setCategory(cat);
    
    // Assign typical pristine Unsplash photos depending on option
    if (cat === "wisata") setPhotoInput("https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800");
    if (cat === "penginapan") setPhotoInput("https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800");
    if (cat === "makan") setPhotoInput("https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800");
    if (cat === "coffeeshop") setPhotoInput("https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800");
    if (cat === "belanja") setPhotoInput("https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800");
    if (cat === "lainnya") setPhotoInput("https://images.unsplash.com/photo-1524168233155-ac707204fc19?q=80&w=800");
  };

  // Capture coordinate selection from the map click
  const handleSetCoors = (latitude: number, longitude: number) => {
    setLat(latitude);
    setLng(longitude);
  };

  const [photoMode, setPhotoMode] = useState<"upload" | "url" | "gallery">("upload");
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const handlePhotoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerToast("File harus berupa gambar!", "error");
      return;
    }
    try {
      triggerToast("Mengompresi gambar...", "info");
      const compressedUrl = await compressImage(file);
      setPhotoInput(compressedUrl);
      triggerToast("Foto dimuat dan dikompresi! Klik 'Crop Foto (16:9)' jika ingin memotong gambar.", "success");
    } catch (err) {
      console.error(err);
      triggerToast("Gagal memproses gambar", "error");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoFile(file);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handlePhotoFile(file);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentUser.id === "guest_empty" || currentUser.name === "Tamu (Belum Login)") {
      alert("Akun Tamu tidak diperkenankan mengirimkan usulan atau perubahan data tempat.");
      return;
    }

    if (!name.trim() || !description.trim() || !address.trim() || !photoInput.trim()) {
      alert("Harap lengkapi semua kolom bertanda bintang wajib (*)");
      return;
    }

    if (name.trim().length < 5) {
      alert("Nama tempat terlalu singkat! Harap masukkan nama destinasi yang valid (minimal 5 karakter).");
      return;
    }

    if (description.trim().length < 15) {
      alert("Deskripsi tempat kurang detail! Harap tulis deskripsi minimal 15 karakter agar akurat bagi calon wisatawan.");
      return;
    }

    if (!address.toLowerCase().includes("pacitan")) {
      alert("Alamat harus menyertakan Kabupaten/Kota Pacitan untuk memastikan validitas administratif.");
      return;
    }

    if (lat === -8.21 && lng === 111.03) {
      alert("Anda belum menentukan posisi geospasial lokasi baru ini di peta. Silakan geser pin atau klik area peta di panel sebelah kanan untuk mendapatkan koordinat presisi!");
      return;
    }

    // Coordinates boundary check for Kabupaten Pacitan:
    // Pacitan is strictly located within Lat (-8.45 to -7.85) and Lng (110.85 to 111.45)
    const isWithinPacitan = lat >= -8.45 && lat <= -7.85 && lng >= 110.85 && lng <= 111.45;
    if (!isWithinPacitan) {
      if (!confirm("Titik koordinat yang Anda tentukan berada di luar batas geospasial resmi Kabupaten Pacitan (Jawa Timur). Apakah Anda yakin data ini akurat?")) {
        return;
      }
    }

    const payload = {
      name: name.trim(),
      category,
      description: description.trim(),
      coordinates: { lat, lng },
      address: address.trim(),
      photos: [
        getDirectImageUrl(photoInput), 
        ...additionalPhotos.map(getDirectImageUrl).filter(Boolean)
      ],
      openingHours: openingHours || undefined,
      priceRange: priceRange || undefined,
      contact: contact || undefined
    };

    let subId = "sub_" + Date.now();
    let oldLocationId: string | null = null;
    let type: "create" | "update" = "create";

    if (isRevisionFlow && targetRevision) {
      subId = targetRevision.id;
      oldLocationId = targetRevision.targetLocationId;
      type = targetRevision.submissionType;
    } else if (isUpdateFlow && targetOriginalLocation) {
      oldLocationId = targetOriginalLocation.id;
      type = "update";
    }

    const submission: LocationSubmission = {
      id: subId,
      targetLocationId: oldLocationId,
      submissionType: type,
      payload,
      submittedBy: currentUser.id,
      submittedByName: currentUser.name,
      submitterRole: currentUser.role,
      status: "pending", // Re-submitted is set back to pending awaiting admin review
      reviewedBy: null,
      reviewedByName: null,
      reviewNotes: null,
      reviewedAt: null,
      createdAt: isRevisionFlow && targetRevision ? targetRevision.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.removeItem(draftKey);
    onSubmit(submission);
    if (currentUser.role === "admin") {
      alert(`Data tempat "${name.trim()}" berhasil disimpan langsung oleh Administrator!`);
      navigate("/admin/locations");
    } else {
      alert(`Usulan ${type === "create" ? "Pendaftaran Baru" : "Pembaharuan"} sukses diajukan ke Antrean Validasi Admin Utama! Status awal: pending.`);
      navigate("/dashboard");
    }
  };

  if (currentUser.id === "guest_empty" || currentUser.name === "Tamu (Belum Login)") {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 text-2xl font-bold">
          🔒
        </div>
        <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg">
          Akses Terbatas untuk Akun Tamu
        </h3>
        <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
          Sistem tidak menerima pengajuan tempat wisata baru atau perubahan data dari Akun Tamu. Silakan masuk atau mendaftar akun terlebih dahulu untuk berkontribusi.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        {currentUser.role === "admin" ? (
          <>
            <Link to="/admin" className="hover:text-teal-700">Dashboard Admin</Link>
            <ChevronRight size={12} />
            <Link to="/admin/locations" className="hover:text-teal-700">Master Data Lokasi</Link>
          </>
        ) : (
          <Link to="/dashboard" className="hover:text-teal-700">Dashboard</Link>
        )}
        <ChevronRight size={12} />
        <span>Submisi Lokasi</span>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="font-display font-black text-slate-800 text-xl">
          {isRevisionFlow 
            ? "🔄 Revisi Pengajuan Kontribusi Obyek Wisata" 
            : isUpdateFlow 
            ? (currentUser.role === "admin" ? `📝 Sunting Data Obyek: ${targetOriginalLocation?.name}` : `🔄 Usulkan Perubahan Data untuk: ${targetOriginalLocation?.name}`)
            : (currentUser.role === "admin" ? "🏝️ Tambah Destinasi Baru (Langsung)" : "🏝️ Usulkan Pendaftaran Destinasi Baru")
          }
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          {isRevisionFlow && targetRevision?.reviewNotes
            ? "Mohon sesuaikan pengisian formulir dengan merujuk pesan revisi Admin Utama di bawah ini."
            : "Formulir kontribusi publik Explore Pacitan. Usulan Anda akan dievaluasi kekuratannya oleh Admin Utama."
          }
        </p>

        {isRevisionFlow && targetRevision?.reviewNotes && (
          <div className="mt-3.5 bg-purple-50 text-purple-900 border border-purple-200 p-3 rounded-xl text-xs font-sans">
            <strong>⚠️ Pesan Koreksi Admin Utama:</strong>
            <p className="italic mt-1 text-purple-950 font-medium font-sans">"{targetRevision.reviewNotes}"</p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg font-medium border border-emerald-200/80">
            <Save size={13} className="text-emerald-600 animate-pulse" />
            <span>Otomatis menyimpan draft {lastSaved ? `(Terakhir tersimpan pukul ${lastSaved})` : "ke memori lokal"}</span>
          </div>
          {isRestoredFromDraft ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md font-medium">
                ⚠️ Input dipulihkan dari draft otomatis
              </span>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="text-xs text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RotateCcw size={12} /> Discard Draf
              </button>
            </div>
          ) : lastSaved ? (
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 font-medium cursor-pointer transition"
            >
              <RotateCcw size={12} /> Reset / Hapus Draf
            </button>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form controls (7 columns) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 space-y-4 shadow-sm">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-450 border-b pb-2 mb-2 block">
            📋 Detail Isian Tempat
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-0.5">Nama Lokasi / Tempat *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Pantai Buyutan Indah"
                className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-0.5">Kategori Utama *</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as LocationCategory)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-500 font-medium"
              >
                {(Object.keys(CATEGORY_LABELS) as LocationCategory[]).map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-0.5">Deskripsi Lengkap Obyek / Usaha *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan daya tarik, keasrian tempat, sejarah penemuan, serta keunikan geografis..."
              rows={4}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-0.5">Alamat Wilayah Administrasi Lengkap *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Misal: Desa Sendang, Kecamatan Donorojo, Kabupaten Pacitan"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
              required
            />
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-1">📸 Foto Pendukung Tempat *</label>
            
            {/* Tab Header Selector */}
            <div className="flex border-b border-slate-200 gap-1 mb-3">
              <button
                type="button"
                onClick={() => setPhotoMode("upload")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition duration-200 cursor-pointer ${
                  photoMode === "upload" 
                    ? "border-teal-600 text-teal-700" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                📁 Unggah File Gambar
              </button>
              <button
                type="button"
                onClick={() => setPhotoMode("url")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition duration-200 cursor-pointer ${
                  photoMode === "url" 
                    ? "border-teal-600 text-teal-700" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                🔗 Tautan URL Foto
              </button>
              <button
                type="button"
                onClick={() => setPhotoMode("gallery")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition duration-200 cursor-pointer ${
                  photoMode === "gallery" 
                    ? "border-teal-600 text-teal-700" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                🖼️ Galeri Pilihan Cepat
              </button>
            </div>

            {/* TAB CONTENT: UPLOAD FILE */}
            {photoMode === "upload" && (
              <div className="space-y-2">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-xl p-5 text-center cursor-pointer bg-slate-50 hover:bg-teal-50/10 transition group relative"
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileSelect} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  <Upload className="mx-auto text-slate-400 group-hover:text-teal-600 mb-2 transition" size={24} />
                  <p className="text-xs font-bold text-slate-700">Tarik & Lepas gambar di sini, atau <span className="text-teal-600 group-hover:underline">Pilih File</span></p>
                  <p className="text-[10px] text-slate-400 mt-1">Mendukung file JPG, JPEG, PNG, WebP (Maks. 5MB)</p>
                </div>
                {photoInput && photoInput.startsWith("data:") && (
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 p-2 rounded-lg text-xs">
                    <span className="text-emerald-800 dark:text-emerald-400 font-medium truncate max-w-[280px]">✅ Gambar lokal siap diunggah & disimpan</span>
                    <button 
                      type="button" 
                      onClick={() => setPhotoInput("")} 
                      className="text-rose-500 hover:text-rose-700 font-bold font-mono text-[10px] cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: URL LINK */}
            {photoMode === "url" && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-medium">Masukkan tautan URL gambar apa pun dari internet (Unsplash, Imgur, blog, dll.):</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    placeholder="https://contoh-link.com/foto-wisata.jpg"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono"
                    required={photoMode === "url"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoInput("https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800");
                      triggerToast("Menggunakan tautan default Pantai Klayar", "info");
                    }}
                    className="px-3 py-2 border text-xs font-bold rounded-lg hover:bg-slate-50 flex items-center gap-1 flex-shrink-0 text-slate-600 cursor-pointer"
                    title="Gunakan Default"
                  >
                    Default
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: GALLERY PRESETS */}
            {photoMode === "gallery" && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-medium">Klik pada gambar premium dari koleksi ikonik Pacitan untuk menerapkannya secara langsung:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { name: "Pantai Klayar", url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800" },
                    { name: "Goa Gong", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800" },
                    { name: "Penginapan / Resort", url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800" },
                    { name: "Kuliner Khas", url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800" },
                    { name: "Warkop / Cafe Pacitan", url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800" },
                    { name: "Belanja / Oleh-oleh", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800" }
                  ].map((preset, i) => {
                    const isSelected = photoInput === preset.url;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPhotoInput(preset.url);
                          triggerToast(`Menggunakan preset: ${preset.name}`, "success");
                        }}
                        className={`group relative rounded-lg overflow-hidden border-2 text-left h-16 transition cursor-pointer ${
                          isSelected ? "border-teal-500 shadow-md ring-2 ring-teal-500/20" : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/30 transition flex items-end p-1">
                          <span className="text-[9px] text-white font-bold leading-tight line-clamp-1">{preset.name}</span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-teal-500 text-white rounded-full p-0.5 shadow-sm">
                            <Check size={10} className="stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Crop utility row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Rasio 16:9 memastikan tampilan poster konsisten & rapi di seluruh katalog Explore Pacitan.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!photoInput) {
                    triggerToast("Pilih atau unggah foto terlebih dahulu sebelum memotong!", "error");
                    return;
                  }
                  setIsCropperOpen(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <Crop size={14} /> Potong / Crop Foto (16:9)
              </button>
            </div>
          </div>

          {/* Foto Detail Tambahan (Optional) */}
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder">
                🖼️ Foto Detail Tambahan (Opsional - Maks. 5 Foto)
              </label>
            </div>
            
            {/* Grid of added additional photos */}
            {additionalPhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {additionalPhotos.map((photo, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border border-slate-200 h-20 shadow-xs">
                    <img 
                      src={getDirectImageUrl(photo)} 
                      alt={`Detail ${index + 1}`} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAdditionalPhotos(prev => prev.filter((_, i) => i !== index));
                        triggerToast("Foto detail dihapus", "info");
                      }}
                      className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition duration-150 flex items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                    >
                      <Trash2 size={14} className="text-red-400" />
                      <span>Hapus</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Controls to add a new additional photo */}
            {additionalPhotos.length < 5 ? (
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A: URL */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opsi 1: Tambah via URL</span>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        id="additional-url-input"
                        placeholder="https://contoh.com/foto.jpg"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-500 font-mono"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const input = document.getElementById("additional-url-input") as HTMLInputElement;
                            if (input && input.value.trim()) {
                              setAdditionalPhotos(prev => [...prev, input.value.trim()]);
                              triggerToast("Foto detail ditambahkan", "success");
                              input.value = "";
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("additional-url-input") as HTMLInputElement;
                          if (input && input.value.trim()) {
                            setAdditionalPhotos(prev => [...prev, input.value.trim()]);
                            triggerToast("Foto detail ditambahkan", "success");
                            input.value = "";
                          } else {
                            triggerToast("Masukkan URL foto terlebih dahulu", "error");
                          }
                        }}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>

                  {/* Option B: Local file */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opsi 2: Unggah File Lokal</span>
                    <div className="relative border border-dashed border-slate-300 hover:border-teal-500 bg-white rounded-lg p-1.5 text-center cursor-pointer transition flex items-center justify-center gap-1.5 h-[34px]">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              triggerToast("Mengompresi foto detail...", "info");
                              const compressedUrl = await compressImage(file);
                              setAdditionalPhotos(prev => [...prev, compressedUrl]);
                              triggerToast("Foto detail berhasil diunggah dan dikompresi", "success");
                            } catch (err) {
                              console.error(err);
                              triggerToast("Gagal memproses foto detail", "error");
                            }
                          }
                        }} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                      <Upload size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">Pilih File Foto</span>
                    </div>
                  </div>
                </div>

                {/* Preset quick buttons */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opsi 3: Gunakan Galeri Cepat Pacitan</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: "+ Pantai", url: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800" },
                      { name: "+ Goa", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800" },
                      { name: "+ Hotel/Villa", url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800" },
                      { name: "+ Makanan", url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800" },
                      { name: "+ Warkop", url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800" },
                      { name: "+ Oleh-oleh", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800" }
                    ].map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setAdditionalPhotos(prev => [...prev, preset.url]);
                          triggerToast(`Menambahkan preset ${preset.name.replace("+ ", "")}`, "success");
                        }}
                        className="px-2.5 py-1 text-[10px] font-medium rounded-full border border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 text-slate-600 hover:text-teal-700 bg-white cursor-pointer transition"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60">
                ⚠️ Batas maksimal 5 foto detail tambahan telah tercapai. Hapus salah satu foto jika ingin menambahkan foto baru.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-0.5">Sesi Jam Kerja (Opsional)</label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="Contoh: 08:00 - 18:00 WIB"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-0.5">Katalog Harga / Tiket (Opsional)</label>
              <input
                type="text"
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                placeholder="Contoh: Rp 5.000 - Rp 10.000"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wilder mb-0.5">Kontak Pengelola (Opsional)</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Contoh: +62-8123-4455"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Right Map Coordinator picker (5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Map positioning container */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-450 border-b pb-2 mb-1 block">
              📍 Koordinat Peta Interaktif
            </span>
            
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              Geser pin atau silakan <strong>klik di bagian peta mana saja</strong> untuk mengambil koordinat Lintang (Lat) dan Bujur (Lng) secara otomatis dan instan demi presisi tinggi penayangan.
            </p>

            <div className="h-64 rounded-xl overflow-hidden border border-slate-200 relative">
              <MapComponent
                locations={[]}
                selectedLocation={null}
                interactiveCoordinateSelection={true}
                onSelectCoordinates={handleSetCoors}
                selectedCoordinates={{ lat, lng }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold">Latitude (Lintang)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold">Longitude (Bujur)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-md font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Visual card preview */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-inner">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">📸 Pratinjau Tampilan Poster Tempat</span>
            <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xs max-w-sm mx-auto">
              {photoInput ? (
                <img src={getDirectImageUrl(photoInput)} alt="Preview" className="w-full h-28 object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-28 bg-slate-100 flex items-center justify-center text-slate-350 select-none text-xs">
                  Foto Kosong
                </div>
              )}
              <div className="p-3">
                <span className="text-[9px] uppercase tracking-wider bg-teal-50 text-teal-800 font-bold px-1.5 py-0.5 rounded font-mono">
                  {category}
                </span>
                <h5 className="font-bold text-sm text-slate-800 mt-1 truncate">{name || "Nama Lokasi Usulan"}</h5>
                <p className="text-[11px] text-slate-450 truncate">📍 {address || "Alamat lengkap di Pacitan"}</p>
                {photoInput && (
                  <button
                    type="button"
                    onClick={() => setIsCropperOpen(true)}
                    className="w-full mt-2.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Crop size={13} /> Potong Rasio 16:9
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Accuracy & Validation Checklist Card */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-800 space-y-3.5 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">🛡️ Evaluasi Validasi & Akurasi Data</span>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-xs font-mono">
              {/* Check 1: Name Length */}
              <div className="flex items-center gap-2.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                {name.trim().length >= 5 ? (
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-200">Nama Tempat Valid</p>
                  <p className="text-[10px] text-slate-500">{name.trim().length >= 5 ? "Sesuai" : "Min. 5 karakter"}</p>
                </div>
              </div>

              {/* Check 2: Description Length */}
              <div className="flex items-center gap-2.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                {description.trim().length >= 15 ? (
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-200">Deskripsi Cukup Detail</p>
                  <p className="text-[10px] text-slate-500">{description.trim().length >= 15 ? "Sesuai" : "Min. 15 karakter"}</p>
                </div>
              </div>

              {/* Check 3: Address Admin Pacitan */}
              <div className="flex items-center gap-2.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                {address.toLowerCase().includes("pacitan") ? (
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-200">Wilayah Kabupaten Pacitan</p>
                  <p className="text-[10px] text-slate-500">{address.toLowerCase().includes("pacitan") ? "Tervalidasi" : "Sertakan kata 'Pacitan'"}</p>
                </div>
              </div>

              {/* Check 4: Coordinates Accuracy */}
              <div className="flex items-center gap-2.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                {(() => {
                  const isWithinPacitan = lat >= -8.45 && lat <= -7.85 && lng >= 110.85 && lng <= 111.45;
                  if (lat === -8.21 && lng === 111.03) {
                    return (
                      <>
                        <AlertTriangle size={14} className="text-yellow-500 shrink-0 animate-bounce" />
                        <div className="min-w-0">
                          <p className="font-bold text-yellow-500">Koordinat Default</p>
                          <p className="text-[10px] text-slate-500 font-sans">Silakan pilih posisi di peta</p>
                        </div>
                      </>
                    );
                  }
                  return isWithinPacitan ? (
                    <>
                      <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-200">Uji Geospasial Pacitan</p>
                        <p className="text-[10px] text-emerald-400 font-bold">Lolos Uji Presisi</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={14} className="text-red-400 shrink-0 animate-pulse" />
                      <div className="min-w-0">
                        <p className="font-bold text-red-400">Di Luar Batas Pacitan</p>
                        <p className="text-[10px] text-red-400 font-bold font-sans">Koreksi koordinat di peta</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Submission confirmations */}
          <div className="flex gap-3 justify-end pt-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-850 bg-white hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-pacitan-primary text-white border border-teal-800 hover:bg-teal-800 rounded-xl px-5 py-2 text-xs font-bold transition shadow flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <Check size={14} /> Ajukan Pengajuan
            </button>
          </div>
        </div>
      </form>

      {/* Image Cropper Modal (16:9 Aspect Ratio) */}
      {isCropperOpen && photoInput && (
        <ImageCropperModal
          imageSrc={getDirectImageUrl(photoInput)}
          onClose={() => setIsCropperOpen(false)}
          onCropSave={(croppedImg) => {
            setPhotoInput(croppedImg);
            triggerToast("Foto berhasil dipotong ke rasio 16:9!", "success");
          }}
        />
      )}
    </div>
  );
}

/* =========================================================================
   ADMIN EXCLUSIVE: 7. AdminSlaDashboardView (SLA/KPI operational overview)
   ========================================================================= */
function AdminSlaDashboardView({ 
  locations, 
  submissions, 
  users = [],
  reviews = [],
  itineraries = [],
  logs = [],
  currentUser 
}: { 
  locations: Location[]; 
  submissions: LocationSubmission[]; 
  users?: User[];
  reviews?: Review[];
  itineraries?: Itinerary[];
  logs?: ModerationLog[];
  currentUser: User;
}) {
  const navigate = useNavigate();

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiConfig, setAiConfig] = useState(() => AiService.getConfig());

  useEffect(() => {
    const handleConfigUpdate = (e: CustomEvent) => {
      setAiConfig(e.detail);
    };
    window.addEventListener("sipp_ai_config_updated" as any, handleConfigUpdate);
    return () => {
      window.removeEventListener("sipp_ai_config_updated" as any, handleConfigUpdate);
    };
  }, []);

  // Route protection
  if (currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const approvedLocs = locations.filter((l) => l.status === "approved").length;
  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const approvedSubmissions = submissions.filter((s) => s.status === "approved").length;
  const totalSubmissionsVal = submissions.length;

  const approvalRatio = totalSubmissionsVal > 0 
    ? ((approvedSubmissions / totalSubmissionsVal) * 100).toFixed(1) 
    : "100";

  const totalPengelola = users.filter((u) => u.role === "pengelola").length;
  const totalWisatawan = users.filter((u) => u.role === "user").length;

  const handleExportPDF = () => {
    try {
      exportAdminPdfReport({
        locations,
        submissions,
        users: users.length > 0 ? users : LocalDB.getUsers(),
        reviews: reviews.length > 0 ? reviews : LocalDB.getReviews(),
        itineraries: itineraries.length > 0 ? itineraries : LocalDB.getItineraries(),
        logs: logs.length > 0 ? logs : LocalDB.getLogs(),
        currentUser,
      });
      triggerToast("Dokumen PDF Laporan SLA, KPI & Pengunjung berhasil diunduh!", "success");
    } catch (err) {
      console.error("Gagal mengekspor PDF:", err);
      triggerToast("Gagal memproses dokumen PDF. Silakan coba lagi.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Header */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-mono text-[10px] uppercase font-bold tracking-widest block">ADMIN UTAMA INTERFACE</span>
            <span className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
              STANDAR RESMI OPERASIONAL DUKUNGAN PARIWISATA
            </span>
          </div>
          <h2 className="font-display font-black text-slate-900 dark:text-slate-100 text-2xl sm:text-3xl">📊 Dashboard SLA &amp; KPI Operasional Moderasi</h2>
          <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-3xl leading-relaxed">
            Panel kontrol terpadu metrik Service Level Agreement (SLA) dan Key Performance Indicator (KPI) operasional platform Explore Pacitan. Digunakan oleh Admin Utama untuk memantau kecepatan respon kurasi, kepatuhan batas waktu verifikasi, presisi pemetaan geotagging GPS, serta efisiensi moderasi konten pariwisata secara real-time.
          </p>

          {/* Quick SLA Parameters Chips */}
          <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono">
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium flex items-center gap-1.5">
              <span>⏱️ Target SLA Utama:</span> <strong className="text-teal-700 dark:text-teal-300">&lt; 24:00 Jam</strong>
            </span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium flex items-center gap-1.5">
              <span>🎯 Target Minimal Kepatuhan:</span> <strong className="text-emerald-600 dark:text-emerald-400">&ge; 95.0%</strong>
            </span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium flex items-center gap-1.5">
              <span>📍 Akurasi Geotagging:</span> <strong className="text-indigo-600 dark:text-indigo-400">&ge; 98.0% Presisi</strong>
            </span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium flex items-center gap-1.5">
              <span>🛡️ Standar Foto &amp; Info:</span> <strong className="text-amber-600 dark:text-amber-400">Min 2 Foto HD + Jam Buka</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportPDF}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-4 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer border border-teal-600"
            title="Export Laporan PDF Resmi untuk Dinas & Stakeholder"
          >
            <FileText size={16} />
            <span>Export PDF Laporan</span>
          </button>
        </div>
      </div>

      {/* Dedicated AI Setup Panel - ONLY FOR ADMIN UTAMA */}
      {isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md font-bold mt-0.5 transition-colors ${
              aiConfig.enabled && aiConfig.isValidated 
                ? "bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950" 
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}>
              <Bot size={26} className="stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-extrabold text-base text-white">
                  Pengaturan Integrasi AI Asisten Pariwisata (LLM Chatbot)
                </h3>
                {aiConfig.isValidated ? (
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle size={12} /> Terhubung &amp; Valid ({aiConfig.provider.toUpperCase()} - {aiConfig.modelName})
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle size={12} /> Belum Dikonfigurasi / Belum Valid
                  </span>
                )}
                <span className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  aiConfig.enabled 
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                }`}>
                  <Power size={11} />
                  STATUS AI: {aiConfig.enabled ? "AKTIF (ON)" : "NONAKTIF (OFF)"}
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {!aiConfig.isValidated
                  ? "Popup Asisten AI disembunyikan untuk publik sampai Admin Utama memasukkan & memvalidasi Kunci API LLM (OpenRouter, Groq, OpenAI, Gemini, dll)."
                  : aiConfig.enabled
                  ? "Sistem AI aktif & terhubung. Pengunjung dapat menggunakan Asisten AI Pariwisata melalui widget melayang di pojok kanan bawah."
                  : "Fitur AI dinonaktifkan secara manual oleh Admin Utama. Widget popup disembunyikan dari publik."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center shrink-0">
            {/* Direct ON/OFF Toggle Switch */}
            <div className="flex items-center gap-2.5 bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700">
              <span className="text-[11px] font-bold text-slate-300">Sakelar AI:</span>
              <button
                type="button"
                onClick={() => {
                  const newStatus = !aiConfig.enabled;
                  const updated = { ...aiConfig, enabled: newStatus };
                  setAiConfig(updated);
                  AiService.saveConfig(updated);
                  triggerToast(
                    newStatus
                      ? "Fitur Asisten AI Pariwisata telah DIAKTIFKAN (ON)."
                      : "Fitur Asisten AI Pariwisata telah DINONAKTIFKAN (OFF).",
                    newStatus ? "success" : "info"
                  );
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  aiConfig.enabled ? "bg-emerald-500" : "bg-slate-600"
                }`}
                title={aiConfig.enabled ? "Klik untuk Nonaktifkan AI (OFF)" : "Klik untuk Aktifkan AI (ON)"}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    aiConfig.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className={`text-[11px] font-black uppercase font-mono ${aiConfig.enabled ? "text-emerald-400" : "text-rose-400"}`}>
                {aiConfig.enabled ? "ON" : "OFF"}
              </span>
            </div>

            <button
              onClick={() => setShowAiModal(true)}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 cursor-pointer shadow-md"
            >
              <Bot size={15} />
              <span>{aiConfig.isValidated ? "Kelola Kunci AI" : "Setup Kunci AI"}</span>
            </button>
          </div>
        </div>
      )}

      {/* AI Config Modal Component */}
      <AiConfigModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
      />

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Kecepatan Respons SLA */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 bottom-1 text-teal-200/30 dark:text-teal-950/30 text-5xl font-black font-display font-mono pointer-events-none select-none z-0">
            SLA
          </div>
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Kecepatan Respons</span>
              <span className="bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">⚡ FAST</span>
            </div>
            <span className="block text-3xl font-black font-display text-teal-700 dark:text-teal-300 tracking-tight mt-1">2.8 Jam</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight pt-1 border-t border-slate-100 dark:border-slate-800">
              ✓ Target Maksimal: &lt; 24.0 Jam
            </p>
          </div>
        </div>

        {/* KPI 2: Kepatuhan Target SLA */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 bottom-1 text-emerald-200/30 dark:text-emerald-950/40 text-5xl font-black font-display font-mono pointer-events-none select-none z-0">
            %
          </div>
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Kepatuhan SLA</span>
              <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">🟢 98.2%</span>
            </div>
            <span className="block text-3xl font-black font-display text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">98.2%</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight pt-1 border-t border-slate-100 dark:border-slate-800">
              Pengajuan selesai &lt; 24 jam
            </p>
          </div>
        </div>

        {/* KPI 3: Tempat Terbit Publik */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 bottom-1 text-slate-200/40 dark:text-slate-800/40 text-5xl font-black font-display font-mono pointer-events-none select-none z-0">
            LIVE
          </div>
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Tempat Terbit</span>
              <span className="bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800">PUBLIK</span>
            </div>
            <span className="block text-3xl font-black font-display text-slate-800 dark:text-slate-100 tracking-tight mt-1">{approvedLocs} <span className="text-sm font-bold text-slate-500">Obyek</span></span>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight pt-1 border-t border-slate-100 dark:border-slate-800">
              ● Status: Aktif &amp; Terverifikasi
            </p>
          </div>
        </div>

        {/* KPI 4: Usulan Pending */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 bottom-1 text-rose-200/30 dark:text-rose-950/30 text-5xl font-black font-display font-mono pointer-events-none select-none z-0">
            {pendingSubmissions.length}
          </div>
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Usulan Pending</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${pendingSubmissions.length > 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                {pendingSubmissions.length > 0 ? "⚠️ NEED ACTION" : "✓ CLEAR"}
              </span>
            </div>
            <span className={`block text-3xl font-black font-display tracking-tight mt-1 ${pendingSubmissions.length > 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>
              {pendingSubmissions.length} <span className="text-sm font-bold text-slate-500">Berkas</span>
            </span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight pt-1 border-t border-slate-100 dark:border-slate-800">
              {pendingSubmissions.length > 0 ? "⚠️ Memerlukan penanganan" : "✓ Antrean bersih"}
            </p>
          </div>
        </div>

        {/* KPI 5: Akurasi Geotagging & Data */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 bottom-1 text-teal-200/30 dark:text-teal-950/30 text-5xl font-black font-display font-mono pointer-events-none select-none z-0">
            GPS
          </div>
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Akurasi Data</span>
              <span className="bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">📍 GPS HIGH</span>
            </div>
            <span className="block text-3xl font-black font-display text-teal-700 dark:text-teal-300 tracking-tight mt-1">99.4%</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight pt-1 border-t border-slate-100 dark:border-slate-800">
              Koordinat &amp; Foto Valid
            </p>
          </div>
        </div>

        {/* KPI 6: Resolusi Approval */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 bottom-1 text-indigo-200/30 dark:text-indigo-950/30 text-5xl font-black font-display font-mono pointer-events-none select-none z-0">
            OK
          </div>
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 font-mono">Resolusi Approval</span>
              <span className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">RATIO</span>
            </div>
            <span className="block text-3xl font-black font-display text-indigo-700 dark:text-indigo-300 tracking-tight mt-1">{approvalRatio}%</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight pt-1 border-t border-slate-100 dark:border-slate-800">
              Lulus kurasi orisinal
            </p>
          </div>
        </div>
      </div>

      {/* Matriks SLA Operasional Moderasi */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              ⏱️ Matriks Service Level Agreement (SLA) per Kategori
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Standar acuan kecepatan dan kualitas moderasi operasional berdasarkan jenis berkas yang diajukan.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SLA Normal & Terpenuhi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3 rounded-l-lg whitespace-nowrap">Kategori Moderasi</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Target SLA Maksimal</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Realisasi Rata-rata</th>
                <th className="py-2.5 px-3">Standard Kualitas / KPI</th>
                <th className="py-2.5 px-3 rounded-r-lg text-right whitespace-nowrap">Status Kepatuhan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                  1. Pengajuan Destinasi Baru (Create)
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">&lt; 24.0 Jam</td>
                <td className="py-3 px-3 text-teal-700 dark:text-teal-400 font-bold font-mono whitespace-nowrap">1.9 Jam</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">Min 2 Foto HD, Koordinat Lat/Lng Akurat, Rincian Tiket & Jam Operasional</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    🟢 SLA Met (100%)
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                  2. Pembaruan Data & Fasilitas (Update)
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">&lt; 12.0 Jam</td>
                <td className="py-3 px-3 text-teal-700 dark:text-teal-400 font-bold font-mono whitespace-nowrap">3.4 Jam</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">Validasi data mitra pengelola resmi & konfirmasi perubahan fisik lokasi</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    🟢 SLA Met (98.5%)
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                  3. Moderasi Ulasan & Komentar Publik
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">&lt; 6.0 Jam</td>
                <td className="py-3 px-3 text-teal-700 dark:text-teal-400 font-bold font-mono whitespace-nowrap">1.2 Jam</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">Filter otomatis kata kasar, anti-spam bot, dan validasi ulasan asli pengunjung</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    🟢 SLA Met (100%)
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                  4. Verifikasi Akun Mitra Pengelola Baru
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">&lt; 48.0 Jam</td>
                <td className="py-3 px-3 text-teal-700 dark:text-teal-400 font-bold font-mono whitespace-nowrap">5.6 Jam</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">Validasi email resmi dinas/mitra &amp; penetapan lokasi pengelolaan objek wisata</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    🟢 SLA Met (96.0%)
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                  5. Penanganan Laporan &amp; Aduan Wisatawan
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">&lt; 4.0 Jam</td>
                <td className="py-3 px-3 text-teal-700 dark:text-teal-400 font-bold font-mono whitespace-nowrap">0.9 Jam</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">Investigasi aduan fasilitas rusak/informasi menyesatkan dengan verifikasi mitra setempat</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    🟢 SLA Met (100%)
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                  6. Kurasi Paket Wisata &amp; Itinerary Resmi
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">&lt; 18.0 Jam</td>
                <td className="py-3 px-3 text-teal-700 dark:text-teal-400 font-bold font-mono whitespace-nowrap">2.5 Jam</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">Verifikasi kelayakan harga, rute perjalanan, serta ketersediaan kontak pemandu wisata</td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    🟢 SLA Met (99.1%)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Detailed SOP Workflow Steps */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
            📋 Alur Standar Operasional Prosedur (SOP) Moderasi &amp; Penjaminan Mutu KPI
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-mono font-bold text-teal-700 dark:text-teal-400 block">Langkah 1: Pengajuan Berkas</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">Penerimaan &amp; Parsing</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Sistem otomatis mencatat timestamp masuk &amp; memvalidasi kelengkapan awal field mandatory (Nama, Kategori, Foto).
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-mono font-bold text-teal-700 dark:text-teal-400 block">Langkah 2: Pemeriksaan GPS</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">Validasi Geotagging</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Admin memeriksa koordinat peta Lat/Lng agar presisi di wilayah Kabupaten Pacitan dan tidak tumpang tindih.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-mono font-bold text-teal-700 dark:text-teal-400 block">Langkah 3: Kurasi Orisinalitas</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">Pemeriksaan Media &amp; Konten</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Pemeriksaan kualitas foto resolusi tinggi, kejelasan deskripsi, jam buka operasional, serta harga tiket masuk.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-mono font-bold text-teal-700 dark:text-teal-400 block">Langkah 4: Keputusan SLA</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">Publikasi / Revision</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Penerbitan langsung ke katalog publik atau pengiriman catatan revisi ke pengelola dalam kurun &lt; 24 jam.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual KPI Capaian Progress Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
            <span>Kepatuhan SLA (&lt;24 Jam)</span>
            <span className="text-teal-600 font-mono">98.2%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-teal-600 h-2 rounded-full" style={{ width: "98.2%" }}></div>
          </div>
          <p className="text-[10px] text-slate-400">Target minimal: 95.0% • Status: Baik</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
            <span>Akurasi Geotagging GPS</span>
            <span className="text-emerald-600 font-mono">99.4%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: "99.4%" }}></div>
          </div>
          <p className="text-[10px] text-slate-400">Target minimal: 98.0% • Status: Presisi</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
            <span>Kepuasan Pengguna (CSAT)</span>
            <span className="text-amber-600 font-mono">96.0% (4.8/5.0)</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-amber-500 h-2 rounded-full" style={{ width: "96.0%" }}></div>
          </div>
          <p className="text-[10px] text-slate-400">Berdasarkan ulasan &amp; umpan balik mitra</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
            <span>Tingkat Eskalasi Masalah</span>
            <span className="text-indigo-600 font-mono">0.8%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: "8%" }}></div>
          </div>
          <p className="text-[10px] text-slate-400">Maksimal batas toleransi: 2.0%</p>
        </div>
      </div>

      {/* SLA Actions and Governance Alerts */}
      <div>
        {/* Administration Governance Note Card */}
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 shadow-inner space-y-3">
          <span className="font-bold text-slate-800 dark:text-amber-300 text-xs block flex items-center gap-1 text-amber-900 dark:text-amber-200">
            🛡️ Aturan Tata Tertib &amp; SOP Admin Utama
          </span>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal font-sans">
            1. <strong>Ketepatan Koordinat</strong>: Jangan lalui approval tempat baru jika tanda semat pin peta melenceng di tengah laut lepas selatan atau luar Pacitan, tawarkan <strong>Revision Request</strong>.
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal font-sans">
            2. <strong>Duplikasi Data</strong>: Verifikasi kemiripan orisinalitas nama atau kedekatan jarak koordinat lat/lng sebelum menyetujui pengisian item.
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal font-sans">
            3. <strong>Aduan Kebersihan</strong>: Admin berkuasa menangguhkan sementara obyek yang status pelayanannya menurun drastis demi reputasi pariwisata Pacitan.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   ADMIN EXCLUSIVE: 8. AdminQueueView (Incoming queue)
   ========================================================================= */
function AdminQueueView({ 
  submissions, 
  locations,
  currentUser,
  onProcessBatch
}: { 
  submissions: LocationSubmission[]; 
  locations: Location[];
  currentUser: User;
  onProcessBatch: (
    updatedSubs: LocationSubmission[], 
    updatedLocs: Location[] | null, 
    newLogs: ModerationLog[]
  ) => void;
}) {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<"all" | "create" | "update">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectNotes, setBulkRejectNotes] = useState("");

  if (currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const pendingList = submissions.filter((s) => s.status === "pending");
  const filteredPendingList = pendingList.filter((s) => {
    if (typeFilter === "all") return true;
    return s.submissionType === typeFilter;
  });

  const countCreate = pendingList.filter(s => s.submissionType === "create").length;
  const countUpdate = pendingList.filter(s => s.submissionType === "update").length;

  // Clear selection if the active filter changes to avoid hidden item actions
  useEffect(() => {
    setSelectedIds([]);
  }, [typeFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPendingList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPendingList.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const executeBulkApprove = () => {
    const selectedSubs = pendingList.filter(s => selectedIds.includes(s.id));
    if (selectedSubs.length === 0) return;

    let nextLocations = [...locations];
    const updatedSubsList: LocationSubmission[] = [];
    const newLogsList: ModerationLog[] = [];

    selectedSubs.forEach((sub, idx) => {
      const updatedSub: LocationSubmission = {
        ...sub,
        status: "approved",
        reviewedBy: currentUser.id,
        reviewedByName: currentUser.name,
        reviewedAt: new Date().toISOString(),
        reviewNotes: "Disetujui secara massal. Informasi valid dan akurat."
      };
      updatedSubsList.push(updatedSub);

      if (sub.submissionType === "create") {
        const newLoc: Location = {
          id: "loc_bulk_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substr(2, 4),
          name: sub.payload.name,
          category: sub.payload.category,
          description: sub.payload.description,
          coordinates: sub.payload.coordinates,
          address: sub.payload.address,
          photos: sub.payload.photos,
          status: "approved",
          createdBy: sub.submittedBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ratingAverage: 4.5,
          reviewCount: 0,
          openingHours: sub.payload.openingHours,
          priceRange: sub.payload.priceRange,
          contact: sub.payload.contact
        };
        nextLocations.push(newLoc);
      } else if (sub.submissionType === "update" && sub.targetLocationId) {
        nextLocations = nextLocations.map(loc => {
          if (loc.id === sub.targetLocationId) {
            return {
              ...loc,
              name: sub.payload.name,
              category: sub.payload.category,
              description: sub.payload.description,
              coordinates: sub.payload.coordinates,
              address: sub.payload.address,
              photos: sub.payload.photos,
              openingHours: sub.payload.openingHours,
              priceRange: sub.payload.priceRange,
              contact: sub.payload.contact,
              updatedAt: new Date().toISOString()
            };
          }
          return loc;
        });
      }

      const newLog: ModerationLog = {
        id: "log_bulk_app_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substr(2, 4),
        action: "approve",
        submissionId: sub.id,
        targetName: sub.payload.name,
        adminId: currentUser.id,
        adminEmail: currentUser.email,
        timestamp: new Date().toISOString(),
        reason: "Persetujuan usulan secara massal melalui moderasi dashboard."
      };
      newLogsList.push(newLog);
    });

    onProcessBatch(updatedSubsList, nextLocations, newLogsList);
    triggerToast(`Berhasil menyetujui ${selectedSubs.length} usulan secara massal! Data resmi diterbitkan ke peta publik Explore Pacitan.`, "success");
    setSelectedIds([]);
    setShowBulkApproveModal(false);
  };

  const executeBulkReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkRejectNotes.trim()) {
      triggerToast("Alasan penolakan massal wajib dicantumkan!", "error");
      return;
    }

    const selectedSubs = pendingList.filter(s => selectedIds.includes(s.id));
    if (selectedSubs.length === 0) return;

    const updatedSubsList: LocationSubmission[] = [];
    const newLogsList: ModerationLog[] = [];

    selectedSubs.forEach((sub, idx) => {
      const updatedSub: LocationSubmission = {
        ...sub,
        status: "rejected",
        reviewedBy: currentUser.id,
        reviewedByName: currentUser.name,
        reviewedAt: new Date().toISOString(),
        reviewNotes: `Ditolak secara massal. Catatan: ${bulkRejectNotes}`
      };
      updatedSubsList.push(updatedSub);

      const newLog: ModerationLog = {
        id: "log_bulk_rej_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substr(2, 4),
        action: "reject",
        submissionId: sub.id,
        targetName: sub.payload.name,
        adminId: currentUser.id,
        adminEmail: currentUser.email,
        timestamp: new Date().toISOString(),
        reason: `Penolakan usulan secara massal. Alasan: ${bulkRejectNotes}`
      };
      newLogsList.push(newLog);
    });

    onProcessBatch(updatedSubsList, null, newLogsList);
    triggerToast(`Berhasil menolak ${selectedSubs.length} usulan secara massal.`, "info");
    setSelectedIds([]);
    setBulkRejectNotes("");
    setShowBulkRejectModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link to="/admin" className="hover:text-teal-705">SLA Dashboard</Link>
        <ChevronRight size={12} />
        <span className="text-slate-600">Antrean Moderasi</span>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-205 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="font-display font-black text-slate-900 text-xl">📥 Antrean Menunggu Keputusan</h2>
          <p className="text-slate-500 text-xs mt-0.5">Daftar usulan kontribusi yang menunggu validasi kualitas data oleh Anda.</p>
        </div>
        <span className="text-xs font-bold px-3 py-1 bg-red-100 text-red-800 rounded-full font-mono animate-pulse">
          Pending: {pendingList.length} draf
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl max-w-md">
        <button
          onClick={() => setTypeFilter("all")}
          className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
            typeFilter === "all"
              ? "bg-white dark:bg-slate-800 text-teal-750 shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          📂 Semua ({pendingList.length})
        </button>
        <button
          onClick={() => setTypeFilter("create")}
          className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
            typeFilter === "create"
              ? "bg-white dark:bg-slate-800 text-teal-750 shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          ➕ Tempat Baru ({countCreate})
        </button>
        <button
          onClick={() => setTypeFilter("update")}
          className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
            typeFilter === "update"
              ? "bg-white dark:bg-slate-800 text-teal-750 shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          📝 Update Data ({countUpdate})
        </button>
      </div>

      {/* Bulk Action Controls Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center bg-teal-600 text-white font-mono font-bold text-xs w-6 h-6 rounded-full">
              {selectedIds.length}
            </span>
            <div>
              <p className="text-xs font-bold text-slate-800">Moderasi Massal Aktif</p>
              <p className="text-[10px] text-slate-500 font-medium">Anda telah memilih {selectedIds.length} usulan untuk diproses bersamaan.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => {
                setShowBulkApproveModal(true);
                setShowBulkRejectModal(false);
              }}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition shadow-sm uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={14} /> Setujui Massal
            </button>
            <button
              onClick={() => {
                setShowBulkRejectModal(true);
                setShowBulkApproveModal(false);
              }}
              className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition shadow-sm uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              <XCircle size={14} /> Tolak Massal
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer font-bold px-2 py-1"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Select All Checkbox Row */}
      {filteredPendingList.length > 0 && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={filteredPendingList.length > 0 && selectedIds.length === filteredPendingList.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
            />
            Pilih Semua Usulan di Halaman Ini
          </label>
          <span className="text-[11px] text-slate-400 font-mono font-bold">
            {selectedIds.length} dari {filteredPendingList.length} dipilih
          </span>
        </div>
      )}

      {filteredPendingList.length === 0 ? (
        <div className="text-center bg-white border rounded-2xl py-20 text-slate-400 italic text-xs">
          <CheckCircle className="mx-auto text-emerald-500 mb-2" size={40} />
          Tidak ada usulan kontribusi dengan kriteria terpilih dalam antrean.
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden divide-y divide-slate-100">
          {filteredPendingList.map((sub) => {
            const isSelected = selectedIds.includes(sub.id);
            return (
              <div key={sub.id} className={`p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 transition-colors ${isSelected ? "bg-teal-50/20 border-l-4 border-l-teal-500" : ""}`}>
                <div className="flex gap-4 items-start flex-1">
                  {/* Card Checkbox */}
                  <div className="pt-1.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(sub.id)}
                      className="w-4.5 h-4.5 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </div>

                  <img
                    src={getDirectImageUrl(sub.payload.photos?.[0])}
                    alt={sub.payload.name}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-205 flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-805 text-sm sm:text-base">{sub.payload.name}</h4>
                      <span className={`px-2 py-0.2 rounded text-[8px] font-mono tracking-wider font-bold uppercase rounded ${CATEGORY_COLORS[sub.payload.category]}`}>
                        {sub.payload.category}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider font-mono px-1 rounded bg-slate-100 text-slate-500">
                        {sub.submissionType === 'create' ? "Tempat Baru" : "Update Data"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1">{sub.payload.address}</p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <span>Diusulkan oleh: 👤 <b>{sub.submittedByName}</b></span>
                      <span>•</span>
                      <span>{new Date(sub.createdAt).toLocaleDateString("id-ID")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/admin/moderation/${sub.id}`)}
                    className="bg-slate-900 font-bold hover:bg-teal-700 text-white rounded-lg text-xs px-4 py-2 shadow cursor-pointer transition uppercase"
                  >
                    Proses Usulan →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BULK APPROVE MODAL */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-250">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle size={28} />
              <h3 className="font-display font-black text-lg">Setujui Massal</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Apakah Anda yakin ingin <strong className="text-slate-800">menyetujui {selectedIds.length} usulan tempat</strong> sekaligus?
            </p>
            <div className="bg-slate-50 p-3 rounded-xl max-h-40 overflow-y-auto space-y-1.5 border border-slate-100">
              {pendingList.filter(s => selectedIds.includes(s.id)).map(sub => (
                <div key={sub.id} className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span className="truncate max-w-[280px]">✨ {sub.payload.name}</span>
                  <span className="text-[9px] uppercase font-mono text-slate-450">({sub.submissionType})</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-450">
              Tindakan ini akan mempublikasikan data usulan secara resmi dan otomatis meluncurkannya ke Peta Wisata Explore Pacitan.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkApproveModal(false)}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition uppercase"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeBulkApprove}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition shadow uppercase"
              >
                Ya, Setujui Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK REJECT MODAL */}
      {showBulkRejectModal && (
        <form onSubmit={executeBulkReject} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-250">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle size={28} />
              <h3 className="font-display font-black text-lg">Tolak Massal</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Apakah Anda yakin ingin <strong className="text-slate-800">menolak {selectedIds.length} usulan tempat</strong> sekaligus?
            </p>
            <div className="bg-slate-50 p-3 rounded-xl max-h-28 overflow-y-auto space-y-1.5 border border-slate-100">
              {pendingList.filter(s => selectedIds.includes(s.id)).map(sub => (
                <div key={sub.id} className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span className="truncate max-w-[280px]">❌ {sub.payload.name}</span>
                  <span className="text-[9px] uppercase font-mono text-slate-450">({sub.submissionType})</span>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider">
                Alasan Penolakan Massal *
              </label>
              <textarea
                value={bulkRejectNotes}
                onChange={(e) => setBulkRejectNotes(e.target.value)}
                placeholder="Contoh: Berkas usulan tidak valid, tidak memiliki deskripsi lengkap, atau lokasi salah..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-rose-500 font-medium h-20"
                required
              />
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBulkRejectModal(false);
                  setBulkRejectNotes("");
                }}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition uppercase"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition shadow uppercase"
              >
                Ya, Tolak Semua
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/* =========================================================================
   ADMIN EXCLUSIVE: 9. AdminModerationView (Approve/Reject/Reject Revision view)
   ========================================================================= */
function AdminModerationView({ 
  submissions, 
  locations, 
  currentUser,
  onProcess 
}: { 
  submissions: LocationSubmission[]; 
  locations: Location[]; 
  currentUser: User;
  onProcess: (updatedSub: LocationSubmission, updatedLocs: Location[] | null, log: ModerationLog) => void;
}) {
  const { id } = useParams();
  const navigate = useNavigate();

  const sub = submissions.find((s) => s.id === id);
  const isPending = sub?.status === "pending";

  const [notes, setNotes] = useState("");
  const [showApprovePanel, setShowApprovePanel] = useState(false);
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);

  if (currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (!sub) {
    return (
      <div className="text-center py-20 bg-white border border-dashed rounded-2xl">
        <AlertCircle size={40} className="mx-auto text-red-500 mb-2" />
        <h4 className="font-display font-medium text-slate-800">Usulan Tidak Ditemukan</h4>
        <button onClick={() => navigate("/admin/queue")} className="bg-slate-900 text-white px-3 py-1 rounded text-xs mt-4 hover:bg-slate-800">
          Kembali ke Antrean
        </button>
      </div>
    );
  }

  // Find original location if it's an "update" submission for comparison
  const originalLoc = sub.targetLocationId ? locations.find(l => l.id === sub.targetLocationId) : null;

  const executeApprove = () => {
    if (!isPending) return;

    const updatedSub: LocationSubmission = {
      ...sub,
      status: "approved",
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: "Disetujui. Informasi valid dan akurat."
    };

    let nextLocations: Location[] = [...locations];

    if (sub.submissionType === "create") {
      // Append a completely new published location
      const newLoc: Location = {
        id: "loc_" + Date.now(),
        name: sub.payload.name,
        category: sub.payload.category,
        description: sub.payload.description,
        coordinates: sub.payload.coordinates,
        address: sub.payload.address,
        photos: sub.payload.photos,
        status: "approved",
        createdBy: sub.submittedBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ratingAverage: 4.5, // Default start rating
        reviewCount: 0,
        openingHours: sub.payload.openingHours,
        priceRange: sub.payload.priceRange,
        contact: sub.payload.contact
      };
      nextLocations.push(newLoc);
    } else if (sub.submissionType === "update" && sub.targetLocationId) {
      // Modify original fields directly
      nextLocations = nextLocations.map(loc => {
        if (loc.id === sub.targetLocationId) {
          return {
            ...loc,
            name: sub.payload.name,
            category: sub.payload.category,
            description: sub.payload.description,
            coordinates: sub.payload.coordinates,
            address: sub.payload.address,
            photos: sub.payload.photos,
            openingHours: sub.payload.openingHours,
            priceRange: sub.payload.priceRange,
            contact: sub.payload.contact,
            updatedAt: new Date().toISOString()
          };
        }
        return loc;
      });
    }

    // Capture logs
    const newLog: ModerationLog = {
      id: "log_" + Date.now(),
      action: "approve",
      submissionId: sub.id,
      targetName: sub.payload.name,
      adminId: currentUser.id,
      adminEmail: currentUser.email,
      timestamp: new Date().toISOString(),
      reason: "Konten diverifikasi dan dinyatakan layak tayang untuk pariwisata Pacitan."
    };

    onProcess(updatedSub, nextLocations, newLog);
    triggerToast(`Usulan "${sub.payload.name}" disetujui! Data resmi diterbitkan ke peta publik Explore Pacitan.`, "success");
    navigate("/admin/queue");
  };

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      triggerToast("Alasan penolakan berkas wajib dicantumkan!", "error");
      return;
    }

    const updatedSub: LocationSubmission = {
      ...sub,
      status: "rejected",
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes
    };

    const newLog: ModerationLog = {
      id: "log_" + Date.now(),
      action: "reject",
      submissionId: sub.id,
      targetName: sub.payload.name,
      adminId: currentUser.id,
      adminEmail: currentUser.email,
      timestamp: new Date().toISOString(),
      reason: notes
    };

    onProcess(updatedSub, null, newLog);
    triggerToast(`Usulan "${sub.payload.name}" ditolak dengan alasan: ${notes}`, "info");
    navigate("/admin/queue");
  };

  const handleRequestRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      triggerToast("Catatan petunjuk perbaikan revisi wajib dicantumkan!", "error");
      return;
    }

    const updatedSub: LocationSubmission = {
      ...sub,
      status: "revision_requested",
      reviewedBy: currentUser.id,
      reviewedByName: currentUser.name,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes
    };

    const newLog: ModerationLog = {
      id: "log_" + Date.now(),
      action: "request_revision",
      submissionId: sub.id,
      targetName: sub.payload.name,
      adminId: currentUser.id,
      adminEmail: currentUser.email,
      timestamp: new Date().toISOString(),
      reason: notes
    };

    onProcess(updatedSub, null, newLog);
    triggerToast(`Penangguhan revisi diajukan untuk "${sub.payload.name}". Submitter diberi tahu perbaikan: ${notes}`, "info");
    navigate("/admin/queue");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/admin/queue")}
          className="text-xs font-bold text-slate-650 hover:text-slate-900 border px-3 py-1.5 rounded-lg bg-white shadow-xs cursor-pointer flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Kembali ke Antrean
        </button>
        <span className="text-normal font-mono font-bold bg-amber-50 text-amber-800 border px-3 py-1 rounded-full">
          Mengevaluasi Usulan: #{sub.id}
        </span>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Usulan baru / payload candidate (Always exists) */}
        <div className="bg-white rounded-2xl p-5 border border-amber-300 relative shadow-md">
          <span className="absolute top-3 right-3 text-[10px] bg-amber-500 font-bold tracking-widest text-slate-950 font-mono py-0.5 px-2 rounded-full">
            KANDIDAT BARU
          </span>
          <h3 className="font-display font-bold text-slate-800 text-base border-b border-slate-100 pb-2 mb-4">
            🚀 Data yang Diajukan
          </h3>

          <div className="space-y-3 font-sans text-xs">
            <img src={getDirectImageUrl(sub.payload.photos?.[0])} alt={sub.payload.name} className="w-full h-44 object-cover rounded-xl border mb-3" referrerPolicy="no-referrer" />
            
            <div className="grid grid-cols-3 py-1.5 border-b">
              <span className="font-bold text-slate-500">Nama Tempat</span>
              <span className="col-span-2 text-slate-900 font-semibold">{sub.payload.name}</span>
            </div>
            <div className="grid grid-cols-3 py-1.5 border-b">
              <span className="font-bold text-slate-500">Kategori</span>
              <span className="col-span-2 uppercase font-semibold text-teal-800">{sub.payload.category}</span>
            </div>
            <div className="grid grid-cols-3 py-1.5 border-b">
              <span className="font-bold text-slate-500">Alamat Lengkap</span>
              <span className="col-span-2 text-slate-800 font-medium">{sub.payload.address}</span>
            </div>
            <div className="grid grid-cols-3 py-1.5 border-b">
              <span className="font-bold text-slate-500">Koordinat</span>
              <span className="col-span-2 text-slate-800 font-mono">Lat: {sub.payload.coordinates.lat} | Lng: {sub.payload.coordinates.lng}</span>
            </div>
            <div className="grid grid-cols-3 py-1.5 border-b">
              <span className="font-bold text-slate-500">Jam Layanan</span>
              <span className="col-span-2 text-slate-700 font-mono">{sub.payload.openingHours || "-"}</span>
            </div>
            <div className="grid grid-cols-3 py-1.5 border-b">
              <span className="font-bold text-slate-500">Tiket Masuk</span>
              <span className="col-span-2 text-slate-750">{sub.payload.priceRange || "-"}</span>
            </div>
            <div className="grid grid-cols-3 py-1.5 border-b">
              <span className="font-bold text-slate-500">Deskripsi</span>
              <span className="col-span-2 text-slate-650 leading-relaxed font-light">{sub.payload.description}</span>
            </div>
          </div>
        </div>

        {/* Existing data if type is edit update */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm min-h-[300px]">
          {sub.submissionType === "update" && originalLoc ? (
            <div>
              <span className="text-[10px] bg-slate-100 font-bold tracking-widest text-slate-600 font-mono py-0.5 px-2 rounded-full border float-right">
                DATA AKTIF SEKARANG
              </span>
              <h3 className="font-display font-bold text-slate-855 text-base border-b border-slate-100 pb-2 mb-4">
                📋 Perbandingan dengan Data Existing
              </h3>

              <div className="space-y-3 font-sans text-xs">
                <img src={getDirectImageUrl(originalLoc.photos?.[0])} alt={originalLoc.name} className="w-full h-36 object-cover rounded-xl border mb-3 grayscale opacity-60" referrerPolicy="no-referrer" />
                
                <div className="grid grid-cols-3 py-1.5 border-b">
                  <span className="font-semibold text-slate-400">Nama Tempat</span>
                  <span className="col-span-2 text-slate-600 font-medium">{originalLoc.name}</span>
                </div>
                <div className="grid grid-cols-3 py-1.5 border-b">
                  <span className="font-semibold text-slate-400">Kategori</span>
                  <span className="col-span-2 uppercase font-medium text-slate-600">{originalLoc.category}</span>
                </div>
                <div className="grid grid-cols-3 py-1.5 border-b">
                  <span className="font-semibold text-slate-400">Alamat</span>
                  <span className="col-span-2 text-slate-600">{originalLoc.address}</span>
                </div>
                <div className="grid grid-cols-3 py-1.5 border-b">
                  <span className="font-semibold text-slate-400">Koordinat</span>
                  <span className="col-span-2 text-slate-550 font-mono">Lat: {originalLoc.coordinates.lat} | Lng: {originalLoc.coordinates.lng}</span>
                </div>
                <div className="grid grid-cols-3 py-1.5 border-b">
                  <span className="font-semibold text-slate-400">Jam Layanan</span>
                  <span className="col-span-2 text-slate-550 font-mono">{originalLoc.openingHours || "-"}</span>
                </div>
                <div className="grid grid-cols-3 py-1.5 border-b">
                  <span className="font-semibold text-slate-400">Deskripsi</span>
                  <span className="col-span-2 text-slate-550 line-clamp-4 leading-normal">{originalLoc.description}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-400 italic">
              <Compass size={40} className="mx-auto text-slate-300 mb-1.5" />
              <span>Pengusulan berjenis <strong>TEMPAT BARU (CREATE)</strong>. Tidak ada perbandingan data lama untuk ditayangkan.</span>
            </div>
          )}
        </div>
      </div>

      {/* Admin Action Bar */}
      {isPending && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl border border-teal-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h4 className="font-display font-bold text-lg">🛡️ Kotak Kendali Resolusi Administrasi</h4>
              <p className="text-xs text-slate-400 mt-1">Gunakan tombol resolusi di samping kanan untuk menyetujui, meminta revisi ulang, atau menolak berkas.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setShowRejectPanel(false);
                  setShowApprovePanel(false);
                  setShowRevisionPanel(true);
                }}
                className="bg-purple-900 border border-purple-800 hover:bg-purple-800 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer transition shadow-sm uppercase tracking-wider"
              >
                Minta Revisi
              </button>
              
              <button
                onClick={() => {
                  setShowRevisionPanel(false);
                  setShowApprovePanel(false);
                  setShowRejectPanel(true);
                }}
                className="bg-red-950 border border-red-800 hover:bg-red-900 text-red-300 text-xs font-bold py-2 px-4 rounded-xl cursor-pointer transition shadow-sm uppercase tracking-wider"
              >
                Tolak Pengajuan
              </button>

              <button
                onClick={() => {
                  setShowRevisionPanel(false);
                  setShowRejectPanel(false);
                  setShowApprovePanel(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-5 rounded-xl cursor-pointer transition shadow-md flex items-center gap-1 uppercase tracking-wider"
              >
                <Check size={14} /> Terbitkan (Approve)
              </button>
            </div>
          </div>

          {/* Inline Action dialog approve confirmation */}
          {showApprovePanel && (
            <div className="bg-slate-800/80 border border-emerald-500/60 p-5 rounded-xl space-y-3">
              <strong className="block text-xs font-mono text-emerald-400 uppercase tracking-wider">✅ Konfirmasi Persetujuan Publikasi Tempat</strong>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Apakah Anda yakin ingin menyetujui usulan kontribusi pariwisata <strong>"{sub.payload.name}"</strong>? Setelah disetujui, obyek wisata ini akan langsung terbit di peta publik Explore Pacitan dan dapat diakses oleh seluruh wisatawan.
              </p>
              <div className="flex justify-end gap-2 text-xs pt-1">
                <button type="button" onClick={() => setShowApprovePanel(false)} className="px-3 py-1.5 hover:text-white text-slate-400 cursor-pointer">Batal</button>
                <button type="button" onClick={executeApprove} className="bg-emerald-600 hover:bg-emerald-750 text-white py-1.5 px-4 rounded-md font-bold cursor-pointer uppercase tracking-wider">Ya, Setujui & Terbitkan</button>
              </div>
            </div>
          )}

          {/* Inline Action dialog request revision */}
          {showRevisionPanel && (
            <form onSubmit={handleRequestRevision} className="bg-slate-800/80 border border-purple-700/60 p-4 rounded-xl space-y-3">
              <strong className="block text-xs font-mono text-purple-300 uppercase tracking-wider">✍️ Berikan Instruksi Catatan Revisi untuk Submitter</strong>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Mohon ganti foto tempat dengan kualitas resolusi tinggi yang asli (tidak mengandung hak cipta bermerek) serta revisi kembali koordinat lintangnya."
                rows={3}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:border-purple-500"
                required
              />
              <div className="flex justify-end gap-2 text-xs">
                <button type="button" onClick={() => setShowRevisionPanel(false)} className="px-2.5 py-1.5 hover:text-white text-slate-400">Batal</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white py-1.5 px-4 rounded-md font-bold cursor-pointer">Kirim Instruksi Revisi</button>
              </div>
            </form>
          )}

          {/* Inline Action dialog reject */}
          {showRejectPanel && (
            <form onSubmit={handleReject} className="bg-slate-800/80 border border-red-700/60 p-4 rounded-xl space-y-3">
              <strong className="block text-xs font-mono text-red-350 uppercase tracking-wider">✍️ Nyatakan Alasan Mutlak Tolakan Berkas</strong>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Obyek wisata bersangkutan merupakan duplikasi langsung dari data Pantai Klayar yang telah terbit live di Explore Pacitan."
                rows={3}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:border-red-500"
                required
              />
              <div className="flex justify-end gap-2 text-xs">
                <button type="button" onClick={() => setShowRejectPanel(false)} className="px-2.5 py-1.5 hover:text-white text-slate-400">Batal</button>
                <button type="submit" className="bg-red-600 hover:bg-red-700 text-white py-1.5 px-4 rounded-md font-bold cursor-pointer">Tolak Selamanya</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   ADMIN EXCLUSIVE: 10. AdminLocationsManageView (Manage published list)
   ========================================================================= */
function AdminLocationsManageView({ 
  locations, 
  currentUser,
  onToggleStatus 
}: { 
  locations: Location[]; 
  currentUser: User;
  onToggleStatus: (locId: string, active: boolean) => void;
}) {
  const navigate = useNavigate();
  const [confirmingLoc, setConfirmingLoc] = useState<{ id: string; name: string; nextMode: boolean } | null>(null);

  if (currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Overlay Modal Confirmation */}
      {confirmingLoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-105">
            <h3 className="font-display font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              ⚠️ Konfirmasi Perubahan Status
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin mengubah status pariwisata <strong>"{confirmingLoc.name}"</strong> menjadi{" "}
              <span className={`font-bold ${confirmingLoc.nextMode ? "text-emerald-600" : "text-rose-600"}`}>
                {confirmingLoc.nextMode ? "Aktif (Live)" : "Ditangguhkan"}
              </span>?
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setConfirmingLoc(null)}
                className="px-3 py-1.5 border hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onToggleStatus(confirmingLoc.id, confirmingLoc.nextMode);
                  triggerToast(
                    `Status "${confirmingLoc.name}" berhasil diubah menjadi ${confirmingLoc.nextMode ? "Aktif (Live)" : "Ditangguhkan"}.`,
                    "success"
                  );
                  setConfirmingLoc(null);
                }}
                className={`py-1.5 px-4 rounded-lg text-white font-bold cursor-pointer ${
                  confirmingLoc.nextMode ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Ya, Ubah Status
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link to="/admin" className="hover:text-teal-700">SLA Dashboard</Link>
        <ChevronRight size={12} />
        <span className="text-slate-600">Daftar Obyek</span>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-205 flex justify-between items-center">
        <div>
          <h2 className="font-display font-black text-slate-900 text-xl">🏬 Master Data Lokasi Aktif</h2>
          <p className="text-slate-500 text-xs">Tangguhkan sementara obyek wisata bermasalah atau aktifkan kembali secara instan.</p>
        </div>
        <span className="text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-1 rounded-full font-bold font-mono">
          Total Aktif: {locations.filter(l => l.status === "approved").length} obyek
        </span>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden divide-y divide-slate-100 p-2 sm:p-4">
        {locations.map((loc) => {
          const isApproved = loc.status === "approved";

          return (
            <div key={loc.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex gap-3.5 items-center">
                <img src={getDirectImageUrl(loc.photos?.[0])} alt={loc.name} className="w-12 h-12 rounded-lg object-cover border" referrerPolicy="no-referrer" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-slate-800 text-sm">{loc.name}</h4>
                    <span className={`px-1.5 py-0.2 rounded text-[7px] font-mono tracking-wider font-bold uppercase ${CATEGORY_COLORS[loc.category]}`}>
                      {loc.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">📍 {loc.address}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                  isApproved ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-150 text-slate-500 border border-slate-200'
                }`}>
                  {isApproved ? "Approved (Live)" : "Inactive (Tangguh)"}
                </span>

                <button
                  onClick={() => navigate(`/dashboard/submit?editId=${loc.id}`)}
                  className="text-xs font-bold tracking-wider px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Edit3 size={12} /> Edit
                </button>

                <button
                  onClick={() => {
                    const nextMode = !isApproved;
                    setConfirmingLoc({ id: loc.id, name: loc.name, nextMode });
                  }}
                  className={`text-xs font-bold tracking-wider px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer ${
                    isApproved 
                      ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/30 dark:border-red-900/50 dark:text-red-400 font-bold" 
                      : "bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                  }`}
                >
                  {isApproved ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   ADMIN EXCLUSIVE: 11. AdminLogsView (Audit Log Timeline)
   ========================================================================= */
function AdminLogsView({ logs, currentUser }: { logs: ModerationLog[]; currentUser: User }) {
  if (currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium font-mono">
        <Link to="/admin" className="hover:text-teal-700">SLA Dashboard</Link>
        <ChevronRight size={12} />
        <span className="text-slate-600">Audit Log</span>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-205 flex justify-between items-center">
        <div>
          <h2 className="font-display font-black text-slate-900 text-xl">📜 Audit Journal Moderasi</h2>
          <p className="text-slate-500 text-xs">Arsip riwayat validasi berkas administratif secara real-time oleh pengurus utama Explore Pacitan.</p>
        </div>
        <span className="text-xs font-bold font-mono px-3 py-1 bg-slate-100 rounded-full border border-slate-202 text-slate-650">
          Total Log: {logs.length} entri
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 bg-white border rounded-2xl text-slate-400 italic text-xs">
          Belum ada rekaman audit log moderasi dalam sesi pengujian ini.
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-xs">
          <div className="hidden md:grid grid-cols-12 bg-slate-50 p-4 text-xs font-extrabold uppercase text-slate-500 border-b tracking-wider font-mono">
            <span className="col-span-2">Waktu Aksi</span>
            <span className="col-span-2">Aksi Resolusi</span>
            <span className="col-span-3">Target Obyek</span>
            <span className="col-span-2">Admin Eksekutor</span>
            <span className="col-span-3">Alasan / Catatan Tinjauan</span>
          </div>

          <div className="divide-y divide-slate-100 font-sans text-xs">
            {logs.map((log) => {
              return (
                <div key={log.id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-start hover:bg-slate-50/50 transition">
                  <div className="col-span-2 text-slate-500 font-mono">
                    <span className="md:hidden font-bold block text-[10px] text-slate-400 uppercase font-mono mb-0.5">Waktu</span>
                    {new Date(log.timestamp).toLocaleString("id-ID")}
                  </div>

                  <div className="col-span-2">
                    <span className="md:hidden font-bold block text-[10px] text-slate-400 uppercase font-mono mb-0.5">Aksi</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider font-bold ${
                      log.action === "approve"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : log.action === "reject"
                        ? "bg-red-50 text-red-850 border border-red-300"
                        : "bg-purple-50 text-purple-800 border border-purple-300"
                    }`}>
                      {log.action === "request_revision" ? "Instruksi Revisi" : log.action}
                    </span>
                  </div>

                  <div className="col-span-3 font-semibold text-slate-800">
                    <span className="md:hidden font-bold block text-[10px] text-slate-400 uppercase font-mono mb-0.5">Target</span>
                    {log.targetName}
                    <span className="block text-[10px] text-slate-400 font-normal font-mono">Submisi ID: {log.submissionId}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="md:hidden font-bold block text-[10px] text-slate-400 uppercase font-mono mb-0.5">Admin</span>
                    <span className="font-medium text-slate-700">{log.adminEmail.split("@")[0]}</span>
                  </div>

                  <div className="col-span-3 font-light text-slate-600 leading-relaxed font-sans italic">
                    <span className="md:hidden font-bold block text-[10px] text-slate-400 uppercase font-mono mb-0.5">Alasan</span>
                    "{log.reason}"
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   ADMIN EXCLUSIVE: 12. AdminUsersManageView (Manage users & managers roles)
   ========================================================================= */
function AdminUsersManageView({
  users,
  locations,
  currentUser,
  onUpdateUsers
}: {
  users: User[];
  locations: Location[];
  currentUser: User;
  onUpdateUsers: (updatedUsers: User[]) => void;
}) {
  const [editingUserLocs, setEditingUserLocs] = useState<User | null>(null);
  const [selectedLocs, setSelectedLocs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  
  // Add manual user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("pengelola");
  
  // Confirmation modal state for account deletion
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);

  if (currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const approvedLocations = locations.filter((l) => l.status === "approved");

  const isDefaultAdminUtamaUser = (u: User | null | undefined) => {
    if (!u) return false;
    const email = (u.email || "").toLowerCase().trim();
    const id = (u.id || "").toLowerCase().trim();
    return email === "ivanfadhilamaulana1@gmail.com" || id === "21oqjjdx0xfs0ddkrsvjlsxgqm1" || id === "usr_admin";
  };

  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    window.dispatchEvent(new CustomEvent("show-toast", { detail: { message, type } }));
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    const target = users.find(u => u.id === userId);
    if (isDefaultAdminUtamaUser(target)) {
      triggerToast("Peran Default Admin Utama (ivanfadhilamaulana1@gmail.com) tidak dapat diubah!", "error");
      return;
    }
    if (target?.role === "admin" && !isDefaultAdminUtamaUser(currentUser)) {
      triggerToast("Hanya Default Admin Utama yang dapat mengubah peran sesama Admin!", "error");
      return;
    }
    const managed = role === "pengelola" ? (target?.managedLocations || []) : [];
    const updated = users.map(u => {
      if (u.id === userId) {
        return { ...u, role, managedLocations: managed };
      }
      return u;
    });

    if (db && userId) {
      try {
        await setDoc(doc(db, "users", userId), { role, managedLocations: managed }, { merge: true });
      } catch (err) {
        console.error("Error updating user role in Firestore:", err);
      }
    }

    onUpdateUsers(updated);
    triggerToast(`Peran pengguna "${target?.name || ''}" berhasil diperbarui menjadi ${role.toUpperCase()}!`, "success");
  };

  const handleOpenAssignModal = (user: User) => {
    setEditingUserLocs(user);
    setSelectedLocs(user.managedLocations || []);
  };

  const handleToggleLocSelection = (locId: string) => {
    setSelectedLocs(prev => 
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    );
  };

  const handleSaveAssignments = async () => {
    if (editingUserLocs) {
      if (db && editingUserLocs.id) {
        try {
          await setDoc(doc(db, "users", editingUserLocs.id), { managedLocations: selectedLocs }, { merge: true });
        } catch (err) {
          console.error("Error saving managedLocations in Firestore:", err);
        }
      }
      const updated = users.map(u => {
        if (u.id === editingUserLocs.id) {
          return { ...u, managedLocations: selectedLocs };
        }
        return u;
      });
      onUpdateUsers(updated);
      triggerToast(`Penugasan objek wisata untuk ${editingUserLocs.name} berhasil diperbarui!`, "success");
      setEditingUserLocs(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      triggerToast("Nama dan email wajib diisi!", "error");
      return;
    }

    const emailLower = newEmail.toLowerCase().trim();
    if (users.some(u => u.email.toLowerCase() === emailLower)) {
      triggerToast("Pengguna dengan email ini sudah terdaftar!", "error");
      return;
    }

    const newUserId = "usr_" + Date.now();
    const newUser: User = {
      id: newUserId,
      name: newName.trim(),
      email: emailLower,
      role: newRole,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${newName.replace(/\s+/g, '')}`,
      managedLocations: []
    };

    if (db) {
      try {
        await setDoc(doc(db, "users", newUserId), newUser);
      } catch (err) {
        console.error("Error adding user to Firestore:", err);
      }
    }

    onUpdateUsers([...users, newUser]);
    triggerToast(`Pengguna baru "${newName}" berhasil ditambahkan!`, "success");
    
    // Reset form
    setNewName("");
    setNewEmail("");
    setNewRole("pengelola");
    setShowAddForm(false);
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (isDefaultAdminUtamaUser(target)) {
      triggerToast("Default Admin Utama (ivanfadhilamaulana1@gmail.com) tidak dapat dihapus dari sistem!", "error");
      return;
    }
    if (target?.role === "admin" && !isDefaultAdminUtamaUser(currentUser)) {
      triggerToast("Hanya Default Admin Utama yang dapat menghapus sesama Admin!", "error");
      return;
    }
    if (userId === currentUser.id) {
      triggerToast("Anda tidak dapat menghapus akun Anda sendiri!", "error");
      return;
    }
    if (target) {
      setConfirmDeleteUser(target);
    }
  };

  const executeDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    const target = confirmDeleteUser;
    const updated = users.filter(u => u.id !== target.id);

    if (db && target.id) {
      try {
        await deleteDoc(doc(db, "users", target.id));
      } catch (err) {
        console.error("Error deleting user from Firestore:", err);
      }
    }

    onUpdateUsers(updated);
    triggerToast(`Pengguna "${target.name}" (${target.role}) berhasil dihapus dari sistem!`, "success");
    setConfirmDeleteUser(null);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesRole && u.id !== "guest_empty";
  });

  const totalPengelola = users.filter(u => u.role === "pengelola").length;
  const totalUser = users.filter(u => u.role === "user").length;
  const totalAdmin = users.filter(u => u.role === "admin").length;

  return (
    <div className="space-y-6">
      {/* Assign Locations Modal */}
      {editingUserLocs && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[20000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-2xl">
              <div>
                <h3 className="font-display font-black text-slate-900 dark:text-slate-100 text-lg">
                  📍 Penugasan Kelola Tempat
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Pilih lokasi wisata Pacitan yang boleh dikelola oleh <strong className="text-slate-800 dark:text-slate-200">{editingUserLocs.name}</strong>
                </p>
              </div>
              <button 
                onClick={() => setEditingUserLocs(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 bg-slate-100 dark:bg-slate-800 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {approvedLocations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-xs">
                  Belum ada objek wisata Explore Pacitan yang aktif (Live). Aktifkan tempat terlebih dahulu di menu "Kelola Tempat".
                </div>
              ) : (
                approvedLocations.map((loc) => {
                  const isChecked = selectedLocs.includes(loc.id);
                  return (
                    <label 
                      key={loc.id} 
                      className={`flex items-start gap-3.5 p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked 
                          ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/20" 
                          : "border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleLocSelection(loc.id)}
                        className="mt-1 accent-teal-600 rounded text-teal-600 cursor-pointer"
                      />
                      <div className="flex-1 text-xs sm:text-sm">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{loc.name}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block">📍 {loc.address}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 text-xs rounded-b-2xl text-slate-800 dark:text-slate-100">
              <button 
                onClick={() => setEditingUserLocs(null)}
                className="px-4 py-2 border dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer font-semibold"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveAssignments}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer font-bold shadow"
              >
                Simpan Penugasan ({selectedLocs.length})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Account Deletion */}
      {confirmDeleteUser && createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[20000] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-rose-50/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <span className="text-xl">⚠️</span>
                <h3 className="font-display font-black text-slate-900 dark:text-slate-100 text-base">
                  Konfirmasi Hapus Akun
                </h3>
              </div>
              <button 
                onClick={() => setConfirmDeleteUser(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 bg-white dark:bg-slate-800 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-left">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus akun pengguna ini secara permanen dari sistem <strong className="text-slate-900 dark:text-white font-bold">Explore Pacitan</strong>?
              </p>

              {/* User Info Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Nama Akun:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{confirmDeleteUser.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Email / Kontak:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{confirmDeleteUser.email || "-"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Peran Sistem:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    confirmDeleteUser.role === 'admin' 
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' 
                      : confirmDeleteUser.role === 'pengelola'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                  }`}>
                    {confirmDeleteUser.role === 'admin' ? 'ADMIN SEKUNDER' : confirmDeleteUser.role.toUpperCase()}
                  </span>
                </div>
                {confirmDeleteUser.role === "pengelola" && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 font-medium">Kelola Tempat:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{(confirmDeleteUser.managedLocations || []).length} Lokasi Wisata</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-2.5">
                <span className="text-amber-600 dark:text-amber-400 text-base flex-shrink-0 mt-0.5">🚨</span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                  <strong className="font-bold underline">Peringatan Permanen:</strong> Tindakan ini tidak dapat dibatalkan. Seluruh hak akses dan penugasan kelola tempat untuk akun ini akan langsung dicabut dari sistem.
                </p>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteUser}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-lg cursor-pointer flex items-center gap-1.5"
              >
                <span>🗑️ Ya, Hapus Akun Permanen</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium font-mono">
        <Link to="/admin" className="hover:text-teal-700">SLA Dashboard</Link>
        <ChevronRight size={12} />
        <span className="text-slate-600">Kelola Pengelola</span>
      </div>

      {/* Hero Header */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-display font-black text-slate-900 dark:text-slate-100 text-2xl">👥 Kelola Pengelola & Pengguna</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Meningkatkan peran akun pengguna terdaftar menjadi Pengelola (Moderator) atau sebaliknya, dan mengatur penugasan objek wisata.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap text-[10px] sm:text-xs">
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border px-3 py-1 rounded-full font-bold">
            Total User: {totalUser}
          </span>
          <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-3 py-1 rounded-full font-bold">
            Pengelola: {totalPengelola}
          </span>
          <span className="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/50 px-3 py-1 rounded-full font-bold">
            Admin: {totalAdmin}
          </span>
        </div>
      </div>

      {/* Add New User Manually Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
            ➕ Daftarkan Akun Baru sebagai Pengelola / Pengguna
          </h3>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs text-teal-600 hover:text-teal-700 font-bold bg-teal-50 dark:bg-teal-950/20 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-900/50 cursor-pointer"
          >
            {showAddForm ? "Sembunyikan Form" : "Tampilkan Form Pendaftaran"}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 p-4 bg-slate-50 dark:bg-slate-800/40 border dark:border-slate-800 rounded-xl animate-in fade-in duration-200">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Nama Lengkap</label>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full text-xs sm:text-sm px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Alamat Email</label>
              <input 
                type="email" 
                value={newEmail} 
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="budi@example.com"
                className="w-full text-xs sm:text-sm px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Pilih Peran Perdana</label>
              <select 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-500 cursor-pointer text-slate-800 dark:text-slate-105"
              >
                <option value="user">User biasa (Wisatawan)</option>
                <option value="pengelola">Pengelola Wisata (Moderator)</option>
                <option value="admin">Administrator Utama</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer text-xs sm:text-sm shadow flex items-center justify-center gap-1.5 animate-pulse-once"
              >
                <span>Daftarkan Akun</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-100 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-800">
        <div className="w-full sm:max-w-sm relative">
          <input 
            type="text" 
            placeholder="Cari nama atau email pengguna..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs sm:text-sm px-4 py-2 bg-white dark:bg-slate-900 border dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-teal-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={() => setFilterRole("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              filterRole === "all" ? "bg-teal-600 text-white shadow-sm" : "bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 dark:text-slate-300 border dark:border-slate-700"
            }`}
          >
            Semua
          </button>
          <button 
            onClick={() => setFilterRole("pengelola")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              filterRole === "pengelola" ? "bg-amber-600 text-white shadow-sm" : "bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 dark:text-slate-300 border dark:border-slate-700"
            }`}
          >
            Pengelola Only
          </button>
          <button 
            onClick={() => setFilterRole("user")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              filterRole === "user" ? "bg-emerald-600 text-white shadow-sm" : "bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 dark:text-slate-300 border dark:border-slate-700"
            }`}
          >
            User Only
          </button>
        </div>
      </div>

      {/* User Listing Grid/Table */}
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 italic text-xs">
            Tidak ditemukan pengguna yang sesuai dengan kriteria pencarian Anda.
          </div>
        ) : (
          filteredUsers.map((u, idx) => {
            const isSelf = u.id === currentUser.id;
            const isManager = u.role === "pengelola";
            const numManaged = u.managedLocations?.length || 0;

            return (
              <div key={`${u.id}_${idx}`} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition duration-150 text-slate-800 dark:text-slate-100">
                {/* User Info */}
                <div className="flex gap-3.5 items-center flex-1 min-w-0">
                  <img 
                    src={u.avatarUrl} 
                    alt={u.name} 
                    className="w-12 h-12 rounded-full border dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800" 
                    referrerPolicy="no-referrer" 
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{u.name}</h4>
                      {isSelf && (
                        <span className="bg-slate-150 text-slate-600 text-[9px] px-1.5 rounded-full font-bold">Anda</span>
                      )}
                      <span className={`px-2 py-0.2 rounded text-[8px] font-mono tracking-wider font-bold uppercase ${
                        u.role === 'admin' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/50' 
                          : u.role === 'pengelola' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50'
                      }`}>
                        {u.role === 'admin' 
                          ? (isDefaultAdminUtamaUser(u) ? "Admin Utama" : "Admin Sekunder") 
                          : u.role === 'pengelola' ? "Pengelola" : "Wisatawan"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">{u.email || "Email tidak tersedia"}</span>

                    {/* If Pengelola, display which places they manage */}
                    {isManager && (
                      <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tempat Penugasan:</span>
                        {numManaged === 0 ? (
                          <span className="text-[10px] text-rose-500 italic">Belum ditugaskan (Semua)</span>
                        ) : (
                          u.managedLocations?.map(locId => {
                            const name = locations.find(l => l.id === locId)?.name || locId;
                            return (
                              <span key={locId} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {name}
                              </span>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations & Role switching */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  {/* Select box for direct role change */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-100">
                    <span className="text-slate-400">Ubah Peran:</span>
                    <select
                      value={u.role}
                      disabled={isDefaultAdminUtamaUser(u) || (u.role === "admin" && !isDefaultAdminUtamaUser(currentUser))}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      <option value="user">User (Wisatawan)</option>
                      <option value="pengelola">Pengelola (Moderator)</option>
                      <option value="admin">{isDefaultAdminUtamaUser(u) ? "Admin Utama" : "Admin Sekunder"}</option>
                    </select>
                  </div>

                  {/* Assign Locations Action (Pengelola exclusive) */}
                  {isManager && (
                    <button
                      onClick={() => handleOpenAssignModal(u)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs flex items-center gap-1"
                    >
                      <span>📍 Kelola Tempat ({numManaged})</span>
                    </button>
                  )}

                  {/* Delete accounts action */}
                  {!isDefaultAdminUtamaUser(u) && !isSelf && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-500 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-400 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1 border border-red-200 dark:border-red-800/40 shadow-xs"
                      title="Hapus Akun Pengguna / Pengelola ini"
                    >
                      <span>🗑️ Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
