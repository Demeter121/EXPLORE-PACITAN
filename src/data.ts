import { Location, User, UserRole, LocationSubmission, Itinerary, Review, ModerationLog, TourPackage, AdminNotification } from "./types";

// Dynamic dates helper
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export const EMPTY_GUEST_USER: User = {
  id: "guest_empty",
  name: "Tamu (Belum Login)",
  email: "",
  role: "user",
  avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=guest_empty"
};

export const MOCK_USERS: User[] = [
  EMPTY_GUEST_USER,
  {
    id: "21oQqjjDX0Xfs0ddKRsVJlsxGqm1",
    name: "Ivan Fadhila (Admin Utama)",
    email: "ivanfadhilamaulana1@gmail.com",
    role: "admin",
    password: "123456",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=ivan"
  },
  {
    id: "usr_mgr_koor",
    name: "Budi Santoso (Koordinator Pengelola)",
    email: "ivanfadhila9@gmail.com",
    role: "pengelola",
    password: "123456",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=ivan2",
    managedLocations: ["loc_2"]
  },
  {
    id: "usr_mgr_1",
    name: "Siti Aminah (Mitra Pengelola)",
    email: "siti.klayar@gmail.com",
    role: "pengelola",
    password: "123456",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=mitra",
    managedLocations: ["loc_1"]
  },
  {
    id: "usr_wst_1",
    name: "Rina Lestari (Wisatawan)",
    email: "buyyers9mlr@gmail.com",
    role: "user",
    password: "123456",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=buyyer",
  }
];

export const INITIAL_NOTIFICATIONS: AdminNotification[] = [
  {
    id: "notif_1",
    senderId: "21oQqjjDX0Xfs0ddKRsVJlsxGqm1",
    senderName: "Ivan Fadhila (Admin Utama)",
    targetRole: "all",
    title: "Selamat Datang di Explore Pacitan (explorepacitan.com)",
    message: "Terima kasih telah berkontribusi dan menjelajahi surga tersembunyi Kabupaten Pacitan. Gunakan panel pengelola untuk mengajukan tempat wisata baru.",
    type: "info",
    createdAt: daysAgo(1),
    readBy: []
  },
  {
    id: "notif_2",
    senderId: "21oQqjjDX0Xfs0ddKRsVJlsxGqm1",
    senderName: "Ivan Fadhila (Admin Utama)",
    targetRole: "pengelola",
    title: "Pembaruan Regulasi & SLA Moderasi",
    message: "Seluruh pengajuan obyek wisata baru wajib disertai koordinat akurat dan foto orisinal. Tinjauan SLA dilakukan maksimal < 24 Jam.",
    type: "warning",
    createdAt: daysAgo(2),
    readBy: []
  }
];

export const INITIAL_LOCATIONS: Location[] = [];

