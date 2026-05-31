"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Clock, MapPin, ChevronDown, X, Filter, CheckCircle2, AlertCircle, Gem } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { GemIcon } from "lucide-react";

// Types
type Lot = {
  id: number;
  lot_number: any;
  contract_number: any;
  de_contrato: any;
  peso_lote: any;
  valor: any;
  url_imagem_capa: any;
  url_imagem_frente: any;
  url_imagem_verso: any;
  imagem_capa_url?: string | null;
  pickup_location: any;
  sg_uf: any;
  co_leilao: any;
  outcome_status: any;
  winning_bid_value: any;
  centralizer_name: any;
  city_id: any;
  cities?: any;
};

type State = {
  uf: any;
};

type City = {
  id: any;
  name: any;
  caixa_city_code?: any;
  states?: any;
};

// Jewelry categories
const CATEGORIES = [
  { id: "ouro_18k", name: "Ouro 18k", icon: Gem },
  { id: "ouro_14k", name: "Ouro 14k", icon: Gem },
  { id: "prata", name: "Prata", icon: Gem },
  { id: "alianca", name: "Aliança", icon: Gem },
  { id: "colar", name: "Colar", icon: Gem },
  { id: "brinco", name: "Brinco", icon: Gem },
  { id: "anel", name: "Anel", icon: Gem },
  { id: "pulseira", name: "Pulseira", icon: Gem },
];

// Extract jewelry type from description
function getJewelryType(description: string | null): string {
  if (!description) return "Joia";
  const d = description.toLowerCase();
  if (d.includes("aliança")) return "Aliança";
  if (d.includes("colar")) return "Colar";
  if (d.includes("brinco")) return "Brinco";
  if (d.includes("anel")) return "Anel";
  if (d.includes("pulseira")) return "Pulseira";
  if (d.includes("ouro 18")) return "Ouro 18k";
  if (d.includes("ouro 14")) return "Ouro 14k";
  if (d.includes("prata")) return "Prata";
  return "Joia";
}

function formatPrice(price: number | null): string {
  if (!price) return "R$ --";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(price);
}

