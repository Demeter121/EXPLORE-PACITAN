import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { Location, ItineraryItem } from "../types";
import { 
  Compass, ExternalLink, Navigation, Locate, AlertCircle, RefreshCw,
  ArrowLeft, ArrowRight, ArrowUpRight, ArrowUpLeft, ArrowUp, Flag, MapPin, Car, ChevronDown, ChevronRight
} from "lucide-react";

interface ItineraryMapProps {
  items: ItineraryItem[];
  locations: Location[];
  activeDay: number;
}

interface RouteStep {
  instruction: string;
  distance: number;
  modifier?: string;
  type: string;
}

interface RouteSegment {
  fromName: string;
  toName: string;
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[];
}

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

// Translate maneuver into Indonesian description
function formatStepInstruction(step: any, index: number, fromName: string, toName: string): string {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;
  const name = step.name || "";
  const distance = step.distance; // meters
  
  let action = "";
  
  if (type === "depart") {
    action = `Mulai berkendara dari "${fromName}"`;
  } else if (type === "arrive") {
    action = `Tiba di tujuan: "${toName}"`;
  } else if (type === "roundabout") {
    action = "Masuki bundaran";
    if (step.maneuver.exit) {
      action += ` dan ambil jalan keluar ke-${step.maneuver.exit}`;
    }
  } else if (type === "new name") {
    action = "Terus ikuti jalan";
  } else {
    switch (modifier) {
      case "left":
        action = "Belok kiri";
        break;
      case "right":
        action = "Belok kanan";
        break;
      case "sharp left":
        action = "Belok tajam ke kiri";
        break;
      case "sharp right":
        action = "Belok tajam ke kanan";
        break;
      case "slight left":
        action = "Ambil arah agak ke kiri";
        break;
      case "slight right":
        action = "Ambil arah agak ke kanan";
        break;
      case "uturn":
        action = "Putar balik";
        break;
      case "straight":
        action = "Lurus terus";
        break;
      default:
        action = "Lurus terus";
        break;
    }
  }

  if (name && name !== "" && type !== "depart" && type !== "arrive") {
    action += ` ke Jalan ${name}`;
  }

  // Append distance if applicable
  if (distance > 0 && type !== "arrive") {
    const distText = distance >= 1000 
      ? `${(distance / 1000).toFixed(1)} km` 
      : `${Math.round(distance)} m`;
    action += ` sejauh ${distText}`;
  }

  return action;
}

// Render dynamic maneuver directions icon
function getManeuverIcon(type: string, modifier?: string) {
  if (type === "depart") return <MapPin size={13} className="text-emerald-500 flex-shrink-0" />;
  if (type === "arrive") return <Flag size={13} className="text-rose-500 flex-shrink-0" />;
  if (type === "roundabout") return <RefreshCw size={13} className="text-teal-500 flex-shrink-0" />;
  
  switch (modifier) {
    case "left":
    case "sharp left":
      return <ArrowLeft size={13} className="text-blue-500 flex-shrink-0" />;
    case "right":
    case "sharp right":
      return <ArrowRight size={13} className="text-blue-500 flex-shrink-0" />;
    case "slight left":
      return <ArrowUpLeft size={13} className="text-sky-500 flex-shrink-0" />;
    case "slight right":
      return <ArrowUpRight size={13} className="text-sky-500 flex-shrink-0" />;
    case "uturn":
      return <RefreshCw size={13} className="text-indigo-500 flex-shrink-0" />;
    default:
      return <ArrowUp size={13} className="text-slate-400 flex-shrink-0" />;
  }
}