export const INITIAL_SUBMISSIONS: LocationSubmission[] = [
  {
    id: "sub_1",
    targetLocationId: null,
    submissionType: "create",
    payload: {
      name: "Pantai Buyutan",
      category: "wisata",
      description: "Pantai alami dengan pasir putih lapang nan luas yang terletak di bawah tebing karang raksasa. Menawarkan keindahan gugusan karang mirip kapal legendaris, keasrian alam yang alami, serta spot sunset menakjubkan.",
      coordinates: { lat: -8.2327, lng: 110.9575 },
      address: "Desa Widoro, Kecamatan Donorojo, Pacitan, Jawa Timur",
      photos: [
        "https://images.unsplash.com/photo-1473116763269-255ea7604bb6?q=80&w=800&auto=format&fit=crop"
      ],
      openingHours: "06:00 - 18:00 WIB",
      priceRange: "Rp 10.000",
      contact: "+62-812-3322-1100"
    },
    submittedBy: "usr_2",
    submittedByName: "Suroso Widjojo",
    submitterRole: "pengelola",
    status: "pending",
    reviewedBy: null,
    reviewedByName: null,
    reviewNotes: null,
    reviewedAt: null,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: "sub_2",
    targetLocationId: "loc_3",
    submissionType: "update",
    payload: {
      name: "Pantai Kasap (Mini Raja Ampat)",
      category: "wisata",
      description: "Sering dijuluki sebagai 'Mini Raja Ampat' Pacitan karena gugusan bukit karang hijaunya yang memukau di atas samudera. Kini dilengkapi dengan spot gardu pandang terstruktur baru, jembatan kayu foto, dan warung-warung kopi kelapa muda tradisional.",
      coordinates: { lat: -8.2269, lng: 111.0253 },
      address: "Dusun Watukarung, Desa Candi, Kecamatan Pringkuku, Kabupaten Pacitan, Jawa Timur",
      photos: [
        "https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=800&auto=format&fit=crop"
      ],
      openingHours: "05:00 - 18:30 WIB",
      priceRange: "Rp 7.000",
      contact: "+62-856-7772-2211"
    },
    submittedBy: "usr_1",
    submittedByName: "Aditya Pratama",
    submitterRole: "user",
    status: "pending",
    reviewedBy: null,
    reviewedByName: null,
    reviewNotes: null,
    reviewedAt: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1)
  },
  {
    id: "sub_3",
    targetLocationId: null,
    submissionType: "create",
    payload: {
      name: "Istana Kuliner Seafood Pacitan",
      category: "makan",
      description: "Masakan olahan laut segar dari nelayan Pelabuhan Tamperan Pacitan langsung, terkenal dengan lobster asam manis, cumi saus padang dan ikan bakar khas bumbu kelapa pedas.",
      coordinates: { lat: -8.2112, lng: 111.1082 },
      address: "Dusun Tamperan, Desa Sidoharjo, Pacitan Kota, Jawa Timur",
      photos: [
        "https://images.unsplash.com/photo-1534080391025-a77af9cd5428?q=80&w=800&auto=format&fit=crop"
      ],
      openingHours: "10:00 - 22:00 WIB",
      priceRange: "Rp 50.000 - Rp 150.000",
      contact: "+62-813-9000-8800"
    },
    submittedBy: "usr_1",
    submittedByName: "Aditya Pratama",
    submitterRole: "user",
    status: "revision_requested",
    reviewedBy: "21oQqjjDX0Xfs0ddKRsVJlsxGqm1",
    reviewedByName: "Ivan Fadhila (Admin Utama)",
    reviewNotes: "Koordinat peta yang dimasukkan terlalu jauh dari jalan raya utama. Harap geser pin koordinat latitude/longitude agar sesuai dengan letak aslinya di dekat pelabuhan Tamperan ya.",
    reviewedAt: daysAgo(3),
    createdAt: daysAgo(5),
    updatedAt: daysAgo(3)
  }
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: "rev_1",
    locationId: "loc_1",
    userId: "usr_1",
    userEmail: "aditya.pratama@gmail.com",
    userName: "Aditya Pratama",
    rating: 5,
    comment: "Pantai tercantik di Pacitan! Semburan air seruling samudera bekerja sangat ajaib tiap kali ombak pasang menghantam tebing karang. Fasilitas parkir luas dan banyak yang menjual es kelapa muda.",
    createdAt: daysAgo(10)
  },
  {
    id: "rev_2",
    locationId: "loc_1",
    userId: "21oQqjjDX0Xfs0ddKRsVJlsxGqm1",
    userEmail: "ivanfadhilamaulana1@gmail.com",
    userName: "Ivan Fadhila (Admin Utama)",
    rating: 4,
    comment: "Pemandangannya sangat kokoh serta ombak yang dramatis. Jalur akses jalan dari kota Pacitan sudah sangat mulus diaspal dan dipasangi penanda arah kokoh.",
    createdAt: daysAgo(7)
  },
  {
    id: "rev_3",
    locationId: "loc_2",
    userId: "usr_1",
    userEmail: "aditya.pratama@gmail.com",
    userName: "Aditya Pratama",
    rating: 5,
    comment: "Luar biasa megah! Lampu sorot warna-warni di dalam goa sangat memperindah formasi stalaktit alami. Suhu di dalam goa agak lembap tapi tidak sesak karena ada kipas angin besar di beberapa sudut.",
    createdAt: daysAgo(14)
  }
];

