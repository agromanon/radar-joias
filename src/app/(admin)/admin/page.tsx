"use client";

import { ArrowUpRight, ArrowDownRight, Users, Database, Zap, Cpu, AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface ScraperLog {
  auctioneer: string;
  lots_count: number;
  status: 'success' | 'error' | 'running';
  ran_at: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [scrapers, setScrapers] = useState<ScraperLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch stats
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch scraper logs
      const scrapersRes = await fetch('/api/admin/scrapers/logs');
      if (scrapersRes.ok) {
        const scrapersData = await scrapersRes.json();
        setScrapers(scrapersData.logs || []);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins} minutos`;
    return `Há ${diffHours} horas`;
  };

  const getScraperStatus = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="flex items-center gap-1.5 text-[#10B981] text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div> ONLINE</span>;
      case 'error':
        return <span className="flex items-center gap-1.5 text-[#EF4444] text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse"></div> ERROR</span>;
      case 'running':
        return <span className="flex items-center gap-1.5 text-[#F59E0B] text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-spin"></div> RODANDO</span>;
      default:
        return <span className="flex items-center gap-1.5 text-[#8E9297] text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-[#8E9297]"></div> DESC</span>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#5865F2] animate-spin mx-auto mb-4" />
          <p className="text-[#8E9297]">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
        <p className="text-[#EF4444]">Erro ao carregar dashboard. Verifique suas permissões de admin.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#151A22] border border-[#272A31] p-6 rounded-3xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#5865F2]/10 rounded-xl text-[#5865F2]"><Users className="w-5 h-5" /></div>
            <span className="text-[#10B981] text-xs font-bold flex items-center gap-1">{stats.users.growth}</span>
          </div>
          <p className="text-[#8E9297] text-xs font-bold uppercase tracking-widest">Usuários Ativos</p>
          <h3 className="text-3xl font-bold text-white mt-1">{formatNumber(stats.users.total)}</h3>
        </div>

        <div className="bg-[#151A22] border border-[#272A31] p-6 rounded-3xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#F59E0B]/10 rounded-xl text-[#F59E0B]"><Database className="w-5 h-5" /></div>
            <span className="text-[#10B981] text-xs font-bold flex items-center gap-1">+{stats.lots.addedLast24h}</span>
          </div>
          <p className="text-[#8E9297] text-xs font-bold uppercase tracking-widest">Lotes Escaneados/Dia</p>
          <h3 className="text-3xl font-bold text-white mt-1">{formatNumber(stats.lots.total)}</h3>
        </div>

        <div className="bg-[#151A22] border border-[#272A31] p-6 rounded-3xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#10B981]/10 rounded-xl text-[#10B981]"><Zap className="w-5 h-5" /></div>
            <span className="text-[#10B981] text-xs font-bold flex items-center gap-1">{stats.scrapers.status}</span>
          </div>
          <p className="text-[#8E9297] text-xs font-bold uppercase tracking-widest">Status dos Scrapers</p>
          <h3 className="text-3xl font-bold text-white mt-1">{stats.scrapers.active}/{scrapers.length}</h3>
        </div>

        <div className="bg-[#151A22] border border-[#272A31] p-6 rounded-3xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#5865F2]/10 rounded-xl text-[#5865F2]"><Cpu className="w-5 h-5" /></div>
            <span className="text-[#10B981] text-xs font-bold">Normal</span>
          </div>
          <p className="text-[#8E9297] text-xs font-bold uppercase tracking-widest">Engajamento</p>
          <h3 className="text-3xl font-bold text-white mt-1">{stats.engagement.totalWatchlist}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Scraper Status List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-[#EF4444]" /> Robôs de Captura
            </h2>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 text-[#5865F2] text-xs font-bold hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#272A31] bg-[#0B0E14]/30">
                  <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Fonte Leiloeiro</th>
                  <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Última Varredura</th>
                  <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest text-right">Lotes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#272A31]">
                {scrapers.map((scraper, index) => (
                  <tr key={index} className={`hover:bg-[#2F3136]/10 transition-colors ${scraper.status === 'error' ? 'bg-[#EF4444]/5' : ''}`}>
                    <td className="px-6 py-4 text-white font-bold text-sm">{scraper.auctioneer}</td>
                    <td className="px-6 py-4">{getScraperStatus(scraper.status)}</td>
                    <td className="px-6 py-4 text-[#8E9297] text-xs font-medium">{formatTimeAgo(scraper.ran_at)}</td>
                    <td className="px-6 py-4 text-white text-sm font-bold text-right tabular-nums">
                      {scraper.status === 'success' ? formatNumber(scraper.lots_count) : '--'}
                    </td>
                  </tr>
                ))}
                {scrapers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-[#8E9297] text-sm">
                      Nenhum scraper executado ainda. Configure o GitHub Actions para rodar automaticamente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Alerts */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#F59E0B]" /> Alertas do Sistema
          </h2>
          <div className="space-y-3">
            <div className="bg-[#151A22] border-l-4 border-[#10B981] p-4 rounded-xl">
              <p className="text-white text-xs font-bold">Sistema Operacional</p>
              <p className="text-[#8E9297] text-[11px] mt-1">
                {stats.lots.active} lotes ativos no banco de dados. {stats.lots.highValue} lotes com alto valor percebido.
              </p>
              <span className="text-[#10px] text-[#454655] block mt-2">Atualizado: {new Date(stats.timestamp).toLocaleString('pt-BR')}</span>
            </div>

            {stats.engagement.avgWatchlistPerUser > 0 && (
              <div className="bg-[#151A22] border-l-4 border-[#5865F2] p-4 rounded-xl">
                <p className="text-white text-xs font-bold">Engajamento dos Usuários</p>
                <p className="text-[#8E9297] text-[11px] mt-1">
                  Média de {stats.engagement.avgWatchlistPerUser} lotes na watchlist por usuário.
                </p>
              </div>
            )}

            {stats.scrapers.status !== 'operational' && (
              <div className="bg-[#151A22] border-l-4 border-[#EF4444] p-4 rounded-xl">
                <p className="text-white text-xs font-bold">Atenção aos Scrapers</p>
                <p className="text-[#8E9297] text-[11px] mt-1">
                  Verifique o status dos scrapers acima. Algumas fontes podem estar retornando erros.
                </p>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-tr from-[#151A22] to-[#0B0E14] border border-[#5865F2]/20 rounded-3xl p-6">
            <h4 className="text-white font-bold text-sm mb-2">💡 Próximos Passos</h4>
            <p className="text-[#8E9297] text-xs leading-relaxed">
              Configure o GitHub Actions para rodar os scrapers automaticamente a cada 6 horas.
              Monitore o dashboard para garantir que os dados estão sendo atualizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
