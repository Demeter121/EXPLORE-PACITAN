# 📚 Panduan Tutorial Setup: Vite, Google Gemini API, & Firebase

Dokumen ini berisi panduan langkah demi langkah untuk melakukan konfigurasi lingkungan pengembangan, mendapatkan API Key yang dibutuhkan, serta mengintegrasikan Firebase dan Vite pada proyek **Sistem Informasi Pariwisata Pacitan (SIPP)**.

---

## 📋 Daftar Isi
1. [Bagian 1: Setup Proyek & Server Pengembangan Vite](#bagian-1-setup-proyek--server-pengembangan-vite)
2. [Bagian 2: Cara Mendapatkan API Key Google Gemini](#bagian-2-cara-mendapatkan-api-key-google-gemini)
3. [Bagian 3: Cara Setup Firebase & Mendapatkan Kredensial API Key](#bagian-3-cara-setup-firebase--mendapatkan-kredensial-api-key)
4. [Bagian 4: Pengaturan File Variabel Lingkungan (.env)](#bagian-4-pengaturan-file-variabel-lingkungan-env)
5. [Bagian 5: Verifikasi & Uji Coba Aplikasi](#bagian-5-verifikasi--uji-coba-aplikasi)

---

## ⚡ Bagian 1: Setup Proyek & Server Pengembangan Vite

Vite adalah bundler dan dev server generasi baru yang sangat cepat untuk aplikasi Web/React.

### 1.1 Persyaratan Sistem
- **Node.js**: Versi `>= 18.0.0` (disarankan LTS versi 20 atau 22). Anda dapat memeriksa versi Node.js dengan perintah:
  ```bash
  node -v
  ```
- **npm** (biasanya terikut saat menginstal Node.js) atau **bun** / **pnpm**.

### 1.2 Menginstal Dependensi Proyek
Buka terminal/command prompt di folder root proyek ini, kemudian jalankan:
```bash
npm install
```
Perintah ini akan menginstal seluruh pustaka yang diperlukan seperti React, Vite, Leaflet, Firebase, Motion, Tailwind CSS, dan Google Gen AI SDK.

### 1.3 Perintah-perintah Utama Vite (npm scripts)
- **Menjalankan Dev Server**:
  ```bash
  npm run dev
  ```
  Aplikasi akan berjalan secara lokal di URL `http://localhost:3000`. Dev server ini mendukung *Hot Module Replacement* (HMR) sehingga perubahan kode akan langsung terlihat.

- **Menguji Type Checking (Lint)**:
  ```bash
  npm run lint
  ```
  Menjalankan pemeriksaan tipe TypeScript tanpa menghasilkan file output untuk memastikan tidak ada kesalahan sintaks/tipe.

- **Membuat Build Produksi**:
  ```bash
  npm run build
  ```
  Memproses dan mengoptimalkan kode proyek menjadi file terkompresi di folder `dist/` untuk siap di-deploy ke hosting seperti Cloud Run, Vercel, Netlify, atau Firebase Hosting.

- **Pratinjau Hasil Build**:
  ```bash
  npm run preview
  ```
  Menjalankan server lokal untuk menguji file bundel yang ada di folder `dist/`.

---

## 🤖 Bagian 2: Pengaturan API Key LLM & Asisten AI Chatbot (OpenRouter, Groq, OpenAI, Gemini, Ollama)

Aplikasi SIPP mendukung berbagai macam penyedia AI (LLM Provider) berbasis standar OpenAI Chat Completions API. Anda dapat menggunakan **OpenRouter**, **Groq Cloud**, **OpenAI**, **Google Gemini**, **Ollama (Lokal)**, atau **Custom Endpoint**.

### 2.1 Mendapatkan Kunci API dari Berbagai Penyedia:
- **OpenRouter (Rekomendasi Utama)**:
  1. Buka [https://openrouter.ai/keys](https://openrouter.ai/keys)
  2. Buat API Key baru.
  3. Gunakan Base URL: `https://openrouter.ai/api/v1`
  4. Pilihan Model populer: `google/gemini-2.5-flash`, `openai/gpt-4o-mini`, `deepseek/deepseek-r1`, `meta-llama/llama-3.3-70b-instruct`

- **Groq Cloud (Sangat Cepat & Gratis)**:
  1. Buka [https://console.groq.com/keys](https://console.groq.com/keys)
  2. Dapatkan API Key.
  3. Gunakan Base URL: `https://api.groq.com/openai/v1`
  4. Model: `llama-3.3-70b-versatile` atau `mixtral-8x7b-32768`

- **Google Gemini (OpenAI Endpoint)**:
  1. Buka [https://aistudio.google.com/](https://aistudio.google.com/)
  2. Klik **"Get API Key"** dan salin kunci (`AIzaSy...`).
  3. Gunakan Base URL: `https://generativelanguage.googleapis.com/v1beta/openai`
  4. Model: `gemini-2.5-flash`

- **OpenAI**:
  1. Buka [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  2. Gunakan Base URL: `https://api.openai.com/v1`
  3. Model: `gpt-4o-mini`

- **Ollama / Local Server**:
  1. Jalankan Ollama di komputer lokal (`ollama run llama3`).
  2. Gunakan Base URL: `http://localhost:11434/v1`
  3. Model: `llama3`

---

### 2.2 Sistem Validasi Otomatis & Popup Chatbot
1. Klik tombol **"Set AI Key"** di navigasi atas atau tombol melayang **"Setup Kunci AI"** di kanan bawah.
2. Masukkan **Base URL**, **API Key**, dan **Nama Model**.
3. Klik **"Uji Validasi & Simpan Kunci AI"**.
4. Sistem akan mengirim pesan ping ringan ke endpoint API.
5. **Jika Valid**: Status berubah menjadi **`✓ Terhubung & Valid`**, dan **Popup Asisten AI Pariwisata Pacitan** akan otomatis muncul dan aktif digunakan!
6. **Jika Gagal**: Sistem menampilkan pesan kesalahan yang detail (misal: *401 Unauthorized*, *404 Model Not Found*, atau *CORS Network Error*).

---

## 🔥 Bagian 3: Cara Setup Firebase & Mendapatkan Kredensial API Key

Firebase digunakan sebagai basis data cloud (Firestore) untuk menyimpan data wisata, lokasi usulan masyarakat, ulasan, notifikasi, serta otentikasi pengguna (Google Sign-In).

### 3.1 Membuat Project di Firebase Console
1. Buka **Firebase Console**:
   👉 [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Klik **"Add project"** (atau "Tambah proyek").
3. Masukkan nama proyek, misalnya: `sisteminformasipariwisatapct`.
4. Pilih opsi Google Analytics (opsional), lalu klik **"Create project"**.
5. Tunggu hingga proses pembuatan proyek selesai, lalu klik **"Continue"**.

---

### 3.2 Menambahkan Aplikasi Web (Web App) ke Firebase Project
1. Pada halaman utama *Project Overview*, klik ikon Web **`</>`** untuk menambahkan aplikasi web.
2. Masukkan nama aplikasi, misalnya: `SIPP Web App`.
3. (Opsional) Centang "Also set up Firebase Hosting" jika ingin menggunakan Firebase Hosting.
4. Klik **"Register app"**.
5. Firebase akan menampilkan blok kode **Firebase configuration**. Contoh tampilannya:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyD6QuJJ5RMbClgqzZVkagSALeZhkfWpBaw",
     authDomain: "sisteminformasipariwisatapct.firebaseapp.com",
     projectId: "sisteminformasipariwisatapct",
     storageBucket: "sisteminformasipariwisatapct.firebasestorage.app",
     messagingSenderId: "17617438203",
     appId: "1:17617438203:web:f184358361423abd2ef75e",
     measurementId: "G-XXXXXXXXXX"
   };
   ```
6. Salin nilai-nilai string dari konfigurasi di atas (`apiKey`, `authDomain`, `projectId`, dll.).

---

### 3.3 Mengaktifkan Firebase Authentication (Google Sign-In)
1. Di menu navigasi sebelah kiri Firebase Console, buka **Build** > **Authentication**.
2. Klik tombol **"Get started"**.
3. Pilih tab **"Sign-in method"**.
4. Klik penyedia **"Google"**.
5. Geser sakelar ke opsi **Enable** (Aktifkan).
6. Pilih email dukungan proyek (*Project support email*), lalu klik **"Save"**.

---

### 3.4 Mengaktifkan Cloud Firestore Database
1. Di menu sebelah kiri, buka **Build** > **Firestore Database**.
2. Klik **"Create database"**.
3. Pilih lokasi database (misal: `asia-southeast1` untuk Singapura atau `asia-east1`).
4. Pada pilihan aturan awal (*Security rules*), Anda dapat memilih **Start in production mode**.
5. Klik **"Create"**.
6. Setelah database terbentuk, buka tab **Rules** pada Firestore Database di Console.
7. Salin seluruh isi dari file `firestore.rules` yang ada di proyek ini, tempelkan (paste) ke editor rules di Firebase Console, lalu klik **"Publish"**.

---

## 🛠️ Bagian 4: Pengaturan File Variabel Lingkungan (.env)

Agar aplikasi dapat terhubung ke Firebase dan Gemini secara otomatis, Anda perlu mengatur file `.env`.

### 4.1 Membuat File `.env`
Di folder utama proyek, duplikat file `.env.example` dan ubah namanya menjadi `.env`.

### 4.2 Isian Lengkap `.env`
Sesuaikan isinya dengan kredensial yang Anda dapatkan dari Google AI Studio dan Firebase Console:

```env
# ==========================================
# Google Gemini API Key
# ==========================================
GEMINI_API_KEY="AIzaSyXXXXXXXXXXXX_GEMINI_KEY_ANDA"

# ==========================================
# Firebase Web Client Configuration
# ==========================================
VITE_FIREBASE_API_KEY="AIzaSyD6QuJJ5RMbClgqzZVkagSALeZhkfWpBaw"
VITE_FIREBASE_AUTH_DOMAIN="sisteminformasipariwisatapct.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="sisteminformasipariwisatapct"
VITE_FIREBASE_STORAGE_BUCKET="sisteminformasipariwisatapct.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="17617438203"
VITE_FIREBASE_APP_ID="1:17617438203:web:f184358361423abd2ef75e"
VITE_FIREBASE_MEASUREMENT_ID=""
```

### 4.3 Menyesuaikan `firebase-applet-config.json`
Selain file `.env`, Anda juga dapat memperbarui file `firebase-applet-config.json` di root proyek agar sesuai dengan kredensial Firebase Anda:

```json
{
  "projectId": "sisteminformasipariwisatapct",
  "appId": "1:17617438203:web:f184358361423abd2ef75e",
  "apiKey": "AIzaSyD6QuJJ5RMbClgqzZVkagSALeZhkfWpBaw",
  "authDomain": "sisteminformasipariwisatapct.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "sisteminformasipariwisatapct.firebasestorage.app",
  "messagingSenderId": "17617438203",
  "measurementId": "",
  "oAuthClientId": "",
  "recaptchaSiteKey": ""
}
```

---

## 🚀 Bagian 5: Verifikasi & Uji Coba Aplikasi

Setelah seluruh langkah di atas selesai:

1. Jalankan perintah server lokal:
   ```bash
   npm run dev
   ```
2. Buka peramban (browser) di `http://localhost:3000`.
3. **Uji Fitur Otentikasi**: Klik tombol **Masuk / Daftar** di navigasi atas, lalu coba login menggunakan akun Google.
4. **Uji Fitur Peta & Usulan**: Buka halaman **Peta Wisata Interaktif** atau **Ajukan Lokasi**, coba buat usulan tempat wisata baru. Data akan otomatis disinkronkan ke Firestore.
5. **Uji Fitur AI Assistant**: Klik ikon **Tanya AI Gemini** atau buat itinerari otomatis untuk memverifikasi bahwa `GEMINI_API_KEY` berfungsi dengan baik.

---

### ❓ Troubleshooting & Solusi Masalah Umum

- **Error `Firebase: Error (auth/configuration-not-found)`**:
  *Penyebab*: Penyedia otentikasi Google belum diaktifkan di Firebase Console.
  *Solusi*: Buka Firebase Console > Authentication > Sign-in method > Aktifkan Google.

- **Error `Missing or insufficient permissions` pada Firestore**:
  *Penyebab*: Aturan keamanan (security rules) Firestore menolak akses baca/tulis.
  *Solusi*: Buka file `firestore.rules` di proyek ini dan terapkan aturan tersebut ke tab Rules di Firebase Console.

- **Error `API key not valid` pada Gemini AI**:
  *Penyebab*: API key salah atau belum diatur di file `.env`.
  *Solusi*: Periksa kembali file `.env` Anda dan pastikan nama variabelnya adalah `GEMINI_API_KEY`.

---
*Semoga panduan ini membantu Anda dalam mengkonfigurasi dan menjalankan Sistem Informasi Pariwisata Pacitan (SIPP)!*
