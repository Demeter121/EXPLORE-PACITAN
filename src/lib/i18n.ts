export type Language = "id" | "en";

export const dict = {
  id: {
    // General
    explorePacitan: "Jelajahi Pesona Pacitan",
    subtitle: "Pusat Informasi Wisata, Akomodasi, Kuliner, dan Sinkronisasi Google Sheets Terpadu",
    searchPlaceholder: "Cari destinasi wisata, hotel, kuliner di Pacitan...",
    allCategories: "Semua Kategori",
    wisata: "Wisata Alam",
    penginapan: "Penginapan & Hotel",
    makan: "Kuliner & Resto",
    coffeeshop: "Kafe & Kopi",
    belanja: "Oleh-Oleh & Belanja",
    lainnya: "Lainnya",
    syncSheets: "Sinkronisasi Google Sheets",
    tourPackages: "Paket Wisata",
    itineraryBuilder: "Buat Itinerari",
    aiAssistant: "Asisten AI Pacitan",
    close: "Tutup",
    save: "Simpan",
    cancel: "Batal",
    loading: "Memuat...",
    success: "Berhasil",
    error: "Kesalahan",
    
    // Google Sheets Modal
    sheetsTitle: "Integrasi Google Sheets & Maps",
    sheetsSubtitle: "Kelola & sinkronkan database obyek wisata dan paket wisata dalam satu file spreadsheet",
    activeSheet: "Google Sheet Database Aktif",
    switchSheet: "Ganti Sheet",
    openSheet: "Buka Dokumen Google Sheet",
    pullLatest: "Tarik Perubahan Terbaru dari Sheet",
    pullDesc: "Update teks, alamat, koordinat, foto, atau fasilitas di Google Sheet dan langsung perbarui peta.",
    syncNow: "⚡ Tarik Data Sekarang",
    autoSyncLabel: "Sinkronkan otomatis setiap kali membuka website",
    lastSyncTime: "Sinkron terakhir:",
    manualLoad: "Muat / Tes Link",
    publicTip: "Tips Akses Otomatis: Di Google Sheets, klik Bagikan (Share) ➔ Ubah Akses Umum menjadi \"Siapa saja yang memiliki link\" sebagai Pelihat (Viewer) agar website dapat memperbarui data secara langsung.",
    exportSheet: "Ekspor ke Spreadsheet",
    importSheet: "Opsi Impor Lengkap",
    merge: "➕ Gabungkan",
    replace: "🔄 Ganti Semua",
    
    // Tour Packages
    tourPackagesTitle: "Paket Wisata Eksklusif Pacitan",
    tourPackagesDesc: "Pilihan paket tur terkurasi untuk liburan terbaik Anda di Pacitan",
    bookNow: "Pesan Paket Ini",
    duration: "Durasi",
    facilities: "Fasilitas Termasuk",
    price: "Harga",
    perPax: "/ orang",

    // Interactive Map / List
    mapView: "Tampilan Peta",
    listView: "Tampilan Daftar",
    directions: "Rute Google Maps",
    reviews: "Ulasan",
    openingHours: "Jam Buka",
    contact: "Kontak",
    priceRange: "Kisaran Harga"
  },
  en: {
    // General
    explorePacitan: "Explore Pacitan Charm",
    subtitle: "Integrated Information Center for Tourism, Accommodation, Culinary, and Google Sheets Sync",
    searchPlaceholder: "Search destinations, hotels, culinary in Pacitan...",
    allCategories: "All Categories",
    wisata: "Nature & Tourism",
    penginapan: "Hotels & Stay",
    makan: "Culinary & Dining",
    coffeeshop: "Cafes & Coffee",
    belanja: "Souvenirs & Shopping",
    lainnya: "Other",
    syncSheets: "Google Sheets Sync",
    tourPackages: "Tour Packages",
    itineraryBuilder: "Itinerary Planner",
    aiAssistant: "Pacitan AI Assistant",
    close: "Close",
    save: "Save",
    cancel: "Cancel",
    loading: "Loading...",
    success: "Success",
    error: "Error",
    
    // Google Sheets Modal
    sheetsTitle: "Google Sheets & Maps Integration",
    sheetsSubtitle: "Manage & sync tourism spots and tour packages database within a single spreadsheet file",
    activeSheet: "Active Google Sheet Database",
    switchSheet: "Switch Sheet",
    openSheet: "Open Google Sheet Document",
    pullLatest: "Pull Latest Changes from Sheet",
    pullDesc: "Update text, address, coordinates, photos, or facilities in Google Sheet and instantly update the map.",
    syncNow: "⚡ Pull Data Now",
    autoSyncLabel: "Auto-sync whenever opening the website",
    lastSyncTime: "Last sync:",
    manualLoad: "Load / Test Link",
    publicTip: "Automatic Access Tip: In Google Sheets, click Share ➔ Change General Access to \"Anyone with the link\" as Viewer so the website can pull updates directly.",
    exportSheet: "Export to Spreadsheet",
    importSheet: "Complete Import Options",
    merge: "➕ Merge",
    replace: "🔄 Replace All",
    
    // Tour Packages
    tourPackagesTitle: "Exclusive Pacitan Tour Packages",
    tourPackagesDesc: "Curated tour package options for your best vacation in Pacitan",
    bookNow: "Book This Package",
    duration: "Duration",
    facilities: "Included Facilities",
    price: "Price",
    perPax: "/ person",

    // Interactive Map / List
    mapView: "Map View",
    listView: "List View",
    directions: "Google Maps Directions",
    reviews: "Reviews",
    openingHours: "Opening Hours",
    contact: "Contact",
    priceRange: "Price Range"
  }
};

export function getTranslation(lang: Language = "id") {
  return dict[lang] || dict.id;
}
