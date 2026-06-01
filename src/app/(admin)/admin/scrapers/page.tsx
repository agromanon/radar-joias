"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, RefreshCw, AlertTriangle, CheckCircle2, Clock, Play, Zap, Image, Link2, FileText, TrendingUp, Trash2, Globe, Activity } from "lucide-react";

interface ScraperMode {
  mode: string;
  label: string;
  description: string;
  schedule: string;
  isOnDemand: boolean;
  stats: {
    lastRun: string | null;
    totalRuns: number;
    successCount: number;
    errorCount: number;
    totalItemsFound: number;
    totalItemsNew: number;
    totalItemsUpdated: number;
    totalErrors: number;
    avgDurationMs: number;
    lastSuccess: string | null;
    lastError: string | null;
  } | null;
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  'states-cities': <Globe className="w-5 h-5" />,
  'bid-periods': <Clock className="w-5 h-5" />,
  'discover': <Bot className="w-5 h-5" />,
  'active-lots': <Activity className="w-5 h-5" />,
  'results': <CheckCircle2 className="w-5 h-5" />,
  'insight': <TrendingUp className="w-5 h-5" />,
  'enrich': <Zap className="w-5 h-5" />,
  'download-images': <Image className="w-5 h-5" />,
  'health-check-images': <Image className="w-5 h-5" />,
  'refresh-images': <Image className="w-5 h-5" />,
  'dedup': <Trash2 className="w-5 h-5" />,
  'edital': <FileText className="w-5 h-5" />,
  'auctions': <Link2 className="w-5 h-5" />,
  'scrape-lots': <Activity className="w-5 h-5" />,
  'scrape-results': <CheckCircle2 className="w-5 h-5" />,
  're-scrape-missing': <Image className="w-5 h-5" />,
  'reconstruct-urls': <Link2 className="w-5 h-5" />,
};

