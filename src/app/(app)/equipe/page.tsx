"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Plus, Users, Globe, Lock, Trash2, Copy, Check, Loader2, BarChart3, Clock, TrendingUp, List, LayoutDashboard } from "lucide-react";
import { useUser } from "@/hooks/useUser";

type DashboardStats = {
  totalWatchlists: number;
  totalItems: number;
  recentItemsCount: number;
};

type DashboardWatchlist = {
  id: string;
  name: string;
  shareCode: string;
  isPublic: boolean;
  itemCount: number;
  updatedAt: string;
};

type RecentItem = {
  id: string;
  notes: string | null;
  addedAt: string;
  watchlistName: string;
  watchlistCode: string;
  lot: {
    id: string;
    lotNumber: number;
    contract: string;
    value: number;
    imageUrl: string | null;
    city: string | null;
    state: string | null;
    weight: number | null;
    karat: string | null;
  } | null;
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

export default function EquipePage() {
  const { user } = useUser();
  const [view, setView] = useState<"dashboard" | "manage">("dashboard");
  const [dashboard, setDashboard] = useState<{
    stats: DashboardStats;
    watchlists: DashboardWatchlist[];
    recentItems: RecentItem[];
    karatBreakdown: Record<string, number>;
  } | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

  // Existing watchlists state (for manage view)
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (view === "dashboard") fetchDashboard();
      else fetchWatchlists();
    }
  }, [user, view]);

  async function fetchDashboard() {
    setDashLoading(true);
    try {
      const res = await fetch("/api/shared-watchlists/dashboard");
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (e) {
      console.error("Error fetching dashboard:", e);
    } finally {
      setDashLoading(false);
    }
  }

  async function fetchWatchlists() {
    setLoading(true);
    try {
      const res = await fetch("/api/shared-watchlists");
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data.watchlists || []);
      }
    } catch (e) {
      console.error("Error fetching:", e);
    } finally {
      setLoading(false);
    }
  }

  async function createWatchlist(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/shared-watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc || null, is_public: newPublic }),
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlists(prev => [data.watchlist, ...prev]);
        setShowCreate(false);
        setNewName("");
        setNewDesc("");
        setNewPublic(false);
        fetchDashboard();
      }
    } catch (e) {
      console.error("Error creating:", e);
    } finally {
      setCreating(false);
    }
  }

  async function deleteWatchlist(id: string) {
    if (!confirm("Excluir esta lista?")) return;
    const wl = watchlists.find(w => w.id === id);
    if (!wl) return;
    try {
      const res = await fetch(`/api/shared-watchlists/${wl.share_code}`, { method: "DELETE" });
      if (res.ok) {
        setWatchlists(prev => prev.filter(w => w.id !== id));
        fetchDashboard();
      }
    } catch (e) {
      console.error("Error deleting:", e);
    }
  }

  function copyShareLink(shareCode: string) {
    navigator.clipboard.writeText(`${window.location.origin}/equipe/${shareCode}`);
    setCopied(shareCode);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Users className="w-16 h-16 text-[#454655] mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h1>
        <p className="text-[#8E9297] mb-6">Faça login para acessar o War Room</p>
        <Link href="/login" className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-full font-bold text-sm">
          Fazer Login
        </Link>
      </div>
    );
  }

  const karats = dashboard ? Object.entries(dashboard.karatBreakdown).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="min-h-full p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-[#5865F2]" />
          War Room
        </h1>
        <p className="text-[#8E9297] text-sm mt-1">
          Acompanhe a atividade da sua equipe e gerencie listas compartilhadas.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView("dashboard")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            view === "dashboard"
              ? "bg-[#5865F2] text-white"
              : "bg-[#151A22] border border-[#272A31] text-[#8E9297] hover:text-white"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </button>
        <button
          onClick={() => setView("manage")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            view === "manage"
              ? "bg-[#5865F2] text-white"
              : "bg-[#151A22] border border-[#272A31] text-[#8E9297] hover:text-white"
          }`}
        >
          <List className="w-4 h-4" />
          Gerenciar Listas
        </button>
      </div>

      {/* Dashboard view */}
      {view === "dashboard" && (
        <>
          {dashLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5865F2] border-t-transparent" />
            </div>
          ) : dashboard ? (
            <div className="space-y-6">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#5865F2]/20 flex items-center justify-center">
                      <List className="w-4 h-4 text-[#5865F2]" />
                    </div>
                    <span className="text-[#8E9297] text-xs font-bold uppercase">Listas</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{dashboard.stats.totalWatchlists}</p>
                </div>
                <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/20 flex items-center justify-center">
                      <Star className="w-4 h-4 text-[#10B981]" />
                    </div>
                    <span className="text-[#8E9297] text-xs font-bold uppercase">Total de Lotes</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{dashboard.stats.totalItems}</p>
                </div>
                <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-[#F59E0B]" />
                    </div>
                    <span className="text-[#8E9297] text-xs font-bold uppercase">Recentes</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{dashboard.recentItems.length}</p>
                </div>
              </div>

              {/* Karat breakdown + Watchlists summary */}
              <div className="grid grid-cols-5 gap-4">
                {/* Karat breakdown */}
                <div className="col-span-2 bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#5865F2]" />
                    Por Quilate
                  </h3>
                  {karats.length === 0 ? (
                    <p className="text-[#8E9297] text-sm">Sem dados ainda</p>
                  ) : (
                    <div className="space-y-2">
                      {karats.slice(0, 6).map(([karat, count]) => {
                        const pct = Math.round((count / dashboard.stats.totalItems) * 100);
                        return (
                          <div key={karat} className="flex items-center gap-3">
                            <span className="text-white font-mono text-sm w-10">{karat}k</span>
                            <div className="flex-1 bg-[#2F3136] rounded-full h-2">
                              <div
                                className="bg-[#5865F2] rounded-full h-2"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[#8E9297] text-xs w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Watchlists summary */}
                <div className="col-span-3 bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#F59E0B]" />
                    Suas Listas
                  </h3>
                  {dashboard.watchlists.length === 0 ? (
                    <p className="text-[#8E9297] text-sm">Nenhuma lista ainda</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.watchlists.slice(0, 6).map(wl => (
                        <div key={wl.id} className="flex items-center justify-between py-2 border-b border-[#272A31] last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{wl.name}</span>
                            {wl.isPublic ? (
                              <Globe className="w-3 h-3 text-[#10B981]" />
                            ) : (
                              <Lock className="w-3 h-3 text-[#8E9297]" />
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[#8E9297] text-xs">{wl.itemCount} lotes</span>
                            <Link
                              href={`/equipe/${wl.shareCode}`}
                              className="text-[#5865F2] hover:text-[#4752C4] text-xs font-bold"
                            >
                              Ver →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#5865F2]" />
                  Atividade Recente
                </h3>
                {dashboard.recentItems.length === 0 ? (
                  <p className="text-[#8E9297] text-sm py-4">Nenhuma atividade ainda. Adicione lotes às suas listas!</p>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentItems.map(item => (
                      <div key={item.id} className="flex items-center gap-4 py-3 border-b border-[#272A31] last:border-0">
                        {item.lot?.imageUrl ? (
                          <img
                            src={item.lot.imageUrl}
                            alt={`Lote ${item.lot.lotNumber}`}
                            className="w-12 h-12 rounded-xl object-cover bg-[#2F3136] flex-shrink-0"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#2F3136] flex-shrink-0 flex items-center justify-center">
                            <Star className="w-5 h-5 text-[#454655]" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white font-medium text-sm">
                              {item.lot ? `Lote #${item.lot.lotNumber}` : "Lote removido"}
                            </span>
                            {item.lot?.karat && (
                              <span className="text-[10px] font-mono text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded">
                                {item.lot.karat}k
                              </span>
                            )}
                            {item.lot?.state && (
                              <span className="text-[10px] text-[#8E9297]">{item.lot.state}</span>
                            )}
                          </div>
                          <p className="text-[#8E9297] text-xs truncate">
                            {item.lot ? formatCurrency(item.lot.value) : "—"}
                            {item.lot?.weight ? ` · ${item.lot.weight}g` : ""}
                            {item.watchlistName && (
                              <span className="ml-2">→ {item.watchlistName}</span>
                            )}
                          </p>
                          {item.notes && (
                            <p className="text-[#8E9297] text-xs truncate mt-0.5 italic">"{item.notes}"</p>
                          )}
                        </div>
                        <span className="text-[#8E9297] text-xs flex-shrink-0">{timeAgo(item.addedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-[#8E9297]">Erro ao carregar dashboard</div>
          )}
        </>
      )}

      {/* Manage view */}
      {view === "manage" && (
        <>
          {/* Create new */}
          <div className="mb-6">
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-3 rounded-2xl font-bold text-sm transition-colors shadow-lg shadow-[#5865F2]/20"
              >
                <Plus className="w-5 h-5" />
                Nova Lista Compartilhada
              </button>
            ) : (
              <form onSubmit={createWatchlist} className="bg-[#151A22] border border-[#272A31] rounded-2xl p-6 max-w-md">
                <h2 className="text-white font-bold mb-4">Criar Lista</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Nome da Lista</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Ex: Ouro 18k em SP"
                      className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Descrição (opcional)</label>
                    <input
                      type="text"
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="Ex: Lotes próximos ao encerramento"
                      className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPublic}
                      onChange={e => setNewPublic(e.target.checked)}
                      className="w-4 h-4 rounded border-[#272A31] text-[#5865F2] focus:ring-[#5865F2]"
                    />
                    <span className="text-white text-sm">Tornar pública</span>
                  </label>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={creating || !newName.trim()}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="px-5 py-3 bg-[#2F3136] hover:bg-[#454655] text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Lists */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5865F2] border-t-transparent" />
            </div>
          ) : watchlists.length === 0 && !showCreate ? (
            <div className="text-center py-16">
              <Star className="w-14 h-14 text-[#272A31] mx-auto mb-4" />
              <h2 className="text-white font-bold text-lg mb-2">Nenhuma lista ainda</h2>
              <p className="text-[#8E9297] text-sm mb-6">Crie sua primeira lista compartilhada para coordenar com sua equipe.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {watchlists.map(wl => {
                const itemCount = wl.shared_watchlist_items?.[0]?.count || 0;
                return (
                  <div key={wl.id} className="bg-[#151A22] border border-[#272A31] hover:border-[#454655] rounded-2xl p-5 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-bold">{wl.name}</h3>
                          {wl.is_public ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
                              <Globe className="w-3 h-3" /> Pública
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-[#8E9297] bg-[#2F3136] px-2 py-0.5 rounded-full">
                              <Lock className="w-3 h-3" /> Privada
                            </span>
                          )}
                        </div>
                        {wl.description && (
                          <p className="text-[#8E9297] text-sm mb-2">{wl.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-[#8E9297]">
                          <span>{itemCount} lote{itemCount !== 1 ? "s" : ""}</span>
                          <span>·</span>
                          <code className="text-white font-mono">{wl.share_code}</code>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyShareLink(wl.share_code)}
                          className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#454655] text-[#8E9297] hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                          {copied === wl.share_code ? (
                            <><Check className="w-3.5 h-3.5 text-[#10B981]" /> Copiado</>
                          ) : (
                            <><Copy className="w-3.5 h-3.5" /> Copiar</>
                          )}
                        </button>
                        <Link
                          href={`/equipe/${wl.share_code}`}
                          className="flex items-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                        >
                          Ver
                        </Link>
                        <button
                          onClick={() => deleteWatchlist(wl.id)}
                          className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#272A31] hover:border-[#EF4444]/40 text-[#8E9297] hover:text-[#EF4444] px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