export default function ItineraryMap({ items, locations, activeDay }: ItineraryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);

  // User Geolocation State
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showDirections, setShowDirections] = useState(false);

  // Road Routing State
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);

  // Get valid locations in sequence for the day
  const routeLocations = items
    .map((item) => locations.find((l) => l.id === item.locationId))
    .filter((loc): loc is Location => !!loc);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Pacitan coastline / town center
    const defaultCenter: [number, number] = [-8.21, 111.03];
    const defaultZoom = 11;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Elegant Voyager light basemap (handles dark mode via global CSS filter)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(map);

    markerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Auto resize map when container size changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn("Leaflet cleanup error:", e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Fetch real road routing using OSRM API (or fallback to straight line if error)
  useEffect(() => {
    let active = true;
    const coords: string[] = [];
    
    if (userCoords && showDirections) {
      coords.push(`${userCoords[1]},${userCoords[0]}`); // OSRM takes [lng, lat]
    }
    
    routeLocations.forEach((loc) => {
      coords.push(`${loc.coordinates.lng},${loc.coordinates.lat}`);
    });

    if (coords.length < 2) {
      setRoutePath([]);
      setRouteSegments([]);
      setActiveSegmentIndex(null);
      return;
    }

    setIsLoadingRoute(true);
    const coordsString = coords.join(";");
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=true`;

    fetch(osrmUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memanggil server peta");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
          throw new Error("Rute jalan tidak ditemukan");
        }

        const route = data.routes[0];
        
        // GeoJSON coordinates are [lng, lat], we map them to Leaflet [lat, lng]
        const realCoords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        setRoutePath(realCoords);

        // Map legs to our segments
        const parsedSegments = route.legs.map((leg: any, idx: number) => {
          let fromName = "";
          let toName = "";

          if (userCoords && showDirections) {
            if (idx === 0) {
              fromName = "Lokasi Saya";
              toName = routeLocations[0]?.name || "Destinasi 1";
            } else {
              fromName = routeLocations[idx - 1]?.name || `Stop ${idx}`;
              toName = routeLocations[idx]?.name || `Stop ${idx + 1}`;
            }
          } else {
            fromName = routeLocations[idx]?.name || `Stop ${idx + 1}`;
            toName = routeLocations[idx + 1]?.name || `Stop ${idx + 2}`;
          }

          const steps = (leg.steps || []).map((step: any, stepIdx: number) => {
            return {
              instruction: formatStepInstruction(step, stepIdx, fromName, toName),
              distance: step.distance,
              modifier: step.maneuver?.modifier,
              type: step.maneuver?.type,
            };
          });

          // Fallback if steps are empty
          if (steps.length === 0) {
            steps.push({
              instruction: `Berkendara dari "${fromName}" ke "${toName}"`,
              distance: leg.distance,
              type: "straight"
            });
          }

          return {
            fromName,
            toName,
            distanceKm: Number((leg.distance / 1000).toFixed(1)),
            durationMin: Math.round(leg.duration / 60),
            steps,
          };
        });

        setRouteSegments(parsedSegments);
        setIsLoadingRoute(false);
        setActiveSegmentIndex(0);
      })
      .catch((err) => {
        console.warn("OSRM error, falling back to straight-line navigation:", err);
        if (!active) return;
        setIsLoadingRoute(false);

        // Fallback straight lines
        const fallbackCoords: [number, number][] = [];
        if (userCoords && showDirections) {
          fallbackCoords.push([userCoords[0], userCoords[1]]);
        }
        routeLocations.forEach((loc) => {
          fallbackCoords.push([loc.coordinates.lat, loc.coordinates.lng]);
        });
        setRoutePath(fallbackCoords);

        // Fallback instructions
        const fallbackSegments: RouteSegment[] = [];
        const isUserIncluded = (userCoords && showDirections);
        const loopCount = routeLocations.length - (isUserIncluded ? 0 : 1);

        for (let i = 0; i < loopCount; i++) {
          let fromName = "";
          let toName = "";
          let fromLat = 0, fromLng = 0, toLat = 0, toLng = 0;

          if (isUserIncluded) {
            if (i === 0) {
              fromName = "Lokasi Saya";
              toName = routeLocations[0].name;
              fromLat = userCoords[0];
              fromLng = userCoords[1];
              toLat = routeLocations[0].coordinates.lat;
              toLng = routeLocations[0].coordinates.lng;
            } else {
              fromName = routeLocations[i - 1].name;
              toName = routeLocations[i].name;
              fromLat = routeLocations[i - 1].coordinates.lat;
              fromLng = routeLocations[i - 1].coordinates.lng;
              toLat = routeLocations[i].coordinates.lat;
              toLng = routeLocations[i].coordinates.lng;
            }
          } else {
            fromName = routeLocations[i].name;
            toName = routeLocations[i + 1].name;
            fromLat = routeLocations[i].coordinates.lat;
            fromLng = routeLocations[i].coordinates.lng;
            toLat = routeLocations[i + 1].coordinates.lat;
            toLng = routeLocations[i + 1].coordinates.lng;
          }

          const dist = calculateDistance(fromLat, fromLng, toLat, toLng);
          const dur = estimateDrivingDuration(dist);

          fallbackSegments.push({
            fromName,
            toName,
            distanceKm: dist,
            durationMin: dur,
            steps: [
              {
                instruction: `Mulai mengemudi dari "${fromName}"`,
                distance: 0,
                type: "depart"
              },
              {
                instruction: `Lanjutkan berkendara menyusuri jalan utama menuju "${toName}"`,
                distance: dist * 1000,
                type: "straight"
              },
              {
                instruction: `Tiba di tujuan: "${toName}"`,
                distance: 0,
                type: "arrive"
              }
            ]
          });
        }

        setRouteSegments(fallbackSegments);
        setActiveSegmentIndex(fallbackSegments.length > 0 ? 0 : null);
      });

    return () => {
      active = false;
    };
  }, [items, locations, userCoords, showDirections]);

  // Handle map overlays (markers & polylines) whenever path/markers change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // Stop any active animations to prevent calculations on changing layers
    try {
      map.stop();
    } catch (e) {
      console.warn("Leaflet stop animation warning:", e);
    }

    // Clear existing
    markerGroup.clearLayers();
    polylinesRef.current.forEach((pl) => {
      try {
        pl.remove();
      } catch (e) {
        // ignore
      }
    });
    polylinesRef.current = [];

    if (routeLocations.length === 0) return;

    // Plot User GPS Marker if active
    if (userCoords && showDirections) {
      const userMarker = L.marker(userCoords, {
        icon: L.divIcon({
          className: "user-gps-marker",
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></div>
              <div class="w-4.5 h-4.5 bg-blue-600 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      });
      userMarker.bindPopup(`
        <div class="p-1.5 font-sans text-center">
          <p class="text-xs font-bold text-slate-800">📍 Lokasi Anda Saat Ini</p>
          <p class="text-[9px] text-slate-500 mt-0.5">Mulai navigasi dari koordinat GPS Anda</p>
        </div>
      `, { maxWidth: 160 });
      userMarker.addTo(markerGroup);
    }

    // Plot Route Stop Markers
    routeLocations.forEach((loc, index) => {
      const lat = loc.coordinates.lat;
      const lng = loc.coordinates.lng;

      const markerHtml = `
        <div class="relative flex flex-col items-center">
          <div class="flex items-center justify-center w-7.5 h-7.5 rounded-full bg-teal-600 dark:bg-indigo-600 text-white font-display font-black text-xs shadow-md border-2 border-white transition-transform hover:scale-110 cursor-pointer">
            ${index + 1}
          </div>
          <div class="bg-slate-950/85 text-white font-semibold px-2 py-0.5 text-[8.5px] rounded-md shadow mt-1 whitespace-nowrap pointer-events-none">
            ${loc.name}
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "numbered-stop-marker",
          html: markerHtml,
          iconSize: [40, 50],
          iconAnchor: [20, 15]
        })
      });

      marker.bindPopup(`
        <div class="p-2 font-sans max-w-xs">
          <div class="font-bold text-slate-800 text-xs">Pemberhentian ${index + 1}: ${loc.name}</div>
          <p class="text-[10px] text-slate-500 line-clamp-2 mt-0.5">${loc.description}</p>
          <div class="text-[9px] text-teal-600 font-bold uppercase mt-1">🏷️ ${loc.category}</div>
        </div>
      `, { maxWidth: 200 });

      marker.addTo(markerGroup);
    });

    // Draw real route path on map
    if (routePath.length >= 2) {
      // Main street-conforming route line
      const polyline = L.polyline(routePath, {
        color: "#0f766e", // teal-700
        weight: 5,
        opacity: 0.9,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);

      polylinesRef.current.push(polyline);

      // Fit map bounds to contain entire route with comfortable padding
      map.fitBounds(polyline.getBounds(), {
        padding: [45, 45],
        maxZoom: 15,
      });
    } else if (routeLocations.length === 1) {
      map.setView([routeLocations[0].coordinates.lat, routeLocations[0].coordinates.lng], 13, { animate: true });
    }
  }, [routeLocations.length, routePath, userCoords, showDirections]);

  // Locate User GPS
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setLocationError("Peramban Anda tidak mendukung penentuan lokasi GPS.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords([latitude, longitude]);
        setIsLocating(false);
        setShowDirections(true);
      },
      (error) => {
        console.error("GPS error:", error);
        setIsLocating(false);
        let errorMsg = "Gagal mengambil koordinat lokasi Anda.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Akses GPS ditolak peramban. Harap aktifkan izin lokasi di peramban Anda.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Sinyal GPS tidak tersedia atau tidak akurat.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Waktu tunggu GPS habis. Silakan coba kembali.";
        }
        setLocationError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Google Maps Directions link for overall day trip
  const getGoogleMapsDirectionsUrl = () => {
    if (routeLocations.length === 0) return "";
    
    let origin = "";
    let startIndex = 0;
    
    if (userCoords && showDirections) {
      origin = `${userCoords[0]},${userCoords[1]}`;
    } else {
      if (routeLocations.length < 2) return "";
      origin = `${routeLocations[0].coordinates.lat},${routeLocations[0].coordinates.lng}`;
      startIndex = 1;
    }

    const lastStop = routeLocations[routeLocations.length - 1];
    const destination = `${lastStop.coordinates.lat},${lastStop.coordinates.lng}`;

    const activeRouteStops = routeLocations.slice(startIndex, -1);
    
    if (activeRouteStops.length === 0) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    }

    const waypoints = activeRouteStops
      .map((loc) => `${loc.coordinates.lat},${loc.coordinates.lng}`)
      .join("|");

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
  };

  const gmapsUrl = getGoogleMapsDirectionsUrl();

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col h-full min-h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400 font-mono tracking-wider">
            Rute Perjalanan Realistis (OSM)
          </span>
          <h4 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5 mt-0.5">
            <Compass size={15} className="text-teal-600" /> Peta Hari Ke-{activeDay}
          </h4>
        </div>

        {gmapsUrl && (
          <a
            href={gmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition shadow-sm cursor-pointer"
          >
            <Navigation size={10} /> Google Maps
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Control GPS Box */}
      <div className="mb-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400 mt-0.5">
              <Navigation size={14} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-normal">
                Arah dari Lokasi Saya Saat Ini
              </p>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Tampilkan rute jalan berbelok langsung dari posisi GPS ponsel Anda sekarang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center sm:self-center">
            {userCoords ? (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                  GPS Aktif
                </span>
                <button
                  type="button"
                  onClick={() => setShowDirections(!showDirections)}
                  className={`text-[9px] font-bold px-2 py-1 rounded transition cursor-pointer ${
                    showDirections
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-750"
                  }`}
                >
                  {showDirections ? "Sembunyikan Rute" : "Tampilkan Rute"}
                </button>
                <button
                  type="button"
                  onClick={handleLocateUser}
                  disabled={isLocating}
                  title="Refresh GPS"
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 rounded transition cursor-pointer"
                >
                  <RefreshCw size={11} className={isLocating ? "animate-spin" : ""} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLocateUser}
                disabled={isLocating}
                className="w-full sm:w-auto text-[9px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-75"
              >
                {isLocating ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" /> Mengambil GPS...
                  </>
                ) : (
                  <>
                    <Locate size={11} /> Aktifkan Navigasi GPS
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {locationError && (
          <div className="mt-2 text-[9px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/40 p-2 rounded-lg flex items-center gap-1.5">
            <AlertCircle size={11} />
            <span>{locationError}</span>
          </div>
        )}
      </div>

      {/* Leaflet Container */}
      <div className="relative h-[240px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />
        
        {routeLocations.length === 0 && (
          <div className="absolute inset-0 z-20 bg-slate-100/90 dark:bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
            <Compass size={32} className="text-slate-400 mb-2 animate-spin-slow" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Belum ada destinasi terpilih</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] mt-1">
              Tambahkan beberapa obyek wisata pada draf hari ke-{activeDay} untuk menampilkan rute jalan.
            </p>
          </div>
        )}
      </div>

      {/* Turn-by-Turn Instruction Panel */}
      {routeSegments.length > 0 && (
        <div className="mt-3 flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Car size={13} className="text-teal-600" />
              <span>📋 Petunjuk Belokan ({routeSegments.length} Segmen)</span>
            </div>
            {isLoadingRoute && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Memetakan...
              </span>
            )}
          </div>

          {/* Segment Tabs selector */}
          <div className="flex gap-1 overflow-x-auto pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-900 scrollbar-thin">
            {routeSegments.map((seg, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => setActiveSegmentIndex(sIdx)}
                className={`flex-shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeSegmentIndex === sIdx
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Segmen {sIdx + 1}: {seg.fromName.split(" ").slice(0, 2).join(" ")} ➡️ {seg.toName.split(" ").slice(0, 2).join(" ")}
              </button>
            ))}
          </div>

          {/* Active Segment turns list */}
          {activeSegmentIndex !== null && routeSegments[activeSegmentIndex] && (
            <div className="flex-1 overflow-y-auto max-h-[160px] pr-1 space-y-1 scrollbar-thin text-left">
              <div className="mb-2 bg-teal-50/50 dark:bg-teal-950/15 border border-teal-150/40 dark:border-teal-900/40 rounded-lg p-2 flex items-center justify-between text-[10px]">
                <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {routeSegments[activeSegmentIndex].fromName} ➔ {routeSegments[activeSegmentIndex].toName}
                </span>
                <span className="font-bold font-mono text-teal-700 dark:text-teal-400 flex-shrink-0 ml-2">
                  {routeSegments[activeSegmentIndex].distanceKm} km ({routeSegments[activeSegmentIndex].durationMin} mnt)
                </span>
              </div>

              {routeSegments[activeSegmentIndex].steps.map((step, stepIdx) => (
                <div 
                  key={stepIdx} 
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-transparent hover:border-slate-100 dark:hover:border-slate-850 transition"
                >
                  <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-xs mt-0.5">
                    {getManeuverIcon(step.type, step.modifier)}
                  </div>
                  <div className="flex-1 text-[10.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                    <span className="font-medium">{step.instruction}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Warning */}
      {routeLocations.length >= 1 && (
        <div className="mt-3 bg-teal-50/30 dark:bg-indigo-950/15 border border-teal-150/50 dark:border-indigo-900/35 rounded-lg p-2.5 text-[10.5px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <span className="flex-shrink-0 text-teal-600 dark:text-teal-400 font-bold font-mono text-xs">
            💡 TIP:
          </span>
          <span className="leading-normal">
            Peta rute ini dihitung berdasarkan jalan raya di Pacitan. Ketuk tombol <b>Google Maps</b> untuk navigasi audio GPS langsung saat berkendara.
          </span>
        </div>
      )}
    </div>
  );
}
