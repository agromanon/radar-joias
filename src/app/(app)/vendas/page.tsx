"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, MapPin, X, Filter, Gem, TrendingUp, BarChart3, Download, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase";

// CAIXA changed image URL base from /vitrinedejoias to /vitrinearquivos/fotos
function fixImageUrl(url: string): string {
  if (url.startsWith('/')) {
    return `https://servicebus2.caixa.gov.br/vitrinearquivos/fotos${url}`;
  }
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
  valor_venda: number;
  winning_bid_value: number;
  url_imagem_capa: string;
  imagem_capa_url: string | null;
  sg_uf: string;
  co_leilao: string;
  centralizer_name: string;
  cities?: any;
  auctions?: any;
  was_sold: boolean;
  outcome_status: string;
  karat?: string;
  category?: string;
  title_enriched?: string | null;
  description_enriched?: string | null;
  karat_enriched?: string | null;
  category_enriched?: string | null;
  weight_enriched?: number | null;
  tags?: string[] | null;
};

function formatPrice(price: number | null | undefined): string {
  if (!price || Number.isNaN(price)) return "R$ --";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
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

export default function VendasPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedKarat, setSelectedKarat] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("result_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ totalSold: 0, avgPrice: 0, totalRevenue: 0 });
  const [marketStats, setMarketStats] = useState<{median: number, min: number, max: number, count: number} | null>(null);

  useEffect(() => {
    fetchLots();
  }, [selectedState, selectedKarat, sortBy, sortOrder, minPrice, maxPrice, searchQuery, page]);

  const paramsRef = useRef<string>("");

  async function fetchLots() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('vendas', 'true');
      params.set('page', page.toString());
      params.set('limit', PAGE_SIZE.toString());
      params.set('sort', sortBy === 'price' ? 'winning_bid_value' : 'first_seen_at');
      params.set('order', sortBy === 'price' ? (sortOrder === 'asc' ? 'asc' : 'desc') : 'desc');
      if (searchQuery) params.set('search', searchQuery);
      if (selectedState) params.set('state', selectedState);
      if (selectedKarat) params.set('karat', selectedKarat);
      if (minPrice) params.set('min_bid', minPrice);
      if (maxPrice) params.set('max_bid', maxPrice);

      const urlString = params.toString();
      paramsRef.current = urlString;
      const res = await fetch(`/api/lots?${urlString}`, { cache: 'no-store' });
      const result = await res.json();
      if (paramsRef.current !== urlString) return;
      if (!res.ok) {
        console.error("Error:", result);
      } else {
        setLots(result.lots ?? []);
        setPagination(result.pagination ?? { total: 0, totalPages: 1 });
      }
    } catch (error: any) {
      console.error("Error fetching lots:", error.message);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setSelectedState("");
    setSelectedKarat("");
    setMinPrice("");
    setMaxPrice("");
    setSearchQuery("");
  }

  return (
    <div className="min-h-full p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">Vendas Realizadas</h1>
            <p className="text-[#8E9297] text-sm">Inteligência de mercado — preços de fechamento por categoria, localização e leilão</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8E9297]" />
            <input
              type="text"
              placeholder="Buscar por descrição, lote, leilão..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#151A22] border border-[#272A31] text-white rounded-full py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all ${showFilters ? 'bg-[#5865F2] text-white' : 'bg-[#151A22] border border-[#272A31] text-white hover:bg-[#2F3136]'}`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            {showFilters ? 'Fechar' : 'Filtros'}
            {(selectedState || selectedKarat) && (
              <span className="w-2 h-2 rounded-full bg-[#5865F2]"></span>
            )}
          </button>
        </div>

        {/* Expandable Filters Bar */}
        {showFilters && (
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-bold text-sm">Filtros</span>
              {(selectedState || selectedKarat || minPrice || maxPrice) && (
                <button
                  onClick={() => { setSelectedState(""); setSelectedKarat(""); setMinPrice(""); setMaxPrice(""); setPage(1); }}
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
                  <option value="12k">Ouro 12k</option>
                  <option value="10k">Ouro 10k</option>
                  <option value="unspecified">Não especificado</option>
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
                  placeholder="Ex: 50000"
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                />
              </div>

              {/* Ordenar */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                >
                  <option value="date">Data de venda</option>
                  <option value="price">Preço de venda</option>
                </select>
              </div>

              {/* Direção */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wide">Direção</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="bg-[#0B0E14] border border-[#272A31] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2] transition-all hover:border-[#454655]"
                >
                  <option value="desc">Maior</option>
                  <option value="asc">Menor</option>
                </select>
              </div>
            </div>

            {/* Active filters */}
            {(selectedState || selectedKarat || minPrice || maxPrice) && (
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
              </div>
            )}
          </div>
        )}

      </header>

      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-[#151A22] to-[#1a2030] border border-[#272A31] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-[#5865F2]" />
            <span className="text-[#8E9297] text-xs font-bold uppercase">Total Vendido</span>
          </div>
          <div className="text-3xl font-black text-white">{pagination.total.toLocaleString("pt-BR")} lotes</div>
        </div>
        <div className="bg-gradient-to-br from-[#151A22] to-[#1a2030] border border-[#272A31] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#10B981]" />
            <span className="text-[#8E9297] text-xs font-bold uppercase">Preço Médio</span>
          </div>
          <div className="text-3xl font-black text-[#10B981]">{formatPrice(stats.avgPrice)}</div>
        </div>
        <div className="bg-gradient-to-br from-[#151A22] to-[#1a2030] border border-[#272A31] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-[#8E9297] text-xs font-bold uppercase">Receita Total</span>
          </div>
          <div className="text-3xl font-black text-[#F59E0B]">{formatPrice(stats.totalRevenue)}</div>
        </div>
      </div>

      {/* Market Stats from get_market_stats RPC */}
      {selectedKarat && marketStats && (
        <div className="bg-[#151A22] border border-[#5865F2]/30 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-[#5865F2]" />
            <h3 className="text-white font-bold">Referência de Preço — {selectedKarat}</h3>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-[#8E9297] text-xs mb-1">Mínimo</div>
              <div className="text-white font-bold">{formatPrice(marketStats.min)}</div>
            </div>
            <div>
              <div className="text-[#8E9297] text-xs mb-1">Mediana</div>
              <div className="text-[#5865F2] font-black text-lg">{formatPrice(marketStats.median)}</div>
            </div>
            <div>
              <div className="text-[#8E9297] text-xs mb-1">Máximo</div>
              <div className="text-white font-bold">{formatPrice(marketStats.max)}</div>
            </div>
            <div>
              <div className="text-[#8E9297] text-xs mb-1">Amostras</div>
              <div className="text-white font-bold">{Number(marketStats.count).toLocaleString('pt-BR')}</div>
            </div>
          </div>
          <p className="text-[#8E9297] text-xs mt-3">Baseado em {Number(marketStats.count).toLocaleString('pt-BR')} vendas de {selectedKarat} no banco de dados. Use como referência para seus lances.</p>
          <p className="text-[#454655] text-[9px] mt-2 leading-relaxed">* Dados históricos meramente informativos. Não constitui orientação de investimento. Decisão de lance é de responsabilidade exclusiva do licitante.</p>
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
            const jewelryType = getJewelryType(lot.de_contrato);
            const stateUf = lot.sg_uf;
            const auction = (lot.auctions as any);
            const resultDate = auction?.result_date;
            const finalPrice = lot.winning_bid_value || lot.valor_venda;
            const originalPrice = lot.valor;
            const priceDiff = finalPrice && originalPrice ? ((finalPrice - originalPrice) / originalPrice * 100) : 0;
            const title = lot.title_enriched || lot.de_contrato || jewelryType;

            return (
              <Link
                key={lot.id}
                href={`/lote/${lot.id}`}
                className="group flex flex-col bg-[#151A22] rounded-3xl overflow-hidden border border-[#272A31] hover:border-[#454655] hover:shadow-2xl transition-all"
              >
                <div className="aspect-square relative bg-[#0B0E14]">
                  {lot.imagem_capa_url ? (
                    <img src={lot.imagem_capa_url} alt={lot.de_contrato ?? jewelryType} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : lot.url_imagem_capa ? (
                    <img src={fixImageUrl(lot.url_imagem_capa)} alt={lot.de_contrato ?? jewelryType} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Gem className="w-16 h-16 text-[#2F3136]" /></div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#10B981] text-white">{jewelryType}</span>
                  {resultDate && (
                    <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold bg-[#0B0E14]/90 text-[#8E9297]">
                      {formatDate(resultDate)}
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-1 text-[10px] text-[#8E9297] mb-2">
                    <MapPin className="w-3 h-3" />
                    {stateUf ?? "—"}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2 leading-snug">{title}</h3>
                  {lot.karat && <p className="text-xs text-[#8E9297] mb-1">{lot.karat} · {lot.peso_lote}</p>}
                  <div className="mt-auto pt-3 border-t border-[#272A31] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#8E9297]">Lance Inicial</span>
                      <span className="text-sm text-[#8E9297]">{formatPrice(originalPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#8E9297]">Vendido por</span>
                      <span className="text-lg font-black text-[#10B981]">{formatPrice(finalPrice)}</span>
                    </div>
                    {priceDiff !== 0 && (
                      <div className={`text-xs font-bold ${priceDiff > 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                        {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}% vs inicial
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-[#8E9297] text-lg mb-2">Nenhuma venda encontrada</p>
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
