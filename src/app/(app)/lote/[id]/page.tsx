"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Gem, Star, X, ChevronLeft, ChevronRight, Scale, ShieldCheck, TrendingUp, AlertTriangle, Loader2, LogIn, Sparkles, Maximize2, Eye, DollarSign, Target, Clock, Info } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

// Precious metal prices in BRL per gram (fallback when API unavailable)
const METAL_PRICES_FALLBACK: Record<string, { price: number; label: string; color: string }> = {
  // Gold by karat
  "24k": { price: 490, label: "Ouro 24k", color: "#F59E0B" },
  "18k": { price: 320, label: "Ouro 18k", color: "#F59E0B" },
  "14k": { price: 250, label: "Ouro 14k", color: "#D97706" },
  "10k": { price: 180, label: "Ouro 10k", color: "#B45309" },
  "Quilate": { price: 320, label: "Quilate", color: "#F59E0B" },
  // Silver
  "925": { price: 16, label: "Prata 925", color: "#94A3B8" },
  "800": { price: 14, label: "Prata 800", color: "#94A3B8" },
  // Platinum & Palladium (used as-is, no karat conversion)
  "platinum": { price: 120, label: "Platina", color: "#E5E7EB" },
  "palladium": { price: 150, label: "Paládio", color: "#9CA3AF" },
};

type MetalPrices = {
  gold: { spot_usd_per_oz: number; per_gram_brl: number };
  silver: { spot_usd_per_oz: number; per_gram_brl: number };
  platinum: { spot_usd_per_oz: number; per_gram_brl: number };
  palladium: { spot_usd_per_oz: number; per_gram_brl: number };
  karat: Record<string, number>;
  silver_purity: Record<string, number>;
  exchange_rate_usd_brl: number;
  updated_at: string;
  source: string;
};

function formatPrice(price: number | null): string {
  if (!price) return "R$ --";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(price);
}

function formatWeight(weight: string | number | null): { value: number; unit: string } {
  if (!weight) return { value: 0, unit: "g" };
  const w = typeof weight === "string" ? parseFloat(weight.replace(",", ".").replace(/[^\d.]/g, "")) : weight;
  return { value: isNaN(w) ? 0 : w, unit: "g" };
}

function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "warning" | "danger">("normal");

  useEffect(() => {
    const calculate = () => {
      // CAIXA auctions close at 4PM Brasília time = 22:00 UTC (BRT = UTC-3)
      const end = new Date(endDate + "T22:00:00Z");
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) return { text: "Encerrado", level: "danger" };
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours < 1) {
        return { text: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`, level: "danger" };
      }
      if (hours <= 72) {
        return { text: `${hours}h ${String(minutes).padStart(2, "0")}m`, level: hours <= 24 ? "danger" : "warning" };
      }
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return { text: `${days}d ${remainingHours}h`, level: "normal" };
    };
    const result = calculate();
    setTimeLeft(result.text);
    setUrgency(result.level as "normal" | "warning" | "danger");
    const interval = setInterval(() => {
      const r = calculate();
      setTimeLeft(r.text);
      setUrgency(r.level as "normal" | "warning" | "danger");
    }, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  const bgColor = urgency === "danger" ? "bg-red-500" : urgency === "warning" ? "bg-amber-500" : "bg-[#5865F2]";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold text-white ${bgColor}`}>
      <Clock className="w-4 h-4" />
      {timeLeft}
    </span>
  );
}

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
  imagem_capa_url: string | null;
  imagem_frente_url: string | null;
  imagem_verso_url: string | null;
  pickup_location: any;
  sg_uf: any;
  co_leilao: any;
  outcome_status: any;
  winning_bid_value: any;
  centralizer_name: any;
  city_id?: number;
  auction_id?: number;
  auctions?: any;
  karat?: string;
  karat_enriched?: string | null;
  category?: string;
  title_enriched?: string | null;
  description_enriched?: string | null;
  weight_enriched?: number | null;
  tags?: string[] | null;
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
  flags_text?: string;
  was_sold?: boolean;
  bid_end?: string | null;
};

type SimilarLot = {
  id: number;
  title_enriched: string | null;
  de_contrato: string;
  winning_bid_value: number;
  peso_lote: string;
  sg_uf: string;
  karat: string;
  weight_enriched: number | null;
  imagem_capa_url: string | null;
  cities?: any;
  auctions?: { result_date: string | null };
};

