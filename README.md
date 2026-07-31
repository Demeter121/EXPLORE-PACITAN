# 🏖️ Sistem Informasi Pariwisata Pacitan (SIPP)

**Sistem Informasi Pariwisata Pacitan (SIPP)** adalah aplikasi web interaktif modern untuk penjelajahan destinasi wisata, pembuatan itinerari liburan, peta lokasi berbasis Leaflet, pengajuan usulan lokasi baru oleh masyarakat, serta sistem moderasi dan notifikasi real-time untuk Admin Utama Kabupaten Pacitan.

---

## 🌟 Fitur Utama

- **🗺️ Peta Destinasi Interaktif**: Peta digital berbasis Leaflet JS dengan filter kategori (Pantai, Goa, Air Terjun, Wisata Alam, Budaya, Kuliner), pencarian lokasi, dan rute perjalanan.
- **📅 Rencana & Itinerari Wisata**: Fitur interaktif susun rencana perjalanan harian lengkap dengan estimasi waktu, jarak, dan ekspor ke format PDF / KML.
- **📩 Pengajuan Usulan Wisata**: Pengguna dapat mengajukan lokasi wisata atau fasilitas baru lengkap dengan koordinat latitude/longitude, foto, deskripsi, dan jam operasional.
- **🛡️ Panel Moderasi Admin**: Sistem tinjauan dan persetujuan usulan lokasi wisata oleh Admin Utama dengan filter status (Draft, Pending, Disetujui, Ditolak).
- **🔔 Notifikasi Real-time**: Sistem notifikasi status pengajuan usulan, konfirmasi persetujuan admin, dan pengumuman sistem.
- **🤖 Asisten Pariwisata Berbasis AI Gemini**: Integrasi Google Gemini AI untuk memberikan rekomendasi wisata kustom berdasarkan preferensi wisatawan.
- **🌓 Mode Gelap / Terang (Dark Mode)**: Tampilan visual responsif dan ramah mata dengan skema warna yang elegan.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend**: React 19, TypeScript, Vite 6
- **Styling**: Tailwind CSS v4, Motion (Framer Motion)
- **Peta & Geofencing**: Leaflet, React-Leaflet
- **Backend & Database**: Firebase Firestore & Firebase Authentication
- **AI Assistant**: Google Gemini API (`@google/genai`)
- **Ikon**: Lucide React
- **Ekspor Dokumen**: jsPDF & jsPDF AutoTable

---

## 📂 Struktur Proyek

```text
.
├── src/
│   ├── components/         # Komponen UI (NavigationBar, ItineraryMap, TourPackagesView, dll)
│   ├── data.ts             # Pengelola Data Lokal & Synchronizer Firestore
│   ├── firebase.ts         # Inisialisasi Firebase SDK (Firestore & Auth)
│   ├── gemini.ts           # Integrasi Google Gemini AI API
│   ├── types.ts            # Definisi Interface & Type TypeScript
│   ├── App.tsx             # Komponen Utama Aplikasi & Routing
│   └── main.tsx            # Entry Point React
├── firebase-applet-config.json # File konfigurasi kredensial Firebase
├── firebase-blueprint.json     # Blueprint skema Firestore
├── firestore.rules             # Aturan Keamanan (Security Rules) Firestore
├── .env.example                # Template variabel lingkungan
├── package.json                # Pengelola dependensi & skrip Vite
├── TUTORIAL_SETUP.md           # Panduan lengkap setup Firebase, API Key, & Vite
└── README.md                   # Dokumen utama ini
```

---

## 🚀 Cara Menjalankan Aplikasi Secara Lokal

### 1. Prasyarat
Pastikan Anda telah menginstal **Node.js** (versi 18 ke atas) dan **npm** di komputer Anda.

### 2. Instalasi Dependensi
Buka terminal di direktori proyek, lalu jalankan:
```bash
npm install
```

### 3. Konfigurasi Variable Lingkungan (.env)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi nilai API Key Gemini dan Kredensial Firebase pada file `.env` tersebut. Panduan langkah demi langkah tersedia di **[TUTORIAL_SETUP.md](./TUTORIAL_SETUP.md)**.

### 4. Jalankan Dev Server (Vite)
Jalankan perintah berikut untuk mengaktifkan server pengembangan:
```bash
npm run dev
```
Aplikasi akan berjalan di `http://localhost:3000`.

### 5. Build untuk Produksi
Untuk mengompilasi aplikasi ke folder `dist` siap rilis:
```bash
npm run build
```

Untuk menguji hasil build produksi secara lokal:
```bash
npm run preview
```

---

## 📖 Panduan Setup Lengkap

Silakan buka file **[TUTORIAL_SETUP.md](./TUTORIAL_SETUP.md)** untuk petunjuk rinci mengenai:
1. Cara setup proyek Vite dan perintah-perintah utamanya.
2. Cara mendapatkan **API Key Google Gemini** dari Google AI Studio.
3. Cara membuat project **Firebase**, mengaktifkan **Authentication** & **Firestore Database**, serta mendapatkan kredensial API Key Firebase.

---

## 📄 Lisensi & Hak Cipta
Dipersembahkan untuk **Sistem Informasi Pariwisata Kabupaten Pacitan (SIPP)**.
