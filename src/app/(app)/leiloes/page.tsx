"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, Clock, MapPin, X, Filter, Gem, TrendingUp, AlertTriangle, Star, CheckSquare, Square, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

// CAIXA changed image URL base from /vitrinedejoias to /vitrinearquivos/fotos
function fixImageUrl(url: string): string {
  if (url.includes('servicebus2.caixa.gov.br/vitrinedejoias/')) {
    return url.replace('servicebus2.caixa.gov.br/vitrinedejoias/', 'servicebus2.caixa.gov.br/vitrinearquivos/fotos/');
  }
  return url;
}

type Lot = {
  id: number;
  lot_number: string;
  de_contrato: string;
  peso_lote: string;
  valor: number;
  url_imagem_capa: string;
  imagem_capa_url: string | null;
  sg_uf: string;
  co_leilao: string;
  outcome_status: string;
  winning_bid_value: number;
  centralizer_name: string;
  cities?: any;
  auctions?: any;
  // Enriched fields (from LLM)
  title_enriched?: string | null;
  description_enriched?: string | null;
  karat_enriched?: string | null;
  category_enriched?: string | null;
  weight_enriched?: number | null;
  tags?: string[] | null;
  // Legacy condition flags
  has_enchimento?: boolean;
  has_low_karat?: boolean;
  has_unvalued_stones?: boolean;
  is_watch_stopped?: boolean;
  is_broken?: boolean;
  is_incomplete?: boolean;
  is_damaged?: boolean;
  has_mixed_metals?: boolean;
  is_folheado?: boolean;
  has_rhodium_plating?: boolean;
  is_coin?: boolean;
  is_bar?: boolean;
  is_watch?: boolean;
  is_montblanc_pen?: boolean;
  karat?: string;
  category?: string;
  bid_end?: string | null;
  bid_start?: string | null;
};

// Derive condition flags from tags array
function flagsFromTags(tags: string[] | null | undefined) {
  if (!tags) return {};
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  return {
    has_enchimento: tagSet.has('enchimento'),
    has_low_karat: tagSet.has('baixo-karat') || tagSet.has('ouro-baixo'),
    has_unvalued_stones: tagSet.has('pedras-nao-valorizadas'),
    is_watch_stopped: tagSet.has('relogio-parado'),
    is_broken: tagSet.has('quebrado') || tagSet.has('partido'),
    is_incomplete: tagSet.has('incompleto') || tagSet.has('falta'),
    is_damaged: tagSet.has('amassado') || tagSet.has('amolgado') || tagSet.has('com-defeito'),
    has_mixed_metals: tagSet.has('metais-mistos') || tagSet.has('residuo-cobre'),
    is_folheado: tagSet.has('folheado'),
    has_rhodium_plating: tagSet.has('ouro-rodinado'),
    is_coin: tagSet.has('moeda'),
    is_bar: tagSet.has('barra'),
    is_watch: tagSet.has('relogio'),
  };
}

function formatPrice(price: number | null | undefined): string {
  if (!price || Number.isNaN(price)) return "R$ --";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(price);
}

function getJewelryType(description: string | null): string {
  if (!description) return "Joia";
  const d = description.toLowerCase();
  if (d.includes("aliança")) return "Aliança";
  if (d.includes("colar")) return "Colar";
  if (d.includes("brinco")) return "Brinco";
  if (d.includes("anel")) return "Anel";
  if (d.includes("pulseira")) return "Pulseira";
  if (d.includes("relógio") || d.includes("watch")) return "Relógio";
  if (d.includes("moeda")) return "Moeda";
  if (d.includes("barra")) return "Barra";
  if (d.includes("ouro 18")) return "Ouro 18k";
  if (d.includes("ouro 14")) return "Ouro 14k";
  if (d.includes("prata")) return "Prata";
  return "Joia";
}