// CAIXA image URL fix
function fixImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes("servicebus2.caixa.gov.br/vitrinedejoias/")) {
    return url.replace("servicebus2.caixa.gov.br/vitrinedejoias/", "servicebus2.caixa.gov.br/vitrinearquivos/fotos/");
  }
  return url;
}

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useUser();
  const supabase = createClient();

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<"capa" | "frente" | "verso">("capa");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingWatchlist, setSavingWatchlist] = useState(false);
  const [marketStats, setMarketStats] = useState<{ min: number; median: number; max: number; count: number } | null>(null);
  const [similarLots, setSimilarLots] = useState<SimilarLot[]>([]);
  const [metalPrices, setMetalPrices] = useState<MetalPrices | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!id) return;
    mountedRef.current = true;
    const controller = new AbortController();
    fetchLot(controller.signal);
    if (user) checkWatchlist();
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [id, user]);

  let metalSignal: AbortController | null = null;
  // Fetch live metal prices
  useEffect(() => {
    if (!id) return;
    metalSignal = new AbortController();
    async function fetchMetalPrices() {
      try {
        const res = await fetch("/api/metal-prices", { signal: metalSignal!.signal });
        if (res.ok) {
          const data = await res.json();
          if (mountedRef.current) setMetalPrices(data);
        }
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") console.error("Error fetching metal prices:", e);
      }
    }
    fetchMetalPrices();
    return () => metalSignal?.abort();
  }, [id]);

  function checkWatchlist() {
    if (!id || !user) return;
    supabase
      .from("watchlist")
      .select("id")
      .eq("lot_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (mountedRef.current) setSaved(!!data); });
  }

  async function fetchLot(signal?: AbortSignal) {
    setLoading(true);
    try {
      const res = await fetch(`/api/lots?limit=1&id=${id}`, { cache: "no-store", signal });
      if (!mountedRef.current) { setLoading(false); return; }
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const lotData = data.lots?.find((l: any) => l.id === parseInt(id));
      if (lotData && mountedRef.current) {
        setLot(lotData);
        setLoading(false); // done — letting market/similar load async
        fetchMarketInsights(lotData);
        fetchSimilarLots(lotData);
      } else {
        setLoading(false);
      }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setLoading(false);
    }
  }

  // Safety net: if fetchLot hangs (shouldn't happen), unblock after 10s
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 10_000);
    return () => clearTimeout(timer);
  }, [id]);

  async function fetchMarketInsights(lotData: Lot) {
    if (!lotData.weight_enriched || lotData.weight_enriched <= 0) return;
    try {
      const w = lotData.weight_enriched;
      // Use karat_enriched if available, fallback to karat, fallback to empty string (all karats)
      const karat = lotData.karat_enriched || lotData.karat || "";
      const karatParam = karat ? `karat=${karat}` : "";
      const query = `/api/lots?vendas=true&${karatParam}&limit=300`;
      const res = await fetch(query);
      if (!res.ok) return;
      const data = await res.json();
      // Exclude current lot, only keep lots with winning bids
      let lots = (data.lots || [])
        .filter((l: any) => l.winning_bid_value && l.id !== lotData.id);

      // Filter by weight similarity (0.7x - 1.3x)
      lots = lots.filter((l: any) => {
        const lw = l.weight_enriched;
        if (!lw) return false;
        const ratio = lw / w;
        return ratio >= 0.7 && ratio <= 1.3;
      });

      // Same UF preference
      if (lotData.sg_uf) {
        const sameUF = lots.filter((l: any) => l.sg_uf === lotData.sg_uf);
        if (sameUF.length >= 3) lots = sameUF;
      }

      const prices = lots.map((l: any) => Number(l.winning_bid_value)).filter(Boolean);

      // Remove extreme outliers (top/bottom 10% by price) to avoid skewed ranges
      if (prices.length >= 5) {
        const sorted = [...prices].sort((a, b) => a - b);
        const trim = Math.max(1, Math.floor(sorted.length * 0.1));
        const trimmed = sorted.slice(trim, sorted.length - trim);
        if (trimmed.length > 0 && mountedRef.current) {
          setMarketStats({
            min: trimmed[0],
            median: trimmed[Math.floor(trimmed.length / 2)],
            max: trimmed[trimmed.length - 1],
            count: trimmed.length,
          });
        }
      } else if (prices.length > 0 && mountedRef.current) {
        const sorted = prices.sort((a: number, b: number) => a - b);
        setMarketStats({
          min: sorted[0],
          median: sorted[Math.floor(sorted.length / 2)],
          max: sorted[sorted.length - 1],
          count: sorted.length,
        });
      }
    } catch (e) { if (!mountedRef.current) console.error("Error fetching market stats:", e); }
  }

  async function fetchSimilarLots(lotData: Lot) {
    if (!lotData.weight_enriched && !lotData.karat) return;
    try {
      let query = `/api/lots?vendas=true&karat=${lotData.karat || ""}&limit=300`;
      const res = await fetch(query);
      if (!res.ok) return;
      const data = await res.json();
      let lots = (data.lots || []).filter((l: any) => l.winning_bid_value);

      // Filter by weight similarity (0.7x - 1.3x)
      if (lotData.weight_enriched && lotData.weight_enriched > 0) {
        const w = lotData.weight_enriched;
        lots = lots.filter((l: any) => {
          const lw = l.weight_enriched;
          if (!lw) return false;
          const ratio = lw / w;
          return ratio >= 0.7 && ratio <= 1.3;
        });
      }

      // Filter by same UF as the current lot (gold prices vary by state income levels)
      if (lotData.sg_uf) {
        const sameUF = lots.filter((l: any) => l.sg_uf === lotData.sg_uf);
        if (sameUF.length >= 3) lots = sameUF;
      }

      // Sort by weight similarity (closest first) then limit
      if (lotData.weight_enriched && lotData.weight_enriched > 0) {
        const w = lotData.weight_enriched;
        lots.sort((a: any, b: any) => {
          const ra = a.weight_enriched ? Math.abs(a.weight_enriched / w - 1) : 999;
          const rb = b.weight_enriched ? Math.abs(b.weight_enriched / w - 1) : 999;
          return ra - rb;
        });
      }

      if (mountedRef.current) setSimilarLots(lots.slice(0, 5));
    } catch (e) { if (!mountedRef.current) console.error("Error fetching similar lots:", e); }
  }

  async function toggleWatchlist() {
    if (!user) { router.push("/login"); return; }
    setSavingWatchlist(true);
    const { data: existing } = await supabase.from("watchlist").select("id").eq("lot_id", id).eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("watchlist").delete().eq("lot_id", id).eq("user_id", user.id);
      setSaved(false);
    } else {
      await supabase.from("watchlist").insert({ lot_id: id, user_id: user.id });
      setSaved(true);
    }
    setSavingWatchlist(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5865F2] animate-spin" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center p-10">
        <p className="text-[#8E9297] text-lg">Lote não encontrado</p>
        <Link href="/leiloes" className="text-[#5865F2] hover:underline mt-4">← Voltar aos Leilões</Link>
      </div>
    );
  }

  const isClosed = lot.outcome_status !== null || lot.was_sold;
  const hasEnded = lot.bid_end && new Date(lot.bid_end + "T22:00:00Z") < new Date() && !isClosed;
  const weight = formatWeight(lot.weight_enriched || lot.peso_lote);

  // Detect metal type from tags
  const tags = lot.tags || [];
  const tagSet = new Set(tags.map((t: string) => t.toLowerCase()));
  const isSilver = tagSet.has("prata") || tagSet.has("prata-925") || tagSet.has("prata-800");
  const isPlatinum = tagSet.has("platina");
  const isPalladium = tagSet.has("paladio") || tagSet.has("paládio");
  const metalType: "gold" | "silver" | "platinum" | "palladium" =
    isSilver ? "silver" : isPlatinum ? "platinum" : isPalladium ? "palladium" : "gold";

  // Get price per gram based on detected metal type
  const karatKey = lot.karat || "18k";
  let pricePerGram = 0;
  let metalLabel = "Ouro";
  let metalColor = "#F59E0B";

  if (metalType === "silver") {
    // Silver: use 925 purity if available, else 800, from live or fallback
    const silverPurityKey = tagSet.has("prata-925") ? "925" : tagSet.has("prata-800") ? "800" : "925";
    pricePerGram = metalPrices?.silver_purity?.[silverPurityKey] ?? (metalPrices?.silver?.per_gram_brl ? metalPrices.silver.per_gram_brl * 0.925 : METAL_PRICES_FALLBACK["925"].price);
    metalLabel = `Prata ${silverPurityKey}`;
    metalColor = "#94A3B8";
  } else if (metalType === "platinum") {
    pricePerGram = metalPrices?.platinum?.per_gram_brl ?? METAL_PRICES_FALLBACK["platinum"].price;
    metalLabel = "Platina";
    metalColor = "#E5E7EB";
  } else if (metalType === "palladium") {
    pricePerGram = metalPrices?.palladium?.per_gram_brl ?? METAL_PRICES_FALLBACK["palladium"].price;
    metalLabel = "Paládio";
    metalColor = "#9CA3AF";
  } else {
    // Gold: use karat price
    const livePricePerGram = metalPrices?.karat[karatKey];
    const fallbackPrice = METAL_PRICES_FALLBACK[karatKey];
    pricePerGram = livePricePerGram ?? fallbackPrice?.price ?? 0;
    metalLabel = fallbackPrice?.label || karatKey;
    metalColor = fallbackPrice?.color || "#F59E0B";
  }

  const estimatedMetalValue = pricePerGram > 0 ? weight.value * pricePerGram : null;

  // Active images
  const images = [
    { key: "capa" as const, url: lot.imagem_capa_url || fixImageUrl(lot.url_imagem_capa) },
    { key: "frente" as const, url: lot.imagem_frente_url || fixImageUrl(lot.url_imagem_frente) },
    { key: "verso" as const, url: lot.imagem_verso_url || fixImageUrl(lot.url_imagem_verso) },
  ].filter((img) => img.url);
  const activeImg = images.find((img) => img.key === activeImage) || images[0];

  // Risk flags from tags — DOWNVALUE (yellow/red) vs UPVALUE (green)
  const negativeMap: Record<string, { key: string; label: string; bg: string }> = {
    enchimento: { key: "enchimento", label: "Enchimento", bg: "bg-amber-600 text-white" },
    "baixo-karat": { key: "baixo-karat", label: "Baixo Quilate", bg: "bg-orange-600 text-white" },
    "ouro-baixo": { key: "ouro-baixo", label: "Baixo Quilate", bg: "bg-orange-600 text-white" },
    "pedras-nao-valorizadas": { key: "pedras-nao-valorizadas", label: "Pedras não precificadas", bg: "bg-pink-600 text-white" },
    "relogio-parado": { key: "relogio-parado", label: "Relógio parado", bg: "bg-red-600 text-white" },
    quebrado: { key: "quebrado", label: "Quebrado", bg: "bg-red-700 text-white" },
    partido: { key: "partido", label: "Partido", bg: "bg-red-700 text-white" },
    incompleto: { key: "incompleto", label: "Incompleto", bg: "bg-red-800 text-white" },
    falta: { key: "falta", label: "Faltam componentes", bg: "bg-red-800 text-white" },
    amassado: { key: "amassado", label: "Amassado", bg: "bg-yellow-600 text-white" },
    amolgado: { key: "amolgado", label: "Amolgado", bg: "bg-yellow-600 text-white" },
    "com-defeito": { key: "com-defeito", label: "Com defeito", bg: "bg-yellow-600 text-white" },
    folheado: { key: "folheado", label: "Folheado", bg: "bg-teal-600 text-white" },
  };

  // UPVALUE flags — positive value indicators in green
  const positiveMap: Record<string, { key: string; label: string; bg: string }> = {
    "ouro-rodinado": { key: "ouro-rodinado", label: "Ouro rodinado", bg: "bg-green-600 text-white" },
    "prata-rodinado": { key: "prata-rodinado", label: "Prata rodinada", bg: "bg-green-600 text-white" },
    "ouro-branco": { key: "ouro-branco", label: "Ouro branco", bg: "bg-green-600 text-white" },
    "ouro-18k": { key: "ouro-18k", label: "Ouro 18k", bg: "bg-green-600 text-white" },
    "ouro-14k": { key: "ouro-14k", label: "Ouro 14k", bg: "bg-green-600 text-white" },
    "com-diamantes": { key: "com-diamantes", label: "Com diamantes", bg: "bg-green-600 text-white" },
    "com-pedras": { key: "com-pedras", label: "Com pedras", bg: "bg-green-600 text-white" },
    "com-pedras-preciosas": { key: "com-pedras-preciosas", label: "Com pedras preciosas", bg: "bg-green-600 text-white" },
    "com-rubi": { key: "com-rubi", label: "Com rubi", bg: "bg-green-600 text-white" },
    "com-esmeralda": { key: "com-esmeralda", label: "Com esmeralda", bg: "bg-green-600 text-white" },
    "com-safira": { key: "com-safira", label: "Com safira", bg: "bg-green-600 text-white" },
    platina: { key: "platina", label: "Platina", bg: "bg-green-600 text-white" },
    paladio: { key: "palidio", label: "Paládio", bg: "bg-green-600 text-white" },
    moeda: { key: "moeda", label: "Moeda", bg: "bg-green-600 text-white" },
    barra: { key: "barra", label: "Barra", bg: "bg-green-600 text-white" },
    relogio: { key: "relogio", label: "Relógio", bg: "bg-green-600 text-white" },
    prata: { key: "prata", label: "Prata", bg: "bg-green-600 text-white" },
    ouro: { key: "ouro", label: "Ouro", bg: "bg-green-600 text-white" },
    "peso-misto": { key: "peso-misto", label: "Peso misto", bg: "bg-orange-600 text-white" },
  };

  const negativeFlags = Object.entries(negativeMap)
    .filter(([tag]) => tagSet.has(tag))
    .map(([tag, val]) => ({ ...val, key: tag }));

  const positiveFlags = Object.entries(positiveMap)
    .filter(([tag]) => tagSet.has(tag))
    .map(([tag, val]) => ({ ...val, key: tag }));

  const title = lot.title_enriched || lot.de_contrato || "Joia";
  const description = lot.description_enriched || null;

  return (
    <div className="min-h-screen bg-[#0B0E14]">
      {/* Lightbox */}
      {lightboxOpen && activeImg?.url && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightboxOpen(false)}>
            <X className="w-8 h-8" />
          </button>
          <img src={activeImg.url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#272A31] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/95 backdrop-blur-sm z-40">
        <Link href={isClosed ? "/vendas" : "/leiloes"} className="flex items-center gap-2 text-[#8E9297] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">{isClosed ? "Voltar às Vendas" : "Voltar aos Leilões"}</span>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={toggleWatchlist} disabled={savingWatchlist} className={`p-2.5 rounded-xl border transition-all ${saved ? "bg-[#5865F2]/10 border-[#5865F2] text-[#5865F2]" : "bg-[#151A22] border-[#272A31] text-[#8E9297] hover:text-white"}`}>
            {savingWatchlist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Images + Description + Tags */}
          <div className="space-y-4">
            {/* Main image */}
            <div className="aspect-square bg-[#151A22] rounded-3xl overflow-hidden border border-[#272A31] relative group">
              {activeImg?.url ? (
                <>
                  <img src={activeImg.url} alt={title} className="w-full h-full object-cover" />
                  <button onClick={() => setLightboxOpen(true)} className="absolute top-4 right-4 p-2 bg-[#151A22]/80 rounded-xl text-white hover:bg-[#2F3136] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Gem className="w-24 h-24 text-[#2F3136]" /></div>
              )}
              {/* Image nav arrows */}
              {images.length > 1 && (
                <>
                  <button onClick={() => { const idx = images.findIndex(i => i.key === activeImage); setActiveImage(images[(idx - 1 + images.length) % images.length].key); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#151A22]/80 rounded-full flex items-center justify-center text-white hover:bg-[#2F3136] transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => { const idx = images.findIndex(i => i.key === activeImage); setActiveImage(images[(idx + 1) % images.length].key); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#151A22]/80 rounded-full flex items-center justify-center text-white hover:bg-[#2F3136] transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            {/* Thumbnails */}
            <div className="flex gap-3">
              {images.map((img) => (
                <button key={img.key} onClick={() => setActiveImage(img.key)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${activeImage === img.key ? "border-[#5865F2]" : "border-[#272A31] hover:border-[#454655]"}`}>
                  <img src={img.url!} alt={img.key} loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Description - below images, larger font */}
            {description && (
              <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
                {description.split("\n").map((line, i) => {
                  // "Fatores que podem afetar" header (risk — amber)
                  if (line.includes("Fatores que podem afetar")) {
                    return <p key={i} className="text-amber-400 text-base font-bold mt-5 mb-2">{line}</p>;
                  }
                  // "Fatores que podem agregar" header (positive value — green)
                  if (line.includes("Fatores que podem agregar")) {
                    return <p key={i} className="text-green-400 text-base font-bold mt-5 mb-2">{line}</p>;
                  }
                  // CAIXA original description header
                  if (line.includes("Descricao original CAIXA")) {
                    return <p key={i} className="text-gray-400 text-xs font-semibold mt-4 mb-1 uppercase tracking-wide">{line}</p>;
                  }
                  // Flag item line: "• Label: explanation"
                  if (line.startsWith("•")) {
                    const colonIdx = line.indexOf(":");
                    if (colonIdx > 1) {
                      const label = line.slice(1, colonIdx).trim();
                      const explanation = line.slice(colonIdx + 1).trim();
                      // Positive value indicators get green styling
                      const positive = ["Com diamantes","Pedras preciosas","Moeda","barra","Ouro rodinado","Prata","Platina"];
                      const isPositive = positive.some(v => label.includes(v));
                      return (
                        <p key={i} className="text-white text-base leading-relaxed mt-2">
                          <span className={`font-bold ${isPositive ? "text-green-300" : "text-amber-300"}`}>• {label}:</span> <span className="text-gray-200">{explanation}</span>
                        </p>
                      );
                    }
                  }
                  // Legal disclaimer first paragraph (only this one gets the border-top)
                  if (line.startsWith("As informacoes") || line.startsWith("As informações")) {
                    return <p key={i} className="text-[#9CA3AF] text-xs leading-relaxed mt-4 pt-3 border-t border-[#272A31]">{line}</p>;
                  }
                  // Legal disclaimer subsequent paragraphs
                  if (line.startsWith("A decisao") || line.startsWith("O valor estimado")) {
                    return <p key={i} className="text-[#9CA3AF] text-xs leading-relaxed">{line}</p>;
                  }
                  // Regular line
                  if (line.trim()) {
                    return <p key={i} className="text-white text-base leading-relaxed">{line}</p>;
                  }
                  // Empty line
                  return <br key={i} />;
                })}
              </div>
            )}

                      </div>

          {/* Right: Details */}
          <div className="space-y-6">
            {/* Title & Meta */}
            <div>
              <p className="text-white text-sm font-medium mb-2">
                Lote {lot.lot_number} · {lot.sg_uf} · Leilão {lot.co_leilao}
                {!isClosed && lot.bid_end && (
                  <span className="text-[#8E9297]"> · Encerra em {new Date(lot.bid_end + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                )}
              </p>
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                {title}
              </h1>
              {/* Countdown right below title */}
              {!isClosed && !hasEnded && lot.bid_end && (
                <CountdownTimer endDate={lot.bid_end} />
              )}
              {hasEnded && !isClosed && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold text-white bg-red-500">
                  Encerrado · Aguardando resultados
                </span>
              )}

              {/* Market comparison strip — above the gold card */}
              {marketStats && marketStats.count >= 3 && (
                <div className="bg-[#0B0E14] border border-[#1F2937] rounded-xl px-4 py-2 flex items-center gap-4 text-xs mt-3">
                  <span className="text-[#8E9297]">Preço justo (mediana):</span>
                  <span className="text-[#10B981] font-black">{formatPrice(marketStats.median)}</span>
                  <span className="text-[#8E9297]">-range:</span>
                  <span className="text-white font-bold">{formatPrice(marketStats.min)}</span>
                  <span className="text-[#8E9297]">—</span>
                  <span className="text-white font-bold">{formatPrice(marketStats.max)}</span>
                  <span className="ml-auto text-[#5865F2] font-medium">{marketStats.count} vendas similares</span>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-[#8E9297] uppercase tracking-widest mb-1">Peso</div>
                <div className="text-xl font-black text-white">{weight.value.toFixed(2)}<span className="text-[#8E9297] text-xs">g</span></div>
              </div>
              <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-[#8E9297] uppercase tracking-widest mb-1">Quilate</div>
                <div className="text-xl font-black text-white">{lot.karat || "—"}</div>
              </div>
              <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-[#8E9297] uppercase tracking-widest mb-1">UF</div>
                <div className="text-xl font-black text-white">{lot.sg_uf || "—"}</div>
              </div>
            </div>

            {/* Metal Value Card */}
            {weight.value > 0 && !isClosed && (
              <div className="bg-[#151A22] border border-[#F59E0B]/40 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5" style={{ color: metalColor }} />
                    <span className="text-sm font-bold uppercase tracking-widest" style={{ color: metalColor }}>
                      {metalType === "gold" ? "Valor do Ouro" : metalType === "silver" ? "Valor da Prata" : metalType === "platinum" ? "Valor da Platina" : "Valor do Paládio"}
                    </span>
                  </div>
                  {metalPrices && (
                    <span className="text-xs text-[#8E9297]">
                      {metalType === "gold" && `24k spot: R$ ${metalPrices.karat["24k"]?.toFixed(2)}/g`}
                      {metalType === "silver" && `925 spot: R$ ${metalPrices.silver_purity?.["925"]?.toFixed(2)}/g`}
                      {metalType === "platinum" && `PT spot: R$ ${metalPrices.platinum?.per_gram_brl?.toFixed(2)}/g`}
                      {metalType === "palladium" && `PD spot: R$ ${metalPrices.palladium?.per_gram_brl?.toFixed(2)}/g`}
                    </span>
                  )}
                </div>

                {/* Karat unknown disclaimer — only for gold */}
                {!lot.karat && metalType === "gold" && (
                  <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-2.5 mb-3">
                    <p className="text-amber-300 text-xs font-semibold">⚠️ Quilatagem não detectada — mostrando intervalo de 10k a 24k</p>
                  </div>
                )}

                {/* Mixed weight warning — gold portion only */}
                {tagSet.has("peso-misto") && (
                  <div className="bg-orange-500/15 border border-orange-500/40 rounded-xl p-2.5 mb-3">
                    <p className="text-orange-300 text-xs font-semibold">⚠️ Peso misto detectado — o valor é baseado apenas na parcela de ouro, não no peso total.</p>
                  </div>
                )}

                {/* Metal value range — gold uses karat range, others use single estimate */}
                {metalType === "gold" ? (
                  lot.karat ? (
                    /* Gold + karat known — show conservative → optimistic range */
                    <div className="flex items-end justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-3">
                          <div className="text-2xl font-black text-amber-400">
                            {formatPrice(weight.value * pricePerGram * 0.60)}
                          </div>
                          <span className="text-[#8E9297] text-sm">—</span>
                          <div className="text-2xl font-black text-[#10B981]">
                            {formatPrice(weight.value * pricePerGram * 0.85)}
                          </div>
                        </div>
                        <p className="text-[#8E9297] text-xs mt-1">
                          {lot.karat} × {weight.value.toFixed(2)}g × 60%—85% margem
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Gold + karat unknown — show full 10K-24K range */
                    <div className="mb-3">
                      <div className="flex items-baseline gap-3">
                        <div className="text-2xl font-black text-amber-400">
                          {formatPrice(weight.value * (metalPrices?.karat["10k"] || 180) * 0.60)}
                        </div>
                        <span className="text-[#8E9297] text-sm">—</span>
                        <div className="text-2xl font-black text-[#10B981]">
                          {formatPrice(weight.value * (metalPrices?.karat["24k"] || 490) * 0.85)}
                        </div>
                      </div>
                      <p className="text-[#8E9297] text-xs mt-1">
                        10k — 24k × {weight.value.toFixed(2)}g × 60%—85% margem
                      </p>
                    </div>
                  )
                ) : (
                  /* Silver / Platinum / Palladium — single estimate with margin */
                  <div className="flex items-end justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <div className="text-2xl font-black text-amber-400">
                          {formatPrice(weight.value * pricePerGram * 0.65)}
                        </div>
                        <span className="text-[#8E9297] text-sm">—</span>
                        <div className="text-2xl font-black text-[#10B981]">
                          {formatPrice(weight.value * pricePerGram * 0.90)}
                        </div>
                      </div>
                      <p className="text-[#8E9297] text-xs mt-1">
                        {metalLabel} × {weight.value.toFixed(2)}g × 65%—90% margem
                      </p>
                    </div>
                  </div>
                )}

                {/* Commission sub-line */}
                {lot.valor && (
                  <p className="text-[#6B7280] text-xs">
                    +6% comissão = até {formatPrice((lot.valor || 0) * 1.06)} custo total
                  </p>
                )}

                <p className="text-[#454655] text-[10px] mt-3 leading-relaxed">* Valor de revenda estimado. Não inclui pedras ou manufacture.</p>
              </div>
            )}

            {/* Bid vs Market Signal */}
            {weight.value > 0 && lot.valor && !isClosed && !hasEnded && (
              (() => {
                // Use the same margin factors as the value card above
                const marginLow = metalType === "gold" ? 0.60 : 0.65;
                const marginHigh = metalType === "gold" ? 0.85 : 0.90;
                const conservative = weight.value * pricePerGram * marginLow;
                const optimistic = weight.value * pricePerGram * marginHigh;
                const bid = lot.valor;
                let badge: { color: string; bg: string; text: string };
                if (bid < conservative) {
                  badge = { color: "text-[#10B981]", bg: "bg-[#10B981]/10 border border-[#10B981]/40", text: "Abaixo do valor de mercado" };
                } else if (bid > optimistic) {
                  badge = { color: "text-red-400", bg: "bg-red-400/10 border border-red-400/40", text: "Acima do valor de mercado" };
                } else {
                  badge = { color: "text-amber-400", bg: "bg-amber-400/10 border border-amber-400/40", text: "Dentro da faixa" };
                }
                const metalSuffix = metalType === "gold" ? `${lot.karat || "?"}×g` : metalLabel;
                return (
                  <div className={`rounded-xl px-4 py-2.5 ${badge.bg}`}>
                    <span className={`text-xs font-bold ${badge.color}`}>{badge.text}</span>
                    <span className="text-[#8E9297] text-xs ml-2">lance inicial vs. {metalSuffix}</span>
                  </div>
                );
              })()
            )}

            {/* Risk & Value Flags */}
            {(negativeFlags.length > 0 || positiveFlags.length > 0) && (
              <div className="bg-[#151A22] border border-amber-500/30 rounded-2xl p-5">
                {negativeFlags.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-500 text-xs font-bold uppercase tracking-widest">Fatores de Risco</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {negativeFlags.map((f) => (
                        <span key={f.key} className={`text-xs font-bold px-2.5 py-1 rounded-lg ${f.bg}`}>{f.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {positiveFlags.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-green-500 text-xs font-bold uppercase tracking-widest">Fatores de Valor</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {positiveFlags.map((f) => (
                        <span key={f.key} className={`text-xs font-bold px-2.5 py-1 rounded-lg ${f.bg}`}>{f.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Price Card */}
            <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-6">
              {isClosed ? (
                <div className="text-center py-2">
                  <div className="text-[#8E9297] text-xs font-bold uppercase tracking-widest mb-2">Vendido por</div>
                  <div className="text-4xl font-black text-[#10B981]">{formatPrice(lot.winning_bid_value)}</div>
                  {lot.winning_bid_value && lot.valor && (
                    <div className={`text-sm font-bold mt-2 ${lot.winning_bid_value > lot.valor ? "text-[#10B981]" : "text-red-400"}`}>
                      {lot.winning_bid_value > lot.valor ? "+" : ""}{(((lot.winning_bid_value - lot.valor) / lot.valor) * 100).toFixed(1)}% vs lance inicial
                    </div>
                  )}
                </div>
              ) : hasEnded ? (
                <div className="text-center py-2">
                  <div className="text-4xl font-black text-red-400">Encerrado</div>
                  <div className="text-[#8E9297] text-sm mt-2">Aguardando publicação dos resultados</div>
                </div>
              ) : (
                <>
                  <div className="text-[#8E9297] text-xs font-bold uppercase tracking-widest mb-2">Lance Inicial</div>
                  <div className="text-4xl font-black text-white tracking-tight">{formatPrice(lot.valor)}</div>
                </>
              )}
            </div>

            {/* Bid Strategy */}
            {!isClosed && !hasEnded && marketStats && (
              <div className="bg-[#151A22] border border-[#10B981]/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-[#10B981]" />
                  <span className="text-[#10B981] text-xs font-bold uppercase tracking-widest">Estratégia de Lance</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-[10px] text-[#8E9297] uppercase mb-1">Mínimo</div>
                    <div className="text-white font-bold">{formatPrice(marketStats.min)}</div>
                    <div className="text-[10px] text-[#6B7280]">+6% → {formatPrice(marketStats.min * 1.06)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-[#8E9297] uppercase mb-1">Mediana</div>
                    <div className="text-[#10B981] font-black text-xl">{formatPrice(marketStats.median)}</div>
                    <div className="text-[10px] text-[#6B7280]">+6% → {formatPrice(marketStats.median * 1.06)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-[#8E9297] uppercase mb-1">Máximo</div>
                    <div className="text-white font-bold">{formatPrice(marketStats.max)}</div>
                    <div className="text-[10px] text-[#6B7280]">+6% → {formatPrice(marketStats.max * 1.06)}</div>
                  </div>
                </div>
                {weight.value > 0 && (
                  <div className="bg-[#0B0E14] rounded-xl p-3 text-xs text-[#8E9297]">
                    R$ {(marketStats.median / weight.value).toFixed(2)}/g médio para {lot.karat || "todas as quilatagens"}
                  </div>
                )}
                <p className="text-[#454655] text-[10px] mt-3 leading-relaxed">* Baseado em {marketStats.count} vendas similares. Decisão de lance é de responsabilidade exclusiva do licitante.</p>
              </div>
            )}

            {/* Similar Sales */}
            {similarLots.length > 0 && (
              <div className="bg-[#151A22] border border-[#5865F2]/30 rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-[#5865F2]" />
                  <span className="text-[#5865F2] text-xs font-bold uppercase tracking-widest">Vendas Similares Recentes</span>
                  {(() => {
                    const w = lot.weight_enriched || 0;
                    const sameUF = similarLots.filter((l: any) => l.sg_uf === lot.sg_uf);
                    if (sameUF.length >= 3) {
                      return (
                        <span className="ml-auto text-[10px] text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/40 font-bold">
                          Mesmas UF: {lot.sg_uf}
                        </span>
                      );
                    } else if (similarLots.length > 0) {
                      return (
                        <span className="ml-auto text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full border border-yellow-400/40">
                          UF: {similarLots[0].sg_uf} — sem similar em {lot.sg_uf}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="space-y-3">
                  {similarLots.map((s, idx) => (
                    <a key={s.id} href={`/lote/${s.id}`} className="relative block p-2 rounded-xl border-2 transition-all no-underline bg-[#151A22] hover:-translate-y-0.5 hover:bg-[#2F3136]/50" style={{ borderColor: idx === 0 ? '#10B981' : 'transparent' }}>
                      {idx === 0 && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="text-[10px] bg-[#10B981] text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap">Mais proximo</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {s.imagem_capa_url ? (
                          <img src={s.imagem_capa_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-[#0B0E14]" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#2F3136] flex items-center justify-center"><Gem className="w-5 h-5 text-[#454655]" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{s.title_enriched || s.de_contrato}</p>
                          <p className="text-[#8E9297] text-xs">{s.weight_enriched ? `${s.weight_enriched.toFixed(2)}g` : s.peso_lote} · {s.karat}</p>
                          {s.auctions?.result_date && (
                            <p className="text-[#8E9297] text-xs">Vendido em {new Date(s.auctions.result_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-[#10B981] font-bold">{formatPrice(s.winning_bid_value)}</div>
                          <div className="text-[#8E9297] text-[10px]">{s.sg_uf}</div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              {lot.pickup_location && (
                <div className="bg-[#151A22] border border-[#272A31] rounded-xl p-4">
                  <div className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest mb-1">Local de Retirada</div>
                  <div className="text-white text-sm flex items-start gap-2"><MapPin className="w-3 h-3 mt-0.5 text-[#5865F2] shrink-0" />{lot.pickup_location}</div>
                </div>
              )}
              <div className="bg-[#151A22] border border-[#272A31] rounded-xl p-4">
                <div className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest mb-1">Centralizadora</div>
                <div className="text-white text-sm">{lot.centralizer_name || "—"}</div>
              </div>
            </div>

            {/* CTA */}
            {!isClosed && !hasEnded && (
              <div className="space-y-3">
                <a
                  href={`https://vitrinedejoias.caixa.gov.br/Paginas/Busca.aspx?numeroDoLoteOuContrato=${lot.contract_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-[#5865F2]/20"
                >
                  Ver na Vitrine de Joias CAIXA
                </a>
                <p className="text-[#8E9297] text-sm text-center">
                  Para dar lance, vá a uma agência CAIXA e utilize o terminal de auto-atendimento.
                </p>
              </div>
            )}

            {isClosed && (
              <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
                <p className="text-[#10B981] text-sm font-bold">Este lote já foi vendido</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}