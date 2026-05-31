"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Trash2, MapPin, Clock, Gem, ExternalLink, Download, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { exportWatchlistToPDF } from "@/lib/pdf-export";

// CAIXA changed image URL base from /vitrinedejoias to /vitrinearquivos/fotos
function fixImageUrl(url: string): string {
  if (url.includes('servicebus2.caixa.gov.br/vitrinedejoias/')) {
    return url.replace('servicebus2.caixa.gov.br/vitrinedejoias/', 'servicebus2.caixa.gov.br/vitrinearquivos/fotos/');
  }
  return url;
}

type WatchlistItem = {
  id: string;
  created_at: string;
  notes?: string | null;
  lots: {
    id: number;
    lot_number: any;
    de_contrato: any;
    valor: any;
    url_imagem_capa: any;
    imagem_capa_url: string | null;
    sg_uf: any;
    co_leilao: any;
    peso_lote: any;
    karat?: string;
    outcome_status: any;
    cities?: { name: any; states?: any };
  };
};

function formatPrice(price: number | null): string {
  if (!price) return "R$ --";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(price);
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const { user } = useUser();

  useEffect(() => {
    if (user) fetchWatchlist();
  }, [user]);

  const fetchWatchlist = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("watchlist")
        .select(`id, created_at, notes, lots(id, lot_number, de_contrato, valor, url_imagem_capa, imagem_capa_url, sg_uf, co_leilao, peso_lote, outcome_status, cities(name, states(uf)))`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWatchlist((data || []) as any);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchlist = async (lotId: number) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("lot_id", lotId);

      if (!error) {
        setWatchlist(prev => prev.filter(item => item.lots.id !== lotId));
      }
    } catch (error) {
      console.error("Error removing from watchlist:", error);
    }
  };

  const handleExportPDF = async () => {
    if (watchlist.length === 0) return;
    setExporting("pdf");
    try {
      const items = watchlist.map(item => ({
        id: item.lots.id,
        de_contrato: item.lots.de_contrato,
        lot_number: item.lots.lot_number,
        karat: item.lots.karat,
        peso_lote: item.lots.peso_lote,
        valor: item.lots.valor,
        sg_uf: item.lots.sg_uf,
        co_leilao: item.lots.co_leilao,
      }));
      await exportWatchlistToPDF(items);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportCSV = () => {
    if (watchlist.length === 0) return;
    setExporting("csv");
    try {
      const headers = ["Lote", "Descrição", "Karatagem", "Peso", "Lance Inicial", "Estado", "Leilão", "Data de Salvamento"];
      const rows = watchlist.map(item => [
        item.lots.lot_number || item.lots.id,
        item.lots.de_contrato || "Joia",
        item.lots.karat || "",
        item.lots.peso_lote || "",
        item.lots.valor || "",
        item.lots.sg_uf || "",
        item.lots.co_leilao || "",
        new Date(item.created_at).toLocaleDateString("pt-BR"),
      ]);
      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "radar-joias-watchlist.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-full p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Star className="w-6 h-6 text-[#F59E0B]" fill="#F59E0B" /> Meus Lotes Salvos
        </h1>
        <p className="text-[#8E9297] text-sm mt-1">
          {watchlist.length} lote{watchlist.length !== 1 ? "s" : ""} na sua watchlist
          {watchlist.length > 0 && (
            <div className="ml-auto inline-flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={!!exporting}
                className="inline-flex items-center gap-1.5 text-[#5865F2] hover:text-[#4752C4] font-semibold transition-colors text-sm disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting === "csv" ? "Gerando..." : "CSV"}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={!!exporting}
                className="inline-flex items-center gap-1.5 text-[#5865F2] hover:text-[#4752C4] font-semibold transition-colors text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {exporting === "pdf" ? "Gerando..." : "PDF"}
              </button>
            </div>
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5865F2] border-t-transparent" />
        </div>
      ) : watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Gem className="w-14 h-14 text-[#272A31] mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Nenhum lote salvo ainda</h2>
          <p className="text-[#8E9297] text-sm mb-6 max-w-xs">
            Navegue pelos lotes e clique na estrela para salvar os que te interessam.
          </p>
          <Link
            href="/leiloes"
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-full font-bold transition-colors text-sm shadow-lg shadow-[#5865F2]/20"
          >
            Explorar Lotes
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {watchlist.map((item) => {
            const lot = item.lots;
            const cityName = (lot.cities as any)?.name;
            const stateUf = (lot.cities as any)?.states?.uf ?? lot.sg_uf;

            return (
              <div
                key={item.id}
                className="group flex gap-5 bg-[#151A22] border border-[#272A31] hover:border-[#454655] rounded-2xl p-4 transition-all duration-200"
              >
                {/* Thumbnail */}
                <div className="w-28 md:w-36 aspect-square flex-shrink-0 rounded-xl overflow-hidden bg-[#0B0E14]">
                  {lot.imagem_capa_url ? (
                    <img
                      src={lot.imagem_capa_url}
                      alt={String(lot.de_contrato || "Jóia")}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : lot.url_imagem_capa ? (
                    <img
                      src={fixImageUrl(lot.url_imagem_capa)}
                      alt={String(lot.de_contrato || "Jóia")}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gem className="w-10 h-10 text-[#2F3136]" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wider mb-1">
                          Leilão {lot.co_leilao} · Lote {lot.lot_number}
                        </p>
                        <h2 className="text-white font-bold text-sm md:text-base leading-snug line-clamp-2">
                          {lot.de_contrato ?? "Jóia"}
                        </h2>
                      </div>
                      {lot.outcome_status && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex-shrink-0 ${
                          lot.outcome_status === "VENDIDO" ? "bg-[#10B981]" :
                          lot.outcome_status === "ARREMATADO" ? "bg-[#10B981]" :
                          lot.outcome_status === "CANCELADO" ? "bg-[#EF4444]" :
                          "bg-[#5865F2]"
                        }`}>
                          {lot.outcome_status}
                        </span>
                      )}
                    </div>

                    {/* Location */}
                    {cityName && (
                      <div className="flex items-center gap-1.5 mt-2 text-[#8E9297] text-xs">
                        <MapPin className="w-3.5 h-3.5 text-[#5865F2]" />
                        {cityName}, {stateUf}
                      </div>
                    )}

                    {/* Weight */}
                    {lot.peso_lote && (
                      <div className="flex items-center gap-1.5 mt-1 text-[#8E9297] text-xs">
                        <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                        {lot.peso_lote}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
                    <div>
                      <p className="text-[#8E9297] text-[10px]">Lance Inicial</p>
                      <p className="text-white font-bold text-base tabular-nums">{formatPrice(lot.valor)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[#454655] text-[10px] hidden sm:block">
                        Salvo {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>

                      <Link
                        href={`/lote/${lot.id}`}
                        className="flex items-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-md shadow-[#5865F2]/20"
                      >
                        Ver Detalhes
                      </Link>

                      <a
                        href="https://vitrinedejoias.caixa.gov.br/Paginas/Busca.aspx"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#454655] text-[#8E9297] hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => removeFromWatchlist(lot.id)}
                        className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#EF4444]/40 text-[#8E9297] hover:text-[#EF4444] px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}