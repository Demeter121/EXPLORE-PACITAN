import { Location, LocationCategory } from "../types";

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: {
    sheetId: number;
    title: string;
    index: number;
  }[];
}

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

export interface SavedSpreadsheetItem {
  id: string;
  title: string;
  url: string;
  sheetCount: number;
  lastUsedAt: string;
  isActive?: boolean;
}

export interface CategorySheetConfig {
  category: LocationCategory;
  spreadsheetId: string;
  sheetTitle: string;
  title?: string;
  updatedAt?: string;
}

const STORAGE_SAVED_SHEETS_KEY = "sipp_saved_spreadsheets_list";
const STORAGE_ACTIVE_SHEET_KEY = "sipp_last_spreadsheet_id";
const STORAGE_AUTO_SYNC_KEY = "sipp_auto_sync_sheets";
const STORAGE_LAST_SYNC_TIME_KEY = "sipp_last_sheet_sync_time";
const STORAGE_CATEGORY_MAPPING_KEY = "sipp_category_sheets_mapping";

export const DEFAULT_CATEGORY_MAPPING: Record<LocationCategory, CategorySheetConfig> = {
  wisata: {
    category: "wisata",
    spreadsheetId: "",
    sheetTitle: "Wisata",
    title: "Sheet Wisata & Destinasi",
  },
  penginapan: {
    category: "penginapan",
    spreadsheetId: "",
    sheetTitle: "Penginapan",
    title: "Sheet Hotel & Penginapan",
  },
  makan: {
    category: "makan",
    spreadsheetId: "",
    sheetTitle: "Kuliner",
    title: "Sheet Kuliner & Rumah Makan",
  },
  coffeeshop: {
    category: "coffeeshop",
    spreadsheetId: "",
    sheetTitle: "Coffeeshop",
    title: "Sheet Kafe & Coffeeshop",
  },
  belanja: {
    category: "belanja",
    spreadsheetId: "",
    sheetTitle: "Belanja",
    title: "Sheet Oleh-Oleh & Belanja",
  },
  lainnya: {
    category: "lainnya",
    spreadsheetId: "",
    sheetTitle: "Lainnya",
    title: "Sheet Fasilitas & Lainnya",
  },
};

export function getCategorySheetsMapping(): Record<LocationCategory, CategorySheetConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_CATEGORY_MAPPING_KEY);
    if (!raw) return { ...DEFAULT_CATEGORY_MAPPING };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CATEGORY_MAPPING,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_CATEGORY_MAPPING };
  }
}

export function saveCategorySheetsMapping(
  mapping: Record<LocationCategory, CategorySheetConfig>
): void {
  try {
    localStorage.setItem(STORAGE_CATEGORY_MAPPING_KEY, JSON.stringify(mapping));
  } catch {
    // Ignore storage errors
  }
}

export function updateSingleCategoryConfig(
  category: LocationCategory,
  config: Partial<CategorySheetConfig>
): Record<LocationCategory, CategorySheetConfig> {
  const current = getCategorySheetsMapping();
  const updated: Record<LocationCategory, CategorySheetConfig> = {
    ...current,
    [category]: {
      ...current[category],
      ...config,
      category,
      updatedAt: new Date().toISOString(),
    },
  };
  saveCategorySheetsMapping(updated);
  return updated;
}

