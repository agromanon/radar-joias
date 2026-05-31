"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Star, Trash2, MapPin, Clock, Gem, ExternalLink, Users, Lock, Globe, Copy, Check, Square, CheckSquare, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/useUser";

function fixImageUrl(url: string): string {
  if (url.includes('servicebus2.caixa.gov.br/vitrinedejoias/')) {
    return url.replace('servicebus2.caixa.gov.br/vitrinedejoias/', 'servicebus2.caixa.gov.br/vitrinearquivos/fotos/');
  }
  return url;
}

type SharedWatchlistItem = {
  id: string;
  notes: string | null;
  created_at: string;
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

export default function SharedWatchlistPage() {
  const params = useParams();
  const shareCode = params.shareCode as string;
  const { user } = useUser();

  const [watchlist, setWatchlist] = useState<any>(null);
  const [items, setItems] = useState<SharedWatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCopying, setBulkCopying] = useState(false);

  useEffect(() => {
    fetchWatchlist();
  }, [shareCode]);

  async function fetchWatchlist() {
    try {
      const res = await fetch(`/api/shared-watchlists/${shareCode}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Lista não encontrada");
      }
      const data = await res.json();
      setWatchlist(data.watchlist);
      setItems(data.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(lotId: number) {
    if (!watchlist?.is_owner) return;
    setRemoving(lotId);
    try {
      const res = await fetch(`/api/shared-watchlists/${shareCode}/items?lotId=${lotId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.lots.id !== lotId));
      }
    } catch (e) {
      console.error("Error removing:", e);
    } finally {
      setRemoving(null);
    }
  }

  async function copyToMyWatchlist(lotId: number) {
    if (!user) return;
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot_id: lotId }),
      });
    } catch (e) {
      console.error("Error copying:", e);
    }
  }

  function toggleSelect(lotId: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.lots.id)));
    }
  }

  async function bulkCopyToWatchlist() {
    if (!user || selected.size === 0) return;
    setBulkCopying(true);
    try {
      const lotIds = Array.from(selected);
      await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_bulk", lot_ids: lotIds }),
      });
      setSelected(new Set());
    } catch (e) {
      console.error("Error bulk copying:", e);
    } finally {
      setBulkCopying(false);
    }
  }

  function copyShareLink() {
    const url = `${window.location.origin}/equipe/${shareCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5865F2] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Lock className="w-16 h-16 text-[#454655] mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Lista não encontrada</h1>
        <p className="text-[#8E9297] mb-6">{error}</p>
        <Link href="/leiloes" className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-full font-bold text-sm">
          Explorar Lotes
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[#8E9297] text-sm mb-1">
              <Users className="w-4 h-4" />
              {watchlist?.is_public ? (
                <span className="flex items-center gap-1 text-[#10B981]"><Globe className="w-3 h-3" /> Pública</span>
              ) : (
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Privada</span>
              )}
              {watchlist?.user_profiles?.company && (
                <span>· {watchlist.user_profiles.company}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Star className="w-6 h-6 text-[#F59E0B]" fill="#F59E0B" />
              {watchlist?.name}
            </h1>
            {watchlist?.description && (
              <p className="text-[#8E9297] text-sm mt-1">{watchlist.description}</p>
            )}
          </div>

          {/* Share button */}
          <button
            onClick={copyShareLink}
            className="flex items-center gap-2 bg-[#151A22] border border-[#272A31] hover:border-[#454655] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado!" : "Compartilhar"}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-[#8E9297]">
          {user && items.length > 0 && (
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 text-xs text-[#8E9297] hover:text-white transition-colors"
            >
              {selected.size === items.length ? (
                <><CheckSquare className="w-4 h-4 text-[#5865F2]" /> Desmarcar todos</>
              ) : (
                <><Square className="w-4 h-4" /> Selecionar todos</>
              )}
            </button>
          )}
          <span>{items.length} lote{items.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>Código: <code className="text-white font-mono">{shareCode}</code></span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Gem className="w-14 h-14 text-[#272A31] mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Nenhum lote nesta lista</h2>
          <p className="text-[#8E9297] text-sm mb-6 max-w-xs">
            Esta lista ainda não tem lotes salvos.
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
          {items.map((item) => {
            const lot = item.lots;
            const cityName = (lot.cities as any)?.name;
            const stateUf = (lot.cities as any)?.states?.uf ?? lot.sg_uf;

            const isSelected = selected.has(lot.id);
            return (
              <div
                key={item.id}
                className={`group flex gap-5 bg-[#151A22] border rounded-2xl p-4 transition-all duration-200 ${
                  isSelected ? "border-[#5865F2]" : "border-[#272A31] hover:border-[#454655]"
                }`}
              >
                {/* Selection checkbox */}
                {user && !watchlist?.is_owner && (
                  <div className="flex items-start pt-1 flex-shrink-0">
                    <button
                      onClick={() => toggleSelect(lot.id)}
                      className="text-[#8E9297] hover:text-white transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-[#5865F2]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                )}

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

                    {cityName && (
                      <div className="flex items-center gap-1.5 mt-2 text-[#8E9297] text-xs">
                        <MapPin className="w-3.5 h-3.5 text-[#5865F2]" />
                        {cityName}, {stateUf}
                      </div>
                    )}

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

                      {user && !watchlist?.is_owner && (
                        <button
                          onClick={() => copyToMyWatchlist(lot.id)}
                          className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#F59E0B]/40 text-[#8E9297] hover:text-[#F59E0B] px-3 py-2 rounded-xl text-xs font-bold transition-all"
                          title="Copiar para minha watchlist"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {watchlist?.is_owner && (
                        <button
                          onClick={() => removeItem(lot.id)}
                          disabled={removing === lot.id}
                          className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#EF4444]/40 text-[#8E9297] hover:text-[#EF4444] px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#151A22] border border-[#5865F2] rounded-2xl px-6 py-3 shadow-2xl shadow-[#5865F2]/20">
          <span className="text-white text-sm font-bold">{selected.size} selecionado{selected.size !== 1 ? "s" : ""}</span>
          <div className="w-px h-6 bg-[#272A31]" />
          <button
            onClick={bulkCopyToWatchlist}
            disabled={bulkCopying}
            className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            {bulkCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
            Copiar para Watchlist
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[#8E9297] hover:text-white text-sm px-2 py-2 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