// Countdown to bid end date
function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculate = () => {
      const end = new Date(endDate);
      const now = new Date();
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) return "Encerrado";

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setIsUrgent(diff < 1000 * 60 * 60 * 24); // < 24h

      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    };

    setTimeLeft(calculate());
    const interval = setInterval(() => setTimeLeft(calculate()), 60_000);
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${
      timeLeft === "Encerrado" ? "text-[#EF4444]" : isUrgent ? "text-[#F59E0B]" : "text-[#8E9297]"
    }`}>
      <Clock className="w-3.5 h-3.5" />
      <span>{timeLeft || "..."}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("valor");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  const supabase = createClient();

  // Fetch states on mount
  useEffect(() => {
    fetchStates();
    fetchLots();
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    setPage(1);
    fetchLots();
  }, [selectedState, selectedCity, sortBy, sortOrder, selectedCategory, searchQuery]);

  async function fetchStates() {
    const { data } = await supabase.from("states").select("uf").order("uf");
    if (data) setStates(data);
  }

  async function fetchCities() {
    if (!selectedState) { setCities([]); return; }
    const { data } = await supabase
      .from("cities")
      .select("id, name, states:states!inner(uf)")
      .eq("states.uf", selectedState)
      .order("name");
    if (data) setCities(data as City[]);
  }

  useEffect(() => { fetchCities(); }, [selectedState]);

  async function fetchLots() {
    setLoading(true);
    try {
      let query = supabase
        .from("lots")
        .select(`
          id, lot_number, contract_number, de_contrato, peso_lote, valor,
          url_imagem_capa, url_imagem_frente, url_imagem_verso, imagem_capa_url,
          pickup_location, sg_uf, co_leilao, outcome_status,
          winning_bid_value, centralizer_name, city_id,
          cities(name, states(uf))
        `, { count: "exact" })
        .is("outcome_status", null) // only active (not yet sold/closed)
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      // Text search
      if (searchQuery) {
        query = query.ilike("de_contrato", `%${searchQuery}%`);
      }

      // State filter
      if (selectedState) {
        query = query.eq("sg_uf", selectedState);
      }

      // City filter
      if (selectedCity) {
        const cityId = parseInt(selectedCity);
        query = query.eq("city_id", cityId);
      }

      // Category filter (jewelry type from description)
      if (selectedCategory) {
        query = query.ilike("de_contrato", `%${selectedCategory}%`);
      }

      // Sort
      const ascending = sortOrder === "asc";
      if (sortBy === "valor") query = query.order("valor", { ascending });
      else if (sortBy === "peso") query = query.order("peso_lote", { ascending });
      else query = query.order("last_seen_at", { ascending: false });

      const { data, count, error } = await query;

      if (error) {
        console.error("Error fetching lots:", error);
      } else {
        setLots(data ?? []);
        setPagination({
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setSelectedState("");
    setSelectedCity("");
    setSelectedCategory("");
    setSearchQuery("");
  }

  return (
    <div className="min-h-full p-6 md:p-10 max-w-7xl mx-auto">

      {/* Filters Modal */}
      {showFilters && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="bg-[#151A22] border border-[#272A31] rounded-3xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-[#272A31]">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#5865F2]" />
                Filtros
              </h2>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 rounded-lg hover:bg-[#2F3136] text-[#8E9297] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Estado (UF)</label>
                <select
                  value={selectedState}
                  onChange={(e) => { setSelectedState(e.target.value); setSelectedCity(""); }}
                  className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
                >
                  <option value="">Todos os estados</option>
                  {states.map((s) => (
                    <option key={s.uf} value={s.uf}>{s.uf}</option>
                  ))}
                </select>
              </div>

              {selectedState && (
                <div>
                  <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Cidade</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
                  >
                    <option value="">Todas as cidades</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
                >
                  <option value="valor">Menor Lance</option>
                  <option value="peso">Peso</option>
                  <option value="last_seen">Mais Recentes</option>
                </select>
              </div>

              {(selectedState || selectedCity || selectedCategory) && (
                <button
                  onClick={clearFilters}
                  className="w-full py-3 bg-[#2F3136] hover:bg-[#454655] text-white rounded-xl font-semibold transition-colors"
                >
                  Limpar Filtros
                </button>
              )}
            </div>

            <div className="flex items-center justify-end p-6 border-t border-[#272A31]">
              <button
                onClick={() => { fetchLots(); setShowFilters(false); }}
                className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold rounded-xl transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <header className="mb-12 flex flex-col items-center gap-8">
        <div className="w-full max-w-2xl relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[#8E9297]" />
          </div>
          <input
            type="text"
            placeholder="Buscar ouro, aliança, colar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLots()}
            className="w-full bg-[#151A22] border border-[#272A31] text-white text-lg rounded-full py-4 pl-12 pr-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-shadow placeholder:text-[#8E9297]"
          />
          <button
            onClick={fetchLots}
            className="absolute inset-y-2 right-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 rounded-full font-medium transition-colors"
          >
            Buscar
          </button>
        </div>

        {/* State quick filters */}
        <div className="w-full overflow-x-auto pb-4 hide-scrollbar">
          <div className="flex items-center gap-2 px-2">
            <button
              onClick={() => { setSelectedState(""); setSelectedCity(""); }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors shrink-0 ${
                !selectedState ? "bg-[#5865F2] text-white" : "bg-[#151A22] border border-[#272A31] text-[#8E9297] hover:text-white"
              }`}
            >
              Todas
            </button>
            {states.slice(0, 10).map((s) => (
              <button
                key={s.uf}
                onClick={() => { setSelectedState(s.uf); setSelectedCity(""); }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors shrink-0 ${
                  selectedState === s.uf ? "bg-[#5865F2] text-white" : "bg-[#151A22] border border-[#272A31] text-[#8E9297] hover:text-white"
                }`}
              >
                {s.uf}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Lotes em Destaque
            <span className="text-[#8E9297] font-normal text-sm ml-2">({pagination.total} lotes)</span>
          </h2>
          <p className="text-[#8E9297] text-xs mt-1">
            Leilões da Vitrine de Joias CAIXA — atualizados diariamente
          </p>
        </div>

        <button
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg"
        >
          <SlidersHorizontal className="w-4 h-4 text-[#5865F2]" />
          Filtros
          {(selectedState || selectedCity) && (
            <span className="w-2 h-2 bg-[#EF4444] rounded-full"></span>
          )}
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col bg-[#151A22] rounded-[24px] overflow-hidden border border-[#272A31] animate-pulse">
              <div className="aspect-square bg-[#0B0E14]"></div>
              <div className="p-5 space-y-3">
                <div className="h-3 bg-[#272A31] rounded w-1/2"></div>
                <div className="h-4 bg-[#272A31] rounded w-3/4"></div>
                <div className="h-6 bg-[#272A31] rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Grid */}
          {lots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {lots.map((lot) => {
                const jewelryType = getJewelryType(lot.de_contrato);
                const cityName = (lot.cities as any)?.name;
                const stateUf = (lot.cities as any)?.states?.uf ?? lot.sg_uf;

                return (
                  <Link
                    key={lot.id}
                    href={`/lote/${lot.id}`}
                    className="group flex flex-col bg-[#151A22] rounded-[24px] overflow-hidden border border-[#272A31] hover:border-[#454655] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-300"
                  >
                    {/* Image */}
                    <div className="aspect-square w-full relative overflow-hidden bg-[#0B0E14]">
                      {lot.imagem_capa_url ? (
                        <img
                          src={lot.imagem_capa_url}
                          alt={lot.de_contrato ?? jewelryType}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : lot.url_imagem_capa ? (
                        <img
                          src={lot.url_imagem_capa}
                          alt={lot.de_contrato ?? jewelryType}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Gem className="w-16 h-16 text-[#2F3136]" />
                        </div>
                      )}

                      {/* Jewelry type badge */}
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#5865F2] text-white shadow-md">
                        {jewelryType}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      {/* Location */}
                      <div className="flex items-center gap-1 mb-2 text-[10px] text-[#8E9297]">
                        <MapPin className="w-3 h-3" />
                        {cityName ?? "—"} {stateUf ? `, ${stateUf}` : ""}
                      </div>

                      {/* Description */}
                      <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2 leading-snug">
                        {lot.de_contrato ?? jewelryType}
                      </h3>

                      {/* Weight */}
                      {lot.peso_lote && (
                        <p className="text-xs text-[#8E9297] mb-3">{lot.peso_lote}</p>
                      )}

                      <div className="mt-auto space-y-3">
                        {/* Price */}
                        <div className="pt-3 border-t border-[#272A31]">
                          <div className="text-xs text-[#8E9297] mb-1">Lance Inicial</div>
                          <div className="text-xl font-bold text-white tracking-tight">
                            {formatPrice(lot.valor)}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#272A31]">
                          <span className="block text-center bg-[#5865F2] hover:bg-[#4752C4] text-white py-1.5 rounded-lg text-xs font-semibold transition-colors">
                            Ver Detalhes
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-[#8E9297] text-lg mb-2">Nenhum lote encontrado</p>
              <p className="text-[#454655] text-sm mb-4">Tente ajustar os filtros ou buscar outro termo</p>
              <button
                onClick={clearFilters}
                className="text-[#5865F2] hover:underline text-sm font-semibold"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-white text-sm">
                Página {page} de {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-4 py-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}