export function getSavedSpreadsheets(): SavedSpreadsheetItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_SHEETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function saveSpreadsheetToHistory(meta: {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetCount: number;
}): SavedSpreadsheetItem[] {
  try {
    const current = getSavedSpreadsheets();
    const existingIdx = current.findIndex((item) => item.id === meta.spreadsheetId);
    const now = new Date().toISOString();

    const newItem: SavedSpreadsheetItem = {
      id: meta.spreadsheetId,
      title: meta.title || "Spreadsheet Database",
      url: meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${meta.spreadsheetId}`,
      sheetCount: meta.sheetCount || 1,
      lastUsedAt: now,
      isActive: true,
    };

    let updated: SavedSpreadsheetItem[];
    if (existingIdx !== -1) {
      updated = current.map((item, idx) =>
        idx === existingIdx
          ? { ...item, ...newItem, isActive: true }
          : { ...item, isActive: false }
      );
    } else {
      updated = [newItem, ...current.map((item) => ({ ...item, isActive: false }))];
    }

    localStorage.setItem(STORAGE_SAVED_SHEETS_KEY, JSON.stringify(updated));
    localStorage.setItem(STORAGE_ACTIVE_SHEET_KEY, meta.spreadsheetId);
    return updated;
  } catch {
    return [];
  }
}

export function removeSavedSpreadsheet(spreadsheetId: string): SavedSpreadsheetItem[] {
  try {
    const current = getSavedSpreadsheets();
    const filtered = current.filter((item) => item.id !== spreadsheetId);
    localStorage.setItem(STORAGE_SAVED_SHEETS_KEY, JSON.stringify(filtered));
    
    // If active was removed, set next or clear
    const active = localStorage.getItem(STORAGE_ACTIVE_SHEET_KEY);
    if (active === spreadsheetId) {
      if (filtered.length > 0) {
        filtered[0].isActive = true;
        localStorage.setItem(STORAGE_ACTIVE_SHEET_KEY, filtered[0].id);
        localStorage.setItem(STORAGE_SAVED_SHEETS_KEY, JSON.stringify(filtered));
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_SHEET_KEY);
      }
    }
    return filtered;
  } catch {
    return [];
  }
}

export function getActiveSpreadsheetId(): string {
  try {
    return localStorage.getItem(STORAGE_ACTIVE_SHEET_KEY) || "";
  } catch {
    return "";
  }
}

export function setActiveSpreadsheetId(id: string): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_ACTIVE_SHEET_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_SHEET_KEY);
    }
  } catch {
    // Ignore localStorage error
  }
}

export function isAutoSyncEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_AUTO_SYNC_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_AUTO_SYNC_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore localStorage error
  }
}

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(STORAGE_LAST_SYNC_TIME_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncTime(isoString: string): void {
  try {
    localStorage.setItem(STORAGE_LAST_SYNC_TIME_KEY, isoString);
  } catch {
    // Ignore localStorage error
  }
}

export interface SheetsImportResult {
  locations: Location[];
  totalRows: number;
  importedCount: number;
  invalidCount: number;
  errors: string[];
}

/**
 * Extracts a valid Google Spreadsheet ID from either a raw ID or a full Google Sheets URL.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  // Regex to match /spreadsheets/d/([a-zA-Z0-9-_]+)
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  // If it's already a clean alphanumeric ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * Robust CSV parser for Google Sheets CSV exports
 */
export function parseCsvToMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Standard column headers for tourism maps database
 */
export const SHEETS_COLUMNS = [
  "place_id",
  "nama_tempat",
  "kategori",
  "alamat_lengkap",
  "latitude",
  "longitude",
  "plus_code",
  "nomor_telepon",
  "website",
  "sosial_media",
  "jam_operasional",
  "status_buka",
  "rating",
  "total_ulasan",
  "rentang_harga",
  "fasilitas",
  "cid",
  "url_gambar_utama",
  "foto_lainnya",
  "foto_pelanggan",
  "deskripsi_lokasi",
  "url_google_maps",
  "informasi_berguna",
  "knowledge_graph_id",
  "top_review_1",
  "top_review_2",
  "validasi_ai_status",
  "validasi_notes",
  "timestamp"
];

function handleApiError(status: number, errData: any, defaultMessage: string): Error {
  const apiMessage = errData?.error?.message;
  if (status === 401) {
    return new Error("Sesi otorisasi Google telah kedaluwarsa atau membutuhkan izin tambahan. Silakan klik 'Hubungkan Ulang Akun Google'.");
  }
  if (status === 403) {
    return new Error("Akses ditolak (403): Pastikan spreadsheet dibagikan ke publik ('Siapa saja yang memiliki link dapat melihat') atau hubungkan akun Google dengan izin akses.");
  }
  if (status === 404) {
    return new Error("Spreadsheet tidak ditemukan (404). Silakan periksa kembali ID atau URL spreadsheet yang Anda masukkan.");
  }
  return new Error(apiMessage || defaultMessage);
}

/**
 * Fetch list of Google Spreadsheet files owned or accessible by the user in Google Drive
 */
export async function fetchUserDriveSpreadsheets(accessToken: string): Promise<DriveSpreadsheetItem[]> {
  if (!accessToken) {
    throw new Error("Akses token tidak tersedia. Silakan hubungkan akun Google Anda.");
  }
  
  try {
    const allFilesMap = new Map<string, DriveSpreadsheetItem>();
    const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,owners,sharedWithMeTime)");

    // Query both Google Sheets native spreadsheets and MS Excel spreadsheets in Google Drive
    const query = encodeURIComponent("(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel') and trashed = false");

    // Strategy 1: Standard query with all drives support
    let pageToken: string | null = null;
    let pageCount = 0;
    const maxPages = 10;

    do {
      let url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&pageSize=100&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          throw handleApiError(response.status, errData, "Izin akses Google Drive ditolak atau sesi kedaluwarsa. Silakan refresh OAuth.");
        }
        break;
      }

      const data = await response.json();
      (data.files || []).forEach((f: any) => {
        if (f && f.id && !allFilesMap.has(f.id)) {
          allFilesMap.set(f.id, {
            id: f.id,
            name: f.name || "Spreadsheet Tanpa Judul",
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
            owners: f.owners
          });
        }
      });

      pageToken = data.nextPageToken || null;
      pageCount++;
    } while (pageToken && pageCount < maxPages);

    // Strategy 2: If files count is 0 or low, also query without mimeType filter or explicitly query shared files
    if (allFilesMap.size === 0) {
      try {
        const broadUrl = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const broadRes = await fetch(broadUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (broadRes.ok) {
          const broadData = await broadRes.json();
          (broadData.files || []).forEach((f: any) => {
            const isSpreadsheet = 
              f?.mimeType === 'application/vnd.google-apps.spreadsheet' ||
              f?.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
              f?.mimeType === 'application/vnd.ms-excel' ||
              (f?.name && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv') || f.name.endsWith('.xls')));

            if (isSpreadsheet && f.id && !allFilesMap.has(f.id)) {
              allFilesMap.set(f.id, {
                id: f.id,
                name: f.name || "Spreadsheet Tanpa Judul",
                modifiedTime: f.modifiedTime,
                webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
                owners: f.owners
              });
            }
          });
        }
      } catch (err) {
        console.warn("Broad search fallback:", err);
      }
    }

    return Array.from(allFilesMap.values());
  } catch (err: any) {
    console.warn("Drive files fetch warning:", err);
    throw err;
  }
}

/**
 * Fetch spreadsheet metadata including tab names (with fallback for public sheets without OAuth)
 */
export async function getSpreadsheetDetails(
  spreadsheetId: string,
  accessToken?: string | null
): Promise<SpreadsheetMetadata> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error("ID Spreadsheet tidak valid.");

  // If token is available, attempt Sheets API v4
  if (accessToken) {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          spreadsheetId: data.spreadsheetId,
          title: data.properties?.title || "Spreadsheet Tanpa Judul",
          spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
          sheets: (data.sheets || []).map((s: any) => ({
            sheetId: s.properties?.sheetId,
            title: s.properties?.title,
            index: s.properties?.index,
          })),
        };
      }
    } catch (apiErr) {
      console.warn("Sheets API v4 failed, attempting public fallback:", apiErr);
    }
  }

  // Fallback: Test public access via Google Visualization endpoint
  try {
    const testUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json`;
    const res = await fetch(testUrl);
    if (res.ok) {
      const text = await res.text();
      // If we got a valid response containing setResponse
      if (text.includes("google.visualization.Query.setResponse") || text.includes("table")) {
        return {
          spreadsheetId: cleanId,
          title: "Google Spreadsheet (Publik / Shared Link)",
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}`,
          sheets: [
            { sheetId: 0, title: "Sheet1", index: 0 },
            { sheetId: 1, title: "Database_Wisata", index: 1 },
            { sheetId: 2, title: "Destinasi", index: 2 }
          ],
        };
      }
    }
  } catch (publicErr) {
    console.warn("Public gviz test failed:", publicErr);
  }

  // Generic fallback if all else fails
  return {
    spreadsheetId: cleanId,
    title: "Google Spreadsheet",
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}`,
    sheets: [
      { sheetId: 0, title: "Sheet1", index: 0 },
      { sheetId: 1, title: "Database_Wisata", index: 1 }
    ],
  };
}

/**
 * Create a new Google Spreadsheet on user's Google Drive and write the initial locations
 */
export async function createNewSpreadsheetWithLocations(
  title: string,
  locations: Location[],
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; rowCount: number }> {
  const defaultTitle = title || `Database Wisata Pacitan - ${new Date().toLocaleDateString("id-ID")}`;

  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: defaultTitle,
      },
      sheets: [
        {
          properties: {
            title: "Database_Wisata",
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw handleApiError(createRes.status, errData, "Gagal membuat Google Spreadsheet baru di Google Drive.");
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const sheetTitle = createdData.sheets?.[0]?.properties?.title || "Database_Wisata";

  // Now populate with locations
  await exportLocationsToSpreadsheet(spreadsheetId, sheetTitle, locations, accessToken);

  return {
    spreadsheetId,
    spreadsheetUrl: createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    rowCount: locations.length,
  };
}

/**
 * Export locations array into a specific sheet tab in Google Sheets
 */
export async function exportLocationsToSpreadsheet(
  spreadsheetId: string,
  sheetTitle: string,
  locations: Location[],
  accessToken: string
): Promise<{ updatedCells: number; updatedRows: number }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error("ID Spreadsheet tidak valid.");

  // Prepare 2D matrix
  const rows: any[][] = [];

  // Header row
  rows.push(SHEETS_COLUMNS);

  // Data rows
  locations.forEach((loc) => {
    // Split photos back into columns if possible
    const mainPhoto = loc.photos?.[0] || "N/A";
    const otherPhotos = loc.photos?.slice(1).join(", ") || "N/A";

    rows.push([
      loc.id,
      loc.name,
      loc.category,
      loc.address || "N/A",
      String(loc.coordinates?.lat ?? 0).replace(".", ","),
      String(loc.coordinates?.lng ?? 0).replace(".", ","),
      loc.plusCode || "N/A",
      loc.contact || "N/A",
      loc.website || "N/A",
      loc.socialMedia || "N/A",
      loc.openingHours || "N/A",
      loc.statusBuka || "N/A",
      String(loc.ratingAverage ?? 0).replace(".", ","),
      loc.reviewCount ?? 0,
      loc.priceRange || "N/A",
      Array.isArray(loc.facilities) ? loc.facilities.join(", ") : "N/A",
      loc.cid || "N/A",
      mainPhoto,
      otherPhotos,
      "N/A", // foto_pelanggan
      loc.description || "N/A",
      loc.googleMapsUrl || "N/A",
      loc.usefulInfo || "N/A",
      loc.knowledgeGraphId || "N/A",
      loc.topReviews?.[0] || "N/A",
      loc.topReviews?.[1] || "N/A",
      loc.validasiAiStatus || "N/A",
      loc.validasiNotes || "N/A",
      loc.updatedAt || new Date().toISOString()
    ]);
  });

  const range = `${sheetTitle}!A1:${String.fromCharCode(65 + SHEETS_COLUMNS.length - 1)}${rows.length}`;

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: rows,
      }),
    }
  );

  if (!writeRes.ok) {
    const errData = await writeRes.json().catch(() => ({}));
    throw handleApiError(writeRes.status, errData, "Gagal mengekspor data ke Google Spreadsheet.");
  }

  const result = await writeRes.json();
  return {
    updatedCells: result.updatedCells || 0,
    updatedRows: result.updatedRows || rows.length,
  };
}

