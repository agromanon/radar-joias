"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface LotHotspot {
  state: string;
  city: string;
  lat: number;
  lng: number;
  count: number;
  lots: any[];
  temp?: number;
  color?: string;
}

export default function BrazilMap() {
  // Dynamic import of Leaflet to avoid SSR issues
  const [L, setL] = useState<any>(null);
  console.log('[Map] BrazilMap component function called');
  const [hotspots, setHotspots] = useState<LotHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const mountId = useRef(Math.random());

  console.log('[Map] Component instance, mountId:', mountId.current, 'loading:', loading, 'hotspots:', hotspots.length);

  // Load Leaflet dynamically
  useEffect(() => {
    import("leaflet").then((LModule) => {
      const L = LModule.default;
      setL(L);

      // Fix leaflet icon issue
      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    });
  }, []);

  // Fetch data on mount - this runs every time the component remounts (including via key change)
  useEffect(() => {
    console.log('[Map] Component mounted, fetching data...');
    fetchHotspotData();

    return () => {
      console.log('[Map] Component unmounting');
      isFetchingRef.current = false;
    };
  }, []); // Empty dependency array = run on mount

  const fetchHotspotData = async () => {
    console.log('[Map] fetchHotspotData called, mountId:', mountId.current, 'isFetching:', isFetchingRef.current);

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[Map] Already fetching, skipping duplicate request');
      return;
    }

    // Reset error state
    setError(null);

    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.error('[Map] Fetch timeout - forcing loading to false, mountId:', mountId.current);
      setLoading(false);
      isFetchingRef.current = false;
      setError('Tempo de carregamento excedido');
    }, 10000); // 10 second timeout

    try {
      isFetchingRef.current = true;
      setLoading(true);
      console.log('[Map] Starting fetch, mountId:', mountId.current);

      // Request all leiloes with high limit and explicit page
      const response = await fetch('/api/lots?leiloes=true&limit=5000&page=1');
      if (response.ok) {
        const data = await response.json();
        const lots = data.lots || [];

        console.log(`[Map] Fetched ${lots.length} lots from API`);

        // City name normalization map - fix common typos and encoding issues
        const normalizeCityName = (city: string): string => {
          const normalized = city.toString().trim().toLowerCase();

          // Common typos and misspellings
          const corrections: Record<string, string> = {
            'são paula': 'São Paulo',
            'sao paula': 'São Paulo',
            'são paolo': 'São Paulo',
            'sao paolo': 'São Paulo',
            's. paulo': 'São Paulo',
            's. paula': 'São Paulo',
          };

          // Check if we have a correction for this city
          if (corrections[normalized]) {
            return corrections[normalized];
          }

          // Return original if no correction needed
          return city.toString().trim();
        };

        // Group lots by state/city with normalization
        const grouped = (lots as any[]).reduce((acc, lot) => {
          // Normalize: trim whitespace, handle undefined/null, ensure UTF-8
          const state = (lot.location_state || 'BR').toString().trim();
          const rawCity = (lot.location_city || 'Outros').toString().trim();
          const city = normalizeCityName(rawCity);

          // Use consistent key generation
          const key = `${state}|${city}`;

          if (!acc[key]) {
            // Use actual coordinates if available, otherwise use state capital
            const lat = lot.location_lat || -15.78;
            const lng = lot.location_lng || -47.93;

            acc[key] = {
              state,
              city,
              lat,
              lng,
              count: 0,
              lots: []
            };
          }

          acc[key].count++;
          acc[key].lots.push(lot);
          return acc;
        }, {});

        console.log(`[Map] Grouped into ${Object.keys(grouped).length} locations`);
        Object.entries(grouped as Record<string, LotHotspot>).forEach(([key, value]: [string, LotHotspot]) => {
          console.log(`[Map] ${key}: ${value.lots.length} lots`);
        });

        // Convert to array and calculate temperature (count-based intensity)
        const hotspotsArray = (Object.values(grouped) as LotHotspot[]).map(spot => {
          const maxCount = Math.max(...(Object.values(grouped) as LotHotspot[]).map((s: LotHotspot) => s.count), 1); // Avoid division by zero
          const temp = Math.round((spot.count / maxCount) * 100);

          // Color based on temperature
          let color = "#5865F2"; // Default blue (low)
          if (temp >= 70) color = "#EF4444"; // Red (high)
          else if (temp >= 40) color = "#F59E0B"; // Orange (medium)
          else if (temp >= 20) color = "#10B981"; // Green (emerging)

          return {
            ...spot,
            temp,
            color
          };
        });

        console.log(`Created ${hotspotsArray.length} hotspot markers, mountId:`, mountId.current);
        hotspotsArray.forEach(spot => {
          console.log(`[Map] Hotspot: ${spot.state}-${spot.city}, lots: ${spot.lots.length}, temp: ${spot.temp}, mountId:`, mountId.current);
        });

        setHotspots(hotspotsArray);
        console.log('[Map] setHotspots called, mountId:', mountId.current, 'loading set to false');
      } else {
        console.error('[Map] API response not OK:', response.status, 'mountId:', mountId.current);
        setError('Falha ao carregar dados');
      }
    } catch (error) {
      console.error('[Map] Error fetching hotspot data:', error);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      isFetchingRef.current = false;
      console.log('[Map] Fetch complete, loading set to false');
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0B0E14]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#8E9297] text-sm">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0B0E14]">
        <div className="flex flex-col items-center gap-3">
          <p className="text-[#EF4444] text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchHotspotData();
            }}
            className="px-4 py-2 bg-[#5865F2] text-white rounded-lg text-sm hover:bg-[#4752C4]"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Check if window is defined and L is loaded (SSR check)
  if (typeof window === 'undefined' || !L) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0B0E14]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#8E9297] text-sm">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  // Error fallback
  if (hotspots.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0B0E14]">
        <div className="flex flex-col items-center gap-3">
          <p className="text-[#8E9297] text-sm">Nenhum lote encontrado</p>
        </div>
      </div>
    );
  }

  // Brazil bounds - more restrictive
  const brazilBounds: [[number, number], [number, number]] = [
    [-33.75, -73.99],  // Southwest
    [5.27, -28.84]     // Northeast
  ];

  // Wrap map render in try-catch for error handling
  try {
    return (
      <MapContainer
      center={[-15.78, -47.93]}  // Center of Brazil
      zoom={4}
      minZoom={4}
      maxZoom={6}
      maxBounds={brazilBounds}
      maxBoundsViscosity={1.0}
      scrollWheelZoom={true}
      closePopupOnClick={false}
      bounceAtZoomLimits={false}
      zoomControl={false}
      attributionControl={false}
      zoomAnimation={false}
      markerZoomAnimation={false}
      fadeAnimation={false}
      inertia={false}
      style={{ width: "100%", height: "100%", borderRadius: "0", background: "#0B0E14" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {hotspots.map((spot) => (
        <CircleMarker
          key={`${spot.state}-${spot.city}`}
          center={[spot.lat, spot.lng]}
          radius={Math.max(12, Math.min(50, spot.count / 2))}
          pathOptions={{
            color: spot.color,
            fillColor: spot.color,
            fillOpacity: 0.45,
            weight: 2,
          }}
        >
          <Popup
            closeButton={true}
            closeOnClick={false}
            autoClose={false}
          >
            <div style={{ background: "#151A22", border: "1px solid #272A31", borderRadius: "12px", padding: "14px", minWidth: "200px", color: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "15px" }}>{spot.state}</span>
                <span style={{ background: spot.color + "22", color: spot.color, padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 }}>
                  {spot.temp}°
                </span>
              </div>
              <p style={{ color: "#8E9297", fontSize: "12px", margin: "0 0 4px" }}>{spot.city}</p>
              <p style={{ color: "#8E9297", fontSize: "11px", margin: "0 0 8px" }}>{spot.lots.length} lotes disponíveis</p>
              <a
                href={`/dashboard?state=${spot.state}`}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "8px",
                  background: "#5865F2",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  textAlign: "center",
                  padding: "8px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#4752C4"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#5865F2"}
              >
                Ver Lotes
              </a>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
    );
  } catch (error) {
    console.error('[Map] Error rendering map:', error);
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0B0E14]">
        <div className="flex flex-col items-center gap-3">
          <p className="text-[#EF4444] text-sm">Erro ao carregar mapa</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#5865F2] text-white rounded-lg text-sm"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
}