export const INITIAL_ITINERARIES: Itinerary[] = [
  {
    id: "iti_1",
    title: "Eksplorasi Alam & Pantai Barat Pacitan",
    description: "Rencana perjalanan 2 hari menjelajahi goa tercantik dan pantai pasir putih legendaris Pacitan Barat.",
    days: [
      {
        dayNumber: 1,
        items: [
          { locationId: "loc_2", timeSlot: "08:30 - 11:30 WIB", note: "Melihat keindahan stalaktit Goa Gong pagi hari agar sepi pengunjung." },
          { locationId: "loc_7", timeSlot: "12:00 - 13:30 WIB", note: "Makan siang kuliner legendaris sate kambing khas di kota." },
          { locationId: "loc_3", timeSlot: "14:30 - 17:30 WIB", note: "Menikmati indahnya pemandangan Raja Ampat mini di Pantai Kasap saat matahari mulai condong." }
        ]
      },
      {
        dayNumber: 2,
        items: [
          { locationId: "loc_1", timeSlot: "08:00 - 12:00 WIB", note: "Eksplorasi ombak seruling samudera Pantai Klayar sekalian foto seru di tebing." },
          { locationId: "loc_4", timeSlot: "13:30 - 17:00 WIB", note: "Bermain air atau bersantai melihat peselancar profesional di Pantai Watukarung." },
          { locationId: "loc_8", timeSlot: "18:00 - 20:00 WIB", note: "Nongkrong santai minum kopi artisan di pusat kota Pacitan sebelum pulang." }
        ]
      }
    ],
    isPublic: true,
    createdBy: "usr_1",
    createdByName: "Aditya Pratama",
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4)
  }
];

export const INITIAL_LOGS: ModerationLog[] = [
  {
    id: "log_1",
    action: "request_revision",
    submissionId: "sub_3",
    targetName: "Istana Kuliner Seafood Pacitan",
    adminId: "21oQqjjDX0Xfs0ddKRsVJlsxGqm1",
    adminEmail: "ivanfadhilamaulana1@gmail.com",
    timestamp: daysAgo(3),
    reason: "Koordinat peta yang dimasukkan terlalu jauh dari jalan raya utama. Harap geser pin koordinat latitude/longitude agar sesuai."
  }
];

