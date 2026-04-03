import Link from "next/link";
import { Star, ExternalLink, Trash2, Brain, AlertTriangle } from "lucide-react";

const SAVED_LOTS = [
  {
    id: 1,
    title: "Sucata de Cobre Misto (2 Toneladas)",
    auctioneer: "Sodré Santoro",
    price: "R$ 45.000",
    image: "https://images.unsplash.com/photo-1558222218-b7b54eede3f3?auto=format&fit=crop&q=80&w=800",
    risk: "BAIXO RISCO",
    riskColor: "bg-[#10B981]",
    riskText: "text-[#10B981]",
    savedAt: "Salvo há 2 dias",
    date: "15 Abr 2026",
  },
  {
    id: 2,
    title: "Trator Agrícola John Deere 2018",
    auctioneer: "Freitas Leiloeiro",
    price: "R$ 120.000",
    image: "https://images.unsplash.com/photo-1592982537447-6f296d34cc81?auto=format&fit=crop&q=80&w=800",
    risk: "MÉDIO RISCO",
    riskColor: "bg-[#F59E0B]",
    riskText: "text-[#F59E0B]",
    savedAt: "Salvo há 5 dias",
    date: "18 Abr 2026",
  },
  {
    id: 3,
    title: "Máquina de Torno CNC Romi",
    auctioneer: "Kwara",
    price: "R$ 85.500",
    image: "https://images.unsplash.com/photo-1565439387878-1a52fc0ba3fc?auto=format&fit=crop&q=80&w=800",
    risk: "MÉDIO RISCO",
    riskColor: "bg-[#F59E0B]",
    riskText: "text-[#F59E0B]",
    savedAt: "Salvo há 1 semana",
    date: "20 Abr 2026",
  },
];

export default function WatchlistPage() {
  return (
    <div className="min-h-full p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Star className="w-6 h-6 text-[#F59E0B]" fill="#F59E0B" /> Lotes Salvos
        </h1>
        <p className="text-[#8E9297] text-sm mt-1">
          {SAVED_LOTS.length} lote{SAVED_LOTS.length !== 1 ? "s" : ""} na sua watchlist
        </p>
      </div>

      {SAVED_LOTS.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Star className="w-14 h-14 text-[#272A31] mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Nenhum lote salvo ainda</h2>
          <p className="text-[#8E9297] text-sm mb-6 max-w-xs">
            Navegue pelos leilões e clique na estrela para salvar os que te interessam.
          </p>
          <Link
            href="/dashboard"
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-full font-bold transition-colors text-sm shadow-lg shadow-[#5865F2]/20"
          >
            Explorar Lotes
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {SAVED_LOTS.map((lot) => (
            <div
              key={lot.id}
              className="group flex gap-5 bg-[#151A22] border border-[#272A31] hover:border-[#454655] rounded-2xl p-4 transition-all duration-200"
            >
              {/* Thumbnail */}
              <div className="w-28 md:w-36 aspect-[4/3] flex-shrink-0 rounded-xl overflow-hidden bg-[#0B0E14]">
                <img
                  src={lot.image}
                  alt={lot.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-wider mb-1">
                        {lot.auctioneer}
                      </p>
                      <h2 className="text-white font-bold text-sm md:text-base leading-snug line-clamp-2">
                        {lot.title}
                      </h2>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex-shrink-0 ${lot.riskColor}`}>
                      {lot.risk}
                    </span>
                  </div>

                  {/* AI hint */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Brain className="w-3.5 h-3.5 text-[#5865F2]" />
                    <span className="text-[#8E9297] text-xs">
                      Análise IA disponível — {lot.riskText.includes("10B981") ? "oportunidade favorável" : "verifique custos ocultos"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
                  <div>
                    <p className="text-[#8E9297] text-[10px]">Lance atual</p>
                    <p className="text-white font-bold text-base tabular-nums">{lot.price}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#454655] text-[10px] hidden sm:block">{lot.savedAt}</span>

                    <Link
                      href={`/lote/${lot.id}`}
                      className="flex items-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-md shadow-[#5865F2]/20"
                    >
                      <Brain className="w-3.5 h-3.5" /> Ver Análise
                    </Link>

                    <a
                      href="#"
                      className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#454655] text-[#8E9297] hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#EF4444]/40 text-[#8E9297] hover:text-[#EF4444] px-3 py-2 rounded-xl text-xs font-bold transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Bottom tip */}
          <div className="flex items-start gap-3 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-2xl p-4 mt-6">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <p className="text-[#8E9297] text-xs leading-relaxed">
              <span className="text-white font-bold">Lembrete:</span> Os leiloeiros não oferecem transporte.
              Confirme a localização do pátio antes de dar um lance. Use o{" "}
              <Link href="/mapa" className="text-[#5865F2] hover:underline">Radar Geográfico</Link> para verificar a distância.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
