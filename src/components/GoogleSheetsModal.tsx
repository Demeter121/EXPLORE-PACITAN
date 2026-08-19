import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  FileSpreadsheet, 
  DownloadCloud, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Copy, 
  X, 
  Sparkles, 
  Lock, 
  PlusCircle, 
  Database, 
  Trash2, 
  Check, 
  ClipboardPaste, 
  BookOpen, 
  Zap, 
  Globe, 
  Clock, 
  ChevronDown, 
  Layers, 
  Search, 
  Table, 
  CheckCheck,
  Edit3,
  ListFilter,
  LogOut
} from "lucide-react";
import { Location, LocationCategory } from "../types";
import { getTranslation, Language } from "../lib/i18n";
import { 
  signInWithPopup, 
  getCachedGoogleAccessToken, 
  setCachedGoogleAccessToken, 
  getFirebaseAuth, 
  getGoogleSheetsAuthProvider 
} from "../lib/firebase";
import { GoogleAuthProvider } from "firebase/auth";
import { 
  getSpreadsheetDetails, 
  exportLocationsToSpreadsheet, 
  importLocationsFromSpreadsheet, 
  createNewSpreadsheetWithLocations, 
  extractSpreadsheetId,
  SHEETS_COLUMNS,
  SpreadsheetMetadata,
  SavedSpreadsheetItem,
  DriveSpreadsheetItem,
  fetchUserDriveSpreadsheets,
  getSavedSpreadsheets,
  saveSpreadsheetToHistory,
  removeSavedSpreadsheet,
  getActiveSpreadsheetId,
  setActiveSpreadsheetId,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getLastSyncTime,
  CategorySheetConfig,
  getCategorySheetsMapping,
  saveCategorySheetsMapping,
  updateSingleCategoryConfig,
  importFromAllCategorySheets,
  exportToAllCategorySheets,
  DEFAULT_CATEGORY_MAPPING
} from "../lib/googleSheets";
import { clearFirestoreCollection } from "../lib/firestoreSync";

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onImportSuccess: (importedLocations: Location[], mode: "replace" | "merge") => void;
  currentUserId: string;
  language?: "id" | "en";
}

interface CategoryMeta {
  key: LocationCategory;
  name: string;
  emoji: string;
  desc: string;
  defaultSheet: string;
  badgeBg: string;
  badgeBorder: string;
}