/**
 * Import and parse locations from a Google Spreadsheet (Supports API v4 and Public CSV fallback)
 */
export async function importLocationsFromSpreadsheet(
  spreadsheetId: string,
  sheetTitle: string = "Sheet1",
  accessToken?: string | null,
  currentUserId: string = "sheets_sync_admin"
): Promise<SheetsImportResult> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error("ID Spreadsheet tidak valid.");

  let values: any[][] = [];

  // Method 1: Try authenticated Google Sheets API v4 if accessToken is present
  if (accessToken) {
    try {
      const range = `${sheetTitle}!A1:Z1500`;
      const readRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (readRes.ok) {
        const data = await readRes.json();
        if (Array.isArray(data.values) && data.values.length > 1) {
          values = data.values;
        }
      }
    } catch (e) {
      console.warn("Authenticated fetch failed, attempting public CSV fallback:", e);
    }
  }

  // Method 2: Public fallback if Method 1 didn't return values
  if (values.length === 0) {
    const endpoints = [
      `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetTitle)}`,
      `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv`,
      `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const csvText = await res.text();
          if (csvText && csvText.length > 10) {
            const parsedMatrix = parseCsvToMatrix(csvText);
            if (parsedMatrix.length > 1) {
              values = parsedMatrix;
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`Failed fetching from ${url}:`, err);
      }
    }
  }

  if (values.length < 2) {
    throw new Error("Spreadsheet kosong, belum dibagikan ke publik, atau hanya berisi baris judul. Pastikan sheet berisi baris data destinasi wisata dan disetel: 'Siapa saja yang memiliki link dapat melihat'.");
  }

  const headers = values[0].map((h: any) => String(h || "").trim().toLowerCase());
  
  // Find column index helpers with prioritized matching (exact match -> token match -> safe substring)
  const findCol = (keys: string[]) => {
    // 1. Exact match
    const exact = headers.findIndex((h) => keys.some((k) => h === k.toLowerCase()));
    if (exact !== -1) return exact;

    // 2. Tokenized word boundary match
    const tokenMatch = headers.findIndex((h) => {
      const tokens = h.split(/[^a-z0-9]+/);
      return keys.some((k) => tokens.includes(k.toLowerCase()));
    });
    if (tokenMatch !== -1) return tokenMatch;

    // 3. Substring match (skip short ambiguous keys like 'id', 'no', 'lat', 'lng' to avoid false positives)
    return headers.findIndex((h) => {
      return keys.some((k) => {
        const kLower = k.toLowerCase();
        if (kLower.length <= 3) return false;
        return h.includes(kLower);
      });
    });
  };

  const idIdx = findCol(["id_lokasi", "place_id", "placeid", "id", "kode_lokasi", "kode", "no"]);
  const nameIdx = findCol(["nama_tempat", "nama", "name", "destinasi", "title", "obyek", "tempat", "lokasi"]);
  const catIdx = findCol(["kategori", "category", "jenis", "tipe"]);
  const latIdx = findCol(["latitude", "lat", "lintang", "y"]);
  const lngIdx = findCol(["longitude", "lng", "long", "bujur", "x"]);
  const addrIdx = findCol(["alamat_lengkap", "alamat", "address", "lokasi", "desa", "kecamatan"]);
  const descIdx = findCol(["deskripsi_lokasi", "deskripsi", "description", "desc", "keterangan", "informasi", "detail"]);
  const ratingIdx = findCol(["rating", "skor", "score", "bintang", "star"]);
  const reviewIdx = findCol(["total_ulasan", "ulasan", "review", "reviews", "jumlah ulasan"]);
  const hoursIdx = findCol(["jam_operasional", "jam", "operasional", "hours", "buka", "opening"]);
  const priceIdx = findCol(["rentang_harga", "biaya", "harga", "price", "tiket", "tarif", "htm"]);
  const contactIdx = findCol(["nomor_telepon", "kontak", "contact", "telepon", "phone", "wa", "whatsapp", "no hp"]);
  const placeIdIdx = findCol(["place_id", "place id", "google place", "placeid"]);
  const webIdx = findCol(["website", "web", "link", "url", "situs"]);
  const mapsUrlIdx = findCol(["url_google_maps", "maps url", "google maps url", "gmaps", "link maps"]);
  const facilitiesIdx = findCol(["fasilitas", "facilities", "amenities", "fitur"]);
  
  // Specific photo columns
  const mainPhotoIdx = findCol(["url_gambar_utama", "foto utama", "main image", "gambar"]);
  const otherPhotosIdx = findCol(["foto_lainnya", "foto lainnya", "additional images"]);
  const customerPhotosIdx = findCol(["foto_pelanggan", "customer photos"]);

  // Extra metadata columns
  const plusCodeIdx = findCol(["plus_code", "pluscode"]);
  const socialIdx = findCol(["sosial_media", "social media", "instagram", "facebook", "sosmed"]);
  const statusBukaIdx = findCol(["status_buka", "business status"]);
  const cidIdx = findCol(["cid"]);
  const infoIdx = findCol(["informasi_berguna", "useful info"]);
  const knowledgeIdx = findCol(["knowledge_graph_id"]);
  const topRev1Idx = findCol(["top_review_1"]);
  const topRev2Idx = findCol(["top_review_2"]);
  const aiStatusIdx = findCol(["validasi_ai_status"]);
  const aiNotesIdx = findCol(["validasi_notes"]);
  const timestampIdx = findCol(["timestamp"]);

  const validCategories: LocationCategory[] = [
    "wisata",
    "penginapan",
    "makan",
    "coffeeshop",
    "belanja",
    "lainnya"
  ];

  const normalizeCategory = (val: string): LocationCategory => {
    if (!val) return "wisata";
    const lower = val.toLowerCase().trim();
    const found = validCategories.find(c => c === lower);
    if (found) return found;

    if (lower.includes("wisata") || lower.includes("pantai") || lower.includes("goa") || lower.includes("air terjun") || lower.includes("alam") || lower.includes("budaya") || lower.includes("candi") || lower.includes("tour") || lower.includes("attraction")) {
      return "wisata";
    }
    if (lower.includes("hotel") || lower.includes("homestay") || lower.includes("villa") || lower.includes("penginapan") || lower.includes("resort") || lower.includes("inn") || lower.includes("lodge") || lower.includes("guest house")) {
      return "penginapan";
    }
    if (lower.includes("makan") || lower.includes("resto") || lower.includes("kuliner") || lower.includes("warung") || lower.includes("seafood") || lower.includes("dining") || lower.includes("cafe") && !lower.includes("coffee")) {
      return "makan";
    }
    if (lower.includes("kopi") || lower.includes("coffee") || lower.includes("coffeeshop")) {
      return "coffeeshop";
    }
    if (lower.includes("belanja") || lower.includes("oleh-oleh") || lower.includes("souvenir") || lower.includes("pasar") || lower.includes("mall") || lower.includes("toko") || lower.includes("shop") || lower.includes("pusat")) {
      return "belanja";
    }
    return "wisata";
  };

  const parsedLocations: Location[] = [];
  const errors: string[] = [];
  const nowStr = new Date().toISOString();

  // Helper to slugify string for stable ID
  const makeSlug = (str: string) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // Iterate rows
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === "")) {
      continue; // Skip empty rows
    }

    const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : (row[1] ? String(row[1]).trim() : "");
    if (!name) {
      errors.push(`Baris ${r + 1}: Nama destinasi tidak boleh kosong.`);
      continue;
    }

    // Coordinates parsing
    let lat = latIdx !== -1 ? parseFloat(String(row[latIdx]).replace(",", ".")) : NaN;
    let lng = lngIdx !== -1 ? parseFloat(String(row[lngIdx]).replace(",", ".")) : NaN;

    // Detect inverted lat/lng (e.g. lat > 0 in Indonesia, lng < 0)
    if (lat > 50 && lng < 0) {
      const temp = lat;
      lat = lng;
      lng = temp;
    }

    // Fallback if not specified or NaN, default to central Pacitan area
    if (isNaN(lat) || lat === 0) lat = -8.2046;
    if (isNaN(lng) || lng === 0) lng = 111.0921;

    // Photos parsing: combine main, other, and customer photos
    let photos: string[] = [];
    
    // Add main photo
    if (mainPhotoIdx !== -1 && row[mainPhotoIdx] && String(row[mainPhotoIdx]).startsWith("http")) {
      photos.push(String(row[mainPhotoIdx]).trim());
    }
    
    // Add other photos
    if (otherPhotosIdx !== -1 && row[otherPhotosIdx]) {
      const others = String(row[otherPhotosIdx]).split(/[|,\n;]+/).map(p => p.trim()).filter(p => p.startsWith("http"));
      photos = [...photos, ...others];
    }
    
    // Add customer photos
    if (customerPhotosIdx !== -1 && row[customerPhotosIdx]) {
      const customers = String(row[customerPhotosIdx]).split(/[|,\n;]+/).map(p => p.trim()).filter(p => p.startsWith("http"));
      photos = [...photos, ...customers];
    }

    // Deduplicate and filter N/A
    photos = [...new Set(photos)].filter(p => p && p.toLowerCase() !== "n/a");

    if (photos.length === 0) {
      photos = ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"];
    }

    // Facilities parsing
    let facilities: string[] = [];
    if (facilitiesIdx !== -1 && row[facilitiesIdx] && String(row[facilitiesIdx]) !== "N/A") {
      facilities = String(row[facilitiesIdx])
        .split(/[|,\n;]+/)
        .map(f => f.trim())
        .filter(Boolean);
    }

    let id = "";
    if (idIdx !== -1 && row[idIdx]) {
      const rawId = String(row[idIdx]).trim();
      if (
        rawId && 
        rawId.toLowerCase() !== "n/a" && 
        !rawId.startsWith("http://") && 
        !rawId.startsWith("https://") && 
        !rawId.includes("/") && 
        !rawId.includes("\\")
      ) {
        id = rawId.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
      }
    }
    if (!id || id.length < 2) {
      const sheetPrefix = makeSlug(sheetTitle || "loc");
      id = `loc_${sheetPrefix ? sheetPrefix + "_" : ""}${makeSlug(name)}_${r}`;
    }

    const rawCategory = catIdx !== -1 ? String(row[catIdx] || "") : "";
    const category = normalizeCategory(rawCategory);

    const description = descIdx !== -1 && row[descIdx] && String(row[descIdx]) !== "N/A" 
      ? String(row[descIdx] || "").trim() 
      : `Destinasi ${name} terletak di wilayah Kabupaten Pacitan, Jawa Timur.`;
    
    const address = addrIdx !== -1 && row[addrIdx] && String(row[addrIdx]) !== "N/A"
      ? String(row[addrIdx] || "").trim() 
      : "Kabupaten Pacitan, Jawa Timur";
    
    const ratingAverage = ratingIdx !== -1 ? parseFloat(String(row[ratingIdx]).replace(",", ".")) || 4.7 : 4.7;
    const reviewCount = reviewIdx !== -1 ? parseInt(String(row[reviewIdx]), 10) || 0 : 0;

    const loc: Location = {
      id,
      name,
      category,
      coordinates: { lat, lng },
      address: address || "Kabupaten Pacitan, Jawa Timur",
      description: description || `Destinasi ${name} terletak di wilayah Kabupaten Pacitan.`,
      photos,
      status: "approved",
      createdBy: currentUserId,
      createdAt: nowStr,
      updatedAt: timestampIdx !== -1 && row[timestampIdx] ? String(row[timestampIdx]) : nowStr,
      ratingAverage: isNaN(ratingAverage) ? 4.7 : Math.min(5, Math.max(1, ratingAverage)),
      reviewCount: isNaN(reviewCount) ? 0 : reviewCount,
      openingHours: hoursIdx !== -1 && String(row[hoursIdx]) !== "N/A" ? String(row[hoursIdx] || "").trim() : undefined,
      priceRange: priceIdx !== -1 && String(row[priceIdx]) !== "N/A" ? String(row[priceIdx] || "").trim() : undefined,
      contact: contactIdx !== -1 && String(row[contactIdx]) !== "N/A" ? String(row[contactIdx] || "").trim() : undefined,
      googlePlaceId: placeIdIdx !== -1 && String(row[placeIdIdx]) !== "N/A" ? String(row[placeIdIdx] || "").trim() : undefined,
      website: webIdx !== -1 && String(row[webIdx]) !== "N/A" ? String(row[webIdx] || "").trim() : undefined,
      googleMapsUrl: mapsUrlIdx !== -1 && String(row[mapsUrlIdx]) !== "N/A" ? String(row[mapsUrlIdx] || "").trim() : undefined,
      facilities: facilities.length > 0 ? facilities : undefined,
      
      // New extended fields
      plusCode: plusCodeIdx !== -1 && String(row[plusCodeIdx]) !== "N/A" ? String(row[plusCodeIdx]) : undefined,
      socialMedia: socialIdx !== -1 && String(row[socialIdx]) !== "N/A" ? String(row[socialIdx]) : undefined,
      statusBuka: statusBukaIdx !== -1 && String(row[statusBukaIdx]) !== "N/A" ? String(row[statusBukaIdx]) : undefined,
      cid: cidIdx !== -1 && String(row[cidIdx]) !== "N/A" ? String(row[cidIdx]) : undefined,
      usefulInfo: infoIdx !== -1 && String(row[infoIdx]) !== "N/A" ? String(row[infoIdx]) : undefined,
      knowledgeGraphId: knowledgeIdx !== -1 && String(row[knowledgeIdx]) !== "N/A" ? String(row[knowledgeIdx]) : undefined,
      topReviews: [
        topRev1Idx !== -1 ? String(row[topRev1Idx]) : "",
        topRev2Idx !== -1 ? String(row[topRev2Idx]) : ""
      ].filter(r => r && r !== "N/A"),
      validasiAiStatus: aiStatusIdx !== -1 && String(row[aiStatusIdx]) !== "N/A" ? String(row[aiStatusIdx]) : undefined,
      validasiNotes: aiNotesIdx !== -1 && String(row[aiNotesIdx]) !== "N/A" ? String(row[aiNotesIdx]) : undefined,
    };

    parsedLocations.push(loc);
  }

  // Deduplicate parsed locations by unique ID
  const dedupedMap = new Map<string, Location>();
  parsedLocations.forEach((loc, idx) => {
    let safeKey = (loc.id || "").toLowerCase().trim();
    if (!safeKey || dedupedMap.has(safeKey)) {
      safeKey = `${safeKey || "loc"}_${idx}`;
      loc.id = safeKey;
    }
    dedupedMap.set(safeKey, loc);
  });
  const dedupedLocations = Array.from(dedupedMap.values());

  // Save successful sync time
  setLastSyncTime(nowStr);

  return {
    locations: dedupedLocations,
    totalRows: values.length - 1,
    importedCount: dedupedLocations.length,
    invalidCount: errors.length,
    errors,
  };
}

/**
 * Import locations from all configured category-specific Google Spreadsheets
 */
export async function importFromAllCategorySheets(
  mappings: Record<LocationCategory, CategorySheetConfig>,
  accessToken?: string | null,
  currentUserId: string = "sheets_sync_admin",
  masterSpreadsheetId?: string
): Promise<{
  locations: Location[];
  categoryStats: Record<string, { count: number; error?: string }>;
  totalImported: number;
  errors: string[];
}> {
  const combinedLocations: Location[] = [];
  const categoryStats: Record<string, { count: number; error?: string }> = {};
  const globalErrors: string[] = [];

  const categories = Object.keys(mappings) as LocationCategory[];
  const activeId = masterSpreadsheetId || getActiveSpreadsheetId();

  for (const cat of categories) {
    const config = mappings[cat];
    const cleanId = extractSpreadsheetId(config?.spreadsheetId || activeId || "");

    if (!cleanId) {
      categoryStats[cat] = { count: 0, error: "Belum dikonfigurasi (ID/URL kosong)" };
      continue;
    }

    try {
      const sheetName = config.sheetTitle || "Sheet1";
      const res = await importLocationsFromSpreadsheet(cleanId, sheetName, accessToken, currentUserId);
      
      // Enforce the specific category if the sheet was meant specifically for this category
      const enforcedLocations = res.locations.map((loc, idx) => ({
        ...loc,
        id: loc.id.includes(cat) ? loc.id : `${loc.id}_${cat}`,
        category: loc.category || cat
      }));

      combinedLocations.push(...enforcedLocations);
      categoryStats[cat] = { count: enforcedLocations.length };
    } catch (err: any) {
      const msg = err?.message || `Gagal impor kategori ${cat}`;
      categoryStats[cat] = { count: 0, error: msg };
      globalErrors.push(`[${cat.toUpperCase()}]: ${msg}`);
    }
  }

  // Deduplicate combined locations strictly by ID
  const uniqueMap = new Map<string, Location>();
  combinedLocations.forEach((loc, idx) => {
    let key = (loc.id || loc.name).toLowerCase().trim();
    if (uniqueMap.has(key)) {
      key = `${key}_${idx}`;
      loc.id = key;
    }
    uniqueMap.set(key, loc);
  });

  const finalLocations = Array.from(uniqueMap.values());

  return {
    locations: finalLocations,
    categoryStats,
    totalImported: finalLocations.length,
    errors: globalErrors,
  };
}

/**
 * Export locations to all configured category-specific Google Spreadsheets
 */
export async function exportToAllCategorySheets(
  mappings: Record<LocationCategory, CategorySheetConfig>,
  locations: Location[],
  accessToken: string,
  masterSpreadsheetId?: string
): Promise<{
  results: Record<string, { count: number; success: boolean; error?: string }>;
  successCount: number;
  failCount: number;
}> {
  if (!accessToken) {
    throw new Error("Akses token Google OAuth diperlukan untuk mengekspor ke spreadsheet.");
  }

  const results: Record<string, { count: number; success: boolean; error?: string }> = {};
  let successCount = 0;
  let failCount = 0;

  const categories = Object.keys(mappings) as LocationCategory[];
  const activeId = masterSpreadsheetId || getActiveSpreadsheetId();

  for (const cat of categories) {
    const config = mappings[cat];
    const cleanId = extractSpreadsheetId(config?.spreadsheetId || activeId || "");

    if (!cleanId) {
      results[cat] = { count: 0, success: false, error: "ID Spreadsheet belum diatur." };
      failCount++;
      continue;
    }

    const catLocations = locations.filter(l => l.category === cat);
    const sheetName = config.sheetTitle || "Sheet1";

    try {
      await exportLocationsToSpreadsheet(cleanId, sheetName, catLocations, accessToken);
      results[cat] = { count: catLocations.length, success: true };
      successCount++;
    } catch (err: any) {
      results[cat] = { count: catLocations.length, success: false, error: err?.message || "Gagal ekspor" };
      failCount++;
    }
  }

  return {
    results,
    successCount,
    failCount,
  };
}