const MODE_COLORS: Record<string, string> = {
  'states-cities': 'bg-blue-600',
  'bid-periods': 'bg-indigo-600',
  'discover': 'bg-purple-600',
  'active-lots': 'bg-green-600',
  'results': 'bg-teal-600',
  'insight': 'bg-cyan-600',
  'enrich': 'bg-yellow-600',
  'download-images': 'bg-pink-600',
  'health-check-images': 'bg-rose-600',
  'refresh-images': 'bg-fuchsia-600',
  'dedup': 'bg-orange-600',
  'edital': 'bg-amber-600',
  'auctions': 'bg-violet-600',
  'scrape-lots': 'bg-emerald-600',
  'scrape-results': 'bg-cyan-600',
  're-scrape-missing': 'bg-pink-600',
  'reconstruct-urls': 'bg-sky-600',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 1000)}s`
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const now = new Date()
  const past = new Date(dateStr)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return 'Agora'
  if (diffMins < 60) return `Há ${diffMins}m`
  if (diffHours < 24) return `Há ${diffHours}h`
  return `Há ${diffDays}d`
}

function StatusBadge({ stats }: { stats: ScraperMode['stats'] }) {
  if (!stats) return <span className="text-xs text-[#8E9297]">Sem dados</span>
  if (stats.errorCount > 0 && stats.totalRuns > 0) {
    const errorRate = Math.round((stats.errorCount / stats.totalRuns) * 100)
    return <span className="text-xs font-bold text-[#EF4444]">{errorRate}% erro</span>
  }
  if (stats.totalRuns === 0) return <span className="text-xs text-[#8E9297]">Nunca executado</span>
  return <span className="text-xs font-bold text-[#10B981]">OK</span>
}

export default function ScrapersPage() {
  const [modes, setModes] = useState<ScraperMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerSuccess, setTriggerSuccess] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scrapers/status');
      if (res.ok) {
        const data = await res.json();
        setModes(data.modes || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleTrigger = async (mode: string) => {
    setTriggering(mode);
    setTriggerSuccess(null);
    try {
      const res = await fetch('/api/admin/scrapers/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setTriggerSuccess(mode);
        setTimeout(() => setTriggerSuccess(null), 3000);
      } else {
        console.error('Trigger failed:', data.error);
      }
    } catch (e) {
      console.error('Trigger error:', e);
    } finally {
      setTriggering(null);
    }
  };

  const scheduledModes = modes.filter(m => !m.isOnDemand);
  const onDemandModes = modes.filter(m => m.isOnDemand);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bot className="w-7 h-7 text-[#5865F2]" /> Scraper Status
          </h1>
          <p className="text-[#8E9297] text-sm mt-1">Monitore execuções e acione robôs sob demanda.</p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 bg-[#151A22] border border-[#272A31] hover:border-[#454655] text-white px-4 py-2 rounded-xl font-bold transition-all text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Scheduled scrapers grid */}
      <div>
        <h2 className="text-sm font-bold text-[#8E9297] uppercase tracking-wider mb-4">Cronogramados</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5 animate-pulse">
                <div className="h-5 bg-[#2F3136] rounded w-1/2 mb-3" />
                <div className="h-4 bg-[#2F3136] rounded w-3/4 mb-4" />
                <div className="h-8 bg-[#2F3136] rounded w-1/3" />
              </div>
            ))
          ) : (
            scheduledModes.map((m) => {
              const iconBg = MODE_COLORS[m.mode] || 'bg-[#454655]'
              return (
                <div key={m.mode} className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5 hover:border-[#454655] transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-white`}>
                        {MODE_ICONS[m.mode] || <Bot className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-sm">{m.label}</h3>
                        <p className="text-[#8E9297] text-xs">{m.schedule}</p>
                      </div>
                    </div>
                    <StatusBadge stats={m.stats} />
                  </div>
                  <p className="text-[#8E9297] text-xs mb-4 leading-relaxed">{m.description}</p>
                  {m.stats ? (
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#272A31]">
                      <div className="text-center">
                        <div className="text-white font-black text-lg">{m.stats.totalRuns}</div>
                        <div className="text-[#8E9297] text-[10px] uppercase">Execuções</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white font-black text-lg">{m.stats.totalItemsFound.toLocaleString()}</div>
                        <div className="text-[#8E9297] text-[10px] uppercase">Itens</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white font-black text-lg">{formatDuration(m.stats.avgDurationMs)}</div>
                        <div className="text-[#8E9297] text-[10px] uppercase">Tempo Médio</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* On-demand scrapers */}
      <div>
        <h2 className="text-sm font-bold text-[#8E9297] uppercase tracking-wider mb-4">Sob Demanda</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#151A22] border border-[#272A31] rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-[#2F3136] rounded w-2/3 mb-2" />
                <div className="h-3 bg-[#2F3136] rounded w-1/2" />
              </div>
            ))
          ) : (
            onDemandModes.map((m) => {
              const iconBg = MODE_COLORS[m.mode] || 'bg-[#454655]'
              return (
                <div key={m.mode} className="bg-[#151A22] border border-[#272A31] rounded-xl p-4 flex items-center justify-between hover:border-[#454655] transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center text-white`}>
                      {MODE_ICONS[m.mode] || <Bot className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-xs">{m.label}</h3>
                      <p className="text-[#8E9297] text-[10px]">{formatTimeAgo(m.stats?.lastRun || null)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTrigger(m.mode)}
                    disabled={triggering === m.mode}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      triggerSuccess === m.mode
                        ? 'bg-[#10B981] text-white'
                        : 'bg-[#5865F2] hover:bg-[#4752C4] text-white disabled:opacity-50'
                    }`}
                  >
                    {triggering === m.mode ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : triggerSuccess === m.mode ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {triggerSuccess === m.mode ? 'Disparado!' : 'Disparar'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Stats summary */}
      {!loading && modes.length > 0 && (
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-6">
          <h2 className="text-white font-bold text-sm mb-4">Resumo Geral</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-black text-white">
                {modes.reduce((sum, m) => sum + (m.stats?.totalRuns || 0), 0)}
              </div>
              <div className="text-[#8E9297] text-xs mt-1">Total de Execuções</div>
            </div>
            <div>
              <div className="text-3xl font-black text-[#10B981]">
                {modes.reduce((sum, m) => sum + (m.stats?.totalItemsFound || 0), 0).toLocaleString()}
              </div>
              <div className="text-[#8E9297] text-xs mt-1">Total de Itens Capturados</div>
            </div>
            <div>
              <div className="text-3xl font-black text-[#5865F2]">
                {modes.reduce((sum, m) => sum + (m.stats?.totalItemsNew || 0), 0).toLocaleString()}
              </div>
              <div className="text-[#8E9297] text-xs mt-1">Novos Itens</div>
            </div>
            <div>
              <div className="text-3xl font-black text-[#EF4444]">
                {modes.reduce((sum, m) => sum + (m.stats?.totalErrors || 0), 0)}
              </div>
              <div className="text-[#8E9297] text-xs mt-1">Total de Erros</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}