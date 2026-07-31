import { useEffect, useRef } from "react";
import L from "leaflet";
import { Location, LocationCategory } from "../types";

interface MapComponentProps {
  locations: Location[];
  selectedLocation: Location | null;
  onMarkerClick?: (location: Location) => void;
  interactiveCoordinateSelection?: boolean;
  onSelectCoordinates?: (lat: number, lng: number) => void;
  selectedCoordinates?: { lat: number; lng: number } | null;
}

// Category color maps
const CATEGORY_COLORS: Record<LocationCategory, string> = {
  wisata: "#0f766e",   // Teal
  penginapan: "#f59e0b", // Amber
  makan: "#e11d48",      // Rose
  coffeeshop: "#8b5cf6", // Purple
  belanja: "#db2777",    // Pink (Belanja)
  lainnya: "#64748b"     // Slate
};

// Help map category icons
const CATEGORY_EMOJIS: Record<LocationCategory, string> = {
  wisata: "🏝️",
  penginapan: "🏨",
  makan: "🍲",
  coffeeshop: "☕",
  belanja: "🛍️",
  lainnya: "📍"
};

export default function MapComponent({
  locations,
  selectedLocation,
  onMarkerClick,
  interactiveCoordinateSelection = false,
  onSelectCoordinates,
  selectedCoordinates = null
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const customSelectionMarkerRef = useRef<L.Marker | null>(null);

  const selectCoordsRef = useRef(onSelectCoordinates);
  const interactiveRef = useRef(interactiveCoordinateSelection);
  const onMarkerClickRef = useRef(onMarkerClick);

  useEffect(() => {
    selectCoordsRef.current = onSelectCoordinates;
    interactiveRef.current = interactiveCoordinateSelection;
    onMarkerClickRef.current = onMarkerClick;
  }, [onSelectCoordinates, interactiveCoordinateSelection, onMarkerClick]);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Pacitan regency town / coast area
    const defaultCenter: [number, number] = [-8.21, 111.03];
    const defaultZoom = 12;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Use CartoDB Voyager tiles - very elegant, modern, high contrast light basemap
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(map);

    markerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Handle map clicks when in placement mode
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (interactiveRef.current && selectCoordsRef.current) {
        const { lat, lng } = e.latlng;
        selectCoordsRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop(); // Stop any pending animations
          mapInstanceRef.current.remove();
        } catch (err) {
          console.warn("Leaflet map removal warning:", err);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Set coordinate-selection marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (customSelectionMarkerRef.current) {
      customSelectionMarkerRef.current.remove();
      customSelectionMarkerRef.current = null;
    }

    if (selectedCoordinates) {
      const pinIcon = L.divIcon({
        className: "custom-div-icon",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-red-400 opacity-75"></span>
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white shadow-lg border-2 border-white font-bold text-lg select-none">
              🎯
            </div>
            <div class="absolute top-8 bg-red-900 text-white px-2 py-0.5 text-[10px] rounded shadow whitespace-nowrap font-semibold">
              Kandidat Lokasi Baru
            </div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 16]
      });

      customSelectionMarkerRef.current = L.marker([selectedCoordinates.lat, selectedCoordinates.lng], {
        icon: pinIcon
      }).addTo(map);

      // Pan to selection
      map.setView([selectedCoordinates.lat, selectedCoordinates.lng], map.getZoom() < 14 ? 14 : map.getZoom());
    }
  }, [selectedCoordinates]);

  // 3. Render locations markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // Stop active map transitions to prevent position conflicts with cleared markers
    try {
      map.stop();
    } catch (e) {
      console.warn("Leaflet stop animation warning:", e);
    }

    // Clear existing markers
    markerGroup.clearLayers();

    // Map each approved location to a custom Leaflet HTML marker
    locations.forEach((loc) => {
      const color = CATEGORY_COLORS[loc.category] || "#64748b";
      const emoji = CATEGORY_EMOJIS[loc.category] || "📍";

      // HTML template for the marker
      const markerHtml = `
        <div class="relative group" style="cursor: pointer;">
          <div class="transition-transform duration-300 transform group-hover:scale-110 flex items-center justify-center w-8 h-8 rounded-full shadow-md border-2 border-white text-base" style="background-color: ${color};">
            <span class="select-none">${emoji}</span>
          </div>
          <div class="absolute left-1/2 -translate-x-1/2 top-9 bg-slate-900/90 text-white font-medium px-2 py-0.5 text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            ${loc.name}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: "custom-div-icon",
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([loc.coordinates.lat, loc.coordinates.lng], { icon });

      // Create rich styling popup content
      const popupContent = document.createElement("div");
      popupContent.className = "w-64 overflow-hidden rounded-lg bg-white shadow-xl border border-slate-100 font-sans";
      
      const photoCover = loc.photos?.[0] || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=300';
      
      popupContent.innerHTML = `
        <img src="${photoCover}" alt="${loc.name}" class="w-full h-28 object-cover" referrerPolicy="no-referrer" />
        <div class="p-3">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded text-white" style="background-color: ${color};">
              ${loc.category}
            </span>
            <div class="flex items-center text-amber-500 text-xs font-semibold">
              ⭐ ${loc.ratingAverage.toFixed(1)}
            </div>
          </div>
          <h4 class="font-bold text-slate-800 text-sm mb-1">${loc.name}</h4>
          <p class="text-xs text-slate-500 line-clamp-2 mb-2">${loc.description}</p>
          <div class="text-[11px] text-slate-400 truncate mb-3">📍 ${loc.address}</div>
          <button id="pop-btn-${loc.id}" class="w-full bg-slate-900 text-white rounded text-xs py-1.5 font-medium hover:bg-teal-700 transition-colors pointer-events-auto">
            Buka Detail Wisata
          </button>
        </div>
      `;

      // Set popup
      marker.bindPopup(popupContent, {
        closeButton: true,
        maxWidth: 280
      });

      // Handle popup click navigation securely via custom DOM triggers
      marker.on("popupopen", () => {
        const btn = document.getElementById(`pop-btn-${loc.id}`);
        if (btn && onMarkerClickRef.current) {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            onMarkerClickRef.current?.(loc);
          });
        }
      });

      marker.addTo(markerGroup);
    });
  }, [locations]);

  // 4. Center map when selectedLocation changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedLocation) return;

    map.setView(
      [selectedLocation.coordinates.lat, selectedLocation.coordinates.lng],
      14, // Zoom in
      { animate: true, duration: 1.5 }
    );
  }, [selectedLocation]);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <div
        id="sipp-leaflet-map"
        ref={mapContainerRef}
        className="w-full h-full absolute inset-0 z-10 border border-slate-200/80 shadow-inner"
      />
      {interactiveCoordinateSelection && (
        <div className="absolute top-3 left-12 z-20 bg-teal-900 border border-teal-700 text-white text-xs px-3 py-2 rounded-lg shadow-md flex items-center gap-2 max-w-[280px]">
          <span className="animate-pulse flex h-2 w-2 rounded-full bg-emerald-400"></span>
          <span>
            {selectedCoordinates 
              ? `Terpilih: ${selectedCoordinates.lat}, ${selectedCoordinates.lng}`
              : "Klik di titik peta mana saja untuk mengambil koordinat."
            }
          </span>
        </div>
      )}
    </div>
  );
}
