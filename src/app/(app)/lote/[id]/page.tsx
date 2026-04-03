"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Cpu, FileText, CheckCircle2, MapPin, BellRing, Zap, AlertCircle, RefreshCw, Package, Ruler, Eye, Gavel, Users, Building2, Info, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useWatchlist } from "@/contexts/WatchlistContext";

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
 * Format relative time in Portuguese (e.g., "5 min atrás", "2h atrás")
 */
function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return "desconhecido";

  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diffMs = now - time;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d atrás`;
  } else if (hours > 0) {
    return `${hours}h atrás`;
  } else if (minutes > 0) {
    return `${minutes} min atrás`;
  } else {
    return "agora mesmo";
  }
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
  last_scraped_at?: string;  // When price was last fetched from Kwara
  location_city?: string;
  location_state?: string;
  edict_url?: string;
  source_url?: string;
  description?: string;
  is_in_watchlist?: boolean;
  // Extended fields from detailed scraping
  refs?: string[];
  general_observations?: string;
  visiting_observations?: string;
  visiting_address?: string;
  pickup_observations?: string;
  pickup_address?: string;
  measurements?: string;
  listing_title?: string;
  starting_bid?: number;
  buyer_fee_percentage?: number;
  minimum_increment?: number;
  views?: number;
  bids_count?: number;
  seller_name?: string;
  seller_logo_url?: string;
  metadata?: {
    images?: Array<{
      url: string;
      id: string;
      title: string;
      displayOrder: number;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
};

export default function LoteDetail() {
  const params = useParams();
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState("");
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [refreshingPrice, setRefreshingPrice] = useState(false);
  const [priceLoading, setPriceLoading] = useState(true); // Start with loading state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());
  const { refreshCount } = useWatchlist();

  // Helper functions for lightbox - must be defined before useEffect
  const closeLightbox = () => setLightboxOpen(false);

  const goToNextImage = () => {
    const images = [];
    if (lot?.image_url) images.push(lot.image_url);
    if (lot?.metadata?.images && Array.isArray(lot.metadata.images)) {
      lot.metadata.images.forEach((img: any) => {
        const url = typeof img === 'object' && img.url ? img.url : img;
        if (url && url !== lot?.image_url) images.push(url);
      });
    }
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const goToPrevImage = () => {
    const images = [];
    if (lot?.image_url) images.push(lot.image_url);
    if (lot?.metadata?.images && Array.isArray(lot.metadata.images)) {
      lot.metadata.images.forEach((img: any) => {
        const url = typeof img === 'object' && img.url ? img.url : img;
        if (url && url !== lot?.image_url) images.push(url);
      });
    }
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goToNextImage();
      if (e.key === 'ArrowLeft') goToPrevImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  useEffect(() => {
    if (params.id) {
      fetchLot();
      // Auto-refresh price when user views details
      autoRefreshPrice();
    }
  }, [params.id]);

  // Debug: Log when lot or refreshTimestamp changes
  useEffect(() => {
    if (lot?.last_scraped_at) {
      console.log('Render - lot.last_scraped_at:', lot.last_scraped_at);
      console.log('Render - refreshTimestamp:', refreshTimestamp);
      console.log('Render - isPriceFresh:', isPriceFresh(lot.last_scraped_at));
      console.log('Render - formatRelativeTime:', formatRelativeTime(lot.last_scraped_at));
    }
  }, [lot?.last_scraped_at, refreshTimestamp]);

  useEffect(() => {
    if (lot?.closing_at) {
      const calculateTimeLeft = () => {
        const closing = new Date(lot.closing_at);
        const now = new Date();
        const diff = closing.getTime() - now.getTime();

        if (diff <= 0) return "Encerrado";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

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
    }
  }, [lot?.closing_at]);

  const fetchLot = async () => {
    try {
      const response = await fetch(`/api/lots/${params.id}`);
      const data = await response.json();
      setLot(data.lot);
      setIsInWatchlist(data.lot.is_in_watchlist || false);
    } catch (error) {
      console.error("Error fetching lot:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWatchlist = async () => {
    if (!lot) return;

    setToggleLoading(true);
    try {
      const response = await fetch(`/api/watchlist/${lot.id}`, {
        method: isInWatchlist ? 'DELETE' : 'POST',
      });

      if (response.ok) {
        setIsInWatchlist(!isInWatchlist);
        // Refresh sidebar count
        refreshCount();
      }
    } catch (error) {
      console.error("Error toggling watchlist:", error);
    } finally {
      setToggleLoading(false);
    }
  };

  const autoRefreshPrice = async () => {
    setPriceLoading(true);
    try {
      const response = await fetch(`/api/lots/${params.id}/refresh`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // Update only price-related fields
        setLot(prev => prev ? {
          ...prev,
          current_bid: data.lot.current_bid,
          last_scraped_at: data.lot.last_scraped_at,
        } : null);
      }
    } catch (error) {
      console.error("Error auto-refreshing price:", error);
    } finally {
      setPriceLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const refreshPrice = async () => {
    if (!lot || refreshingPrice) return;

    setRefreshingPrice(true);
    try {
      const response = await fetch(`/api/lots/${lot.id}/refresh`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Refresh response:', data); // Debug log
        console.log('New last_scraped_at:', data.lot.last_scraped_at); // Debug

        // Update only dynamic fields, preserve all other lot data
        setLot(prev => {
          if (!prev) return null;

          const updated = {
            ...prev,
            current_bid: data.lot.current_bid,
            last_scraped_at: data.lot.last_scraped_at,
            bids_count: data.lot.bids_count,
            views: data.lot.views,
          };

          console.log('Updated lot last_scraped_at:', updated.last_scraped_at); // Debug log
          return updated;
        });

        // Force UI refresh by updating timestamp
        const newTimestamp = Date.now();
        console.log('Setting refreshTimestamp to:', newTimestamp); // Debug
        setRefreshTimestamp(newTimestamp);
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Refresh failed:', errorData);
        alert(`Erro ao atualizar: ${errorData.error || 'Erro no servidor Kwara'}. Tente novamente em alguns minutos.`);
      }
    } catch (error) {
      console.error("Error refreshing price:", error);
      alert('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setRefreshingPrice(false);
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

  if (loading) {
    return (
      <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-[#272A31] rounded w-1/3"></div>
          <div className="h-12 bg-[#272A31] rounded"></div>
          <div className="aspect-video bg-[#272A31] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto text-center py-20">
        <p className="text-[#8E9297] text-lg">Lote não encontrado</p>
      </div>
    );
  }

  // Extract product name from full title
  // Title format: "Leilão de X - Auctioneer - Product Name - Notes"
  const getProductName = (fullTitle: string | undefined) => {
    if (!fullTitle) return 'Carregando...';

    const parts = fullTitle.split(' - ');
    if (parts.length >= 3) {
      // Product name is the third part, remove notes in parentheses
      const productName = parts[2].replace(/\s*\(Não inclui.*$/, '').trim();
      return productName;
    }
    return fullTitle;
  };

  const getAuctionName = (fullTitle: string | undefined) => {
    if (!fullTitle) return null;

    const parts = fullTitle.split(' - ');
    if (parts.length >= 1) {
      return parts[0]; // "Leilão de X"
    }
    return null;
  };

  // Get all image URLs (main + additional from metadata)
  const getAllImages = (): string[] => {
    const images: string[] = [];

    // Add main image
    if (lot?.image_url) {
      images.push(lot.image_url);
    }

    // Add additional images from metadata
    if (lot?.metadata?.images && Array.isArray(lot.metadata.images)) {
      lot.metadata.images.forEach((image: any) => {
        const url = typeof image === 'object' && image.url ? image.url : image;
        if (url && url !== lot?.image_url) {
          images.push(url);
        }
      });
    }

    return images;
  };

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const productName = getProductName(lot?.title);
  const auctionName = getAuctionName(lot?.title);
  const allImages = getAllImages();

  return (
    <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Breadcrumb / Top Info */}
      <div className="flex items-center gap-4 text-[#8E9297] text-sm">
        <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Radar
        </Link>
        <span>/</span>
        <span>{lot?.auctioneer || 'Leiloeiro'}</span>
        <span>/</span>
        <span className="text-white font-medium">{productName ? productName.substring(0, 40) + (productName.length > 40 ? '...' : '') : 'Lote'}</span>
      </div>

      {/* Main Title Area */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
          {productName || 'Carregando...'}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-[#8E9297]">
          {(lot?.location_city || lot?.location_state) && (
            <span className="flex items-center gap-1 text-sm">
              <MapPin className="w-3.5 h-3.5" />
              {lot?.location_city}{lot?.location_city && lot?.location_state && ", "}{lot?.location_state}
            </span>
          )}
          <span className="text-sm">•</span>
          <span className="text-sm">Encerra em <span className="text-white font-mono bg-[#2F3136] px-2 py-0.5 rounded-md ml-1">{timeLeft}</span></span>
          <span className="text-sm">•</span>
          {priceLoading ? (
            <span className="text-sm flex items-center gap-2">
              Lance Atual:
              <span className="inline-flex items-center gap-1.5">
                <span className="animate-pulse bg-[#2F3136] text-[#8E9297] px-2 py-0.5 rounded font-mono text-xs">
                  Carregando preço atualizado...
                </span>
                <RefreshCw className="w-3.5 h-3.5 text-[#5865F2] animate-spin" />
              </span>
            </span>
          ) : (
            <span className="text-sm flex items-center gap-1">
              Lance Atual:
              <span className="text-white font-bold font-mono">{formatPrice(lot?.current_bid || 0)}</span>
              {lot?.last_scraped_at && isPriceFresh(lot.last_scraped_at) && (
                <span className="ml-1.5 px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] text-xs font-medium rounded-full">
                  ✓ Atualizado agora
                </span>
              )}
            </span>
          )}
          <span className="text-sm">•</span>
          <button
            onClick={() => {
              console.log('Refresh button clicked, current timestamp:', lot?.last_scraped_at);
              refreshPrice();
            }}
            disabled={refreshingPrice || priceLoading}
            className={`text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
              (refreshingPrice || priceLoading)
                ? 'bg-[#2F3136] text-[#8E9297] cursor-wait'
                : 'bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] hover:text-[#4752C4]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrice ? 'animate-spin' : ''}`} />
            {refreshingPrice ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {/* Price Freshness Disclaimer */}
        {lot.last_scraped_at && (
          <div key={refreshTimestamp} className={`mt-3 px-4 py-3 rounded-xl border flex items-start gap-3 ${
            isPriceFresh(lot.last_scraped_at)
              ? 'bg-[#10B981]/10 border-[#10B981]/20'
              : 'bg-[#F59E0B]/10 border-[#F59E0B]/20'
          }`}>
            <div className={`flex-shrink-0 mt-0.5 ${
              isPriceFresh(lot.last_scraped_at) ? 'text-[#10B981]' : 'text-[#F59E0B]'
            }`}>
              {isPriceFresh(lot.last_scraped_at) ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-xs font-medium ${
                isPriceFresh(lot.last_scraped_at) ? 'text-[#10B981]' : 'text-[#F59E0B]'
              }`}>
                {isPriceFresh(lot.last_scraped_at) ? '✓ Preço verificado agora' : '⚠️ Este preço pode ter mudado'}
              </p>
              <p className="text-[11px] text-[#8E9297] mt-1">
                Atualizado: <span className="text-white font-medium">{formatRelativeTime(lot.last_scraped_at)}</span>
                {!isPriceFresh(lot.last_scraped_at) && (
                  <a
                    href={lot.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-[#5865F2] hover:text-[#4752C4] underline"
                  >
                    Ver preço atual
                  </a>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Split Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        
        {/* Left Column (Images & Basic Details) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Main Image Gallery */}
          <div className="space-y-4">
            <div
              className="aspect-video w-full rounded-[24px] overflow-hidden bg-[#0B0E14] border border-[#272A31] relative cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => openLightbox(0)}
            >
              <img
                src={lot?.image_url || "https://images.unsplash.com/photo-1558222218-b7b54eede3f3?auto=format&fit=crop&q=80&w=1200"}
                alt={productName || 'Lote'}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-[#10B981] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {lot?.risk_score === "BAIXO" ? "Alta Qualidade" : lot?.risk_score === "MÉDIO" ? "Qualidade OK" : "Verificar"}
              </div>

              {/* Zoom hint */}
              <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5">
                <Eye className="w-3 h-3" /> Clique para ampliar
              </div>
            </div>

            {/* Image Gallery Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {allImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-[#272A31] hover:border-[#5865F2] transition-colors cursor-pointer"
                    onClick={() => openLightbox(index)}
                  >
                    <img
                      src={imageUrl}
                      alt={`${productName} - Imagem ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Auction Information */}
          <div className="bg-[#151A22] rounded-[24px] border border-[#272A31] p-6">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-[#5865F2]" /> Informações do Leilão
            </h3>
            <div className="space-y-2">
              {auctionName && (
                <div className="flex items-center gap-2">
                  <span className="text-[#8E9297] text-sm w-24">Leilão:</span>
                  <span className="text-white font-medium">{auctionName}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[#8E9297] text-sm w-24">Leiloeiro:</span>
                <span className="text-white font-medium">{lot.auctioneer}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-[#151A22] rounded-[24px] border border-[#272A31] p-6">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#5865F2]" /> Itens do Lote
            </h3>
            {lot.description ? (
              <p className="text-white text-base leading-relaxed">{lot.description}</p>
            ) : (
              <p className="text-[#8E9297] text-sm italic">Descrição não disponível - o scraper pode não ter capturado esta informação</p>
            )}
          </div>

          {/* Extended Details Section */}
          <div className="bg-[#151A22] rounded-[24px] border border-[#272A31] p-6 space-y-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-[#5865F2]" /> Detalhes Completos do Lote
            </h3>

            {/* Seller Information */}
            {(lot.seller_name || lot.seller_logo_url) && (
              <div className="flex items-start gap-4 p-4 bg-[#0B0E14] rounded-xl border border-[#272A31]">
                {lot.seller_logo_url && (
                  <img
                    src={lot.seller_logo_url}
                    alt={lot.seller_name || 'Vendedor'}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="text-xs text-[#8E9297] uppercase tracking-wider mb-1">Vendedor</p>
                  <p className="text-white font-semibold">{lot.seller_name || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Auction Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {lot.views !== undefined && (
                <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                  <Eye className="w-5 h-5 text-[#5865F2] mb-2" />
                  <p className="text-2xl font-bold text-white">{lot.views.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-[#8E9297]">Visualizações</p>
                </div>
              )}
              {lot.bids_count !== undefined && (
                <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                  <Gavel className="w-5 h-5 text-[#5865F2] mb-2" />
                  <p className="text-2xl font-bold text-white">{lot.bids_count}</p>
                  <p className="text-xs text-[#8E9297]">Lances</p>
                </div>
              )}
              {lot.starting_bid && (
                <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                  <Zap className="w-5 h-5 text-[#10B981] mb-2" />
                  <p className="text-lg font-bold text-white">{formatPrice(lot.starting_bid)}</p>
                  <p className="text-xs text-[#8E9297]">Lance Inicial</p>
                </div>
              )}
              {lot.minimum_increment && (
                <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                  <AlertCircle className="w-5 h-5 text-[#F59E0B] mb-2" />
                  <p className="text-lg font-bold text-white">{formatPrice(lot.minimum_increment)}</p>
                  <p className="text-xs text-[#8E9297]">Incremento Mín.</p>
                </div>
              )}
            </div>

            {/* Measurements */}
            {lot.measurements && (
              <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                <div className="flex items-center gap-2 mb-2">
                  <Ruler className="w-4 h-4 text-[#5865F2]" />
                  <p className="text-sm font-semibold text-white">Medidas</p>
                </div>
                <p className="text-[#8E9297] text-sm">{lot.measurements}</p>
              </div>
            )}

            {/* Buyer Fee */}
            {lot.buyer_fee_percentage && (
              <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#F59E0B]" />
                    <p className="text-sm font-semibold text-white">Taxa de Comprador</p>
                  </div>
                  <p className="text-lg font-bold text-[#F59E0B]">{lot.buyer_fee_percentage}%</p>
                </div>
                <p className="text-xs text-[#8E9297] mt-1">Adicionado ao valor final do lance</p>
              </div>
            )}

            {/* References */}
            {lot.refs && lot.refs.length > 0 && (
              <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-[#5865F2]" />
                  <p className="text-sm font-semibold text-white">Referências</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lot.refs.map((ref, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-[#2F3136] text-[#8E9297] text-sm rounded-full border border-[#272A31]"
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Visiting Information */}
            {(lot.visiting_address || lot.visiting_observations) && (
              <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-[#10B981]" />
                  <p className="text-sm font-semibold text-white">Visitação</p>
                </div>
                {lot.visiting_address && (
                  <p className="text-[#8E9297] text-sm mb-2">{lot.visiting_address}</p>
                )}
                {lot.visiting_observations && (
                  <p className="text-white text-sm bg-[#2F3136] p-3 rounded-lg">{lot.visiting_observations}</p>
                )}
              </div>
            )}

            {/* Pickup Information */}
            {(lot.pickup_address || lot.pickup_observations) && (
              <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-[#F59E0B]" />
                  <p className="text-sm font-semibold text-white">Retirada</p>
                </div>
                {lot.pickup_address && (
                  <p className="text-[#8E9297] text-sm mb-2">{lot.pickup_address}</p>
                )}
                {lot.pickup_observations && (
                  <p className="text-white text-sm bg-[#2F3136] p-3 rounded-lg">{lot.pickup_observations}</p>
                )}
              </div>
            )}

            {/* General Observations */}
            {lot.general_observations && (
              <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#272A31]">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-[#5865F2]" />
                  <p className="text-sm font-semibold text-white">Observações Gerais</p>
                </div>
                <p className="text-[#8E9297] text-sm">{lot.general_observations}</p>
              </div>
            )}
          </div>

          {/* Risk Assessment Module */}
          <div className="bg-[#151A22] rounded-[24px] overflow-hidden border border-[#5865F2]/20 shadow-[0_0_40px_-10px_rgba(88,101,242,0.15)] relative">
            <div className="absolute top-0 right-0 p-4">
              <div className="flex items-center gap-1.5 text-[#5865F2] text-xs font-bold bg-[#5865F2]/10 px-3 py-1 rounded-full uppercase tracking-widest">
                <Cpu className="w-3.5 h-3.5" /> AI Consultant
              </div>
            </div>

            <div className="p-8">
              <h3 className="text-xl font-bold text-white mb-6">Análise de Risco</h3>

              <div className="bg-[#0B0E14] rounded-2xl p-6 border border-[#272A31]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-semibold text-[#8E9297]">Termômetro de Risco</h4>
                  <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${lot.risk_score === "BAIXO" ? "text-[#10B981] bg-[#10B981]/10" : lot.risk_score === "MÉDIO" ? "text-[#F59E0B] bg-[#F59E0B]/10" : "text-[#EF4444] bg-[#EF4444]/10"}`}>
                    {lot.risk_score === "BAIXO" ? "Baixo Risco" : lot.risk_score === "MÉDIO" ? "Risco Médio" : "Alto Risco"}
                  </span>
                </div>
                <div className="h-3 w-full bg-[#2F3136] rounded-full overflow-hidden flex">
                  <div className={`h-full ${lot.risk_score === "BAIXO" ? "bg-[#10B981] w-full" : lot.risk_score === "MÉDIO" ? "bg-[#F59E0B] w-2/3" : "bg-[#EF4444] w-1/3"}`}></div>
                  {lot.risk_score !== "BAIXO" && <div className={`h-full ${lot.risk_score === "ALTO" ? "bg-[#EF4444]/20 w-2/3" : "bg-[#F59E0B]/30 w-1/3"} border-l-2 border-[#151A22]`}></div>}
                </div>
                <p className="mt-4 text-sm text-[#8E9297] leading-relaxed">
                  Modelo <strong>MiniMax</strong> analisou este lote. {lot.risk_score === "BAIXO" ? "Baixo risco identificado com excelente oportunidade." : lot.risk_score === "MÉDIO" ? "Risco moderado - recomenda-se diligência prévia." : "Alto risco - verifique taxas e condições antes de ofertar."}
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column (Edict & Actions) */}
        <div className="space-y-6">

          {/* Quick Actions */}
          <div className="bg-[#151A22] rounded-[24px] border border-[#272A31] p-6">
            <h3 className="text-lg font-bold text-white mb-4">Ações Rápidas</h3>

            <div className="space-y-3">
              {/* Favorite/Watchlist Toggle */}
              <button
                onClick={toggleWatchlist}
                disabled={toggleLoading}
                className={`w-full py-3 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  isInWatchlist
                    ? 'bg-[#10B981] hover:bg-[#059669] text-white'
                    : 'bg-[#2F3136] hover:bg-[#272A31] border border-[#272A31] text-white'
                }`}
              >
                <BellRing className="w-4 h-4" />
                {toggleLoading ? 'Processando...' : isInWatchlist ? 'Salvo nos Alertas' : 'Adicionar aos Alertas'}
              </button>

              {/* Visit Source Site */}
              {lot.source_url ? (
                <a
                  href={lot.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-3 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" /> Ver no Site Original
                </a>
              ) : (
                <div className="w-full bg-[#2F3136] border border-dashed border-[#8E9297] text-[#8E9297] py-3 rounded-full text-sm text-center">
                  Link do lote em breve
                </div>
              )}
            </div>
          </div>

          {/* Edict Link */}
          {lot.edict_url && (
            <div className="bg-[#151A22] rounded-[24px] border border-[#272A31] shadow-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#5865F2]" /> Edital Oficial
              </h3>

              <a
                href={lot.edict_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#2F3136] hover:bg-[#272A31] border border-[#272A31] text-white py-3 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> Ler PDF Original
              </a>

              <div className="mt-4 p-4 bg-[#0B0E14] rounded-xl border border-[#EF4444]/20">
                <p className="text-[#8E9297] text-xs leading-relaxed">
                  <strong className="text-[#EF4444]">Atenção:</strong> Leia o edital completo antes de ofertar. Verifique taxas, comissões, formas de pagamento e condições de retirada.
                </p>
              </div>
            </div>
          )}

          {/* Quick Info */}
          <div className="bg-[#151A22] rounded-[24px] border border-[#272A31] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white mb-2">Informações do Lote</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-[#272A31]">
                <span className="text-[#8E9297] text-sm">Categoria</span>
                <span className="text-white text-sm font-medium">{lot.category}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-[#272A31]">
                <span className="text-[#8E9297] text-sm">Leiloeiro</span>
                <span className="text-white text-sm font-medium">{lot.auctioneer}</span>
              </div>

              {(lot.location_city || lot.location_state) && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-[#8E9297] text-sm">Localização</span>
                  <span className="text-white text-sm font-medium">{lot.location_city} {lot.location_city && lot.location_state && ", "} {lot.location_state}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute top-4 right-4 z-10 p-2 bg-[#151A22] hover:bg-[#272A31] rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Navigation Arrows */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevImage();
                }}
                className="absolute left-4 z-10 p-3 bg-[#151A22] hover:bg-[#272A31] rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextImage();
                }}
                className="absolute right-4 z-10 p-3 bg-[#151A22] hover:bg-[#272A31] rounded-full transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Image Counter */}
          {allImages.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 bg-[#151A22] rounded-full">
              <p className="text-white text-sm font-medium">
                {currentImageIndex + 1} / {allImages.length}
              </p>
            </div>
          )}

          {/* Main Image */}
          <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={allImages[currentImageIndex]}
              alt={`${productName} - Imagem ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