export const INITIAL_TOUR_PACKAGES: TourPackage[] = [
  {
    id: "pkg_1",
    title: "Eksotis Pacitan Barat (Full Day)",
    provider: "Pacitan Adventure Tour",
    duration: "1 Hari (Full Day)",
    price: "Rp 250.000 / Orang",
    category: "family",
    description: "Nikmati penjelajahan seru ke destinasi pantai pasir putih legendaris dan goa stalaktit tercantik di Asia Tenggara dalam waktu satu hari penuh bersama pemandu lokal berlisensi.",
    destinations: ["Goa Gong", "Pantai Klayar", "Pantai Kasap"],
    includes: ["Transportasi AC PP", "Makan Siang Prasmanan", "Tiket Masuk Semua Wisata", "Air Mineral", "Pemandu Wisata Profesional"],
    contactWhatsApp: "https://wa.me/6281234567890?text=Halo%20Pacitan%20Adventure,%20saya%20tertarik%20dengan%20Paket%20Eksotis%20Pacitan%20Barat",
    photo: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop",
    rating: 4.8,
    reviewsCount: 14
  },
  {
    id: "pkg_2",
    title: "Surfing & Camp Watukarung (3D2N)",
    provider: "Watu Surf Guide & Camp",
    duration: "3 Hari 2 Malam",
    price: "Rp 750.000 / Orang",
    category: "adventure",
    description: "Petualangan menantang ombak kelas dunia di Pantai Watukarung, menginap di tenda pinggir pantai eksklusif, serta eksplorasi tebing mini Raja Ampat di Pantai Kasap.",
    destinations: ["Pantai Watukarung", "Pantai Kasap", "Harry's Ocean Villa"],
    includes: ["Sewa Papan Selancar & Mentor", "Tenda Dome & Matras Premium", "Makan 6x (Barbeque Seafood)", "Tiket Masuk Obyek Wisata", "Dokumentasi Foto & Drone"],
    contactWhatsApp: "https://wa.me/6281234567890?text=Halo%20Watu%20Surf,%20saya%20tertarik%20dengan%20Paket%20Surfing%20and%20Camp%20Watukarung",
    photo: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=800&auto=format&fit=crop",
    rating: 4.9,
    reviewsCount: 8
  },
  {
    id: "pkg_3",
    title: "Pacitan Honeymoon Escape (2D1N)",
    provider: "IndoTravel Pacitan",
    duration: "2 Hari 1 Malam",
    price: "Rp 1.450.000 / Pasang",
    category: "couple",
    description: "Paket liburan romantis khusus pasangan di villa eksklusif tepi pantai. Nikmati makan malam romantis di bawah gemintang dan jelajah keindahan sunset tersembunyi Pacitan.",
    destinations: ["Harry's Ocean Villa", "Pantai Kasap", "Pantai Klayar"],
    includes: ["Kamar Honeymoon Decor", "Private Car & Driver", "Romantic Dinner Pinggir Pantai", "Tiket Masuk Wisata", "Dokumentasi Pasangan"],
    contactWhatsApp: "https://wa.me/6281234567890?text=Halo%20IndoTravel,%20saya%20tertarik%20dengan%20Paket%20Honeymoon%20Escape%20Pacitan",
    photo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop",
    rating: 4.7,
    reviewsCount: 11
  },
  {
    id: "pkg_4",
    title: "Heritage & Kuliner Pacitan Kota (2D1N)",
    provider: "Karsa Budaya Wisata",
    duration: "2 Hari 1 Malam",
    price: "Rp 350.000 / Orang",
    category: "cultural",
    description: "Jelajahi sejarah luhur Pacitan lewat kunjungan ke museum, cagar budaya, dipadukan mencicipi aneka kuliner otentik khas Pacitan kota yang legendaris.",
    destinations: ["Istana Hotel Pacitan", "Sate Kambing Pak Sugiyanto", "Kopi nGelir & Roastery"],
    includes: ["Hotel Bintang 3 (Tengah Kota)", "Makan 3x Kuliner Khas", "Pemandu Sejarah Lokal", "Tiket Masuk Museum & Situs", "Souvenir Kerajinan Khas"],
    contactWhatsApp: "https://wa.me/6281234567890?text=Halo%20Karsa%20Budaya,%20saya%20tertarik%20dengan%20Paket%20Heritage%20Pacitan",
    photo: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop",
    rating: 4.6,
    reviewsCount: 6
  }
];

// Helper functions for localStorage state storage & retrieval
export const isDefaultAdminUtama = (e: string = "", n: string = "", id: string = "") => {
  const email = (e || "").toLowerCase().trim();
  const userId = (id || "").toLowerCase().trim();
  return email === "ivanfadhilamaulana1@gmail.com" || 
         userId === "21oqjjdx0xfs0ddkrsvjlsxgqm1" ||
         userId === "usr_admin";
};

export const isDefaultKoordinatorPengelola = (e: string = "", n: string = "", id: string = "") => {
  const email = (e || "").toLowerCase().trim();
  const userId = (id || "").toLowerCase().trim();
  return email === "ivanfadhila9@gmail.com" || 
         userId === "usr_mgr_koor";
};

export const isDefaultMitraPengelola = (e: string = "", n: string = "", id: string = "") => {
  const email = (e || "").toLowerCase().trim();
  const userId = (id || "").toLowerCase().trim();
  return email === "siti.klayar@gmail.com" || 
         userId === "usr_mgr_1";
};

export const isDefaultWisatawan = (e: string = "", n: string = "", id: string = "") => {
  const email = (e || "").toLowerCase().trim();
  const userId = (id || "").toLowerCase().trim();
  return email === "buyyers9mlr@gmail.com" || 
         userId === "usr_wst_1";
};

