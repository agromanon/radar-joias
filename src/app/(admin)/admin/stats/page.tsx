import { BarChart3, TrendingUp, DollarSign, Users, Zap, ArrowUpRight } from "lucide-react";

const MONTHS = ["Out", "Nov", "Dez", "Jan", "Fev", "Mar"];
const MRR = [3200, 5800, 8100, 11400, 15900, 22300];
const MAX_MRR = Math.max(...MRR);

export default function StatsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#10B981]" /> Métricas de Crescimento
        </h1>
        <p className="text-[#8E9297] text-sm mt-1">Acompanhe o MRR, churn e evolução da base de clientes.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-[#10B981]/10 rounded-lg"><DollarSign className="w-4 h-4 text-[#10B981]" /></div>
            <span className="text-[#10B981] text-xs font-bold flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+40%</span>
          </div>
          <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">MRR Atual</p>
          <h3 className="text-2xl font-bold text-white mt-1 tabular-nums">R$ 22.300</h3>
        </div>
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-[#5865F2]/10 rounded-lg"><Users className="w-4 h-4 text-[#5865F2]" /></div>
            <span className="text-[#10B981] text-xs font-bold flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+12%</span>
          </div>
          <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Usuários Ativos</p>
          <h3 className="text-2xl font-bold text-white mt-1 tabular-nums">1.284</h3>
        </div>
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-[#F59E0B]/10 rounded-lg"><TrendingUp className="w-4 h-4 text-[#F59E0B]" /></div>
            <span className="text-[#10B981] text-xs font-bold">Saudável</span>
          </div>
          <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Churn Rate</p>
          <h3 className="text-2xl font-bold text-white mt-1 tabular-nums">2.1%</h3>
        </div>
        <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-[#EF4444]/10 rounded-lg"><Zap className="w-4 h-4 text-[#EF4444]" /></div>
            <span className="text-[#10B981] text-xs font-bold flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+8</span>
          </div>
          <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Novos / Dia</p>
          <h3 className="text-2xl font-bold text-white mt-1 tabular-nums">+28</h3>
        </div>
      </div>

      {/* MRR Chart (CSS-based bar chart) */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8">
        <h2 className="text-base font-bold text-white mb-8">Evolução do MRR (6 meses)</h2>
        <div className="flex items-end gap-4 h-48">
          {MONTHS.map((month, i) => {
            const heightPct = (MRR[i] / MAX_MRR) * 100;
            const isLast = i === MONTHS.length - 1;
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[#8E9297] text-[10px] font-bold tabular-nums">
                  {(MRR[i] / 1000).toFixed(1)}k
                </span>
                <div className="w-full rounded-t-xl transition-all duration-700 relative group"
                  style={{ height: `${heightPct}%`, background: isLast ? "#5865F2" : "#2F3136" }}>
                  {isLast && <div className="absolute inset-0 rounded-t-xl bg-[#5865F2] animate-pulse opacity-30"></div>}
                </div>
                <span className={`text-[10px] font-bold ${isLast ? "text-[#5865F2]" : "text-[#8E9297]"}`}>{month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8">
        <h2 className="text-base font-bold text-white mb-6">Distribuição por Plano</h2>
        <div className="space-y-4">
          {[
            { plan: "War Room", count: 38, color: "#F59E0B", pct: 3 },
            { plan: "Engenharia B2B", count: 412, color: "#5865F2", pct: 32 },
            { plan: "Rastreador Básico", count: 834, color: "#2F3136", pct: 65 },
          ].map((item) => (
            <div key={item.plan}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white font-medium">{item.plan}</span>
                <span className="text-[#8E9297] font-bold tabular-nums">{item.count} usuários ({item.pct}%)</span>
              </div>
              <div className="w-full bg-[#0B0E14] rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${item.pct}%`, backgroundColor: item.color }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
