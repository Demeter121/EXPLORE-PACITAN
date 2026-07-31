import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Share2, Eye, EyeOff, Save, MapPin, Calendar, Clock, Edit3, Clipboard, CheckCircle2, Compass, Car, ArrowRight, Route, Navigation, X, ExternalLink, Globe } from "lucide-react";
import { Itinerary, ItineraryDay, ItineraryItem, Location, User } from "../types";
import ItineraryMap from "./ItineraryMap";

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

interface ItineraryBuilderProps {
  locations: Location[];
  itineraries: Itinerary[];
  currentUser: User;
  onSaveItinerary: (itinerary: Itinerary) => void;
  onDeleteItinerary: (id: string) => void;
}

export default function ItineraryBuilder({
  locations,
  itineraries,
  currentUser,
  onSaveItinerary,
  onDeleteItinerary
}: ItineraryBuilderProps) {
  // Only display itineraries created by current user
  const userItineraries = itineraries.filter((i) => i.createdBy === currentUser.id);

  const [activeItinerary, setActiveItinerary] = useState<Itinerary | null>(
    userItineraries.length > 0 ? userItineraries[0] : null
  );

  const [isEditing, setIsEditing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeDayTab, setActiveDayTab] = useState(1);

  // Share Modal State
  const [shareModalItinerary, setShareModalItinerary] = useState<Itinerary | null>(null);
  const [modalCopied, setModalCopied] = useState(false);

  const getShareUrl = (itiId: string) => {
    return `${window.location.origin}${window.location.pathname}#/shared/itinerary/${itiId}`;
  };

  const handleCopyModalUrl = () => {
    if (!shareModalItinerary) return;
    const url = getShareUrl(shareModalItinerary.id);
    navigator.clipboard.writeText(url).then(() => {
      setModalCopied(true);
      window.dispatchEvent(new CustomEvent("show-toast", { detail: { message: "Link berbagi itinerari berhasil disalin!", type: "success" } }));
      setTimeout(() => setModalCopied(false), 3000);
    });
  };

  const handleToggleModalPublic = () => {
    if (!shareModalItinerary) return;
    const updated = {
      ...shareModalItinerary,
      isPublic: !shareModalItinerary.isPublic,
      updatedAt: new Date().toISOString()
    };
    setShareModalItinerary(updated);
    onSaveItinerary(updated);
    if (activeItinerary?.id === updated.id) {
      setActiveItinerary(updated);
    }
    window.dispatchEvent(new CustomEvent("show-toast", {
      detail: {
        message: updated.isPublic ? "Akses publik diaktifkan! Siapa saja dengan link dapat membuka itinerari ini." : "Akses publik dinonaktifkan.",
        type: "info"
      }
    }));
  };

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  // Sorting anchor per day
  const [sortingAnchor, setSortingAnchor] = useState<Record<number, string>>({});

  // Active sorting order per day
  const [activeSortOrder, setActiveSortOrder] = useState<Record<number, "closest" | "farthest" | null>>({});

  // Category filter state for individual itinerary item selector rows
  const [rowCategoryFilter, setRowCategoryFilter] = useState<Record<string, string>>({});

  const handleSortDayItems = async (dayIndex: number, order: "closest" | "farthest") => {
    const day = days[dayIndex];
    if (day.items.length < 2) {
      alert("Masukkan minimal 2 destinasi kunjungan terlebih dahulu untuk diurutkan!");
      return;
    }

    // Set the active sort order for this day
    setActiveSortOrder(prev => ({ ...prev, [day.dayNumber]: order }));

    const anchorType = sortingAnchor[day.dayNumber] || "center";
    let refCoords = { lat: -8.2045, lng: 111.0921 }; // Alun-Alun Pacitan
    let firstItem = day.items[0];

    if (anchorType === "gps") {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4500 });
        });
        refCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (error) {
        alert("Akses GPS gagal atau tidak diizinkan. Menggunakan Alun-Alun Pacitan sebagai acuan.");
      }
    } else if (anchorType === "first" && firstItem) {
      const firstLoc = locations.find(l => l.id === firstItem.locationId);
      if (firstLoc) {
        refCoords = firstLoc.coordinates;
      }
    }

    const updatedDays = [...days];
    let itemsToSort = [...updatedDays[dayIndex].items];

    if (anchorType === "first" && itemsToSort.length > 1) {
      // Keep first item at index 0, sort the rest relative to first item's coords
      const restItems = itemsToSort.slice(1);
      restItems.sort((a, b) => {
        const locA = locations.find(l => l.id === a.locationId);
        const locB = locations.find(l => l.id === b.locationId);
        if (!locA || !locB) return 0;
        const distA = calculateDistance(refCoords.lat, refCoords.lng, locA.coordinates.lat, locA.coordinates.lng);
        const distB = calculateDistance(refCoords.lat, refCoords.lng, locB.coordinates.lat, locB.coordinates.lng);
        return order === "closest" ? distA - distB : distB - distA;
      });
      updatedDays[dayIndex].items = [firstItem, ...restItems];
    } else {
      // Sort all items relative to refCoords
      itemsToSort.sort((a, b) => {
        const locA = locations.find(l => l.id === a.locationId);
        const locB = locations.find(l => l.id === b.locationId);
        if (!locA || !locB) return 0;
        const distA = calculateDistance(refCoords.lat, refCoords.lng, locA.coordinates.lat, locA.coordinates.lng);
        const distB = calculateDistance(refCoords.lat, refCoords.lng, locB.coordinates.lat, locB.coordinates.lng);
        return order === "closest" ? distA - distB : distB - distA;
      });
      updatedDays[dayIndex].items = itemsToSort;
    }

    setDays(updatedDays);
  };

  // Open itinerary for edit/view
  const handleSelectItinerary = (iti: Itinerary) => {
    setActiveItinerary(iti);
    setActiveDayTab(1);
    setIsEditing(false);
  };

  // Turn edit mode on
  const handleStartEdit = (iti: Itinerary) => {
    setActiveItinerary(iti);
    setTitle(iti.title);
    setDescription(iti.description);
    // Deep clone days
    setDays(JSON.parse(JSON.stringify(iti.days)));
    setIsPublic(iti.isPublic);
    setActiveDayTab(1);
    setIsEditing(true);
  };

  // Start new itinerary draft
  const handleCreateNew = () => {
    if (currentUser.id === "guest_empty" || currentUser.name === "Tamu (Belum Login)") {
      alert("Akun Tamu tidak diperkenankan membuat rencana perjalanan baru. Silakan login terlebih dahulu!");
      return;
    }
    const newItinerary: Itinerary = {
      id: "iti_" + Date.now(),
      title: "Trip Pantai Pacitan Saya",
      description: "Rencana liburan seru ke pantai pesisir Pacitan.",
      days: [
        {
          dayNumber: 1,
          items: []
        }
      ],
      isPublic: true,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setActiveItinerary(newItinerary);
    setTitle(newItinerary.title);
    setDescription(newItinerary.description);
    setDays(newItinerary.days);
    setIsPublic(newItinerary.isPublic);
    setActiveDayTab(1);
    setIsEditing(true);
  };

  // Core Form Handlers
  const handleAddDay = () => {
    const nextDayNum = days.length + 1;
    setDays([...days, { dayNumber: nextDayNum, items: [] }]);
  };

  const handleRemoveDay = (dayIndex: number) => {
    if (days.length <= 1) return; // Must have at least 1 day
    const updated = days
      .filter((_, idx) => idx !== dayIndex)
      .map((day, newIdx) => ({
        ...day,
        dayNumber: newIdx + 1
      }));
    setDays(updated);
  };

  const handleAddItem = (dayIndex: number) => {
    const defaultLocationId = locations.length > 0 ? locations[0].id : "";
    const updated = [...days];
    updated[dayIndex].items.push({
      locationId: defaultLocationId,
      timeSlot: "08:00 - 10:00 WIB",
      note: "Catatan kunjungan tempat"
    });
    setDays(updated);
  };

  const handleRemoveItem = (dayIndex: number, itemIndex: number) => {
    const updated = [...days];
    updated[dayIndex].items.splice(itemIndex, 1);
    setDays(updated);
  };

  const handleUpdateItem = (
    dayIndex: number,
    itemIndex: number,
    field: keyof ItineraryItem,
    value: string
  ) => {
    const updated = [...days];
    updated[dayIndex].items[itemIndex] = {
      ...updated[dayIndex].items[itemIndex],
      [field]: value
    };
    setDays(updated);
  };

  // Reordering inside Day
  const handleMoveItemDetail = (dayIndex: number, itemIndex: number, direction: "up" | "down") => {
    const updated = [...days];
    const items = [...updated[dayIndex].items];
    if (direction === "up") {
      if (itemIndex === 0) return;
      const temp = items[itemIndex];
      items[itemIndex] = items[itemIndex - 1];
      items[itemIndex - 1] = temp;
    } else {
      if (itemIndex === items.length - 1) return;
      const temp = items[itemIndex];
      items[itemIndex] = items[itemIndex + 1];
      items[itemIndex + 1] = temp;
    }
    updated[dayIndex].items = items;
    setDays(updated);
  };

  // Saving function
  const handleSaveDraft = () => {
    if (currentUser.id === "guest_empty" || currentUser.name === "Tamu (Belum Login)") {
      alert("Akun Tamu tidak diperkenankan menyimpan rencana perjalanan. Silakan login terlebih dahulu!");
      return;
    }
    if (!title.trim()) {
      alert("Judul itinerari tidak boleh kosong!");
      return;
    }

    const saved: Itinerary = {
      id: activeItinerary?.id || "iti_" + Date.now(),
      title,
      description,
      days,
      isPublic,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: activeItinerary?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveItinerary(saved);
    setActiveItinerary(saved);
    setIsEditing(false);
  };

  // Generate shareable URL
  const handleCopyLink = (itiId: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/shared/itinerary/${itiId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedId(itiId);
      setTimeout(() => setCopiedId(null), 3000);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {(currentUser.id === "guest_empty" || currentUser.name === "Tamu (Belum Login)") && (
        <div className="lg:col-span-12 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200">
          <span className="text-base">🔒</span>
          <div>
            <strong>Mode Tamu (Belum Login):</strong> Penyimpanan dan pembuatan rencana perjalanan baru dinonaktifkan untuk Akun Tamu. Silakan masuk atau mendaftar akun untuk menyimpan itinerari perjalanan Anda.
          </div>
        </div>
      )}
      {/* LEFT: Saved Itinerary Listings (4 Cols) */}
      <div className="lg:col-span-4 bg-white rounded-xl shadow-md border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
            ✈️ Rencana Perjalanan
          </h3>
          <button
            onClick={handleCreateNew}
            disabled={isEditing}
            className="bg-pacitan-primary text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-teal-800 transition shadow disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} /> Buat Baru
          </button>
        </div>

        {userItineraries.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-lg">
            <Calendar className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm text-slate-500 font-medium font-sans">Belum ada itinerari buatanmu</p>
            <p className="text-xs text-slate-400 mt-1">Tekan tombol 'Buat Baru' untuk merencanakan liburanmu di Pacitan.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {userItineraries.map((iti) => {
              const isSelected = activeItinerary?.id === iti.id;
              const totalLocations = iti.days.reduce((total, day) => total + day.items.length, 0);

              return (
                <div
                  key={iti.id}
                  onClick={() => !isEditing && handleSelectItinerary(iti)}
                  className={`p-4 rounded-xl border transition-all ${
                    isEditing ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:shadow-md"
                  } ${
                    isSelected
                      ? "border-teal-500 bg-teal-50/40 shadow-sm"
                      : "border-slate-200/80 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-slate-800 text-sm truncate flex-1">{iti.title}</h4>
                    {iti.isPublic ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-0.5">
                        <Eye size={10} /> Publik
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-mono flex items-center gap-0.5">
                        <EyeOff size={10} /> Privat
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mb-3">{iti.description}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                      📅 {iti.days.length} hari
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                        📍 {totalLocations} objek
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareModalItinerary(iti);
                        }}
                        className="p-1 rounded-md text-teal-600 hover:bg-teal-50 hover:text-teal-800 transition cursor-pointer"
                        title="Bagikan Tautan Itinerari"
                      >
                        <Share2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT: Detailed Active Planner Editor / Preview (8 Cols) */}
      <div className="lg:col-span-8 bg-white rounded-xl shadow-md border border-slate-100 p-5">
        {activeItinerary === null ? (
          <div className="text-center py-20 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <Compass size={48} className="mx-auto text-slate-400 mb-3 animate-pulse" />
            <h4 className="font-display font-bold text-slate-700 text-lg">Pilih Rencana Trip</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Silakan pilih itinerari simpanan Anda di panel kiri, atau buat draf baru untuk langsung dieksekusi.
            </p>
          </div>
        ) : isEditing ? (
          /* ================== EDIT FORM MODE ================== */
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                ✍️ {activeItinerary.createdAt === activeItinerary.updatedAt ? "Buat Itinerari Baru" : "Edit Itinerari"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-emerald-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <Save size={14} /> Simpan Trip
                </button>
              </div>
            </div>

            {/* Title & description inputs */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Judul Rencana Perjalanan Wisata
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Misal: Weekend Getaway Pacitan 3D2N"
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Deskripsi / Rangkuman Singkat
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan tujuan liburan ini, misal: Liburan santai bersama keluarga dan rombongan kantor."
                  rows={2}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  {isPublic ? <Eye className="text-emerald-600" size={18} /> : <EyeOff className="text-slate-500" size={18} />}
                  <div>
                    <span className="font-semibold block">Aksesibilitas Link</span>
                    <span className="text-xs text-slate-400 block -mt-1">Ketika diatur sebagai Publik, link dapat dibagikan kepada rekan Anda.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 accent-pacitan-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Day builder */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                <span className="font-bold text-sm text-slate-700">📅 Struktur Hari & Obyek Wisatanya</span>
                <button
                  onClick={handleAddDay}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer transition"
                >
                  + Tambah Hari
                </button>
              </div>

              {days.map((day, dIdx) => (
                <div key={day.dayNumber} className="border border-slate-200 rounded-xl bg-slate-50/30 p-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 mb-4">
                    <span className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      📅 Hari Ke-{day.dayNumber}
                    </span>
                    {days.length > 1 && (
                      <button
                        onClick={() => handleRemoveDay(dIdx)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Hapus Hari
                      </button>
                    )}
                  </div>

                  {/* Automated Sorting Panel */}
                  {day.items.length >= 2 && (
                    <div className="bg-teal-50/60 dark:bg-slate-900/60 border border-teal-150/50 dark:border-slate-800 rounded-xl p-3 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-teal-800 dark:text-teal-400 flex items-center gap-1">
                          ⚡ Urutan Otomatis:
                        </span>
                        <select
                          value={sortingAnchor[day.dayNumber] || "center"}
                          onChange={(e) => setSortingAnchor(prev => ({ ...prev, [day.dayNumber]: e.target.value }))}
                          className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer font-semibold shadow-xs"
                        >
                          <option value="center">Pusat Kota (Alun-Alun)</option>
                          <option value="gps">GPS Lokasi Saya</option>
                          <option value="first">Destinasi Pertama Saat Ini</option>
                        </select>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleSortDayItems(dIdx, "closest")}
                          className={`flex-1 sm:flex-initial font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                            activeSortOrder[day.dayNumber] === "closest"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-400 ring-2 ring-emerald-500/30 scale-[1.03]"
                              : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 opacity-75 hover:opacity-100"
                          }`}
                          title="Urutkan rute dari terdekat hingga terjauh"
                        >
                          {activeSortOrder[day.dayNumber] === "closest" ? (
                            <CheckCircle2 size={13} className="text-emerald-300 animate-pulse" />
                          ) : (
                            <ArrowDown size={12} />
                          )}
                          <span>Terdekat → Terjauh</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSortDayItems(dIdx, "farthest")}
                          className={`flex-1 sm:flex-initial font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                            activeSortOrder[day.dayNumber] === "farthest"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-400 ring-2 ring-emerald-500/30 scale-[1.03]"
                              : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 opacity-75 hover:opacity-100"
                          }`}
                          title="Urutkan rute dari terjauh hingga terdekat"
                        >
                          {activeSortOrder[day.dayNumber] === "farthest" ? (
                            <CheckCircle2 size={13} className="text-emerald-300 animate-pulse" />
                          ) : (
                            <ArrowUp size={12} />
                          )}
                          <span>Terjauh → Terdekat</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Location items list inside single day */}
                  <div className="space-y-3 mb-3">
                    {day.items.map((item, iIdx) => {
                      const selectedLoc = locations.find((l) => l.id === item.locationId);

                      return (
                        <div
                          key={iIdx}
                          className="bg-white border border-slate-200/90 rounded-lg p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center shadow-sm"
                        >
                          {/* Part 1: Place dropdown selection (4 cols) with Category Filter */}
                          <div className="md:col-span-4">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] text-slate-400 uppercase font-bold">Destinasi</label>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Filter:</span>
                                <select
                                  value={rowCategoryFilter[`${dIdx}_${iIdx}`] || "semua"}
                                  onChange={(e) => {
                                    const cat = e.target.value;
                                    setRowCategoryFilter(prev => ({
                                      ...prev,
                                      [`${dIdx}_${iIdx}`]: cat
                                    }));
                                  }}
                                  className="text-[11px] px-2.5 py-1 border border-slate-300 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold focus:outline-none cursor-pointer focus:ring-1 focus:ring-teal-500 transition-colors"
                                >
                                  <option value="semua">Semua</option>
                                  <option value="wisata">Wisata</option>
                                  <option value="penginapan">Penginapan</option>
                                  <option value="makan">Kuliner</option>
                                  <option value="coffeeshop">Kafe</option>
                                  <option value="belanja">Belanja</option>
                                  <option value="lainnya">Lainnya</option>
                                </select>
                              </div>
                            </div>

                            {(() => {
                              const activeFilter = rowCategoryFilter[`${dIdx}_${iIdx}`] || "semua";
                              const filteredLocs = locations.filter(loc => {
                                // Always include the currently selected location so it is visible and not reset
                                if (loc.id === item.locationId) return true;
                                if (activeFilter === "semua") return true;
                                return loc.category === activeFilter;
                              });

                              return (
                                <select
                                  value={item.locationId}
                                  onChange={(e) => handleUpdateItem(dIdx, iIdx, "locationId", e.target.value)}
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                                >
                                  {filteredLocs.length === 0 ? (
                                    <option value="" disabled>Tidak ada lokasi tersedia</option>
                                  ) : (
                                    filteredLocs.map((loc) => (
                                      <option key={loc.id} value={loc.id}>
                                        [{loc.category.toUpperCase()}] {loc.name}
                                      </option>
                                    ))
                                  )}
                                </select>
                              );
                            })()}
                          </div>

                          {/* Part 2: Time Slot inputs (3 cols) */}
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Estimasi Waktu</label>
                            <input
                              type="text"
                              value={item.timeSlot}
                              onChange={(e) => handleUpdateItem(dIdx, iIdx, "timeSlot", e.target.value)}
                              placeholder="Misal: Pagi / 08:00 - 10:00"
                              className="w-full text-xs px-2 py-1 border border-slate-200 rounded font-medium text-slate-700"
                            />
                          </div>

                          {/* Part 3: Note inputs (3 cols) */}
                          <div className="md:col-span-3">
                            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Catatan Khusus</label>
                            <input
                              type="text"
                              value={item.note}
                              onChange={(e) => handleUpdateItem(dIdx, iIdx, "note", e.target.value)}
                              placeholder="Keterangan singkat..."
                              className="w-full text-xs px-2 py-1 border border-slate-200 rounded text-slate-600"
                            />
                          </div>

                          {/* Part 4: Sorting & Actions (2 cols) */}
                          <div className="md:col-span-2 flex items-center justify-end gap-1 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                            <button
                              onClick={() => handleMoveItemDetail(dIdx, iIdx, "up")}
                              disabled={iIdx === 0}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Pindahkan Keatas"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => handleMoveItemDetail(dIdx, iIdx, "down")}
                              disabled={iIdx === day.items.length - 1}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Pindahkan Kebawah"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => handleRemoveItem(dIdx, iIdx)}
                              className="p-1 hover:bg-red-50 text-red-400 hover:text-red-700 rounded cursor-pointer"
                              title="Hapus Destinasi"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleAddItem(dIdx)}
                    className="w-full py-1.5 border border-dashed border-slate-350 hover:bg-white text-teal-700 text-xs font-bold rounded-lg transition text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    + Tambah Destinasi Kunjungan
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveDraft}
                className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Save size={14} /> Simpan Trip Ini
              </button>
            </div>
          </div>
        ) : (
          /* ================== DISPLAY PREVIEW MODE ================== */
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display font-bold text-slate-800 text-xl">{activeItinerary.title}</h3>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-semibold">
                    🆔 {activeItinerary.id}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{activeItinerary.description}</p>
                <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <span>Dibuat oleh: 👤 <b>{activeItinerary.createdByName}</b></span>
                  <span>•</span>
                  <span>Diperbarui: {new Date(activeItinerary.updatedAt).toLocaleDateString("id-ID")}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleStartEdit(activeItinerary)}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <Edit3 size={14} /> Edit Trip
                </button>

                <button
                  onClick={() => onDeleteItinerary(activeItinerary.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/30 dark:border-red-900/50 dark:text-red-400 px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Trash2 size={13} /> Hapus
                </button>

                <button
                  onClick={() => setShareModalItinerary(activeItinerary)}
                  className="bg-pacitan-primary text-white hover:bg-teal-800 px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm ml-1"
                >
                  <Share2 size={14} /> Bagikan Link
                </button>
              </div>
            </div>

            {/* Days Tab Selector */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-150 dark:border-slate-800 pb-3 mb-5">
              {activeItinerary.days.map((day) => (
                <button
                  key={day.dayNumber}
                  onClick={() => setActiveDayTab(day.dayNumber)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDayTab === day.dayNumber
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Calendar size={12} />
                  <span>Hari Ke-{day.dayNumber}</span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                    {day.items.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Two-Column Day Detail: Timeline list + Route Map */}
            {(() => {
              const activeDayObj = activeItinerary.days.find((d) => d.dayNumber === activeDayTab) || activeItinerary.days[0];

              return (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  {/* Left Column: Timeline Stops */}
                  <div className="xl:col-span-7 space-y-4">
                    {activeDayObj.items.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <MapPin size={32} className="mx-auto text-slate-400 mb-2" />
                        <p className="text-sm font-medium text-slate-500">Hari ini belum diisi destinasi</p>
                        <p className="text-xs text-slate-400 mt-1">Tekan tombol 'Edit Trip' untuk menambahkan destinasi liburan.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeDayObj.items.map((item, idx) => {
                          const loc = locations.find((l) => l.id === item.locationId);
                          if (!loc) return null;

                          // Calculate distance to next stop
                          const nextItem = activeDayObj.items[idx + 1];
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
                              {/* Destination Item Card */}
                              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-4 hover:shadow transition-all flex flex-col md:flex-row gap-4 items-start relative pl-10 sm:pl-12">
                                {/* Stop Number Badge */}
                                <div className="absolute left-2.5 sm:left-3 top-4 w-7 h-7 bg-teal-600 dark:bg-indigo-600 text-white rounded-full flex items-center justify-center font-display font-black text-xs shadow-md border-2 border-white select-none">
                                  {idx + 1}
                                </div>

                                <img
                                  src={loc.photos?.[0]}
                                  alt={loc.name}
                                  className="w-full md:w-32 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-bold uppercase py-0.5 px-2 bg-teal-150 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 rounded font-mono">
                                      {loc.category}
                                    </span>
                                    {item.timeSlot && (
                                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                                        <Clock size={11} /> {item.timeSlot}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{loc.name}</h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{loc.description}</p>
                                  <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                                    <MapPin size={10} /> {loc.address}
                                  </div>

                                  {item.note && (
                                    <div className="mt-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 inline-block font-mono">
                                      📝 Catatan: {item.note}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Segment Drive Connection Info */}
                              {nextLoc && (
                                <div className="my-2.5 ml-6 pl-6 border-l-2 border-dashed border-teal-500/40 relative py-1.5">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-1.5 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-xs">
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
                                      className="text-teal-600 dark:text-teal-400 hover:underline font-bold text-[10px] flex items-center gap-0.5 sm:ml-auto border border-teal-100 dark:border-slate-800 px-2 py-0.5 rounded bg-white dark:bg-slate-900 shadow-sm cursor-pointer"
                                    >
                                      Arah Jalan <ArrowRight size={10} />
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

                  {/* Right Column: Dynamic Direction Map */}
                  <div className="xl:col-span-5 h-full">
                    <ItineraryMap
                      items={activeDayObj.items}
                      locations={locations}
                      activeDay={activeDayTab}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Share Modal Overlay */}
      {shareModalItinerary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 relative space-y-5">
            <button
              onClick={() => setShareModalItinerary(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-100 dark:border-teal-900/50">
                <Share2 size={24} />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg">Bagikan Rencana Perjalanan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{shareModalItinerary.title}</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                🔗 Tautan Berbagi Unik (Read-Only Direct Link)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getShareUrl(shareModalItinerary.id)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 flex-1 select-all outline-hidden focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={handleCopyModalUrl}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  {modalCopied ? <CheckCircle2 size={14} className="text-emerald-300 animate-bounce" /> : <Clipboard size={14} />}
                  {modalCopied ? "Tersalin!" : "Salin Link"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Siapa saja yang membuka tautan ini dapat langsung melihat detail itinerari dalam mode <b>baca-saja tanpa perlu login</b>.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2.5">
                {shareModalItinerary.isPublic ? (
                  <Globe size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <EyeOff size={20} className="text-amber-500 shrink-0" />
                )}
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Status Visibilitas Katalog</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {shareModalItinerary.isPublic
                      ? "Aktif publik (tampil di direktori umum & dapat dibuka via link)"
                      : "Unlisted/Privat (hanya dapat dibuka melalui tautan unik di atas)"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleToggleModalPublic}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  shareModalItinerary.isPublic
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                }`}
              >
                {shareModalItinerary.isPublic ? "Publik" : "Jadikan Publik"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Halo! Lihat rencana perjalanan wisata Pacitan "${shareModalItinerary.title}": ${getShareUrl(shareModalItinerary.id)}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Share2 size={13} /> Kirim WhatsApp
              </a>
              <a
                href={getShareUrl(shareModalItinerary.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <ExternalLink size={13} /> Buka Tautan
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
