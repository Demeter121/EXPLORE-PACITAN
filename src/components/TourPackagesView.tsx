import React, { useState, useRef } from "react";
import { Search, Compass, Plus, Phone, Clock, Check, Star, X, Trash2, Edit3, Tag, MessageSquare, Briefcase, Upload, Image } from "lucide-react";
import { TourPackage, User } from "../types";

interface TourPackagesViewProps {
  packages: TourPackage[];
  currentUser: User;
  onAddPackage: (newPkg: TourPackage) => void;
  onDeletePackage: (id: string) => void;
}

export default function TourPackagesView({
  packages,
  currentUser,
  onAddPackage,
  onDeletePackage
}: TourPackagesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Create Form Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<"adventure" | "family" | "couple" | "cultural">("family");
  const [description, setDescription] = useState("");
  const [destinationsInput, setDestinationsInput] = useState("");
  const [includesInput, setIncludesInput] = useState("");
  const [contactWhatsApp, setContactWhatsApp] = useState("");
  const [photo, setPhoto] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran file terlalu besar! Maksimal 2MB agar penyimpanan optimal.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        if (file.size > 2 * 1024 * 1024) {
          alert("Ukuran file terlalu besar! Maksimal 2MB agar penyimpanan optimal.");
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        alert("Harap pilih file gambar saja.");
      }
    }
  };

  const categories = [
    { value: "all", label: "Semua Kategori" },
    { value: "family", label: "Keluarga & Santai" },
    { value: "adventure", label: "Petualangan / Surf" },
    { value: "couple", label: "Honeymoon / Pasangan" },
    { value: "cultural", label: "Sejarah & Budaya" }
  ];

  // Filter packages
  const filteredPackages = packages.filter((pkg) => {
    const matchesSearch =
      pkg.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || pkg.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !provider.trim() || !price.trim()) {
      alert("Harap lengkapi judul, penyedia, dan harga paket!");
      return;
    }

    const destinations = destinationsInput
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    const includes = includesInput
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    // Format WhatsApp Link
    let formattedWA = contactWhatsApp.trim();
    if (formattedWA && !formattedWA.startsWith("http")) {
      // Remove leading +, non-digits
      const digits = formattedWA.replace(/\D/g, "");
      const finalPhone = digits.startsWith("0") ? "62" + digits.substring(1) : digits;
      formattedWA = `https://wa.me/${finalPhone}?text=Halo%20${encodeURIComponent(provider)},%20saya%20tertarik%20dengan%20paket%20wisata%2520${encodeURIComponent(title)}`;
    }

    const defaultPhoto = photo.trim() || "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800&auto=format&fit=crop";

    const newPackage: TourPackage = {
      id: "pkg_" + Date.now(),
      title,
      provider,
      duration: duration || "1 Hari",
      price,
      category,
      description,
      destinations: destinations.length > 0 ? destinations : ["Obyek Wisata Pacitan"],
      includes: includes.length > 0 ? includes : ["Tiket Masuk", "Pemandu"],
      contactWhatsApp: formattedWA || "https://wa.me/6281234567890",
      photo: defaultPhoto,
      rating: 5.0,
      reviewsCount: 1,
      createdBy: currentUser.id
    };

    onAddPackage(newPackage);
    
    // Reset Form
    setTitle("");
    setProvider("");
    setDuration("");
    setPrice("");
    setCategory("family");
    setDescription("");
    setDestinationsInput("");
    setIncludesInput("");
    setContactWhatsApp("");
    setPhoto("");
    setShowAddModal(false);
  };

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case "family": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "adventure": return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300";
      case "couple": return "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300";
      case "cultural": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      default: return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "family": return "Keluarga & Santai";
      case "adventure": return "Petualangan / Surf";
      case "couple": return "Honeymoon / Romantis";
      case "cultural": return "Sejarah & Budaya";
      default: return cat;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-800 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-teal-750">
        <div>
          <h2 className="text-2xl font-black font-display tracking-tight flex items-center gap-2">
            🎒 Layanan Paket Wisata Pacitan
          </h2>
          <p className="text-slate-300 text-xs mt-1 max-w-xl">
            Temukan berbagai pilihan paket liburan terencana dari penyedia agen perjalanan terpercaya di Pacitan. Liburan praktis, hemat, dan berkesan tanpa pusing menyusun rute sendiri.
          </p>
        </div>

        {/* Manager / Admin action */}
        {(currentUser.role === "admin" || currentUser.role === "pengelola") && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <Plus size={16} /> Tambah Layanan Paket
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800">
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama paket, penyedia, atau obyek..."
            className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
          />
        </div>
        <div className="md:col-span-7 flex flex-wrap gap-1.5 items-center justify-end">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat.value
                  ? "bg-teal-650 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Packages Grid */}
      {filteredPackages.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <Compass className="mx-auto text-slate-300 dark:text-slate-700 mb-2 animate-spin-slow" size={40} />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Paket Wisata Tidak Ditemukan</h4>
          <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau ganti kategori penyaringan Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition duration-200 overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Header Photo */}
                <div className="h-48 w-full relative bg-slate-100 dark:bg-slate-950">
                  <img
                    src={pkg.photo}
                    alt={pkg.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider shadow-sm ${getCategoryBadgeColor(pkg.category)}`}>
                      {getCategoryLabel(pkg.category)}
                    </span>
                  </div>
                  {(currentUser.role === "admin" || (currentUser.role === "pengelola" && pkg.id.startsWith("pkg_"))) && (
                    <button
                      onClick={() => onDeletePackage(pkg.id)}
                      className="absolute top-3 right-3 bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow transition"
                      title="Hapus Paket Wisata"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider font-mono">
                      👤 {pkg.provider}
                    </span>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base line-clamp-1 mt-0.5">
                      {pkg.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5">
                      {pkg.description}
                    </p>
                  </div>

                  {/* Details row */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200/40 dark:border-slate-800/60 text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-350">
                      <Clock className="text-teal-500 flex-shrink-0" size={14} />
                      <span className="truncate">{pkg.duration}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 text-right justify-end">
                      <span className="text-teal-650 dark:text-teal-450 font-bold">{pkg.price}</span>
                    </div>
                  </div>

                  {/* Covered Destination tags */}
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Destinasi Utama</span>
                    <div className="flex flex-wrap gap-1">
                      {pkg.destinations.map((dest, i) => (
                        <span
                          key={i}
                          className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200/30 dark:border-slate-750"
                        >
                          📍 {dest}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Included Services */}
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Fasilitas Termasuk</span>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-350">
                      {pkg.includes.map((inc, i) => (
                        <li key={i} className="flex items-center gap-1 truncate">
                          <Check className="text-emerald-500 flex-shrink-0" size={12} />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action footer */}
              <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star className="fill-amber-400 text-amber-400" size={14} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{pkg.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500">({pkg.reviewsCount} review)</span>
                </div>

                <a
                  href={pkg.contactWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition shadow-sm cursor-pointer"
                >
                  <Phone size={12} /> Pesan / Tanya Agen
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Package Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-teal-900">
              <h3 className="font-display font-black text-sm tracking-wide uppercase text-teal-400 flex items-center gap-1.5">
                💼 Tambah Layanan Paket Wisata Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nama Paket Wisata</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Misal: Paket Surfing Watukarung"
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nama Agen / Penyedia Layanan</label>
                  <input
                    type="text"
                    required
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="Misal: Pacitan Trip Co"
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Durasi</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Misal: 2 Hari 1 Malam"
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Harga Paket</label>
                  <input
                    type="text"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Misal: Rp 450.000 / Orang"
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Kategori Paket</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="family">Keluarga & Santai</option>
                    <option value="adventure">Petualangan / Surf</option>
                    <option value="couple">Honeymoon / Romantis</option>
                    <option value="cultural">Sejarah & Budaya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Deskripsi Ringkas</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan gambaran umum keseruan paket pariwisata ini..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Daftar Destinasi Utama (Pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={destinationsInput}
                  onChange={(e) => setDestinationsInput(e.target.value)}
                  placeholder="Misal: Pantai Klayar, Goa Gong, Pantai Kasap"
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fasilitas Termasuk (Pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={includesInput}
                  onChange={(e) => setIncludesInput(e.target.value)}
                  placeholder="Misal: Tiket Masuk, Transport AC PP, Makan Siang"
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nomor Kontak WhatsApp / Link</label>
                  <input
                    type="text"
                    value={contactWhatsApp}
                    onChange={(e) => setContactWhatsApp(e.target.value)}
                    placeholder="Misal: 081234567890"
                    className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Foto Sampul (File Lokal atau URL)</label>
                  <div className="space-y-2">
                    {photo ? (
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 h-24 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                        <img src={photo} alt="Sampul" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhoto("")}
                          className="absolute top-1.5 right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow transition-all cursor-pointer"
                          title="Hapus foto"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all duration-150 ${
                          isDragging
                            ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/20"
                            : "border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-950/40"
                        }`}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <Upload className="mx-auto text-slate-400 mb-1" size={16} />
                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          Pilih / Tarik Foto Lokal
                        </p>
                        <p className="text-[9px] text-slate-400">
                          Format gambar (Maks. 2MB)
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <input
                        type="text"
                        value={photo.startsWith("data:") ? "" : photo}
                        onChange={(e) => setPhoto(e.target.value)}
                        placeholder="Atau masukkan URL foto: https://..."
                        className="w-full text-[11px] px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 dark:bg-slate-950 font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Tambahkan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
