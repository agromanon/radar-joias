"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Navigation } from "lucide-react";
import BrazilMap from "@/components/map/BrazilMap";

interface StateStats {
  state: string;
  count: number;
  temp: number;
  color: string;
  bg: string;
}

// Global flag to track last time we were on /mapa
let lastMapaVisitTime = Date.now();
let hasJustLoaded = true;

function MapaContent() {
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [mapKey, setMapKey] = useState(0);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hasInitializedRef = useRef(false);

  // Log every render for debugging
  console.log('[MapaPage] Render, pathname:', pathname, 'mapKey:', mapKey, 'searchParams:', searchParams.toString());

  // Force full page reload when navigating back to /mapa
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastVisit = now - lastMapaVisitTime;

    console.log('[MapaPage] Navigation effect - pathname:', pathname, 'timeSinceLastVisit:', timeSinceLastVisit, 'hasJustLoaded:', hasJustLoaded);

    // Force reload if:
    // - We're on /mapa
    // - It's been more than 3 seconds since last visit
    // - This is not the initial page load
    if (pathname === '/mapa' && timeSinceLastVisit > 3000 && !hasJustLoaded) {
      console.log('[MapaPage] Detected return to /mapa after being away, forcing reload');
      window.location.reload();
      return;
    }

    // Reset the "just loaded" flag after first navigation
    if (hasJustLoaded) {
      hasJustLoaded = false;
    }

    // Update last visit time
    lastMapaVisitTime = now;
  }, [pathname]);

  // Check for a force-refresh parameter in URL
  useEffect(() => {
    const forceRefresh = searchParams.get('refresh');
    if (forceRefresh === 'true') {
      console.log('[MapaPage] Force refresh detected, reloading page');
      // Remove the refresh param and reload
      window.history.replaceState({}, '', '/mapa');
      window.location.reload();
      return;
    }

    // Check sessionStorage to see if we're returning from another page
    const lastVisitKey = 'mapa-last-visit';
    const lastVisit = sessionStorage.getItem(lastVisitKey);
    const now = Date.now();

    if (lastVisit) {
      const timeSinceLastVisit = now - parseInt(lastVisit, 10);
      console.log('[MapaPage] Time since last visit:', timeSinceLastVisit, 'ms');

      // If it's been more than 5 seconds, likely returning from another page
      if (timeSinceLastVisit > 5000) {
        console.log('[MapaPage] Detected return from another page, refreshing data and map');
        fetchStateStats();
        setMapKey(prev => prev + 1);
      }
    }

    // Update last visit time
    sessionStorage.setItem(lastVisitKey, now.toString());
  }, [searchParams]);

  const fetchStateStats = async () => {
    try {
      const response = await fetch('/api/lots?limit=1000');
      if (response.ok) {
        const data = await response.json();
        const lots = data.lots || [];
        const grouped: Record<string, number> = lots.reduce((acc: Record<string, number>, lot: any) => {
          const state = lot.sg_uf || 'Outros';
          acc[state] = (acc[state] || 0) + 1;
          return acc;
        }, {});
        const stats = Object.entries(grouped).map(([state, count]: [string, number]) => {
          const maxCount = Math.max(...Object.values(grouped));
          const temp = Math.round((count / maxCount) * 100);
          let color = "text-[#5865F2]";
          let bg = "bg-[#5865F2]/10";
          if (temp >= 70) { color = "text-[#EF4444]"; bg = "bg-[#EF4444]/10"; }
          else if (temp >= 40) { color = "text-[#F59E0B]"; bg = "bg-[#F59E0B]/10"; }
          else if (temp >= 20) { color = "text-[#10B981]"; bg = "bg-[#10B981]/10"; }
          return { state, count, temp, color, bg };
        }).sort((a, b) => b.count - a.count);
        setStateStats(stats);
      }
    } catch (error) {
      console.error('Error fetching state stats:', error);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="px-6 md:px-10 py-6 border-b border-[#272A31] flex-shrink-0">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Navigation className="w-6 h-6 text-[#5865F2]" />
          Radar Geográfico
        </h1>
        <p className="text-[#8E9297] text-sm mt-1 max-w-2xl">
          Visualize onde estão concentradas as maiores oportunidades de leilão no Brasil. Clique nos marcadores para ver detalhes.
        </p>
      </div>

      {/* Body: map + sidebar */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* Sidebar */}
        <aside className="lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-r border-[#272A31] flex-shrink-0 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Zonas quentes - Dynamic */}
            <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4">
              <h2 className="text-white font-bold text-sm mb-4">Zonas Quentes 🔥</h2>
              {stateStats.length === 0 ? (
                <p className="text-[#8E9297] text-xs">Carregando dados...</p>
              ) : (
                <div className="space-y-3">
                  {stateStats.slice(0, 8).map((s) => (
                    <div key={s.state} className="flex items-center justify-between group cursor-pointer hover:bg-[#2F3136]/50 px-2 py-1.5 -mx-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${s.bg.replace("/10", "")} opacity-80`} />
                        <div>
                          <span className="text-white font-semibold text-sm">{s.state}</span>
                          <p className="text-[#8E9297] text-[10px]">{s.count} leilões ativos</p>
                        </div>
                      </div>
                      <div className={`w-9 h-9 ${s.bg} ${s.color} rounded-full flex items-center justify-center font-bold text-xs`}>
                        {s.temp}°
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4">
              <h3 className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest mb-3">Legenda</h3>
              <div className="space-y-2">
                {[
                  { color: "bg-[#EF4444]", label: "Alta concentração (70°+)" },
                  { color: "bg-[#F59E0B]", label: "Média concentração (40–70°)" },
                  { color: "bg-[#10B981]", label: "Baixa concentração (20–40°)" },
                  { color: "bg-[#5865F2]", label: "Emergente (<20°)" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${l.color} flex-shrink-0`} />
                    <span className="text-[#8E9297] text-xs">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 min-h-[400px] lg:min-h-0 relative">
          <BrazilMap key={mapKey} />
        </div>
      </div>
    </div>
  );
}

export default function MapaPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white">Carregando mapa...</div>}>
      <MapaContent />
    </Suspense>
  );
}
