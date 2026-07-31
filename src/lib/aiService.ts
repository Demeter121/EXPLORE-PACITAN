import { AiConfig, ChatMessage, AiProviderPreset, User, Location, Itinerary } from "../types";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "",
  modelName: "google/gemini-2.5-flash",
  isValidated: false,
  enabled: true,
};

export const PROVIDER_PRESETS: Record<
  AiProviderPreset,
  { name: string; baseUrl: string; defaultModel: string; note: string }
> = {
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.5-flash",
    note: "Mendukung ratusan model AI (Gemini, Claude, GPT-4o, Llama 3.3, DeepSeek R1).",
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    note: "Resmi dari OpenAI (GPT-4o, GPT-4o-mini). Perlu API Key dari platform.openai.com.",
  },
  groq: {
    name: "Groq Cloud",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
    note: "Sangat cepat & hemat (Llama 3.1 8B, Llama 3.3 70B, Mixtral). API Key dari console.groq.com.",
  },
  gemini_openai: {
    name: "Google Gemini (OpenAI Endpoint)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    note: "Endpoint resmi Google Gemini berspesifikasi OpenAI. API Key dari Google AI Studio.",
  },
  ollama: {
    name: "Ollama (Lokal / Self-Hosted)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3",
    note: "Model lokal berjalan di komputer Anda sendiri tanpa biaya API Key.",
  },
  custom: {
    name: "Custom Base URL",
    baseUrl: "",
    defaultModel: "",
    note: "Gunakan API LLM kustom (vLLM, LM Studio, Together AI, Mistral, dll).",
  },
};

const SYSTEM_PACITAN_PROMPT = `
Anda adalah Asisten AI Pacitan — Asisten Pariwisata Cerdas Resmi Kabupaten Pacitan, Jawa Timur.
Tugas utama Anda:
1. Memberikan rekomendasi destinasi wisata unggulan di Pacitan (seperti Pantai Klayar, Pantai Watukarung, Pantai Buyutan, Pantai Teleng Ria, Goa Gong, Goa Tabuhan, Air Terjun Grojogan Sewu, Sungai Maron Pacitan).
2. Membantu wisatawan menyusun itinerari liburan (misal: 1 Hari, 2 Hari 1 Malam, atau 3 Hari) sesuai preferensi (pantai, goa, petualangan, keluarga, romantis).
3. Memberikan panduan kuliner khas Pacitan (Sego Kalakan / Ikan Hiu, Nasi Tiwul, Sale Pisang, Tahu Tuna, Kupat Tahu Pacitan) dan pusat oleh-oleh.
4. Memberikan estimasi harga tiket masuk, jam operasional, rute akses kendaraan dari Solo/Jogja/Surabaya, serta saran tips keamanan berkunjung.
5. Menjawab pertanyaan pengguna dengan Bahasa Indonesia yang ramah, santun, komunikatif, dan informatif.

ATURAN FORMATTING RESPONS:
- JANGAN PERNAH mengeluarkan karakter asteris tunggal (*) sebagai poin/bullet list biasa.
- Gunakan tanda hubung/dash (-) atau angka (1., 2., 3.) untuk daftar/list.
- Untuk menebalkan nama tempat, makanan, atau kata kunci penting lainnya, gunakan format markdown bold ganda (**Teks Bold**). Format ini akan otomatis diubah menjadi teks tebal yang indah di aplikasi.
- Selalu buat respons terstruktur dengan spasi antar paragraf agar sangat mudah dibaca.
`.trim();

const STORAGE_KEY = "sipp_ai_config";
const CHAT_HISTORY_KEY = "sipp_ai_chat_history";

