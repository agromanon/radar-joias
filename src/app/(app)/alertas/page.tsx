"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2, Search, BellRing, Eye, Mail, AlertTriangle, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

type Alert = {
  id: string;
  name: string;
  criteria: any;
  notification_method: string;
  notification_frequency: string;
  is_active: boolean;
  created_at: string;
};

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKarat, setFormKarat] = useState("");
  const [formState, setFormState] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formMinPrice, setFormMinPrice] = useState("");
  const [formMaxPrice, setFormMaxPrice] = useState("");
  const [formMethod, setFormMethod] = useState("email");
  const [formFrequency, setFormFrequency] = useState("immediate");
  const [saving, setSaving] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch("/api/alerts");
      const data = await response.json();
      if (response.ok) {
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      const response = await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error("Error deleting alert:", error);
    }
  };

  const toggleAlert = async (id: string, currentState: boolean) => {
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentState }),
      });
      if (response.ok) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a));
      }
    } catch (error) {
      console.error("Error toggling alert:", error);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormKarat("");
    setFormState("");
    setFormCategory("");
    setFormMinPrice("");
    setFormMaxPrice("");
    setFormMethod("email");
    setFormFrequency("immediate");
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const criteria: any = {};
      if (formKarat) criteria.karat = formKarat;
      if (formState) criteria.state = formState;
      if (formCategory) criteria.category = formCategory;
      if (formMinPrice) criteria.min_price = parseInt(formMinPrice);
      if (formMaxPrice) criteria.max_price = parseInt(formMaxPrice);

      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          criteria,
          notification_method: formMethod,
          notification_frequency: formFrequency,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(prev => [data.alert, ...prev]);
        setShowForm(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error creating alert:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatCriteria = (criteria: any): string => {
    if (!criteria) return "Todos os lotes";
    const parts = [];
    if (criteria.karat) parts.push(criteria.karat);
    if (criteria.state) parts.push(criteria.state);
    if (criteria.category) parts.push(criteria.category);
    if (criteria.min_price || criteria.max_price) {
      const min = criteria.min_price ? `R$ ${Number(criteria.min_price).toLocaleString('pt-BR')}` : "";
      const max = criteria.max_price ? `R$ ${Number(criteria.max_price).toLocaleString('pt-BR')}` : "";
      parts.push(`${min}${min && max ? " - " : ""}${max}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "Todos os lotes";
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "immediate": return "Imediato";
      case "hourly": return "A cada hora";
      case "daily": return "Diário";
      default: return freq;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "email": return <Mail className="w-3.5 h-3.5" />;
      case "push": return <BellRing className="w-3.5 h-3.5" />;
      default: return <Mail className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-full p-6 md:p-10 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-[#5865F2]" />
            Meus Alertas
          </h1>
          <p className="text-[#8E9297] mt-2 text-lg">
            Configure alertas por karatagem, estado, categoria ou faixa de preço
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/leiloes"
            className="flex items-center gap-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white px-5 py-2.5 rounded-xl font-semibold transition-all text-sm"
          >
            <Search className="w-4 h-4" />
            Ver Lotes
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-xl font-semibold transition-all text-sm shadow-lg shadow-[#5865F2]/20"
          >
            <Plus className="w-4 h-4" />
            Novo Alerta
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-2xl p-4 mb-8">
        <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
        <p className="text-[#8E9297] text-xs leading-relaxed">
          <span className="text-white font-bold">Alertas ativos:</span> você receberá notificações quando novos lotes corresponderem aos seus critérios. Configure karatagem, estado ou categoria para ser notificado sobre peças que te interessam.
        </p>
      </div>

      {/* Create Alert Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white font-bold text-xl">Criar Novo Alerta</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-[#8E9297] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateAlert} className="space-y-4">
              <div>
                <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Nome do Alerta</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ex: Alianças 18k em SP"
                  required
                  className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Karatagem</label>
                  <select
                    value={formKarat}
                    onChange={e => setFormKarat(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                  >
                    <option value="">Todas</option>
                    <option value="18k">Ouro 18k</option>
                    <option value="14k">Ouro 14k</option>
                    <option value="10k">Ouro 10k</option>
                    <option value="12k">Ouro 12k</option>
                    <option value="24k">Ouro 24k</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Estado</label>
                  <select
                    value={formState}
                    onChange={e => setFormState(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                  >
                    <option value="">Todos</option>
                    <option value="SP">SP</option>
                    <option value="RJ">RJ</option>
                    <option value="MG">MG</option>
                    <option value="RS">RS</option>
                    <option value="PR">PR</option>
                    <option value="BA">BA</option>
                    <option value="PE">PE</option>
                    <option value="CE">CE</option>
                    <option value="GO">GO</option>
                    <option value="DF">DF</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Categoria</label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                >
                  <option value="">Todas</option>
                  <option value="Aliança">Aliança</option>
                  <option value="Colar">Colar</option>
                  <option value="Brinco">Brinco</option>
                  <option value="Anel">Anel</option>
                  <option value="Pulseira">Pulseira</option>
                  <option value="Relógio">Relógio</option>
                  <option value="Moeda">Moeda</option>
                  <option value="Barra">Barra</option>
                </select>
              </div>
              <div>
                <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Faixa de Preço (R$)</label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={formMinPrice}
                    onChange={e => setFormMinPrice(e.target.value)}
                    placeholder="Mín"
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                  />
                  <input
                    type="number"
                    value={formMaxPrice}
                    onChange={e => setFormMaxPrice(e.target.value)}
                    placeholder="Máx"
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Método</label>
                  <select
                    value={formMethod}
                    onChange={e => setFormMethod(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                  >
                    <option value="email">E-mail</option>
                    <option value="push">Push</option>
                    <option value="both">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#8E9297] text-xs font-bold uppercase block mb-2">Frequência</label>
                  <select
                    value={formFrequency}
                    onChange={e => setFormFrequency(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                  >
                    <option value="immediate">Imediato</option>
                    <option value="hourly">A cada hora</option>
                    <option value="daily">Diário</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="flex-1 py-3 bg-[#2F3136] hover:bg-[#454655] text-white rounded-xl font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !formName.trim()}
                  className="flex-1 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#5865F2]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Criando..." : "Criar Alerta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5865F2] border-t-transparent" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-12">
            <Bell className="w-16 h-16 text-[#8E9297] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Nenhum alerta configurado</h2>
            <p className="text-[#8E9297] mb-6">
              Configure alertas para ser notificado quando novos lotes corresponderem aos seus critérios.
            </p>
            <Link
              href="/leiloes"
              className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-full font-semibold transition-all"
            >
              Explorar e Criar Alertas
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-[#151A22] border rounded-2xl p-5 transition-all ${
                alert.is_active ? "border-[#272A31]" : "border-[#272A31] opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    alert.is_active ? "bg-[#5865F2]/10" : "bg-[#2F3136]"
                  }`}>
                    <Search className={`w-5 h-5 ${alert.is_active ? "text-[#5865F2]" : "text-[#8E9297]"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-sm">{alert.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        alert.is_active
                          ? "bg-[#10B981]/10 text-[#10B981]"
                          : "bg-[#2F3136] text-[#8E9297]"
                      }`}>
                        <Eye className="w-3 h-3" />
                        {alert.is_active ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                    <p className="text-[#8E9297] text-xs mb-2">
                      {formatCriteria(alert.criteria)}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] text-[#454655]">
                      <span className="flex items-center gap-1">
                        {getMethodIcon(alert.notification_method)}
                        {alert.notification_method === "email" ? "E-mail" : alert.notification_method === "push" ? "Push" : "Ambos"}
                      </span>
                      <span>·</span>
                      <span>{getFrequencyLabel(alert.notification_frequency)}</span>
                      <span>·</span>
                      <span>Criado {new Date(alert.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleAlert(alert.id, alert.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      alert.is_active
                        ? "bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20"
                        : "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20"
                    }`}
                  >
                    {alert.is_active ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="h-8 w-8 bg-[#2F3136] hover:bg-[#EF4444]/20 hover:text-[#EF4444] rounded-lg text-[#8E9297] flex items-center justify-center transition-all"
                    title="Excluir alerta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}