const CATEGORY_META_LIST: CategoryMeta[] = [
  { key: "wisata", name: "Wisata & Destinasi", emoji: "🏝️", desc: "Pantai, Goa, Air Terjun, Candi, Wisata Alam & Sejarah", defaultSheet: "Wisata", badgeBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300", badgeBorder: "border-blue-200 dark:border-blue-800" },
  { key: "penginapan", name: "Hotel & Penginapan", emoji: "🏨", desc: "Hotel, Homestay, Villa, Resort, Guest House", defaultSheet: "Penginapan", badgeBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300", badgeBorder: "border-purple-200 dark:border-purple-800" },
  { key: "makan", name: "Kuliner & Resto", emoji: "🍲", desc: "Restoran, Rumah Makan, Warung Makan, Seafood", defaultSheet: "Wisata Makan / Kuliner", badgeBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300", badgeBorder: "border-amber-200 dark:border-amber-800" },
  { key: "coffeeshop", name: "Kafe & Coffeeshop", emoji: "☕", desc: "Coffeeshop, Kedai Kopi, Kafe, Warkop, Slowbar", defaultSheet: "Coffeeshop", badgeBg: "bg-amber-100/60 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300", badgeBorder: "border-yellow-700/30 dark:border-yellow-700/50" },
  { key: "belanja", name: "Oleh-Oleh & Belanja", emoji: "🛍️", desc: "Pusat Oleh-Oleh, Toko Souvenir, Pasar, Swalayan", defaultSheet: "Belanja", badgeBg: "bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300", badgeBorder: "border-pink-200 dark:border-pink-800" },
  { key: "lainnya", name: "Fasilitas & Lainnya", emoji: "📍", desc: "SPBU, Rest Area, Fasilitas Publik, Terminal, Layanan", defaultSheet: "Lainnya", badgeBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300", badgeBorder: "border-slate-200 dark:border-slate-700" },
];

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  locations,
  onImportSuccess,
  currentUserId,
  language = "id",
}) => {
  const t = getTranslation(language as Language);
  const [accessToken, setAccessToken] = useState<string | null>(getCachedGoogleAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Single Master Spreadsheet URL / ID
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(() => {
    return getActiveSpreadsheetId() || "";
  });
  
  const [savedDatabases, setSavedDatabases] = useState<SavedSpreadsheetItem[]>(() => {
    return getSavedSpreadsheets();
  });
  
  const [categoryMappings, setCategoryMappings] = useState<Record<LocationCategory, CategorySheetConfig>>(() => {
    return getCategorySheetsMapping();
  });
  
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<"semua" | LocationCategory>("semua");
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<DriveSpreadsheetItem[]>([]);
  const [driveSearchTerm, setDriveSearchTerm] = useState<string>("");
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("Sheet1");
  const [activeTab, setActiveTab] = useState<"categories" | "sync" | "databases" | "create" | "guide">("categories");
  const [newSheetTitle, setNewSheetTitle] = useState<string>("Database Wisata Pacitan - Multi Kategori");
  const [autoSync, setAutoSync] = useState<boolean>(() => isAutoSyncEnabled());
  const [lastSync, setLastSync] = useState<string | null>(() => getLastSyncTime());
  
  // Custom tab input toggle per category
  const [customTabInputs, setCustomTabInputs] = useState<Record<string, boolean>>({});

  // Real-time selector dropdown popover states
  const [isSheetSelectorOpen, setIsSheetSelectorOpen] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Loading & status states
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string; url?: string } | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  
  // Confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: "export" | "import_merge" | "import_replace" | "delete_saved";
    onConfirm: () => void;
  } | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSheetSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadDriveFiles = async (tokenToUse?: string) => {
    const token = tokenToUse || accessToken || getCachedGoogleAccessToken();
    if (!token) return;
    setIsLoadingDriveFiles(true);
    setDriveError(null);
    try {
      const files = await fetchUserDriveSpreadsheets(token);
      setDriveSpreadsheets(files || []);
    } catch (err: any) {
      console.warn("Gagal membaca daftar file dari Google Drive:", err);
      setDriveError(err?.message || "Gagal memuat file dari Google Drive.");
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  const handleDisconnectGoogle = () => {
    setCachedGoogleAccessToken(null);
    setAccessToken(null);
    setDriveSpreadsheets([]);
    setFeedback({
      type: "info",
      message: "Akun Google telah diputuskan. Anda dapat menghubungkan ulang kapan saja.",
    });
  };

  const handleRefreshOAuth = async () => {
    setCachedGoogleAccessToken(null);
    setAccessToken(null);
    await handleGoogleAuth();
  };

  // Smart auto match tabs to categories based on detected sheets
  const autoMatchCategoryTabs = (meta?: SpreadsheetMetadata | null) => {
    const targetMeta = meta || metadata;
    if (!targetMeta || !targetMeta.sheets || targetMeta.sheets.length === 0) return 0;

    const availableTabs = targetMeta.sheets.map(s => s.title);
    const updated = { ...categoryMappings };

    const rules: { key: LocationCategory; patterns: RegExp[] }[] = [
      { key: "wisata", patterns: [/wisata/i, /destinasi/i, /pantai/i, /alam/i, /data.*lokasi/i] },
      { key: "penginapan", patterns: [/penginapan/i, /hotel/i, /homestay/i, /villa/i, /resort/i, /lodging/i] },
      { key: "makan", patterns: [/makan/i, /kuliner/i, /resto/i, /restoran/i, /seafood/i, /food/i] },
      { key: "coffeeshop", patterns: [/coffee/i, /kafe/i, /cafe/i, /kopi/i, /warkop/i] },
      { key: "belanja", patterns: [/belanja/i, /oleh/i, /souvenir/i, /pasar/i, /toko/i, /shop/i] },
      { key: "lainnya", patterns: [/lainnya/i, /fasilitas/i, /spbu/i, /umum/i, /other/i] },
    ];

    let matchCount = 0;
    rules.forEach(({ key, patterns }) => {
      for (const pattern of patterns) {
        const found = availableTabs.find(tabName => pattern.test(tabName));
        if (found) {
          updated[key] = {
            ...updated[key],
            category: key,
            spreadsheetId: targetMeta.spreadsheetId,
            sheetTitle: found,
          };
          matchCount++;
          break;
        }
      }
    });

    setCategoryMappings(updated);
    saveCategorySheetsMapping(updated);
    return matchCount;
  };

  useEffect(() => {
    const token = getCachedGoogleAccessToken();
    if (token) {
      setAccessToken(token);
      loadDriveFiles(token);
    }
    const saved = getSavedSpreadsheets();
    setSavedDatabases(saved);
    const activeId = getActiveSpreadsheetId();
    if (activeId && !spreadsheetInput) {
      setSpreadsheetInput(activeId);
    }
    setAutoSync(isAutoSyncEnabled());
    setLastSync(getLastSyncTime());
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && spreadsheetInput.trim() && !metadata && !isLoadingMetadata) {
      handleLoadMetadata(spreadsheetInput.trim(), false);
    }
  }, [isOpen, accessToken]);

  const handleGoogleAuth = async () => {
    setIsAuthenticating(true);
    setFeedback(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGoogleSheetsAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(res);
      const token = credential?.accessToken || getCachedGoogleAccessToken();
      
      if (token) {
        setCachedGoogleAccessToken(token);
        setAccessToken(token);
        setFeedback({
          type: "success",
          message: `Berhasil terhubung dengan Google Sheets: ${res.user.email || "Pengguna"}`,
        });
        await loadDriveFiles(token);
        if (spreadsheetInput.trim()) {
          setTimeout(() => {
            handleLoadMetadata(spreadsheetInput.trim(), true);
          }, 300);
        }
      } else {
        setFeedback({
          type: "error",
          message: "Gagal memperoleh izin akses Google Sheets & Drive. Pastikan Anda menyetujui izin saat login.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Terjadi kesalahan saat mengautentikasi akun Google.",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLoadMetadata = async (idToUse?: string, showSuccessBanner = true) => {
    const targetId = extractSpreadsheetId(idToUse || spreadsheetInput);
    if (!targetId) {
      setFeedback({
        type: "error",
        message: "Silakan masukkan ID Spreadsheet atau URL Google Sheets yang valid.",
      });
      return;
    }

    setIsLoadingMetadata(true);
    setFeedback(null);
    try {
      const meta = await getSpreadsheetDetails(targetId, accessToken);
      setMetadata(meta);
      setSpreadsheetInput(meta.spreadsheetId);
      setActiveSpreadsheetId(meta.spreadsheetId);
      
      // Update saved history
      const updatedSaved = saveSpreadsheetToHistory({
        spreadsheetId: meta.spreadsheetId,
        title: meta.title,
        spreadsheetUrl: meta.spreadsheetUrl,
        sheetCount: meta.sheets.length,
      });
      setSavedDatabases(updatedSaved);

      if (meta.sheets.length > 0) {
        const exists = meta.sheets.some(s => s.title === selectedSheet);
        if (!exists) {
          setSelectedSheet(meta.sheets[0].title);
        }
      }

      // Auto match detected sheet tabs to categories
      autoMatchCategoryTabs(meta);

      if (showSuccessBanner) {
        setFeedback({
          type: "success",
          message: `Spreadsheet aktif: "${meta.title}" (${meta.sheets.length} tab terdeteksi secara realtime).`,
          url: meta.spreadsheetUrl,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Gagal membaca info spreadsheet. Pastikan spreadsheet disetel publik ('Siapa saja yang memiliki link dapat melihat').",
      });
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleSwitchDatabase = (dbItem: SavedSpreadsheetItem | { id: string; title: string }) => {
    setSpreadsheetInput(dbItem.id);
    handleLoadMetadata(dbItem.id, true);
    setIsSheetSelectorOpen(false);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSpreadsheetInput(text.trim());
        const cleanId = extractSpreadsheetId(text.trim());
        if (cleanId) {
          handleLoadMetadata(cleanId, true);
        }
      }
    } catch {
      // Ignore clipboard read error
    }
  };

  const handleDeleteSavedDatabase = (idToDelete: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Hapus dari Riwayat Database?",
      description: `Hapus riwayat referensi database "${title}" dari daftar aplikasi? Dokumen asli di Google Drive tidak akan dihapus.`,
      actionType: "delete_saved",
      onConfirm: () => {
        const remaining = removeSavedSpreadsheet(idToDelete);
        setSavedDatabases(remaining);
        if (metadata?.spreadsheetId === idToDelete) {
          if (remaining.length > 0) {
            setSpreadsheetInput(remaining[0].id);
            handleLoadMetadata(remaining[0].id, false);
          } else {
            setMetadata(null);
            setSpreadsheetInput("");
          }
        }
        setFeedback({
          type: "info",
          message: `Referensi database "${title}" telah dihapus dari riwayat aplikasi.`,
        });
        setConfirmDialog(null);
      },
    });
  };

  const handleUpdateCategoryTab = (category: LocationCategory, sheetTitle: string) => {
    const updated = updateSingleCategoryConfig(category, { 
      sheetTitle,
      spreadsheetId: metadata?.spreadsheetId || extractSpreadsheetId(spreadsheetInput)
    });
    setCategoryMappings(updated);
  };

  const handleImportSingleCategory = async (category: LocationCategory) => {
    const activeId = metadata?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!activeId) {
      setFeedback({ type: "error", message: "Masukkan atau pilih Google Spreadsheet terlebih dahulu." });
      return;
    }

    const config = categoryMappings[category] || DEFAULT_CATEGORY_MAPPING[category];
    const sheetName = config.sheetTitle || DEFAULT_CATEGORY_MAPPING[category].sheetTitle || "Sheet1";

    setIsProcessing(true);
    setFeedback(null);
    try {
      const token = accessToken || getCachedGoogleAccessToken();
      const res = await importLocationsFromSpreadsheet(activeId, sheetName, token, currentUserId);

      if (res.importedCount === 0) {
        setFeedback({
          type: "error",
          message: `Tidak ada data valid yang ditemukan pada tab [${sheetName}] untuk kategori ${category}.`,
        });
        return;
      }

      const enforced = res.locations.map(loc => ({ ...loc, category }));
      const safeLocs = Array.isArray(locations) ? locations : [];
      const otherLocations = safeLocs.filter(l => l && l.category !== category);
      const combined = [...otherLocations, ...enforced];

      onImportSuccess(combined, "replace");
      setLastSync(new Date().toISOString());

      setFeedback({
        type: "success",
        message: `Berhasil menarik ${enforced.length} data kategori [${category.toUpperCase()}] dari tab [${sheetName}].`,
        url: metadata?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${activeId}`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || `Gagal mengimpor data kategori ${category} dari tab [${sheetName}]. Pastikan nama tab sesuai.`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSingleCategory = async (category: LocationCategory) => {
    const activeId = metadata?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!activeId) {
      setFeedback({ type: "error", message: "Pilih Google Spreadsheet terlebih dahulu." });
      return;
    }

    const token = accessToken || getCachedGoogleAccessToken();
    if (!token) {
      setFeedback({ type: "error", message: "Akses Google OAuth diperlukan untuk menulis/ekspor ke Google Sheets." });
      return;
    }

    const safeLocs = Array.isArray(locations) ? locations : [];
    const catLocations = safeLocs.filter(l => l && l.category === category);
    if (catLocations.length === 0) {
      setFeedback({ type: "info", message: `Tidak ada data lokasi dengan kategori [${category}] untuk diekspor.` });
      return;
    }

    const config = categoryMappings[category] || DEFAULT_CATEGORY_MAPPING[category];
    const sheetName = config.sheetTitle || DEFAULT_CATEGORY_MAPPING[category].sheetTitle || "Sheet1";

    setIsProcessing(true);
    setFeedback(null);
    try {
      await exportLocationsToSpreadsheet(activeId, sheetName, catLocations, token);
      setFeedback({
        type: "success",
        message: `Berhasil mengekspor ${catLocations.length} data [${category.toUpperCase()}] ke tab [${sheetName}] di Google Spreadsheet!`,
        url: metadata?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${activeId}`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || `Gagal mengekspor data kategori ${category} ke tab [${sheetName}].`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchImportAllCategories = async () => {
    const activeId = metadata?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!activeId) {
      setFeedback({ type: "error", message: "Pilih atau masukkan URL/ID Google Spreadsheet terlebih dahulu." });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const token = accessToken || getCachedGoogleAccessToken();
      const res = await importFromAllCategorySheets(categoryMappings, token, currentUserId, activeId);

      if (res.totalImported === 0 && res.errors.length > 0) {
        setFeedback({
          type: "error",
          message: `Gagal mengimpor dari tab kategori: ${res.errors.join("; ")}`,
        });
        return;
      }

      onImportSuccess(res.locations, "merge");
      setLastSync(new Date().toISOString());

      const summaryPerCat = Object.entries(res.categoryStats)
        .map(([cat, stat]) => `${cat}: ${stat.count}`)
        .join(" | ");

      setFeedback({
        type: "success",
        message: `Berhasil menarik total ${res.totalImported} data dari seluruh tab kategori spreadsheet! (${summaryPerCat})`,
        url: metadata?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${activeId}`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Gagal melakukan impor multi-tab kategori.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchExportAllCategories = async () => {
    const activeId = metadata?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!activeId) {
      setFeedback({ type: "error", message: "Pilih Google Spreadsheet terlebih dahulu." });
      return;
    }

    const token = accessToken || getCachedGoogleAccessToken();
    if (!token) {
      setFeedback({ type: "error", message: "Akses Google OAuth diperlukan untuk menulis/ekspor ke Google Sheets." });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const safeLocs = Array.isArray(locations) ? locations : [];
      const res = await exportToAllCategorySheets(categoryMappings, safeLocs, token, activeId);
      
      if (res.successCount === 0) {
        setFeedback({
          type: "error",
          message: "Gagal mengekspor ke tab kategori. Pastikan nama tab sudah benar dan spreadsheet dapat diakses.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: `Berhasil mengekspor data ke ${res.successCount} tab kategori dalam spreadsheet "${metadata?.title || "Google Sheets"}"!`,
        url: metadata?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${activeId}`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Gagal melakukan ekspor multi-tab kategori.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const executeQuickImport = async (mode: "replace" | "merge") => {
    const targetId = metadata?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!targetId) {
      setFeedback({ type: "error", message: "Masukkan ID atau URL Google Spreadsheet yang ingin ditarik datanya." });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await importLocationsFromSpreadsheet(
        targetId,
        selectedSheet || "Sheet1",
        accessToken,
        currentUserId
      );

      if (res.importedCount === 0) {
        setFeedback({
          type: "error",
          message: "Tidak ada baris data obyek wisata valid yang dapat diimpor dari spreadsheet tab ini.",
        });
        return;
      }

      onImportSuccess(res.locations, mode);
      setLastSync(new Date().toISOString());

      let msg = `Berhasil menyinkronkan ${res.importedCount} data dari tab "${selectedSheet || "Sheet1"}"!`;
      if (res.invalidCount > 0) {
        msg += ` (${res.invalidCount} baris format tidak sesuai).`;
      }

      setFeedback({
        type: "success",
        message: msg,
        url: metadata?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${targetId}`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Gagal mengimpor data. Pastikan Google Sheet dibagikan publik atau login dengan akun Google.",
      });
    } finally {
      setIsProcessing(false);
      setConfirmDialog(null);
    }
  };

  const executeQuickExport = async () => {
    const targetId = metadata?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!targetId) {
      setFeedback({ type: "error", message: "Pilih atau masukkan Google Spreadsheet terlebih dahulu." });
      return;
    }

    if (!accessToken) {
      setFeedback({
        type: "error",
        message: "Untuk mengekspor dan menulis ke Google Spreadsheet, Anda harus menghubungkan Akun Google dengan tombol Login di atas.",
      });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await exportLocationsToSpreadsheet(
        targetId,
        selectedSheet || "Sheet1",
        locations,
        accessToken
      );
      setFeedback({
        type: "success",
        message: `Sukses mengekspor ${locations.length} data destinasi wisata ke tab "${selectedSheet || "Sheet1"}" (${res.updatedCells} sel diperbarui).`,
        url: metadata?.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${targetId}`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Gagal mengekspor data ke Google Spreadsheet.",
      });
    } finally {
      setIsProcessing(false);
      setConfirmDialog(null);
    }
  };

  const executeCreateNewSheet = async () => {
    if (!accessToken) {
      setFeedback({
        type: "error",
        message: "Hubungkan akun Google terlebih dahulu untuk membuat file baru di Google Drive Anda.",
      });
      return;
    }
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await createNewSpreadsheetWithLocations(
        newSheetTitle,
        locations,
        accessToken
      );
      setSpreadsheetInput(res.spreadsheetId);
      
      const updatedSaved = saveSpreadsheetToHistory({
        spreadsheetId: res.spreadsheetId,
        title: newSheetTitle,
        spreadsheetUrl: res.spreadsheetUrl,
        sheetCount: 1,
      });
      setSavedDatabases(updatedSaved);

      setFeedback({
        type: "success",
        message: `Spreadsheet baru berhasil dibuat dan diisi dengan ${res.rowCount} destinasi wisata Pacitan!`,
        url: res.spreadsheetUrl,
      });
      await handleLoadMetadata(res.spreadsheetId, false);
      setActiveTab("categories");
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Gagal membuat spreadsheet baru di Google Drive.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyHeaderTemplate = () => {
    const csvHeader = SHEETS_COLUMNS.join("\t");
    navigator.clipboard.writeText(csvHeader);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    setAutoSyncEnabled(enabled);
    setFeedback({
      type: "info",
      message: enabled
        ? "Auto-Sync AKTIF: Data terbaru di Google Sheet akan otomatis ditarik saat membuka website."
        : "Auto-Sync DINONAKTIFKAN: Sinkronisasi hanya berjalan saat tombol ditarik secara manual.",
    });
  };

  // Detected sheets array from metadata
  const detectedSheetsList = useMemo(() => {
    return metadata?.sheets || [];
  }, [metadata]);

  // Filtered drive files for dropdown selector
  const filteredDriveFiles = useMemo(() => {
    const safeDrive = Array.isArray(driveSpreadsheets) ? driveSpreadsheets : [];
    if (!selectorSearch.trim()) return safeDrive;
    return safeDrive.filter(f => 
      (f?.name || "").toLowerCase().includes(selectorSearch.toLowerCase()) ||
      (f?.id || "").toLowerCase().includes(selectorSearch.toLowerCase())
    );
  }, [driveSpreadsheets, selectorSearch]);

  const filteredSavedDatabases = useMemo(() => {
    const safeSaved = Array.isArray(savedDatabases) ? savedDatabases : [];
    if (!selectorSearch.trim()) return safeSaved;
    return safeSaved.filter(d => 
      (d?.title || "").toLowerCase().includes(selectorSearch.toLowerCase()) ||
      (d?.id || "").toLowerCase().includes(selectorSearch.toLowerCase())
    );
  }, [savedDatabases, selectorSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent dark:from-emerald-950/40 dark:via-teal-950/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-500/10 shrink-0">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                  {t.sheetsTitle}
                </h2>
                <span className="flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  1 Spreadsheet Multi-Tab
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gunakan 1 link Google Spreadsheet dengan tab terpisah untuk masing-masing kategori wisata.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Master Spreadsheet Hero Card */}
        <div className="bg-slate-50/90 dark:bg-slate-950/80 p-4 border-b border-slate-200/80 dark:border-slate-800 space-y-3 shrink-0">
          
          {/* Active File Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Database size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Spreadsheet Utama:
                  </span>
                  {metadata && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold border border-emerald-200 dark:border-emerald-800">
                      {detectedSheetsList.length} Tab Terdeteksi
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {metadata?.title || (spreadsheetInput ? `ID: ${spreadsheetInput}` : "Belum Ada Spreadsheet Terhubung")}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {metadata?.spreadsheetUrl && (
                <a
                  href={metadata.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink size={12} />
                </a>
              )}
              {accessToken ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> OAuth Aktif
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshOAuth}
                    disabled={isAuthenticating}
                    className="px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-xl flex items-center gap-1 cursor-pointer transition"
                    title="Segarkan Izin OAuth & Token Google"
                  >
                    <RefreshCw size={11} className={isAuthenticating ? "animate-spin" : ""} />
                    <span>Refresh OAuth</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                    title="Putuskan sambungan Akun Google"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleAuth}
                  disabled={isAuthenticating}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  <Globe size={13} />
                  <span>{isAuthenticating ? "Menghubungkan..." : "Login Akun Google"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Spreadsheet Input and Switcher */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              
              {/* Input URL/ID with Paste button */}
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  onBlur={() => {
                    if (spreadsheetInput.trim() && spreadsheetInput.trim() !== metadata?.spreadsheetId) {
                      handleLoadMetadata(spreadsheetInput.trim(), true);
                    }
                  }}
                  placeholder="Paste URL Google Sheets (contoh: https://docs.google.com/spreadsheets/d/...) atau ID"
                  className="w-full text-xs font-mono pl-3.5 pr-20 py-2.5 rounded-2xl border-2 border-emerald-500/30 hover:border-emerald-500 focus:border-emerald-600 dark:border-slate-700 dark:hover:border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs transition focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="absolute right-2 px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1 cursor-pointer transition active:scale-95"
                  title="Tempel dari Clipboard"
                >
                  <ClipboardPaste size={12} />
                  <span>Tempel</span>
                </button>
              </div>

              {/* Action Buttons: Pick from Drive & Load */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSheetSelectorOpen(!isSheetSelectorOpen)}
                  className="px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition shrink-0"
                >
                  <Database size={14} className="text-emerald-600" />
                  <span>Pilih File Drive ({driveSpreadsheets.length || savedDatabases.length})</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isSheetSelectorOpen ? "rotate-180" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadMetadata(spreadsheetInput, true)}
                  disabled={isLoadingMetadata || !spreadsheetInput.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md shadow-emerald-600/20 cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw size={13} className={isLoadingMetadata ? "animate-spin" : ""} />
                  <span>{isLoadingMetadata ? "Memuat..." : "Muat Tab"}</span>
                </button>
              </div>
            </div>

            {/* Dropdown Popover for Drive Files and History */}
            {isSheetSelectorOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150 max-h-80 flex flex-col">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={selectorSearch}
                    onChange={(e) => setSelectorSearch(e.target.value)}
                    placeholder="Cari nama spreadsheet di Drive atau Riwayat..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar max-h-56">
                  {accessToken && (
                    <div>
                      <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 px-2 py-1 uppercase tracking-wider flex justify-between items-center">
                        <span>Google Drive Anda ({filteredDriveFiles.length})</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); loadDriveFiles(); }} 
                          className="text-[10px] lowercase text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw size={10} className={isLoadingDriveFiles ? "animate-spin" : ""} /> refresh
                        </button>
                      </div>

                      {filteredDriveFiles.length === 0 ? (
                        <div className="p-2 text-center text-xs text-slate-400 italic">
                          {isLoadingDriveFiles ? "Memindai Drive..." : "Tidak ada file yang cocok"}
                        </div>
                      ) : (
                        filteredDriveFiles.map((df) => {
                          const isCurrent = df.id === metadata?.spreadsheetId || df.id === spreadsheetInput;
                          return (
                            <button
                              key={df.id}
                              type="button"
                              onClick={() => handleSwitchDatabase(df)}
                              className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2 transition cursor-pointer ${
                                isCurrent
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 font-bold border border-emerald-300 dark:border-emerald-800"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileSpreadsheet size={14} className={isCurrent ? "text-emerald-600" : "text-slate-400"} />
                                <span className="truncate">{df.name}</span>
                              </div>
                              {isCurrent && <Check size={14} className="text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}

                  {filteredSavedDatabases.length > 0 && (
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider">
                        Riwayat Spreadsheet ({filteredSavedDatabases.length})
                      </div>
                      {filteredSavedDatabases.map((s) => {
                        const isCurrent = s.id === metadata?.spreadsheetId || s.id === spreadsheetInput;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSwitchDatabase(s)}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2 transition cursor-pointer ${
                              isCurrent
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 font-bold border border-emerald-300 dark:border-emerald-800"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Database size={13} className={isCurrent ? "text-emerald-600" : "text-slate-400"} />
                              <span className="truncate">{s.title}</span>
                            </div>
                            {isCurrent && <Check size={14} className="text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Realtime Detected Sheet Tabs Quick Pills */}
          {detectedSheetsList.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-2 no-scrollbar border-t border-slate-200/70 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/60 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                <Table size={12} className="text-teal-600" />
                Tab Terdeteksi ({detectedSheetsList.length}):
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {detectedSheetsList.map((s) => (
                  <button
                    key={s.sheetId}
                    type="button"
                    onClick={() => {
                      setSelectedSheet(s.title);
                      setActiveTab("sync");
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      selectedSheet === s.title
                        ? "bg-teal-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                    title="Klik untuk membuka tab ini di mode sinkronisasi cepat"
                  >
                    <span>📑 {s.title}</span>
                    {selectedSheet === s.title && <Check size={12} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation Bar (Never Clipped or Squashed) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 gap-1 sm:gap-2 text-xs font-semibold overflow-x-auto bg-white dark:bg-slate-900 shrink-0 z-10">
          <button
            onClick={() => setActiveTab("categories")}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition shrink-0 ${
              activeTab === "categories"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Layers size={15} />
            <span>📁 Tab Sheet Kategori (Utama)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
              6
            </span>
          </button>

          <button
            onClick={() => setActiveTab("sync")}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition shrink-0 ${
              activeTab === "sync"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Zap size={15} /> ⚡ Tarik & Ekspor Cepat
          </button>

          <button
            onClick={() => setActiveTab("databases")}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition shrink-0 ${
              activeTab === "databases"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Database size={15} />
            <span>📂 Google Drive & Riwayat</span>
            {(driveSpreadsheets.length > 0 || savedDatabases.length > 0) && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                {driveSpreadsheets.length || savedDatabases.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition shrink-0 ${
              activeTab === "create"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <PlusCircle size={15} /> ✨ Buat Sheet Baru
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`py-3.5 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition shrink-0 ${
              activeTab === "guide"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <BookOpen size={15} /> 📋 Format Kolom
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          
          {/* Feedback message banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                  : feedback.type === "error"
                  ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300"
                  : "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-300"
              }`}
            >
              {feedback.type === "success" && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />}
              {feedback.type === "error" && <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />}
              {feedback.type === "info" && <Sparkles size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className="font-medium leading-relaxed">{feedback.message}</p>
                {feedback.url && (
                  <a
                    href={feedback.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 font-bold underline hover:opacity-80"
                  >
                    Buka Dokumen Google Sheet <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 1: KATEGORI & TAB SHEET (PRIMARY FOCUS - SINGLE SPREADSHEET MULTI-TAB)
              ========================================================================= */}
          {activeTab === "categories" && (
            <div className="space-y-4">
              
              {/* Batch Action Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/5 dark:from-emerald-950/40 dark:via-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-emerald-600 text-white text-xs">
                        <Layers size={16} />
                      </span>
                      <h4 className="font-display font-black text-sm text-slate-900 dark:text-slate-100">
                        1 Spreadsheet untuk Semua Kategori
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      Pilih tab sheet yang sesuai untuk setiap kategori menggunakan dropdown. Tab otomatis diambil langsung dari spreadsheet aktif Anda.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        const count = autoMatchCategoryTabs();
                        setFeedback({
                          type: "info",
                          message: `Berhasil mencocokkan ${count} tab sheet secara otomatis berdasarkan nama kategori.`,
                        });
                      }}
                      className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer transition flex items-center gap-1.5"
                      title="Cocokkan otomatis tab sheet dengan kategori"
                    >
                      <Sparkles size={13} className="text-amber-500" />
                      <span>Auto-Cocokkan</span>
                    </button>

                    <button
                      onClick={handleBatchImportAllCategories}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isProcessing ? <RefreshCw size={13} className="animate-spin" /> : <DownloadCloud size={14} />}
                      <span>⚡ Tarik Semua Tab</span>
                    </button>

                    <button
                      onClick={handleBatchExportAllCategories}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <UploadCloud size={14} />
                      <span>📤 Ekspor Semua Tab</span>
                    </button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-emerald-200/50 dark:border-emerald-800/40 text-[11px] no-scrollbar">
                  <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mr-1 shrink-0">Filter:</span>
                  <button
                    onClick={() => setSelectedCategoryFilter("semua")}
                    className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer transition whitespace-nowrap ${
                      selectedCategoryFilter === "semua"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    Semua ({CATEGORY_META_LIST.length})
                  </button>
                  {CATEGORY_META_LIST.map((meta) => {
                    const safeLocs = Array.isArray(locations) ? locations : [];
                    const count = safeLocs.filter((l) => l && l.category === meta.key).length;
                    return (
                      <button
                        key={meta.key}
                        onClick={() => setSelectedCategoryFilter(meta.key)}
                        className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer transition flex items-center gap-1 whitespace-nowrap ${
                          selectedCategoryFilter === meta.key
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <span>{meta.emoji}</span>
                        <span>{meta.name}</span>
                        <span className="text-[10px] opacity-75 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List of Category Cards with Interactive Tab Dropdowns */}
              <div className="space-y-3">
                {CATEGORY_META_LIST
                  .filter((meta) => selectedCategoryFilter === "semua" || selectedCategoryFilter === meta.key)
                  .map((meta) => {
                    const config = categoryMappings[meta.key] || DEFAULT_CATEGORY_MAPPING[meta.key];
                    const safeLocs = Array.isArray(locations) ? locations : [];
                    const catLocations = safeLocs.filter((l) => l && l.category === meta.key);
                    
                    const currentTabName = config.sheetTitle || meta.defaultSheet;
                    const isTabDetected = detectedSheetsList.some(
                      s => s.title.toLowerCase().trim() === currentTabName.toLowerCase().trim()
                    );
                    const isCustomMode = customTabInputs[meta.key] || false;

                    return (
                      <div
                        key={meta.key}
                        className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border ${
                          isTabDetected ? meta.badgeBorder : "border-slate-200 dark:border-slate-800"
                        } shadow-xs space-y-3 transition hover:shadow-md`}
                      >
                        {/* Header & Meta */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="text-2xl">{meta.emoji}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-display font-black text-sm text-slate-900 dark:text-slate-100">
                                  {meta.name}
                                </h5>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  isTabDetected
                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                    : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                                }`}>
                                  {isTabDetected ? "🟢 Tab Terdeteksi di Sheet" : "🟡 Tab Belum Ada di Sheet"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {meta.desc} • <strong className="text-slate-700 dark:text-slate-300">{catLocations.length} tempat</strong> di peta
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-start sm:self-center">
                            {metadata?.spreadsheetUrl && (
                              <a
                                href={metadata.spreadsheetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition"
                              >
                                <span>Buka Sheet</span>
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Interactive Tab Dropdown Selector */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          
                          <div className="sm:col-span-7 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Table size={13} className="text-teal-600" />
                                <span>Pilih Tab Sheet untuk {meta.name}:</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setCustomTabInputs(prev => ({ ...prev, [meta.key]: !prev[meta.key] }))}
                                className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                              >
                                <Edit3 size={11} />
                                <span>{isCustomMode ? "Gunakan Dropdown" : "Ketik Manual"}</span>
                              </button>
                            </div>

                            {isCustomMode ? (
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={currentTabName}
                                  onChange={(e) => handleUpdateCategoryTab(meta.key, e.target.value)}
                                  placeholder={meta.defaultSheet}
                                  className="flex-1 px-3 py-2 text-xs font-bold rounded-xl border-2 border-teal-500/40 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCustomTabInputs(prev => ({ ...prev, [meta.key]: false }))}
                                  className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl text-xs font-bold"
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <select
                                  value={currentTabName}
                                  onChange={(e) => {
                                    if (e.target.value === "__custom__") {
                                      setCustomTabInputs(prev => ({ ...prev, [meta.key]: true }));
                                    } else {
                                      handleUpdateCategoryTab(meta.key, e.target.value);
                                    }
                                  }}
                                  className="w-full text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border-2 border-teal-500/30 hover:border-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-2xs transition focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                                >
                                  {detectedSheetsList.length > 0 ? (
                                    <>
                                      <optgroup label="📋 Tab Terdeteksi di Spreadsheet Ini">
                                        {detectedSheetsList.map((s) => (
                                          <option key={s.sheetId} value={s.title}>
                                            📑 Tab: {s.title}
                                          </option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="✏️ Opsi Kustom">
                                        <option value="__custom__">➕ Ketik Nama Tab Kustom...</option>
                                      </optgroup>
                                    </>
                                  ) : (
                                    <>
                                      <option value={meta.defaultSheet}>📑 Tab: {meta.defaultSheet}</option>
                                      <option value="Sheet1">📑 Tab: Sheet1</option>
                                      <option value="Data Lokasi(All Data)">📑 Tab: Data Lokasi(All Data)</option>
                                      <option value="__custom__">➕ Ketik Nama Tab Kustom...</option>
                                    </>
                                  )}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-teal-600">
                                  <ChevronDown size={15} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Category Actions */}
                          <div className="sm:col-span-5 flex items-center sm:justify-end gap-2 pt-2 sm:pt-4">
                            <button
                              onClick={() => handleImportSingleCategory(meta.key)}
                              disabled={isProcessing}
                              className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                              title={`Tarik data ${meta.name} dari tab [${currentTabName}]`}
                            >
                              <DownloadCloud size={13} />
                              <span>⚡ Tarik Tab Ini</span>
                            </button>
                            
                            <button
                              onClick={() => handleExportSingleCategory(meta.key)}
                              disabled={isProcessing}
                              className="flex-1 sm:flex-none px-3 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                              title={`Ekspor data ${meta.name} ke tab [${currentTabName}]`}
                            >
                              <UploadCloud size={13} />
                              <span>📤 Ekspor ke Tab</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: SINKRONISASI CEPAT (TAB TUNGGAL)
              ========================================================================= */}
          {activeTab === "sync" && (
            <div className="space-y-4">
              
              {/* Quick Tab Selector */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Table size={15} className="text-teal-600" />
                      Pilih Tab Sheet yang Ingin Disinkronkan:
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Pilih salah satu tab dari spreadsheet aktif untuk menarik atau mengekspor data secara langsung.
                    </p>
                  </div>
                  <span className="text-[11px] text-teal-600 font-bold">
                    {detectedSheetsList.length > 0 ? `${detectedSheetsList.length} Tab Tersedia` : "Sheet1 (Default)"}
                  </span>
                </div>

                <div className="relative">
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="w-full text-xs font-bold pl-3.5 pr-8 py-2.5 rounded-2xl border-2 border-teal-500/30 hover:border-teal-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer shadow-xs transition focus:outline-none"
                  >
                    {detectedSheetsList.length > 0 ? (
                      detectedSheetsList.map((s) => (
                        <option key={s.sheetId} value={s.title}>
                          📑 Tab: {s.title}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Sheet1">📑 Tab: Sheet1</option>
                        <option value="Wisata">🏝️ Tab: Wisata</option>
                        <option value="Penginapan">🏨 Tab: Penginapan</option>
                        <option value="Kuliner">🍲 Tab: Kuliner</option>
                        <option value="Coffeeshop">☕ Tab: Coffeeshop</option>
                        <option value="Belanja">🛍️ Tab: Belanja</option>
                      </>
                    )}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-teal-600">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Hero 1-Click Sync Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-900/10 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap size={18} className="text-amber-300 fill-amber-300" />
                      <h3 className="font-display font-black text-base sm:text-lg">
                        Tarik Data Realtime dari Tab [{selectedSheet || "Sheet1"}]
                      </h3>
                    </div>
                    <p className="text-xs text-emerald-100 mt-1 max-w-xl leading-relaxed">
                      Menghubungkan tab <strong>"{selectedSheet || "Sheet1"}"</strong> langsung ke database peta. Setiap perubahan koordinat, foto, atau teks di Google Sheet akan diperbarui instan.
                    </p>
                  </div>

                  <button
                    onClick={() => executeQuickImport("merge")}
                    disabled={isProcessing || (!metadata && !spreadsheetInput.trim())}
                    className="w-full sm:w-auto px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 font-black text-xs rounded-xl shadow-lg shadow-black/10 cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin text-emerald-700" />
                        <span>Menyinkronkan...</span>
                      </>
                    ) : (
                      <>
                        <DownloadCloud size={16} className="text-emerald-700" />
                        <span>⚡ Tarik Data Sekarang</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Info Bar */}
                <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-100">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Database Aktif: {metadata?.title || (spreadsheetInput ? "Custom Link" : "Belum Ada")}</span>
                  </div>
                  {metadata?.spreadsheetUrl && (
                    <a
                      href={metadata.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-white hover:underline flex items-center gap-1 font-bold"
                    >
                      Buka Google Sheet <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>

              {/* Auto Sync & Last Sync Setting */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => handleToggleAutoSync(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    Sinkronkan otomatis setiap kali membuka website
                  </span>
                </label>

                {lastSync && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <Clock size={12} className="text-emerald-600" />
                    <span>Sinkron terakhir: {new Date(lastSync).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Export Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                        <UploadCloud size={16} />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100">Ekspor ke Google Sheet</h5>
                        <p className="text-[11px] text-slate-500">Tulis data saat ini ke tab [{selectedSheet}]</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                      Kirim seluruh {locations.length} data destinasi & koordinat maps ke spreadsheet tab <strong>[{selectedSheet || "Sheet1"}]</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: "Konfirmasi Ekspor & Timpa Data Spreadsheet",
                        description: `Apakah Anda yakin ingin menulis ${locations.length} data obyek wisata ke spreadsheet "${metadata?.title || "Google Sheets"}" pada tab [${selectedSheet || "Sheet1"}]? Baris sebelumnya di sheet ini akan ditimpa dengan data terbaru.`,
                        actionType: "export",
                        onConfirm: executeQuickExport,
                      });
                    }}
                    disabled={isProcessing}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? "Memproses..." : "📤 Ekspor Data Sekarang"}
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                        <DownloadCloud size={16} />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100">Opsi Impor Lengkap</h5>
                        <p className="text-[11px] text-slate-500">Gabungkan atau timpa seluruh data</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                      Tarik data destinasi dari Google Sheet. Anda dapat menggabungkan dengan database ada atau mengganti total.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => executeQuickImport("merge")}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50"
                      title="Gabungkan data baru dengan data yang sudah ada"
                    >
                      ➕ Gabungkan
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: "Konfirmasi Ganti Seluruh Database Wisata",
                          description: `Tindakan ini akan MENGGANTI seluruh database wisata aplikasi saat ini dengan baris data dari Google Spreadsheet tab [${selectedSheet || "Sheet1"}].`,
                          actionType: "import_replace",
                          onConfirm: () => executeQuickImport("replace"),
                        });
                      }}
                      disabled={isProcessing}
                      className="py-2.5 px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50"
                      title="Ganti semua data dengan isi sheet ini"
                    >
                      🔄 Ganti Total
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100">Kosongkan Database Firebase</h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Hapus semua lokasi tersimpan di cloud database secara permanen.</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm("PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA data lokasi dari Firebase? Tindakan ini tidak dapat dibatalkan.")) {
                      try {
                        await clearFirestoreCollection("locations");
                        setFeedback({ type: "success", message: "Seluruh data lokasi berhasil dihapus dari Firebase." });
                        onImportSuccess([], "replace");
                      } catch (err) {
                        setFeedback({ type: "error", message: "Gagal menghapus data dari Firebase." });
                      }
                    }
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-rose-600/10 shrink-0"
                >
                  <Trash2 size={13} />
                  <span>Kosongkan Database</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 3: GOOGLE DRIVE EXPLORER & RIWAYAT
              ========================================================================= */}
          {activeTab === "databases" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-display font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Database size={16} className="text-emerald-600" />
                    Penjelajah Google Drive & Riwayat Sheet
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pilih dokumen Google Spreadsheet yang ingin Anda jadikan referensi utama.
                  </p>
                </div>
              </div>

              {/* Google Drive Section */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-emerald-600" size={18} />
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                      File di Google Drive Anda
                    </h5>
                  </div>
                  
                  {accessToken && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input 
                          type="text"
                          value={driveSearchTerm}
                          onChange={(e) => setDriveSearchTerm(e.target.value)}
                          placeholder="Cari file..."
                          className="w-36 sm:w-48 text-[11px] px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        onClick={() => loadDriveFiles()}
                        disabled={isLoadingDriveFiles}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg cursor-pointer"
                        title="Segarkan daftar file"
                      >
                        <RefreshCw size={14} className={isLoadingDriveFiles ? "animate-spin" : ""} />
                      </button>
                    </div>
                  )}
                </div>

                {!accessToken ? (
                  <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <Lock size={20} />
                    </div>
                    <p className="text-xs text-slate-500">Login akun Google untuk memilih file langsung dari Google Drive Anda.</p>
                    <button
                      onClick={handleGoogleAuth}
                      disabled={isAuthenticating}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition active:scale-95"
                    >
                      {isAuthenticating ? "Menghubungkan..." : "Masuk dengan Google (OAuth)"}
                    </button>
                  </div>
                ) : isLoadingDriveFiles ? (
                  <div className="p-10 text-center space-y-3">
                    <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">Sedang memindai Google Drive Anda...</p>
                  </div>
                ) : driveError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2 text-center">
                    <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{driveError}</p>
                    <button
                      onClick={handleRefreshOAuth}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Login Ulang / Refresh Izin OAuth
                    </button>
                  </div>
                ) : driveSpreadsheets.length === 0 ? (
                  <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      Tidak ada file spreadsheet yang ditemukan atau sesi OAuth membutuhkan pembaruan izin Drive.
                    </p>
                    <button
                      onClick={handleRefreshOAuth}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
                    >
                      Perbarui Izin OAuth Google
                    </button>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {(driveSpreadsheets || [])
                      .filter(f => (f?.name || "").toLowerCase().includes(driveSearchTerm.toLowerCase()))
                      .map((df) => {
                        const isCurrent = df.id === metadata?.spreadsheetId || df.id === spreadsheetInput;
                        const dateFormatted = df.modifiedTime ? new Date(df.modifiedTime).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "";
                        
                        return (
                          <div 
                            key={df.id}
                            onClick={() => {
                              handleSwitchDatabase(df);
                              setActiveTab("categories");
                            }}
                            className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                              isCurrent 
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-800" 
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 hover:shadow-xs"
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCurrent ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                                <FileSpreadsheet size={18} />
                              </div>
                              <div className="overflow-hidden">
                                <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                  {df.name}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                                  <span>ID: {df.id.substring(0, 10)}...</span>
                                  {dateFormatted && <span>• Diubah: {dateFormatted}</span>}
                                </div>
                              </div>
                            </div>
                            
                            <div className="shrink-0">
                              {isCurrent ? (
                                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                  <Check size={14} strokeWidth={3} />
                                </div>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg hover:bg-emerald-600 hover:text-white transition">
                                  Pilih
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Saved Databases List */}
              {savedDatabases.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Riwayat Spreadsheet Tersimpan ({savedDatabases.length})
                  </h5>
                  <div className="space-y-2">
                    {savedDatabases.map((item) => {
                      const isActive = (metadata?.spreadsheetId || spreadsheetInput) === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                            isActive
                              ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <h6 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{item.title}</h6>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {item.id.slice(0, 16)}... • {item.sheetCount} tab</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                handleSwitchDatabase(item);
                                setActiveTab("categories");
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                            >
                              Gunakan
                            </button>
                            <button
                              onClick={() => handleDeleteSavedDatabase(item.id, item.title)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Hapus riwayat"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 4: BUAT SHEET BARU
              ========================================================================= */}
          {activeTab === "create" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <Sparkles size={16} /> Buat Dokumen Google Sheets Baru Otomatis
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Fitur ini akan langsung membuat file spreadsheet baru di Google Drive Anda, menyusun header kolom maps secara otomatis, dan mengisi seluruh {locations.length} data destinasi wisata Pacitan.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Judul Spreadsheet Baru:
                </label>
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="Nama file spreadsheet..."
                  className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <button
                onClick={executeCreateNewSheet}
                disabled={isProcessing || !accessToken || !newSheetTitle.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Membuat Spreadsheet di Google Drive...
                  </>
                ) : (
                  <>
                    <PlusCircle size={16} /> Buat & Tulis {locations.length} Destinasi ke Google Sheets
                  </>
                )}
              </button>
            </div>
          )}

          {/* =========================================================================
              TAB 5: PANDUAN FORMAT KOLOM
              ========================================================================= */}
          {activeTab === "guide" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Daftar Kolom Standar Google Sheets:
                </h4>
                <button
                  onClick={copyHeaderTemplate}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Copy size={13} /> {copiedTemplate ? "Tersalin!" : "Salin Header Kolom"}
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">No</th>
                      <th className="p-2.5">Nama Kolom</th>
                      <th className="p-2.5">Tipe Data</th>
                      <th className="p-2.5">Contoh / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {SHEETS_COLUMNS.map((col, idx) => (
                      <tr key={col} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">{col}</td>
                        <td className="p-2.5 text-slate-500">{col === "Latitude" || col === "Longitude" || col === "Rating" || col === "Ulasan" ? "Number" : "Text"}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400 font-sans">
                          {col === "Latitude" && "-8.2123"}
                          {col === "Longitude" && "111.0543"}
                          {col === "Foto URLs" && "https://... | https://... (pisahkan dengan |)"}
                          {col === "Kategori" && "wisata, penginapan, makan, coffeeshop, belanja, lainnya"}
                          {col === "Fasilitas" && "Parkir, Musholla, Toilet (pisahkan koma)"}
                          {col === "Google Place ID" && "ChIJgQjeQFncey4RmuU0JUioWjg"}
                          {!["Latitude", "Longitude", "Foto URLs", "Kategori", "Fasilitas", "Google Place ID"].includes(col) && "String teks bebas"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-400 dark:text-slate-500 font-mono">
            {locations.length} Destinasi Tersedia di Aplikasi
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* Confirmation Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle size={26} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="font-display font-black text-slate-900 dark:text-slate-100 text-base">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                {confirmDialog.description}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