export class AiService {
  static getConfig(): AiConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_AI_CONFIG,
          ...parsed,
        };
      }
    } catch (e) {
      console.error("Gagal membaca ai_config dari localStorage:", e);
    }
    return DEFAULT_AI_CONFIG;
  }

  static saveConfig(config: AiConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent("sipp_ai_config_updated", { detail: config }));
      
      // Save to Firestore if available
      if (db) {
        setDoc(doc(db, "ai_settings", "config"), config).catch((e) => {
          console.error("Gagal menyimpan ai_config ke Firestore:", e);
        });
      }
    } catch (e) {
      console.error("Gagal menyimpan ai_config ke localStorage:", e);
    }
  }

  static getChatHistory(userId?: string): ChatMessage[] {
    try {
      const suffix = (!userId || userId === "guest_empty") ? "_guest" : `_${userId}`;
      const stored = localStorage.getItem(`${CHAT_HISTORY_KEY}${suffix}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Gagal membaca riwayat chat:", e);
    }
    return [];
  }

  static saveChatHistory(history: ChatMessage[], userId?: string): void {
    try {
      const suffix = (!userId || userId === "guest_empty") ? "_guest" : `_${userId}`;
      localStorage.setItem(`${CHAT_HISTORY_KEY}${suffix}`, JSON.stringify(history));
    } catch (e) {
      console.error("Gagal menyimpan riwayat chat:", e);
    }
  }

  static clearChatHistory(userId?: string): void {
    try {
      const suffix = (!userId || userId === "guest_empty") ? "_guest" : `_${userId}`;
      localStorage.removeItem(`${CHAT_HISTORY_KEY}${suffix}`);
    } catch (e) {
      console.error("Gagal menghapus riwayat chat:", e);
    }
  }

  /**
   * Normalizes Base URL to remove trailing slashes
   */
  private static cleanBaseUrl(url: string): string {
    let cleaned = url.trim();
    while (cleaned.endsWith("/")) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  }

  /**
   * Test & validate AI API Connection
   */
  static async testConnection(config: AiConfig): Promise<{
    success: boolean;
    message: string;
    sampleReply?: string;
  }> {
    if (!config.baseUrl) {
      return { success: false, message: "Base URL tidak boleh kosong." };
    }
    if (!config.modelName) {
      return { success: false, message: "Nama Model tidak boleh kosong." };
    }

    const baseUrl = this.cleanBaseUrl(config.baseUrl);
    const endpoint = `${baseUrl}/chat/completions`;
    let targetModel = config.modelName.trim();

    // Check mismatch: using OpenRouter model name format on Groq Direct API
    if (baseUrl.includes("api.groq.com")) {
      if (targetModel.startsWith("groq/")) {
        const pureName = targetModel.replace(/^groq\//, "");
        if (pureName === "compound-mini" || pureName === "compound" || pureName === "deepseek-r1" || pureName.includes("gemini")) {
          return {
            success: false,
            message: `Model '${config.modelName}' adalah model khusus OpenRouter. Untuk Groq Direct (api.groq.com), gunakan model seperti 'llama-3.1-8b-instant' atau 'mixtral-8x7b-32768'. Jika ingin menggunakan '${config.modelName}', silakan ganti ke Preset OpenRouter.`
          };
        }
        // If it's groq/llama-3.1-8b-instant on groq.com, strip the groq/ prefix
        targetModel = pureName;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey && config.apiKey.trim().length > 0) {
      headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
    }

    if (baseUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "SIPP Pacitan Tourism";
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: targetModel,
          messages: [
            {
              role: "user",
              content: "Halo! Berikan sapaan 1 kalimat singkat sebagai uji koneksi API.",
            },
          ],
          max_tokens: 30,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        let detail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) {
            detail += `: ${errJson.error.message}`;
          } else if (errJson.message) {
            detail += `: ${errJson.message}`;
          }
        } catch {
          if (errText) detail += `: ${errText.slice(0, 100)}`;
        }

        if (response.status === 401) {
          return { success: false, message: "Gagal (401 Unauthorized): API Key tidak valid atau tidak diizinkan." };
        } else if (response.status === 404) {
          return { success: false, message: `Gagal (404 Not Found): Endpoint (${endpoint}) atau Model '${config.modelName}' tidak ditemukan.` };
        } else {
          return { success: false, message: `Gagal menghubungkan ke API: ${detail}` };
        }
      }

      const data = await response.json();

      // Check for nested error objects inside HTTP 200 responses (common in OpenRouter)
      if (data?.error) {
        const errMsg = typeof data.error === "object"
          ? (data.error.message || JSON.stringify(data.error))
          : data.error;
        return { success: false, message: `Gagal menghubungkan ke API (Error: ${errMsg})` };
      }

      const firstChoice = data?.choices?.[0];
      if (firstChoice?.finish_reason === "error" || firstChoice?.error) {
        const choiceErr = firstChoice.error?.message || JSON.stringify(firstChoice.error || firstChoice.finish_reason);
        return { success: false, message: `Gagal dari Model: ${choiceErr}` };
      }

      const reply = firstChoice?.message?.content;
      if (!reply) {
        return { success: false, message: "Koneksi berhasil tetapi model memberikan respons kosong atau tidak valid." };
      }

      return {
        success: true,
        message: `✓ Terhubung! Model '${config.modelName}' aktif dan siap digunakan.`,
        sampleReply: reply,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: false, message: "Koneksi Timeout (Waktu habis). Periksa koneksi atau ketersediaan server." };
      }
      return {
        success: false,
        message: `Terjadi kendala jaringan/CORS: ${err.message || "Gagal menghubungi server AI"}. Periksa Base URL dan koneksi Anda.`,
      };
    }
  }

  static getSystemPrompt(currentUser?: User, locations?: Location[], itineraries?: Itinerary[]): string {
    const timeString = `
WAKTU REAL-TIME SAAT INI (Gunakan ini sebagai referensi waktu saat ini jika ditanya):
- Hari/Tanggal: ${new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
- Jam: ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
- Waktu Lokal: ${new Date().toString()}
`;

    let userContext = "";
    if (!currentUser || currentUser.id === "guest_empty") {
      userContext = `
INFORMASI PENGGUNA SAAT INI:
- Status: Tamu Anonim (Belum Login / Guest).
- Nama: Tamu / Pengunjung.
- Peran: Wisatawan Umum.
- Instruksi Khusus: Pengguna belum masuk ke akun. Bersikaplah sangat ramah dan ajak mereka menjelajahi Pacitan. Jika mereka menanyakan cara menyimpan rencana perjalanan (itinerari) atau memberikan ulasan/rating, jelaskan dengan ramah bahwa mereka perlu melakukan login atau mendaftar akun terlebih dahulu melalui tombol login di pojok kanan atas agar data mereka tersimpan secara permanen.
`;
    } else {
      const roleName = currentUser.role === "admin" 
        ? "Admin Utama (Administrator)" 
        : currentUser.role === "pengelola" 
          ? "Pengelola Wisata (Partner Pariwisata)" 
          : "Pengunjung Terdaftar (User)";
      
      let roleInstructions = "";
      if (currentUser.role === "admin") {
        roleInstructions = `
- Peran Khusus Admin Utama: Pengguna ini adalah Ivan Fadhila (Admin Utama) atau pengelola sistem tertinggi yang memiliki kontrol penuh atas seluruh website SIPP Pacitan (Sistem Informasi Pariwisata Pacitan).
- Instruksi Khusus: Berikan rasa hormat yang tinggi kepada Admin Utama. Jika dia bertanya seputar sistem, antrean persetujuan (queue), log aktivitas (moderation logs), pengelolaan destinasi wisata, atau paket wisata, berikan jawaban teknis atau manajerial yang akurat. Anda dapat menyapanya sebagai "Kak Ivan" atau "Admin Utama Ivan" dengan penuh hormat.
`;
      } else if (currentUser.role === "pengelola") {
        roleInstructions = `
- Peran Khusus Pengelola Wisata: Pengguna ini adalah mitra pengelola tempat wisata resmi di Pacitan yang bertugas memelihara informasi tempat wisatanya, memantau ulasan pengunjung, serta mengajukan pembaruan data wisata.
- Instruksi Khusus: Dukung pekerjaannya dalam mengelola tempat wisata. Berikan panduan mengenai bagaimana cara mendaftarkan atau menyunting informasi tempat wisata mereka, serta bagaimana merespons ulasan pengunjung untuk meningkatkan kualitas destinasi wisata mereka di Pacitan.
`;
      } else {
        roleInstructions = `
- Peran Khusus Pengunjung Terdaftar: Pengguna ini adalah wisatawan yang telah memiliki akun terdaftar di aplikasi.
- Instruksi Khusus: Sapa mereka dengan ramah menggunakan namanya jika memungkinkan. Bantu mereka merencanaperjalanan terbaik mereka di Pacitan, buatkan itinerari kustom, rekomendasikan pantai atau kuliner tersembunyi (hidden gems), dan ingatkan mereka bahwa mereka sekarang bebas menulis ulasan, memberikan rating, serta membuat itinerari tak terbatas yang akan tersimpan otomatis di akun mereka.
`;
      }

      userContext = `
INFORMASI PENGGUNA SAAT INI:
- Status: Pengguna Terotentikasi (Sudah Login).
- Nama Pengguna: ${currentUser.name}
- Email Pengguna: ${currentUser.email}
- Peran/Role Sistem: ${roleName}
${roleInstructions}
`;
    }

    // Include real location list
    let locationsContext = "";
    if (locations && locations.length > 0) {
      locationsContext = `
DAFTAR DESTINASI/LOKASI RIIL DI PACITAN (Gunakan ID-ID ini persis saat merancang atau mengedit itinerari):
${locations.slice(0, 45).map(loc => `- ID: "${loc.id}" | Nama: "${loc.name}" | Kategori: "${loc.category}" | Alamat: "${loc.address}"`).join("\n")}
`;
    }

    // Include real user itineraries
    let itinerariesContext = "";
    if (itineraries && itineraries.length > 0 && currentUser && currentUser.id !== "guest_empty") {
      const userItis = itineraries.filter(i => i.createdBy === currentUser.id);
      if (userItis.length > 0) {
        itinerariesContext = `
DAFTAR ITINERARI SAYA (PENGGUNA) SAAT INI (Gunakan ID ini sebagai acuan untuk mengedit itinerari):
${userItis.map(iti => `- ID: "${iti.id}" | Judul: "${iti.title}" | Deskripsi: "${iti.description}" | Hari: ${iti.days.length} hari`).join("\n")}
`;
      }
    }

    const itineraryActionsInstruction = `
SISTEM AKSI OTOMATISASI ITINERARI (SANGAT PENTING):
Anda memiliki kemampuan untuk membantu pengguna membuat (menambahkan) atau mengedit (memperbarui) itinerari mereka secara langsung di sistem.
Jika pengguna meminta Anda untuk membuat, merancang, menyusun, merencanakan, atau mengedit rencana perjalanan/itinerari mereka, Anda WAJIB menyertakan blok JSON aksi khusus di bagian akhir respons Anda dalam format berikut:

[ITINERARY_ACTION]
{
  "action": "create" | "edit",
  "id": "iti_id_yang_sesuai",
  "title": "Judul Itinerari",
  "description": "Deskripsi singkat rencana perjalanan",
  "days": [
    {
      "dayNumber": 1,
      "items": [
        {
          "locationId": "id_destinasi_yang_sesuai",
          "timeSlot": "08:00 - 10:00 WIB",
          "note": "Aktivitas menyenangkan di sini"
        }
      ]
    }
  ]
}
[/ITINERARY_ACTION]

Ketentuan blok aksi:
1. Jika "action" adalah "create", buatlah ID acak baru unik yang diawali "iti_" (misal "iti_ai_" + timestamp).
2. Jika "action" adalah "edit", gunakan "id" dari itinerari yang ingin diedit sesuai daftar itinerari saya saat ini. Anda dapat menambah hari, memperbarui atau menghapus destinasi, menyusun ulang urutan, serta memperbarui slot waktu & catatan.
3. Selalu pastikan "locationId" yang Anda pilih adalah ID asli dari "DAFTAR DESTINASI/LOKASI RIIL DI PACITAN" di atas. Jangan pernah mengarang ID baru.
4. Anda harus tetap memberikan pesan penjelasan ramah dalam Bahasa Indonesia di luar tag [ITINERARY_ACTION] untuk menyapa pengguna. Tag [ITINERARY_ACTION] akan diproses oleh aplikasi untuk menampilkan tombol interaktif bagi pengguna.
`;

    return `${SYSTEM_PACITAN_PROMPT}\n\n${timeString}\n\n${userContext}\n\n${locationsContext}\n\n${itinerariesContext}\n\n${itineraryActionsInstruction}`.trim();
  }

  /**
   * Send chat message to configured LLM Endpoint
   */
  static async sendMessage(
    userPrompt: string,
    history: ChatMessage[],
    config: AiConfig,
    currentUser?: User,
    locations?: Location[],
    itineraries?: Itinerary[]
  ): Promise<string> {
    if (!config.baseUrl || !config.modelName) {
      throw new Error("Konfigurasi Base URL atau Model AI belum lengkap.");
    }

    const baseUrl = this.cleanBaseUrl(config.baseUrl);
    const endpoint = `${baseUrl}/chat/completions`;
    let targetModel = config.modelName.trim();

    if (baseUrl.includes("api.groq.com") && targetModel.startsWith("groq/")) {
      targetModel = targetModel.replace(/^groq\//, "");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey && config.apiKey.trim().length > 0) {
      headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
    }

    if (baseUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "SIPP Pacitan Tourism";
    }

    // Prepare system message + recent history
    const apiMessages = [
      { role: "system", content: this.getSystemPrompt(currentUser, locations, itineraries) },
      ...history.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: userPrompt },
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: apiMessages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `HTTP Error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        if (errText) errMsg = errText.slice(0, 150);
      }
      throw new Error(errMsg);
    }

    const data = await response.json();

    // Check for nested error objects inside HTTP 200 responses (common in OpenRouter)
    if (data?.error) {
      const errMsg = typeof data.error === "object"
        ? (data.error.message || JSON.stringify(data.error))
        : data.error;
      throw new Error(`API Error: ${errMsg}`);
    }

    const firstChoice = data?.choices?.[0];
    if (firstChoice?.finish_reason === "error" || firstChoice?.error) {
      const choiceErr = firstChoice.error?.message || JSON.stringify(firstChoice.error || firstChoice.finish_reason);
      throw new Error(`Gagal dari Model: ${choiceErr}`);
    }

    const assistantContent = firstChoice?.message?.content;
    
    if (!assistantContent) {
      const rawString = JSON.stringify(data);
      throw new Error(`Server AI memberikan respons kosong. Response raw: ${rawString.slice(0, 300)}`);
    }

    return assistantContent;
  }

  /**
   * Fetch list of available models using OpenAI specification (/models)
   */
  static async fetchAvailableModels(config: AiConfig): Promise<string[]> {
    if (!config.baseUrl) {
      throw new Error("Base URL tidak boleh kosong.");
    }
    const baseUrl = this.cleanBaseUrl(config.baseUrl);
    const endpoint = `${baseUrl}/models`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errDetails = "";
        try {
          const errText = await response.text();
          const errJson = JSON.parse(errText);
          errDetails = errJson?.error?.message || errText.slice(0, 100);
        } catch {
          errDetails = response.statusText;
        }
        throw new Error(`HTTP ${response.status}: ${errDetails || "Koneksi gagal"}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => m.id);
        if (models.length === 0) {
          throw new Error("Daftar model kosong dari server.");
        }
        return models.sort();
      }
      throw new Error("Format respons models tidak sesuai standar OpenAI (tidak mengandung array 'data').");
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Koneksi timeout saat mengambil daftar model.");
      }
      throw err;
    }
  }
}