function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [hoursRemaining, setHoursRemaining] = useState<number>(0);

  useEffect(() => {
    const calculate = () => {
      // CAIXA auctions close at 4PM Brasília time = 22:00 UTC (BRT = UTC-3)
      const end = new Date(endDate + "T22:00:00Z");
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      const hours = diff / (1000 * 60 * 60);
      setHoursRemaining(hours);
      if (diff <= 0) return "Encerrado";
      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h < 1) return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      if (h <= 72) return `${h}h ${String(m).padStart(2, "0")}m`;
      const days = Math.floor(h / 24);
      const remH = h % 24;
      return `${days}d ${remH}h`;
    };
    setTimeLeft(calculate());
    const interval = setInterval(() => setTimeLeft(calculate()), 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  // Alert thresholds for CAIXA physical bid requirement
  // User needs time to go to CAIXA agency ATM, so alerts start 72h (3 days) before
  const isCritical = hoursRemaining > 0 && hoursRemaining <= 24; // Red - within 24h
  const isWarning = hoursRemaining > 24 && hoursRemaining <= 72; // Amber - 24-72h

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${
      timeLeft === "Encerrado" ? "text-red-500" :
      isCritical ? "text-red-500 font-bold" :
      isWarning ? "text-amber-500 font-semibold" :
      "text-white/80"
    }`}>
      <Clock className={`w-3 h-3 ${isCritical ? "animate-pulse" : ""}`} />
      {timeLeft}
      <span className="text-[10px] opacity-60">{formatDate(endDate)}</span>
    </span>
  );
}

export default function LeiloesPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedKarat, setSelectedKarat] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [minWeight, setMinWeight] = useState<string>("");
  const [maxWeight, setMaxWeight] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("bid_end");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"idle" | "adding">("idle");

  const { user } = useUser();
  const supabase = createClient();

  useEffect(() => {
    fetchLots();
  }, [selectedState, selectedKarat, selectedCategory, maxPrice, minPrice, minWeight, maxWeight, sortBy, searchQuery, page]);

  const paramsRef = useRef<string>("");

  async function fetchLots() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('leiloes', 'true');
      params.set('page', page.toString());
      params.set('limit', PAGE_SIZE.toString());
      params.set('order', sortBy === 'price_asc' ? 'valor.asc' : sortBy === 'price_desc' ? 'valor.desc' : 'id.desc');
      if (sortBy === 'bid_end' || sortBy === 'weight_desc') {
        params.set('sort', sortBy);
        params.set('order', 'asc');
      }
      if (searchQuery) params.set('search', searchQuery);
      if (selectedState) params.set('state', selectedState);
      if (selectedKarat) params.set('karat', selectedKarat);
      if (selectedCategory) params.set('category', selectedCategory);
      if (minPrice) params.set('min_bid', minPrice);
      if (maxPrice) params.set('max_bid', maxPrice);
      if (minWeight) params.set('min_weight', minWeight);
      if (maxWeight) params.set('max_weight', maxWeight);

      const urlString = params.toString();
      paramsRef.current = urlString;
      const res = await fetch(`/api/lots?${urlString}`, { cache: 'no-store' });
      const result = await res.json();
      if (paramsRef.current !== urlString) return; // Stale request, ignore
      if (!res.ok) console.error("Error:", result);
      else { setLots(result.lots ?? []); setPagination(result.pagination ?? { total: 0, totalPages: 1 }); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function clearFilters() {
    setSelectedState("");
    setSelectedKarat("");
    setSelectedCategory("");
    setMinPrice("");
    setMaxPrice("");
    setMinWeight("");
    setMaxWeight("");
    setSearchQuery("");
    setPage(1);
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === lots.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(lots.map(l => l.id)));
    }
  }

  async function bulkAddToWatchlist() {
    if (!user || selectedIds.size === 0) return;
    setBulkAction("adding");
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_bulk", lot_ids: ids }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
      }
    } catch (e) {
      console.error("Bulk add failed:", e);
    } finally {
      setBulkAction("idle");
    }
  }

  const flagIcons = [
    { key: "has_enchimento", label: "Enchimento", bg: "bg-amber-600 text-white" },
    { key: "has_low_karat", label: "Baixo Karat", bg: "bg-orange-600 text-white" },
    { key: "has_unvalued_stones", label: "Pedras não precificadas", bg: "bg-pink-600 text-white" },
    { key: "is_watch_stopped", label: "Relógio parado", bg: "bg-red-600 text-white" },
    { key: "is_broken", label: "Quebrado", bg: "bg-red-700 text-white" },
    { key: "is_incomplete", label: "Incompleto", bg: "bg-red-800 text-white" },
    { key: "is_damaged", label: "Danificado", bg: "bg-yellow-600 text-white" },
    { key: "is_folheado", label: "Folheado", bg: "bg-teal-600 text-white" },
    { key: "has_mixed_metals", label: "Metais mistos", bg: "bg-blue-600 text-white" },
    { key: "has_rhodium_plating", label: "Ouro rodinado", bg: "bg-purple-600 text-white" },
  ];

  function shortTitle(description: string | null, jewelryType: string): string {
    if (!description) return jewelryType;
    return description.length > 45 ? description.slice(0, 42).trimEnd() + "…" : description;
  }

  return (
    <div className="min-h-full p-6 md:p-10 max-w-7xl mx-auto">
      {/* Search Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Leilões Disponíveis</h1>
        <p className="text-[#8E9297] text-sm mb-6">Encontre oportunidades de compra em leilões futuros da CAIXA</p>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8E9297]" />
            <input
              type="text"
              placeholder="Buscar ouro, aliança, colar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLots()}
              className="w-full bg-[#151A22] border border-[#272A31] text-white rounded-full py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all ${showFilters ? 'bg-[#5865F2] text-white' : 'bg-[#151A22] border border-[#272A31] text-white hover:bg-[#2F3136]'}`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            {showFilters ? 'Fechar' : 'Filtros'}
            {(selectedState || selectedKarat || selectedCategory || maxPrice) && (
              <span className="w-2 h-2 rounded-full bg-[#5865F2]"></span>
            )}
          </button>
        </div>

        {/* Expandable Filters Bar */}
        {showFilters && (
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-bold text-sm">Filtros</span>
              {(selectedState || selectedKarat || selectedCategory || maxPrice || minPrice || minWeight || maxWeight) && (
                <button
                  onClick={() => { setSelectedState(""); setSelectedKarat(""); setSelectedCategory(""); setMaxPrice(""); setMinPrice(""); setMinWeight(""); setMaxWeight(""); setPage(1); }}
                  className="text-xs text-[#5865F2] hover:text-[#4752C4] font-semibold transition-colors"
                >
                  Limpar todos
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* Estado */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Estado</label>
                <select
                  value={selectedState}
                  onChange={(e) => { setSelectedState(e.target.value); setPage(1); }}
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                >
                  <option value="">Todos</option>
                  {["SP","RJ","MG","RS","PR","BA","GO","DF","PA","SC","PE","CE","MT","ES","AM","RN","PB","AL","RO","PI","MS","MA","SE","TO","AP","RR","AC"].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              {/* Karatagem */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Karatagem</label>
                <select
                  value={selectedKarat}
                  onChange={(e) => { setSelectedKarat(e.target.value); setPage(1); }}
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                >
                  <option value="">Todas</option>
                  <option value="18k">Ouro 18k</option>
                  <option value="14k">Ouro 14k</option>
                  <option value="10k">Ouro 10k</option>
                  <option value="unspecified">Não especificado</option>
                </select>
              </div>

              {/* Tipo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Tipo</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                >
                  <option value="">Todos</option>
                  <option value="Aliança">Aliança ({539})</option>
                  <option value="Anel">Anel ({681})</option>
                  <option value="Brinco">Brinco ({268})</option>
                  <option value="Colar">Colar ({681})</option>
                  <option value="Corrente">Corrente ({40})</option>
                  <option value="Pulseira">Pulseira ({452})</option>
                  <option value="Relógio">Relógio ({90})</option>
                  <option value="Moeda">Moeda ({26})</option>
                  <option value="Barra">Barra ({7})</option>
                  <option value="Jóia">Jóia ({2743})</option>
                </select>
              </div>

              {/* Lance Mín */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Lance Mín (R$)</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                  placeholder="Ex: 1000"
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                />
              </div>

              {/* Lance Máx */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Lance Máx (R$)</label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                  placeholder="Ex: 10000"
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                />
              </div>

              {/* Peso Slider */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">
                  Peso (g) {minWeight || maxWeight ? `— ${minWeight || "0"}g até ${maxWeight || "∞"}g` : ""}
                </label>
                <div className="relative h-6 pt-2">
                  {/* Track background */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-[#272A31] rounded-full" />
                  {/* Active track */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-1 bg-[#EC4899] rounded-full"
                    style={{
                      left: `${((parseFloat(minWeight) || 0) / 700) * 100}%`,
                      right: `${100 - ((parseFloat(maxWeight) || 700) / 700) * 100}%`
                    }}
                  />
                  {/* Min thumb */}
                  <input
                    type="range"
                    min="0"
                    max="700"
                    step="1"
                    value={minWeight || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val <= (parseInt(maxWeight) || 700)) {
                        setMinWeight(val.toString());
                        setPage(1);
                      }
                    }}
                    className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#EC4899]"
                  />
                  {/* Max thumb */}
                  <input
                    type="range"
                    min="0"
                    max="700"
                    step="1"
                    value={maxWeight || 700}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= (parseInt(minWeight) || 0)) {
                        setMaxWeight(val.toString());
                        setPage(1);
                      }
                    }}
                    className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#EC4899]"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#8E9297]">
                  <span>0g</span>
                  <span>700g</span>
                </div>
              </div>

              {/* Ordenar */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                >
                  <option value="bid_end">Encerramento</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="weight_desc">Maior peso</option>
                </select>
              </div>
            </div>

            {/* Active filters */}
            {(selectedState || selectedKarat || selectedCategory || maxPrice || minPrice || minWeight || maxWeight) && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#272A31]">
                {selectedState && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-[#5865F2] text-white px-3 py-1.5 rounded-full font-medium">
                    UF: {selectedState}
                    <button onClick={() => setSelectedState("")} className="hover:text-[#c5c6f0]">×</button>
                  </span>
                )}
                {selectedKarat && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-[#F59E0B] text-white px-3 py-1.5 rounded-full font-medium">
                    {selectedKarat === "unspecified" ? "Não especificado" : selectedKarat}
                    <button onClick={() => setSelectedKarat("")} className="hover:text-[#fcd34d]">×</button>
                  </span>
                )}
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-[#10B981] text-white px-3 py-1.5 rounded-full font-medium">
                    {selectedCategory}
                    <button onClick={() => setSelectedCategory("")} className="hover:text-[#6ee7b7]">×</button>
                  </span>
                )}
                {minPrice && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-[#8B5CF6] text-white px-3 py-1.5 rounded-full font-medium">
                    Mín: R$ {Number(minPrice).toLocaleString('pt-BR')}
                    <button onClick={() => setMinPrice("")} className="hover:text-[#c4b5fd]">×</button>
                  </span>
                )}
                {maxPrice && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-[#8B5CF6] text-white px-3 py-1.5 rounded-full font-medium">
                    Máx: R$ {Number(maxPrice).toLocaleString('pt-BR')}
                    <button onClick={() => setMaxPrice("")} className="hover:text-[#c4b5fd]">×</button>
                  </span>
                )}
                {minWeight && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-[#EC4899] text-white px-3 py-1.5 rounded-full font-medium">
                    Peso: {minWeight}g – {maxWeight || "700"}g
                    <button onClick={() => { setMinWeight(""); setMaxWeight(""); }} className="hover:text-[#f472b6]">×</button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

      </header>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4">
          <div className="text-[#8E9297] text-xs font-bold uppercase mb-1">Total de Lotes</div>
          <div className="text-2xl font-black text-white">{Number(pagination.total).toLocaleString('pt-BR')}</div>
        </div>
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4">
          <div className="text-[#8E9297] text-xs font-bold uppercase mb-1">Menor Lance</div>
          <div className="text-2xl font-black text-[#10B981]">{formatPrice(lots.length > 0 ? Math.min(...lots.map((l: any) => Number(l.valor) || 0)) : null)}</div>
        </div>
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4">
          <div className="text-[#8E9297] text-xs font-bold uppercase mb-1">Maior Lance</div>
          <div className="text-2xl font-black text-white">{formatPrice(lots.length > 0 ? Math.max(...lots.map((l: any) => Number(l.valor) || 0)) : null)}</div>
        </div>
      </div>

      {/* Bulk action bar */}
      {user && (
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-sm text-[#8E9297] hover:text-white transition-colors"
          >
            {selectedIds.size === lots.length && lots.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-[#5865F2]" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Selecionar todos ({lots.length})
          </button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-sm text-[#8E9297]">{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
              <button
                onClick={bulkAddToWatchlist}
                disabled={bulkAction === "adding"}
                className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              >
                {bulkAction === "adding" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Star className="w-4 h-4" />
                )}
                Salvar na Watchlist
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[#8E9297] hover:text-white text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#151A22] rounded-3xl overflow-hidden border border-[#272A31] animate-pulse">
              <div className="aspect-square bg-[#0B0E14]" />
              <div className="p-5 space-y-3"><div className="h-4 bg-[#272A31] rounded w-3/4" /><div className="h-6 bg-[#272A31] rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : lots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {lots.map((lot) => {
            const title = lot.title_enriched || shortTitle(lot.de_contrato, getJewelryType(lot.de_contrato));
            const categoryBadge = lot.category_enriched || getJewelryType(lot.de_contrato);
            const karat = lot.karat_enriched || lot.karat;
            const stateUf = lot.sg_uf;
            const bidEndDate = lot.bid_end;
            const tagFlags = flagsFromTags(lot.tags);
            const activeFlags = flagIcons.filter(f => (lot as any)[f.key] || tagFlags[f.key as keyof typeof tagFlags]);

            return (
              <div
                key={lot.id}
                className="group relative flex flex-col bg-[#151A22] rounded-3xl overflow-hidden border border-[#272A31] hover:border-[#454655] hover:shadow-2xl transition-all"
              >
                {/* Checkbox overlay */}
                {user && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleSelect(lot.id);
                    }}
                    className="absolute top-3 left-3 z-10 p-1 bg-[#0B0E14]/80 rounded-lg backdrop-blur-sm"
                  >
                    {selectedIds.has(lot.id) ? (
                      <CheckSquare className="w-5 h-5 text-[#5865F2]" />
                    ) : (
                      <Square className="w-5 h-5 text-white/60" />
                    )}
                  </button>
                )}
                <Link href={`/lote/${lot.id}`} className="block">
                <div className="aspect-square relative bg-[#0B0E14]">
                  {lot.imagem_capa_url ? (
                    <img src={lot.imagem_capa_url} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : lot.url_imagem_capa ? (
                    <img src={fixImageUrl(lot.url_imagem_capa)} alt={title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 transition-opacity opacity-0" onLoad={(e) => (e.target as HTMLImageElement).style.opacity = '1'} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Gem className="w-16 h-16 text-[#2F3136]" /></div>
                  )}
                  <span className="absolute top-3 left-12 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#5865F2] text-white">{categoryBadge}</span>
                  {bidEndDate && <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold bg-[#0B0E14]/90 text-white"><CountdownTimer endDate={bidEndDate} /></span>}
                </div>
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-[#8E9297]">
                      <MapPin className="w-3 h-3" />
                      {stateUf ?? "—"}
                    </div>
                    {karat && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F59E0B] text-white">
                        {karat}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">{title}</h3>
                  {activeFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeFlags.slice(0, 2).map(f => (
                        <span key={f.key} className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${f.bg}`}>{f.label}</span>
                      ))}
                      {activeFlags.length > 2 && <span className="text-[10px] text-[#8E9297] px-1">+{activeFlags.length - 2}</span>}
                    </div>
                  )}
                  <div className="mt-auto pt-3 border-t border-[#272A31]">
                    <div className="text-[10px] text-[#8E9297] mb-0.5">Lance Inicial</div>
                    <div className="text-xl font-black text-white">{formatPrice(lot.valor)}</div>
                  </div>
                </div>
              </Link>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-[#8E9297] text-lg mb-2">Nenhum lote encontrado</p>
          <button onClick={clearFilters} className="text-[#5865F2] hover:underline text-sm font-semibold">Limpar filtros</button>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white rounded-xl font-semibold disabled:opacity-50">← Anterior</button>
          <span className="text-white text-sm">Página {page} de {pagination.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="px-4 py-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white rounded-xl font-semibold disabled:opacity-50">Próxima →</button>
        </div>
      )}
    </div>
  );
}