export const enforceDefaultAccount = (u: User): User => {
  if (!u) return u;
  const e = (u.email || "").toLowerCase().trim();
  const id = (u.id || "").toLowerCase().trim();
  if (e === "ivanfadhilamaulana1@gmail.com" || id === "21oqjjdx0xfs0ddkrsvjlsxgqm1" || id === "usr_admin") {
    return {
      ...u,
      role: "admin",
      name: (u.name && u.name !== "Ivan" && u.name !== "Pengguna Google") ? u.name : "Ivan Fadhila (Admin Utama)",
      id: u.id || "21oQqjjDX0Xfs0ddKRsVJlsxGqm1",
      email: "ivanfadhilamaulana1@gmail.com",
      avatarUrl: u.avatarUrl && !u.avatarUrl.includes("dicebear") ? u.avatarUrl : "https://api.dicebear.com/7.x/adventurer/svg?seed=ivan"
    };
  } else if (e === "ivanfadhila9@gmail.com" || id === "usr_mgr_koor") {
    return {
      ...u,
      role: u.role || "pengelola",
      name: u.name || "Budi Santoso (Koordinator Pengelola)",
      id: u.id || "usr_mgr_koor",
      email: "ivanfadhila9@gmail.com",
      avatarUrl: u.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=ivan2",
      managedLocations: u.managedLocations !== undefined ? u.managedLocations : ["loc_2"]
    };
  } else if (e === "siti.klayar@gmail.com" || id === "usr_mgr_1") {
    return {
      ...u,
      role: u.role || "pengelola",
      name: u.name || "Siti Aminah (Mitra Pengelola)",
      id: u.id || "usr_mgr_1",
      email: "siti.klayar@gmail.com",
      avatarUrl: u.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=mitra",
      managedLocations: u.managedLocations !== undefined ? u.managedLocations : ["loc_1"]
    };
  } else if (e === "buyyers9mlr@gmail.com" || id === "usr_wst_1") {
    return {
      ...u,
      role: u.role || "user",
      name: u.name || "Rina Lestari (Wisatawan)",
      id: u.id || "usr_wst_1",
      email: "buyyers9mlr@gmail.com",
      avatarUrl: u.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=buyyer"
    };
  }
  return u;
};

