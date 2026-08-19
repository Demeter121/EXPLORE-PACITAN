import { Search } from "lucide-react";
import { useState } from "react";

// Predefined beautiful Pacitan sights for the Gallery
const GALLERY_ITEMS = [
  {
    id: 1,
    title: "Semburan Pantai Klayar",
    category: "Pantai",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800",
    description: "Seruling samudera yang mengeluarkan semburan air setinggi beberapa meter di celah karang Pantai Klayar."
  },
  {
    id: 2,
    title: "Surfing di Watukarung",
    category: "Olahraga",
    image: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=800",
    description: "Gulungan ombak barrel bertaraf internasional yang menantang peselancar dunia di Watukarung."
  },
  {
    id: 3,
    title: "Gugusan Karang Kasap",
    category: "Pemandangan",
    image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=800",
    description: "Bukit-bukit karang hijau mengapung laksana kepulauan Raja Ampat di atas samudera selatan."
  },
  {
    id: 4,
    title: "Pesona Stalaktit Goa Gong",
    category: "Goa",
    image: "https://images.unsplash.com/photo-1507163212151-0a404f6b3bae?q=80&w=800",
    description: "Keindahan stalaktit bercahaya di dalam Goa Gong yang dinobatkan goa tercantik di Asia Tenggara."
  },
  {
    id: 5,
    title: "Pantai Buyutan dari Atas Tebing",
    category: "Pantai",
    image: "https://images.unsplash.com/photo-1473116763269-255ea7604bb6?q=80&w=800",
    description: "Hamparan pasir putih bersih membentang luas di bawah perlindungan tebing batu karang terjal."
  },
  {
    id: 6,
    title: "Geliat Kopi Kota Pacitan",
    category: "Kuliner",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800",
    description: "Suasana kedai kopi modern berpadu ramah-tamah khas warga Pacitan di pusat kota."
  }
];

export function GalleryView() {
  const [filter, setFilter] = useState("Semua");
  const categories = ["Semua", "Pantai", "Goa", "Pemandangan", "Olahraga", "Kuliner"];

  const filteredItems = filter === "Semua" 
    ? GALLERY_ITEMS 
    : GALLERY_ITEMS.filter(item => item.category === filter);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <span className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-mono font-bold">Lensa Wisata</span>
        <h2 className="font-display font-black text-slate-800 dark:text-slate-100 text-3xl mt-1">Galeri Pariwisata Pacitan</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
          Gugusan pantai pasir putih eksotis, kemegahan goa purbakala, dan dinamika budaya lokal yang terangkum dalam bingkai keindahan visual.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === cat
                ? "bg-pacitan-primary text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div key={item.id} className="group bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div className="relative overflow-hidden aspect-video">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-550 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <span className="absolute top-3 left-3 bg-slate-900/80 text-white font-mono text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                {item.category}
              </span>
            </div>
            <div className="p-4">
              <h4 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{item.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutView() {
  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="bg-slate-950 text-white rounded-3xl overflow-hidden relative shadow-xl">
        <div className="absolute inset-0 bg-cover bg-center opacity-30 z-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200')]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent z-10" />
        
        <div className="relative z-20 px-6 py-12 sm:p-16 max-w-3xl">
          <span className="text-teal-400 font-mono text-xs uppercase tracking-wider font-bold">Gerbang Wisata Pacitan</span>
          <h2 className="font-display font-black text-white text-3xl sm:text-5xl mt-2 leading-tight">
            Pacitan: Bumi "Kota 1001 Goa" & Ombak Dunia
          </h2>
          <p className="text-slate-200 dark:text-slate-300 text-sm sm:text-base mt-4 leading-relaxed font-sans font-light">
            Explore Pacitan (explorepacitan.com) hadir untuk mendigitalkan surga petualangan yang tersembunyi di pesisir barat daya Jawa Timur. Kabupaten yang dikepung jajaran pegunungan kapur Kidul dan berbatasan langsung dengan bebas lepasnya Samudera Hindia.
          </p>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
          <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-xl border-l-4 border-teal-600 pl-3 mb-4">
            Keajaiban Alam Pacitan
          </h3>
          <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed mb-4">
            Kabupaten Pacitan dikaruniai rentang bentang alam yang memukau mata dunia. Mulai dari puluhan pantai pasir putih dengan formasi bebatuan karst unik layaknya Pantai Klayar dan Kasap, hingga gua bawah tanah yang terbentuk selama jutaan tahun melahirkan ornamen batuan purba stalaktit dan stalagmit terindah di Asia Tenggara seperti Goa Gong.
          </p>
          <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
            Tidak hanya itu, bentukan topografinya juga melahirkan teluk-teluk eksotis berkarang gagah yang mampu memecah pergerakan air laut lepas menjadi gulungan ombak barrel terbaik di dunia, menjadikannya kiblat utama bagi para peselancar mancanegara.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
          <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-xl border-l-4 border-amber-500 pl-3 mb-4">
            Visi Explore Pacitan (explorepacitan.com)
          </h3>
          <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed mb-4 font-sans">
            Meningkatkan pemaparan digital segenap potensi pariwisata Pacitan secara kredibel dan tepercaya. Lewat keterpaduan peta interaktif, kami bermaksud mempermudah para penjelajah tanah air maupun mancanegara merumuskan rute perjalanan (itinerari) secara cerdas dan efisien.
          </p>
          
          <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-xl p-4 text-xs text-teal-950 dark:text-teal-200">
            <span className="font-bold flex items-center gap-1.5 text-teal-900 dark:text-teal-300 mb-1.5 text-xs">
              ⚠️ Tata Kelola Data Tepercaya
            </span>
            <span className="text-teal-900 dark:text-teal-200/90 leading-relaxed block">
              Setiap penambahan atau pembaharuan lokasi yang diusulkan oleh wisatawan umum maupun pengelola usaha lokal, <strong className="font-bold text-teal-950 dark:text-teal-100">wajib melalui tinjauan validasi ketat Admin Utama</strong> terlebih dahulu sebelum dipublikasikan untuk menjaga keakuratan informasi publik demi kemajuan pariwisata Pacitan.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
