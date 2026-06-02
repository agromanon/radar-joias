"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, RefreshCw, CheckCircle2, XCircle, Clock, RotateCcw, Activity, Loader2 } from "lucide-react";

interface PoolProxy {
  id: number;
  proxy_address: string;
  port: number;
  status: 'pending' | 'active' | 'blocked' | 'replacing';
  caixa_works: boolean | null;
  caixa_tested_at: string | null;
  failure_count: number;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
}

interface PoolStats {
  total: number;
  active: number;
  blocked: number;
  replacing: number;
  pending: number;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function StatusBadge({ status, caixaWorks }: { status: string; caixaWorks: boolean | null }) {
  if (status === 'active' || (status === 'pending' && caixaWorks)) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white"><CheckCircle2 className="w-3 h-3" /> Active</span>;
  }
  if (status === 'blocked') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white"><XCircle className="w-3 h-3" /> Blocked</span>;
  }
  if (status === 'replacing') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-600 text-white"><RotateCcw className="w-3 h-3" /> Replacing</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-600 text-white"><Clock className="w-3 h-3" /> Pending</span>;
}

export default function ProxiesPage() {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [proxies, setProxies] = useState<PoolProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/proxies/status');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setProxies(data.proxies);
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

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/proxies/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Refreshed: ${data.tested} tested, ${data.newlyActive} active, ${data.newlyBlocked} blocked` });
        await fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Refresh failed' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Refresh failed' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleReplace = async () => {
    setReplacing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/proxies/replace', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Replaced ${data.replaced} proxies, added ${data.newProxiesAdded} new proxies` });
        await fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Replace failed' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Replace failed' });
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-[#5865F2]" /> Proxy Pool
          </h1>
          <p className="text-[#8E9297] text-sm mt-1">Autonomous proxy management via WebShare.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-[#151A22] border border-[#272A31] hover:border-[#454655] text-white px-4 py-2 rounded-xl font-bold transition-all text-sm disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
            Refresh Pool
          </button>
          <button
            onClick={handleReplace}
            disabled={replacing || !stats?.blocked}
            className="flex items-center gap-2 bg-[#EF4444] hover:bg-[#DC2626] text-white px-4 py-2 rounded-xl font-bold transition-all text-sm disabled:opacity-50"
          >
            {replacing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Replace Blocked ({stats?.blocked ?? 0})
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold ${message.type === 'success' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
            <div className="text-3xl font-black text-white">{stats.total}</div>
            <div className="text-[#8E9297] text-xs mt-1">Total Proxies</div>
          </div>
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
            <div className="text-3xl font-black text-emerald-400">{stats.active}</div>
            <div className="text-[#8E9297] text-xs mt-1">Active</div>
          </div>
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
            <div className="text-3xl font-black text-yellow-400">{stats.pending}</div>
            <div className="text-[#8E9297] text-xs mt-1">Pending</div>
          </div>
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
            <div className="text-3xl font-black text-red-400">{stats.blocked}</div>
            <div className="text-[#8E9297] text-xs mt-1">Blocked</div>
          </div>
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl p-5">
            <div className="text-3xl font-black text-purple-400">{stats.replacing}</div>
            <div className="text-[#8E9297] text-xs mt-1">Replacing</div>
          </div>
        </div>
      )}

      {/* Proxy Table */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#272A31]">
          <h2 className="text-white font-bold text-sm">Proxy List</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8E9297] text-xs uppercase border-b border-[#272A31]">
                <th className="text-left px-6 py-3">IP Address</th>
                <th className="text-left px-6 py-3">Port</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">CAIXA</th>
                <th className="text-left px-6 py-3">Failures</th>
                <th className="text-left px-6 py-3">Last Used</th>
                <th className="text-left px-6 py-3">Last Tested</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-[#272A31] animate-pulse">
                    <td className="px-6 py-3"><div className="h-4 bg-[#2F3136] rounded w-32" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-[#2F3136] rounded w-12" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-[#2F3136] rounded w-20" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-[#2F3136] rounded w-16" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-[#2F3136] rounded w-8" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-[#2F3136] rounded w-16" /></td>
                    <td className="px-6 py-3"><div className="h-4 bg-[#2F3136] rounded w-16" /></td>
                  </tr>
                ))
              ) : proxies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-[#8E9297]">No proxies in pool. Click "Refresh Pool" to fetch from WebShare.</td>
                </tr>
              ) : (
                proxies.map((p) => (
                  <tr key={p.id} className="border-b border-[#272A31] hover:bg-[#1a1d23]">
                    <td className="px-6 py-3 font-mono text-white">{p.proxy_address}</td>
                    <td className="px-6 py-3 font-mono text-[#8E9297]">{p.port}</td>
                    <td className="px-6 py-3"><StatusBadge status={p.status} caixaWorks={p.caixa_works} /></td>
                    <td className="px-6 py-3">
                      {p.caixa_works === true ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : p.caixa_works === false ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <span className="text-[#8E9297] text-xs">Untested</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-white">{p.failure_count}</td>
                    <td className="px-6 py-3 text-[#8E9297] text-xs">{formatTimeAgo(p.last_used_at)}</td>
                    <td className="px-6 py-3 text-[#8E9297] text-xs">{formatTimeAgo(p.caixa_tested_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}