export class LocalDB {
  static get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(`sipp_${key}`);
      if (!data) return defaultValue;
      const parsed = JSON.parse(data);
      return parsed !== null && parsed !== undefined ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static save<T>(key: string, data: T): void {
    try {
      localStorage.setItem(`sipp_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  }

  static deduplicateLocations(list: Location[]): Location[] {
    if (!Array.isArray(list)) return [];
    const valid = list.filter(item => item && item.name);
    const idMap = new Map<string, Location>();
    valid.forEach((loc, idx) => {
      let rawId = loc.id || "";
      // If ID starts with ChIJ (Google Place ID) or contains raw URL/slashes/special chars or is numeric/timestamp
      const isGooglePlaceId = rawId.startsWith("ChIJ") || rawId.length > 30 || rawId.includes("/") || rawId.startsWith("http");
      
      let slug = "";
      if (loc.name) {
        slug = loc.name
          .toLowerCase()
          .trim()
          .replace(/['"]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }

      let safeId = (!rawId || isGooglePlaceId || !slug) ? (slug ? `pacitan-${slug}` : `destinasi-${idx}`) : rawId.replace(/[^a-zA-Z0-9_-]/g, "-");
      
      const cleaned: Location = { ...loc, id: safeId };
      const key = safeId.toLowerCase().trim();
      if (!idMap.has(key)) {
        idMap.set(key, cleaned);
      } else {
        const existing = idMap.get(key)!;
        idMap.set(key, { ...existing, ...cleaned });
      }
    });
    return Array.from(idMap.values());
  }

  static getLocations(): Location[] {
    const stored = this.get<Location[]>("locations", []);
    const safeStored = Array.isArray(stored) ? stored : [];
    const combined = [...INITIAL_LOCATIONS, ...safeStored];
    const result = this.deduplicateLocations(combined).map(loc => {
      const photos = Array.isArray(loc?.photos) ? loc.photos : [];
      const filteredPhotos = photos.filter(p => p && !p.includes("1544735716-392fe2489ffa"));
      return {
        ...loc,
        photos: filteredPhotos.length > 0
          ? filteredPhotos
          : ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop"]
      };
    });
    this.save("locations", result);
    return result;
  }

  static deduplicateById<T extends { id: string }>(list: T[]): T[] {
    if (!Array.isArray(list)) return [];
    const valid = list.filter(item => item && item.id);
    const map = new Map<string, T>();
    valid.forEach(item => {
      const key = (item.id || "").toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, item);
      } else {
        const existing = map.get(key)!;
        map.set(key, { ...existing, ...item });
      }
    });
    return Array.from(map.values());
  }

  static cleanAndDeduplicateUsers(data: User[]): User[] {
    if (!Array.isArray(data)) return [];
    const validStored = data.filter(u => u && u.id);
    
    // Helper to merge roles preserving elevated/admin status
    const mergeRoles = (r1?: UserRole, r2?: UserRole): UserRole => {
      if (r1 === "admin" || r2 === "admin") return "admin";
      if (r1 === "pengelola" || r2 === "pengelola") return "pengelola";
      return "user";
    };

    // Step 1: Deduplicate by ID first
    const byIdMap = new Map<string, User>();
    validStored.forEach(u => {
      let uCopy = { ...u };
      if (uCopy.id === "guest_empty" || uCopy.name === "Tamu (Belum Login)") {
        uCopy.role = "user";
      } else {
        uCopy = enforceDefaultAccount(uCopy);
      }

      const idKey = (uCopy.id || "").toLowerCase().trim();
      if (!byIdMap.has(idKey)) {
        byIdMap.set(idKey, uCopy);
      } else {
        const existing = byIdMap.get(idKey)!;
        const isMainAdmin = (uCopy.email || "").toLowerCase().trim() === "ivanfadhilamaulana1@gmail.com" || idKey === "21oqjjdx0xfs0ddkrsvjlsxgqm1" || idKey === "usr_admin";
        const finalRole = isMainAdmin ? "admin" : mergeRoles(existing.role, uCopy.role);
        byIdMap.set(idKey, {
          ...existing,
          ...uCopy,
          role: finalRole
        });
      }
    });

    // Step 2: Strict deduplication by normalized email (or name if no email)
    const uniqueMap = new Map<string, User>();
    Array.from(byIdMap.values()).forEach(u => {
      let key = u.email ? u.email.toLowerCase().trim() : (u.name || "").toLowerCase().trim().replace(/\s+/g, " ");

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, u);
      } else {
        const existing = uniqueMap.get(key)!;
        const isMainAdmin = (u.email || "").toLowerCase().trim() === "ivanfadhilamaulana1@gmail.com" || (u.id || "").toLowerCase().trim() === "21oqjjdx0xfs0ddkrsvjlsxgqm1" || (u.id || "").toLowerCase().trim() === "usr_admin";
        const finalRole = isMainAdmin ? "admin" : mergeRoles(existing.role, u.role);
        uniqueMap.set(key, {
          ...existing,
          ...u,
          role: finalRole
        });
      }
    });

    // Step 3: Final safety check - guarantee NO duplicate IDs ever exist in the output array!
    const finalIdMap = new Map<string, User>();
    Array.from(uniqueMap.values()).forEach(u => {
      // Clear old mock passwords to avoid confusion in manual login
      if (u.password === "adminpassword" || u.password === "password123") {
        delete u.password;
      }
      
      const idKey = (u.id || "").toLowerCase().trim();
      if (!finalIdMap.has(idKey)) {
        finalIdMap.set(idKey, u);
      } else {
        const existing = finalIdMap.get(idKey)!;
        const isMainAdmin = (u.email || "").toLowerCase().trim() === "ivanfadhilamaulana1@gmail.com" || idKey === "21oqjjdx0xfs0ddkrsvjlsxgqm1" || idKey === "usr_admin";
        const finalRole = isMainAdmin ? "admin" : mergeRoles(existing.role, u.role);
        finalIdMap.set(idKey, {
          ...existing,
          ...u,
          role: finalRole
        });
      }
    });

    return Array.from(finalIdMap.values());
  }

  static saveLocations(data: Location[]): void {
    this.save("locations", this.deduplicateLocations(data));
  }

  static getSubmissions(): LocationSubmission[] {
    const subs = this.get<LocationSubmission[]>("submissions", INITIAL_SUBMISSIONS);
    const safeSubs = Array.isArray(subs) ? subs : INITIAL_SUBMISSIONS;
    const validSubs = safeSubs.filter(s => s && s.id);
    const uniqueMap = new Map<string, LocationSubmission>();
    validSubs.forEach(sub => {
      const key = (sub.id || "").toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, sub);
      }
    });
    const result: LocationSubmission[] = Array.from(uniqueMap.values()).map(sub => {
      const photos = Array.isArray(sub?.payload?.photos) ? sub.payload.photos : [];
      const filteredPhotos = photos.filter(p => p && !p.includes("1544735716-392fe2489ffa"));
      return {
        ...sub,
        payload: {
          name: sub.payload?.name || "Destinasi Baru",
          category: sub.payload?.category || "wisata",
          description: sub.payload?.description || "",
          coordinates: sub.payload?.coordinates || { lat: -8.2046, lng: 111.0921 },
          address: sub.payload?.address || "Pacitan, Jawa Timur",
          ...sub.payload,
          photos: filteredPhotos.length > 0
            ? filteredPhotos
            : ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop"]
        }
      };
    });
    this.save("submissions", result);
    return result;
  }

  static saveSubmissions(data: LocationSubmission[]): void {
    this.save("submissions", this.deduplicateById(data));
  }

  static getReviews(): Review[] {
    const stored = this.get<Review[]>("reviews", INITIAL_REVIEWS);
    const safeStored = Array.isArray(stored) ? stored : INITIAL_REVIEWS;
    const validStored = safeStored.filter(r => r && r.id);
    const uniqueMap = new Map<string, Review>();
    validStored.forEach(rev => {
      const key = (rev.id || "").toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, rev);
      }
    });
    const result = Array.from(uniqueMap.values());
    this.save("reviews", result);
    return result;
  }

  static saveReviews(data: Review[]): void {
    this.save("reviews", this.deduplicateById(data));
  }

  static getItineraries(): Itinerary[] {
    const stored = this.get<Itinerary[]>("itineraries", INITIAL_ITINERARIES);
    const safeStored = Array.isArray(stored) ? stored : INITIAL_ITINERARIES;
    const validStored = safeStored.filter(i => i && i.title);
    const uniqueMap = new Map<string, Itinerary>();
    validStored.forEach((iti, idx) => {
      let rawId = iti.id || "";
      const isTimestampId = rawId.startsWith("iti_") || rawId.length > 20 || rawId.includes("/") || rawId.startsWith("http");
      
      let slug = "";
      if (iti.title) {
        slug = iti.title
          .toLowerCase()
          .trim()
          .replace(/['"]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }

      let safeId = (!rawId || isTimestampId || !slug) ? (slug ? `itinerari-${slug}` : `itinerari-${idx}`) : rawId.replace(/[^a-zA-Z0-9_-]/g, "-");

      const cleaned: Itinerary = { ...iti, id: safeId };
      const key = safeId.toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, cleaned);
      } else {
        const existing = uniqueMap.get(key)!;
        uniqueMap.set(key, { ...existing, ...cleaned });
      }
    });
    const result = Array.from(uniqueMap.values());
    this.save("itineraries", result);
    return result;
  }

  static saveItineraries(data: Itinerary[]): void {
    this.save("itineraries", this.deduplicateById(data));
  }

  static getLogs(): ModerationLog[] {
    const stored = this.get<ModerationLog[]>("logs", INITIAL_LOGS);
    const safeStored = Array.isArray(stored) ? stored : INITIAL_LOGS;
    const validStored = safeStored.filter(l => l && l.id);
    const uniqueMap = new Map<string, ModerationLog>();
    validStored.forEach(log => {
      const key = (log.id || "").toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, log);
      }
    });
    const result = Array.from(uniqueMap.values());
    this.save("logs", result);
    return result;
  }

  static saveLogs(data: ModerationLog[]): void {
    this.save("logs", this.deduplicateById(data));
  }

  static getTourPackages(): TourPackage[] {
    const stored = this.get<TourPackage[]>("tour_packages", INITIAL_TOUR_PACKAGES);
    const safeStored = Array.isArray(stored) ? stored : INITIAL_TOUR_PACKAGES;
    const validStored = safeStored.filter(p => p && p.id);
    const uniqueMap = new Map<string, TourPackage>();
    validStored.forEach(pkg => {
      const key = (pkg.id || "").toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, pkg);
      }
    });
    const result = Array.from(uniqueMap.values());
    this.save("tour_packages", result);
    return result;
  }

  static saveTourPackages(data: TourPackage[]): void {
    this.save("tour_packages", this.deduplicateById(data));
  }

  static getNotifications(): AdminNotification[] {
    const stored = this.get<AdminNotification[]>("notifications", INITIAL_NOTIFICATIONS);
    const safeStored = Array.isArray(stored) ? stored : INITIAL_NOTIFICATIONS;
    const validStored = safeStored.filter(n => n && n.id);
    const uniqueMap = new Map<string, AdminNotification>();
    validStored.forEach(notif => {
      const key = (notif.id || "").toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          ...notif,
          readBy: Array.isArray(notif.readBy) ? notif.readBy : []
        });
      }
    });
    const result = Array.from(uniqueMap.values());
    this.save("notifications", result);
    return result;
  }

  static saveNotifications(data: AdminNotification[]): void {
    if (!Array.isArray(data)) return;
    const sanitized = data.map(n => ({
      ...n,
      readBy: Array.isArray(n?.readBy) ? n.readBy : []
    }));
    this.save("notifications", this.deduplicateById(sanitized));
  }

  static addNotification(notif: AdminNotification): void {
    const notifs = this.getNotifications();
    const newNotif = {
      ...notif,
      readBy: Array.isArray(notif.readBy) ? notif.readBy : []
    };
    this.saveNotifications([newNotif, ...notifs]);
    window.dispatchEvent(new CustomEvent("sipp_notif_updated"));
  }

  static markNotificationRead(notifId: string, userId: string): void {
    const notifs = this.getNotifications();
    const updated = notifs.map(n => {
      const readByArr = Array.isArray(n.readBy) ? n.readBy : [];
      if (n.id === notifId && !readByArr.includes(userId)) {
        return { ...n, readBy: [...readByArr, userId] };
      }
      return n;
    });
    this.saveNotifications(updated);
    window.dispatchEvent(new CustomEvent("sipp_notif_updated"));
  }

  static markAllNotificationsRead(userId: string): void {
    const notifs = this.getNotifications();
    const updated = notifs.map(n => {
      const readByArr = Array.isArray(n.readBy) ? n.readBy : [];
      if (!readByArr.includes(userId)) {
        return { ...n, readBy: [...readByArr, userId] };
      }
      return n;
    });
    this.saveNotifications(updated);
    window.dispatchEvent(new CustomEvent("sipp_notif_updated"));
  }

  static deleteNotification(notifId: string): void {
    const notifs = this.getNotifications();
    const updated = notifs.filter(n => n.id !== notifId);
    this.saveNotifications(updated);
    window.dispatchEvent(new CustomEvent("sipp_notif_updated"));
  }

  static getUsers(): User[] {
    const stored = this.get<User[]>("users", MOCK_USERS);
    const result = this.cleanAndDeduplicateUsers(stored);
    this.save("users", result);
    return result;
  }

  static saveUsers(data: User[]): User[] {
    const sanitized = this.cleanAndDeduplicateUsers(data);
    this.save("users", sanitized);
    return sanitized;
  }

  static getCurrentUser(): User {
    const user = this.get<User>("current_user", EMPTY_GUEST_USER);
    if (user) {
      if (user.id === "usr_1" || user.id === "usr_2" || user.id === "usr_admin_gen") {
        return EMPTY_GUEST_USER;
      }
      if (user.id === "guest_empty" || user.name === "Tamu (Belum Login)") {
        user.role = "user";
        return user;
      }
      return enforceDefaultAccount(user);
    }
    return EMPTY_GUEST_USER;
  }

  static saveCurrentUser(user: User): void {
    if (user && (user.id === "guest_empty" || user.name === "Tamu (Belum Login)")) {
      user.role = "user";
    } else if (user) {
      user = enforceDefaultAccount(user);
    }
    this.save("current_user", user);
  }
}
