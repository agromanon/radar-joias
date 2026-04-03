"use client";

import { useState, useEffect } from "react";
import { Database, RefreshCw, AlertTriangle, CheckCircle2, Clock, Play, Square } from "lucide-react";

interface ScraperLog {
  auctioneer: string;
  lots_count: number;
  status: 'success' | 'error' | 'running';
  ran_at: string;
}

interface Scraper {
  id: string;
  name: string;
  url: string;
  status: 'ONLINE' | 'ERROR' | 'PAUSED';
  lastRun: string;
  lotsFound: number;
  successRate: string;
  schedule: string;
}

export default function ScrapersPage() {
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScrapers() {
      try {
        const response = await fetch('/api/admin/scrapers/logs');
        if (response.ok) {
          const data = await response.json();

          // Transform API response to Scraper format
          const transformedScrapers: Scraper[] = data.logs.map((log: ScraperLog, index: number) => {
            // Calculate success rate (placeholder logic for now)
            const successRate = log.status === 'success' ? '99.2%' :
                                log.status === 'error' ? '0%' : '95.1%';

            // Map status
            const status: 'ONLINE' | 'ERROR' | 'PAUSED' = log.status === 'success' ? 'ONLINE' :
                                                           log.status === 'error' ? 'ERROR' : 'PAUSED';

            return {
              id: log.auctioneer,
              name: log.auctioneer,
              url: `${log.auctioneer.toLowerCase().replace(/\s+/g, '')}.com.br`,
              status,
              lastRun: formatTimeAgo(log.ran_at),
              lotsFound: log.lots_count,
              successRate,
              schedule: '*/30 * * * *', // Default schedule for now
            };
          });

          setScrapers(transformedScrapers);
        }
      } catch (error) {
        console.error('Error fetching scrapers:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchScrapers();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins} min`;
    return `Há ${diffHours}h`;
  };

  const hasErrors = scrapers.some(s => s.status === 'ERROR');

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-[#EF4444]" /> Robôs Scrapers
          </h1>
          <p className="text-[#8E9297] text-sm mt-1">Gerencie e monitore os robôs de captura de lotes.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-[#5865F2]/20">
          <RefreshCw className="w-4 h-4" /> Reiniciar Todos
        </button>
      </div>

      {/* Alert banner */}
      {hasErrors && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
          <p className="text-[#EF4444] text-sm font-medium">
            {scrapers.filter(s => s.status === 'ERROR').length} robô(s) com falha detectada. Verifique os logs para mais detalhes.
          </p>
        </div>
      )}

      {/* Scrapers Table */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-[#454655] text-sm">Carregando scrapers...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#272A31] bg-[#0B0E14]/40">
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Leiloeiro</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Última Execução</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest text-right">Lotes / Taxa</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Agendamento</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272A31]">
              {scrapers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#8E9297] text-sm">
                    Nenhum scraper executado ainda. Configure o GitHub Actions para rodar automaticamente.
                  </td>
                </tr>
              )}
              {scrapers.map((s) => (
                <tr key={s.id} className={`transition-colors hover:bg-[#2F3136]/10 ${s.status === "ERROR" ? "bg-[#EF4444]/5" : ""}`}>
                  <td className="px-6 py-4">
                    <p className="text-white font-bold text-sm">{s.name}</p>
                    <p className="text-[#8E9297] text-[11px]">{s.url}</p>
                  </td>
                  <td className="px-6 py-4">
                    {s.status === "ONLINE" && <span className="flex items-center gap-1.5 text-[#10B981] text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>ONLINE</span>}
                    {s.status === "ERROR" && <span className="flex items-center gap-1.5 text-[#EF4444] text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse"></div>ERROR</span>}
                    {s.status === "PAUSED" && <span className="flex items-center gap-1.5 text-[#8E9297] text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-[#8E9297]"></div>PAUSADO</span>}
                  </td>
                  <td className="px-6 py-4 text-[#8E9297] text-xs">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.lastRun}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-white text-sm font-bold tabular-nums">{s.lotsFound.toLocaleString()}</p>
                    <p className={`text-xs font-bold ${s.status === "ERROR" ? "text-[#EF4444]" : "text-[#10B981]"}`}>{s.successRate}</p>
                  </td>
                  <td className="px-6 py-4 text-[#8E9297] text-xs font-mono">{s.schedule}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1.5 bg-[#10B981]/10 text-[#10B981] rounded-lg hover:bg-[#10B981]/20 transition-colors" title="Executar agora">
                        <Play className="w-3 h-3" />
                      </button>
                      <button className="p-1.5 bg-[#EF4444]/10 text-[#EF4444] rounded-lg hover:bg-[#EF4444]/20 transition-colors" title="Pausar">
                        <Square className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Scraper */}
      <div className="bg-[#151A22] border border-dashed border-[#272A31] rounded-3xl p-8 text-center hover:border-[#5865F2]/50 transition-colors cursor-pointer group">
        <CheckCircle2 className="w-8 h-8 text-[#454655] group-hover:text-[#5865F2] mx-auto mb-3 transition-colors" />
        <p className="text-[#8E9297] text-sm font-medium group-hover:text-white transition-colors">Adicionar novo leiloeiro para monitoramento</p>
      </div>
    </div>
  );
}
