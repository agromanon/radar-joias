"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Flame, Cpu, Tractor, HardDrive, Car, House, Zap, Activity, Wrench, MoreHorizontal, SlidersHorizontal, Clock, MapPin, ChevronDown, X, Filter, AlertCircle, CheckCircle2 } from "lucide-react";

// Constants for price freshness
const FRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Check if price data is considered fresh (within 15 minutes)
 */
function isPriceFresh(lastScrapedAt: string | undefined): boolean {
  if (!lastScrapedAt) return false;

  const now = Date.now();
  const scrapedTime = new Date(lastScrapedAt).getTime();
  const age = now - scrapedTime;

  return age < FRESH_THRESHOLD_MS;
}

/**
 * Extract product name from full title
 * Title format: "Leilão de X - Auctioneer - Product Name - Notes"
 */
function getProductName(fullTitle: string | undefined) {
  if (!fullTitle) return 'Carregando...';

  const parts = fullTitle.split(' - ');
  if (parts.length >= 3) {
    // Product name is the third part, remove notes in parentheses
    const productName = parts[2].replace(/\s*\(Não inclui.*$/, '').trim();
    return productName;
  }
  return fullTitle;
}

type Lot = {
  id: string;
  title: string;
  auctioneer: string;
  current_bid: number;
  image_url: string;
  risk_score: "BAIXO" | "MÉDIO" | "ALTO";
  category: string;
  closing_at: string;
  last_scraped_at?: string;
  location_city?: string;
  location_state?: string;
};

type FiltersResponse = {
  auctioneers: string[];
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get('state');

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(stateParam);

  // Sorting states
  const [sortBy, setSortBy] = useState("closing_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filter states
  const [selectedAuctioneer, setSelectedAuctioneer] = useState<string>("");
  const [selectedRisk, setSelectedRisk] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  useEffect(() => {
    fetchLots();
  }, [page, sortBy, sortOrder, selectedAuctioneer, selectedRisk, selectedState, stateParam]);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        sort: sortBy,
        order: sortOrder,
      });

      if (searchQuery) params.append("search", searchQuery);
      if (selectedAuctioneer) params.append("auctioneer", selectedAuctioneer);
      if (selectedRisk) params.append("risk_score", selectedRisk);
      if (selectedState) params.append("state", selectedState);

      const response = await fetch(`/api/lots?${params}`);
      const data = await response.json();

      setLots(data.lots);
      setPagination({
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      });
      setFilters({ auctioneers: data.filters.auctioneers });
    } catch (error) {
      console.error("Error fetching lots:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "BAIXO": return "bg-[#10B981]";
      case "MÉDIO": return "bg-[#F59E0B]";
      case "ALTO": return "bg-[#EF4444]";
      default: return "bg-[#8E9297]";
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case "BAIXO": return "BAIXO RISCO";
      case "MÉDIO": return "MÉDIO RISCO";
      case "ALTO": return "ALTO RISCO";
      default: return risk;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const CountdownTimer = ({ closingAt }: { closingAt: string }) => {
    const [timeLeft, setTimeLeft] = useState("");
    const [isUrgent, setIsUrgent] = useState(false);
    const [isBlinking, setIsBlinking] = useState(false);

    useEffect(() => {
      const calculateTimeLeft = () => {
        const closing = new Date(closingAt);
        const now = new Date();
        const diff = closing.getTime() - now.getTime();

        if (diff <= 0) {
          return "Encerrado";
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Determine urgency levels
        const totalMinutes = Math.floor(diff / (1000 * 60));
        const newIsUrgent = totalMinutes < 30; // Less than 30 minutes
        const newIsBlinking = totalMinutes < 10; // Less than 10 minutes - blink!

        if (isUrgent !== newIsUrgent) setIsUrgent(newIsUrgent);
        if (isBlinking !== newIsBlinking) setIsBlinking(newIsBlinking);

        // Always show detailed time with seconds
        if (days > 0) {
          return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else if (hours > 0) {
          return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
          return `${minutes}m ${seconds}s`;
        } else {
          return `${seconds}s`;
        }
      };

      setTimeLeft(calculateTimeLeft());
      const interval = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
      }, 1000);

      return () => clearInterval(interval);
    }, [closingAt]);

    return (
      <div className={`flex items-center gap-1.5 text-xs font-medium ${
        timeLeft === "Encerrado"
          ? "text-[#EF4444]"
          : isBlinking
          ? "text-[#EF4444] animate-pulse"
          : isUrgent
          ? "text-[#EF4444]"
          : "text-[#F59E0B]"
      }`}>
        <Clock className={`w-3.5 h-3.5 ${isBlinking ? "animate-ping" : ""}`} />
        <span>{timeLeft}</span>
      </div>
    );
  };

  const categories = [
    { id: "metais", name: "Metais e Sucata", icon: Flame },
    { id: "maquinario", name: "Maquinário", icon: Tractor },
    { id: "eletronicos", name: "Eletrônicos", icon: Cpu },
    { id: "informatica", name: "Informática/TI", icon: HardDrive },
    { id: "automoveis", name: "Automóveis/Frota", icon: Car },
    { id: "imoveis", name: "Imóveis", icon: House },
    { id: "sucata", name: "Sucata Industrial", icon: Zap },
    { id: "equipamento", name: "Equip. Médico", icon: Activity },
    { id: "ferramentas", name: "Ferramentas", icon: Wrench },
  ];
  return (
    <div className="min-h-full p-6 md:p-10 max-w-7xl mx-auto">

      {/* Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowFilters(false)}>
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#272A31]">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#5865F2]" />
                Filtros e Ordenação
              </h2>
              <button onClick={() => setShowFilters(false)} className="p-2 rounded-lg hover:bg-[#2F3136] text-[#8E9297] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Sort */}
              <div>
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
                >
                  <option value="closing_at">⏰ Termina Primeiro</option>
                  <option value="current_bid">💰 Menor Preço</option>
                  <option value="created_at">🆕 Mais Recentes</option>
                  <option value="title">🔤 A-Z</option>
                </select>
              </div>

              {/* Auctioneer Filter */}
              {filters?.auctioneers && filters.auctioneers.length > 0 && (
                <div>
                  <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Leiloeiro</label>
                  <select
                    value={selectedAuctioneer}
                    onChange={(e) => setSelectedAuctioneer(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
                  >
                    <option value="">Todos os leiloeiros</option>
                    {filters.auctioneers.map((auctioneer) => (
                      <option key={auctioneer} value={auctioneer}>{auctioneer}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Risk Score Filter */}
              <div>
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Nível de Risco</label>
                <select
                  value={selectedRisk}
                  onChange={(e) => setSelectedRisk(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
                >
                  <option value="">Todos os níveis</option>
                  <option value="BAIXO">Baixo Risco</option>
                  <option value="MÉDIO">Médio Risco</option>
                  <option value="ALTO">Alto Risco</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(selectedAuctioneer || selectedRisk) && (
                <button
                  onClick={() => {
                    setSelectedAuctioneer("");
                    setSelectedRisk("");
                  }}
                  className="w-full py-3 bg-[#2F3136] hover:bg-[#454655] text-white rounded-xl font-semibold transition-colors"
                >
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-6 border-t border-[#272A31]">
              <button onClick={() => setShowFilters(false)} className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold rounded-xl transition-colors">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Search & Filter Nav */}
      <header className="mb-12 flex flex-col items-center gap-8">

        {/* Pill Search Bar */}
        <div className="w-full max-w-2xl relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[#8E9297]" />
          </div>
          <input
            type="text"
            placeholder="Buscar sucata, tratores, cobre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLots()}
            className="w-full bg-[#151A22] border border-[#272A31] text-white text-lg rounded-full py-4 pl-12 pr-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-shadow placeholder:text-[#8E9297]"
          />
          <button onClick={fetchLots} className="absolute inset-y-2 right-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 rounded-full font-medium transition-colors">
            Buscar
          </button>
        </div>

        {/* Categories (Airbnb Style with Fading Edge) */}
        <div className="w-full relative flex items-center gap-4">
          <div className="flex-1 overflow-x-auto pb-4 hide-scrollbar relative group">
            {/* Fade effect on right */}
            <div className="absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-[#0B0E14] to-transparent pointer-events-none z-10"></div>

            <div className="flex items-center gap-10 px-2 leading-none">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    className="flex flex-col items-center gap-2.5 text-[#8E9297] hover:text-white transition-all group min-w-max"
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-[13px] font-semibold pb-2 border-b-2 border-transparent group-hover:border-[#454655]">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg shrink-0 mb-4 ml-2 relative"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#5865F2]" />
            Filtros
            {(selectedAuctioneer || selectedRisk) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#EF4444] rounded-full border-2 border-[#0B0E14]"></span>
            )}
          </button>
        </div>
      </header>

      <div className="mb-5 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Leilões em Destaque
            <span className="text-[#8E9297] font-normal text-sm ml-2">({pagination.total} lotes)</span>
          </h2>
          <p className="text-[#8E9297] text-xs mt-1">
            Oportunidades validadas pela Inteligência Artificial
          </p>
        </div>

        {/* Sort Indicator */}
        <div className="flex items-center gap-2 text-xs text-[#8E9297]">
          <span>Ordenado por:</span>
          <span className="text-white font-semibold">
            {sortBy === "closing_at" && "⏰ Termina Primeiro"}
            {sortBy === "current_bid" && "💰 Menor Preço"}
            {sortBy === "created_at" && "🆕 Mais Recentes"}
            {sortBy === "title" && "🔤 A-Z"}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col bg-[#151A22] rounded-[24px] overflow-hidden border border-[#272A31] animate-pulse">
              <div className="aspect-[4/3] bg-[#0B0E14]"></div>
              <div className="p-5 space-y-3">
                <div className="h-3 bg-[#272A31] rounded"></div>
                <div className="h-4 bg-[#272A31] rounded w-3/4"></div>
                <div className="h-8 bg-[#272A31] rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Grid of Lots */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {lots.map((lot) => {
              const productName = getProductName(lot.title);
              return (
                <Link
                  key={lot.id}
                  href={`/lote/${lot.id}`}
                  className="group flex flex-col bg-[#151A22] rounded-[24px] overflow-hidden border border-[#272A31] hover:border-[#454655] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-300"
                >
                  {/* Image Box */}
                  <div className="aspect-[4/3] w-full relative overflow-hidden bg-[#0B0E14] p-2">
                    <img
                      src={lot.image_url || "https://images.unsplash.com/photo-1558222218-b7b54eede3f3?auto=format&fit=crop&q=80&w=800"}
                      alt={productName}
                      className="w-full h-full object-cover rounded-[16px] group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  </div>

                  {/* Content Box */}
                  <div className="p-5 flex flex-col flex-1">
                    {/* Badges - Now between image and content */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {/* Risk Badge */}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm ${getRiskColor(lot.risk_score)}`}>
                        {getRiskLabel(lot.risk_score)}
                      </span>

                      {/* Auctioneer Badge */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#5865F2] text-white shadow-md hover:bg-[#4752C4] transition-colors">
                        <MapPin className="w-3 h-3" />
                        {lot.auctioneer}
                      </span>
                    </div>

                    {/* Location */}
                    {(lot.location_city || lot.location_state) && (
                      <div className="mb-2 text-[10px] text-[#8E9297] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {lot.location_city}
                        {lot.location_city && lot.location_state && ", "}
                        {lot.location_state}
                      </div>
                    )}

                    <h3 className="text-sm font-semibold text-white mb-3 line-clamp-2 leading-snug">
                      {productName}
                    </h3>

                  {/* Countdown Timer */}
                  {lot.closing_at && <CountdownTimer closingAt={lot.closing_at} />}

                  <div className="mt-auto space-y-3">
                    {/* Price Section with top padding */}
                    <div className="pt-3 space-y-1">
                      {/* Price Label */}
                      <div className="text-xs text-[#8E9297] flex items-center gap-1.5">
                        Lance
                        {lot.last_scraped_at && (
                          isPriceFresh(lot.last_scraped_at) ? (
                            <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-[#F59E0B]" />
                          )
                        )}
                      </div>

                      {/* Price with Warning Badge */}
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-white tracking-tight tabular-nums">
                          {formatPrice(lot.current_bid)}
                        </div>
                        {lot.last_scraped_at && !isPriceFresh(lot.last_scraped_at) && (
                          <div className="text-[9px] text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded shrink-0">
                            pode mudar
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Compact Details Button */}
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

          {/* No Results */}
          {!loading && lots.length === 0 && (
            <div className="text-center py-20">
              <p className="text-[#8E9297] text-lg mb-2">Nenhum lote encontrado</p>
              <p className="text-[#454655] text-sm">Tente ajustar seus filtros ou busca</p>
            </div>
          )}
        </>
      )}

    </div>
  );
}
