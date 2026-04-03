"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Target, Plus, Trash2, MapPin, BellRing, Eye, Gavel, Clock, AlertCircle, X } from "lucide-react";
import { useWatchlist } from "@/contexts/WatchlistContext";

type WatchlistItem = {
  id: string;
  created_at: string;
  notes?: string | null;
  lots: {
    id: string;
    title: string;
    auctioneer: string;
    current_bid: number;
    image_url: string;
    risk_score: "BAIXO" | "MÉDIO" | "ALTO";
    category: string;
    closing_at: string;
    location_city?: string;
    location_state?: string;
    source_url?: string;
  };
};

export default function SmartAlertsPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshCount } = useWatchlist();

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const response = await fetch("/api/watchlist");
      const data = await response.json();

      if (response.ok) {
        setWatchlist(data.watchlist || []);
      } else {
        console.error("Error fetching watchlist:", data.error);
      }
    } catch (error) {
      console.error("Error fetching watchlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchlist = async (lotId: string) => {
    try {
      const response = await fetch(`/api/watchlist/${lotId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from local state
        setWatchlist(prev => prev.filter(item => item.lots.id !== lotId));
        // Refresh sidebar count
        refreshCount();
      } else {
        const data = await response.json();
        alert(`Erro ao remover: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      alert('Erro ao remover lote dos alertas');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getProductName = (fullTitle: string | undefined) => {
    if (!fullTitle) return 'Carregando...';

    const parts = fullTitle.split(' - ');
    if (parts.length >= 3) {
      const productName = parts[2].replace(/\s*\(Não inclui.*$/, '').trim();
      return productName;
    }
    return fullTitle;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "BAIXO": return "bg-[#10B981]";
      case "MÉDIO": return "bg-[#F59E0B]";
      case "ALTO": return "bg-[#EF4444]";
      default: return "bg-[#8E9297]";
    }
  };

  return (
    <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Target className="w-8 h-8 text-[#5865F2]" />
            Meus Alertas
          </h1>
          <p className="text-[#8E9297] mt-2 text-lg">
            Acompanhe os lotes que você salvou e receba notificações
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5865F2] border-t-transparent"></div>
        </div>
      ) : watchlist.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20">
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-12">
            <BellRing className="w-16 h-16 text-[#8E9297] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Nenhum alerta salvo</h2>
            <p className="text-[#8E9297] mb-6">
              Clique no botão "Adicionar aos Alertas" em qualquer lote para começar a acompanhar
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-full font-semibold transition-all"
            >
              Explorar Lotes
            </Link>
          </div>
        </div>
      ) : (
        /* Watchlist Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlist.map((item) => {
            const lot = item.lots;
            const productName = getProductName(lot.title);

            return (
              <div
                key={item.id}
                className="bg-[#151A22] border border-[#272A31] rounded-3xl overflow-hidden hover:border-[#454655] transition-all group"
              >
                {/* Lot Image */}
                <Link href={`/lote/${lot.id}`} className="block relative aspect-[4/3] overflow-hidden bg-[#0B0E14]">
                  <img
                    src={lot.image_url || "https://images.unsplash.com/photo-1558222218-b7b54eede3f3?auto=format&fit=crop&q=80&w=800"}
                    alt={productName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 bg-[#10B981] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <Eye className="w-4 h-4" /> Monitorando
                  </div>
                </Link>

                {/* Lot Details */}
                <div className="p-5">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm ${getRiskColor(lot.risk_score)}`}>
                      {lot.risk_score === "BAIXO" ? "Baixo Risco" : lot.risk_score === "MÉDIO" ? "Médio Risco" : "Alto Risco"}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#5865F2] text-white shadow-sm">
                      <Gavel className="w-3 h-3" />
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

                  {/* Title */}
                  <Link href={`/lote/${lot.id}`}>
                    <h3 className="text-sm font-semibold text-white mb-3 line-clamp-2 leading-snug hover:text-[#5865F2] transition-colors">
                      {productName}
                    </h3>
                  </Link>

                  {/* Countdown Timer */}
                  <div className="mb-3 text-[11px] text-[#F59E0B] font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <CountdownTimer closingAt={lot.closing_at} />
                  </div>

                  {/* Price & Actions */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] text-[#8E9297] mb-0.5">Lance Atual</div>
                      <div className="text-lg font-bold text-white tracking-tight tabular-nums">
                        {formatPrice(lot.current_bid)}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromWatchlist(lot.id)}
                      className="h-10 w-10 bg-[#2F3136] hover:bg-[#EF4444] hover:text-white rounded-full text-[#8E9297] hover:text-white flex items-center justify-center transition-all shrink-0"
                      title="Remover dos alertas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* View Details Button */}
                  <Link
                    href={lot.source_url || `/lote/${lot.id}`}
                    target={lot.source_url ? "_blank" : undefined}
                    rel={lot.source_url ? "noopener noreferrer" : undefined}
                    className="block w-full mt-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-2.5 rounded-xl text-sm font-semibold transition-all text-center shadow-[0_4px_14px_0_rgba(88,101,242,0.39)]"
                  >
                    Ver Lote Original
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Countdown Timer Component
function CountdownTimer({ closingAt }: { closingAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

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

      if (days > 0) {
        return `${days}d ${hours}h`;
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

  return <span className={timeLeft === "Encerrado" ? "text-[#EF4444]" : ""}>{timeLeft}</span>;
}
