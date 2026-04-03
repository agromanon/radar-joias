"use client";

import { useState, useEffect } from "react";
import { Crown, Edit2, CheckCircle2, Plus, Save, X, ToggleLeft } from "lucide-react";

type ApiPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: {
    lotsPerMonth: number;
    copilotAccess: boolean;
    advancedFilters: boolean;
    watchlistLimit: number;
    apiAccess?: boolean;
    prioritySupport?: boolean;
  };
};

const PLAN_CONFIG = {
  free: {
    id: "free",
    name: "Rastreador Básico",
    price: 0,
    billing: "Grátis",
    color: "#8E9297",
    borderColor: "border-[#272A31]",
    activeBorder: "border-[#8E9297]",
  },
  pro: {
    id: "pro",
    name: "Engenharia B2B",
    price: 149,
    billing: "R$ 149/mês",
    color: "#5865F2",
    borderColor: "border-[#272A31]",
    activeBorder: "border-[#5865F2]",
  },
  war_room: {
    id: "war_room",
    name: "War Room",
    price: 599,
    billing: "R$ 599/mês",
    color: "#F59E0B",
    borderColor: "border-[#272A31]",
    activeBorder: "border-[#F59E0B]",
  },
};

type Plan = {
  id: string;
  name: string;
  price: number;
  billing: string;
  color: string;
  borderColor: string;
  activeBorder: string;
  users: number;
  features: Array<{
    label: string;
    value: string;
    enabled: boolean;
  }>;
};

function EditModal({ plan, onSave, onClose }: { plan: Plan; onSave: (p: Plan) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Plan>(JSON.parse(JSON.stringify(plan)));

  const setPrice = (val: string) => setDraft({ ...draft, price: Number(val) });
  const setName = (val: string) => setDraft({ ...draft, name: val });
  const toggleFeature = (i: number) => {
    const features = [...draft.features];
    features[i] = { ...features[i], enabled: !features[i].enabled };
    setDraft({ ...draft, features });
  };
  const setFeatureValue = (i: number, val: string) => {
    const features = [...draft.features];
    features[i] = { ...features[i], value: val };
    setDraft({ ...draft, features });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#151A22] border border-[#272A31] rounded-3xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#272A31]">
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            <Edit2 className="w-4 h-4" style={{ color: plan.color }} />
            Editar: {plan.name}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2F3136] text-[#8E9297] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Nome do Plano</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
            />
          </div>

          {/* Price */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Preço Mensal (R$)</label>
            <div className="flex items-center gap-2 bg-[#0B0E14] border border-[#272A31] rounded-xl px-4 py-3">
              <span className="text-[#8E9297] font-bold">R$</span>
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                className="flex-1 bg-transparent text-white text-xl font-bold outline-none tabular-nums"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-3">Recursos</label>
            <div className="space-y-3">
              {draft.features.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#0B0E14] border border-[#272A31] rounded-xl p-3">
                  <button
                    onClick={() => toggleFeature(i)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      f.enabled ? "border-transparent" : "border-[#454655]"
                    }`}
                    style={{ backgroundColor: f.enabled ? plan.color : "transparent" }}
                  >
                    {f.enabled && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`text-sm flex-1 ${f.enabled ? "text-white" : "text-[#454655]"}`}>{f.label}</span>
                  {f.value !== undefined && (
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) => setFeatureValue(i, e.target.value)}
                      placeholder="Valor"
                      className="w-24 bg-transparent text-xs font-bold text-right outline-none placeholder:text-[#272A31]"
                      style={{ color: plan.color }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#272A31]">
          <button onClick={onClose} className="px-5 py-2.5 bg-[#2F3136] hover:bg-[#454655] text-white text-sm font-bold rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-all shadow-lg"
            style={{ backgroundColor: plan.color }}
          >
            <Save className="w-4 h-4" /> Salvar Plano
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/admin/plans');
        if (response.ok) {
          const data = await response.json();

          // Transform API response to Plan format
          const transformedPlans: Plan[] = data.plans.map((apiPlan: ApiPlan) => {
            const config = PLAN_CONFIG[apiPlan.id as keyof typeof PLAN_CONFIG];

            // Transform features array to feature objects
            const features = apiPlan.features.map((feature: string) => {
              if (feature.includes('50 lotes')) {
                return { label: "Lotes visíveis por mês", value: "50", enabled: true };
              } else if (feature.includes('ilimitados')) {
                return { label: "Lotes visíveis por mês", value: "Ilimitado", enabled: true };
              } else if (feature.includes('Análise de editais')) {
                return { label: "Termômetro de Risco IA", value: "", enabled: true };
              } else if (feature.includes('Radar Copilot')) {
                return { label: "Radar Copilot AI", value: "", enabled: true };
              } else if (feature.includes('Multi-usuários')) {
                return { label: "Multi-contas (até 5)", value: "", enabled: true };
              } else if (feature.includes('API access')) {
                return { label: "Webhook API Integration", value: "", enabled: true };
              } else if (feature.includes('Suporte prioritário')) {
                return { label: "Suporte prioritário 24h", value: "", enabled: true };
              } else {
                return { label: feature, value: "", enabled: true };
              }
            });

            return {
              ...config,
              users: 0, // We don't have user count per tier in the API yet
              features,
            };
          });

          setPlans(transformedPlans);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  const editingPlan = plans.find((p) => p.id === editingId) ?? null;

  const handleSave = async (updated: Plan) => {
    try {
      // Call API to update plan
      const response = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: updated.id,
          price: updated.price,
          features: updated.features.filter(f => f.enabled).map(f => f.label),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update plan');
      }

      // Update local state
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, billing: updated.price === 0 ? "Grátis" : `R$ ${updated.price}/mês` } : p)));
      setEditingId(null);
      setSavedId(updated.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (error) {
      console.error('Error saving plan:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {editingPlan && (
        <EditModal plan={editingPlan} onSave={handleSave} onClose={() => setEditingId(null)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#F59E0B]" /> Gestão de Planos
          </h1>
          <p className="text-[#8E9297] text-sm mt-1">Configure preços, limites e recursos por plano.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-[#5865F2]/20">
          <Plus className="w-4 h-4" /> Novo Plano
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="lg:col-span-3 px-6 py-12 text-center text-[#454655] text-sm">
            Carregando planos...
          </div>
        ) : (
          plans.map((plan) => {
            const isSaved = savedId === plan.id;
            return (
              <div key={plan.id} className={`bg-[#151A22] border-2 ${plan.borderColor} rounded-3xl p-6 flex flex-col gap-5 transition-all duration-300 ${isSaved ? `ring-2 ring-offset-2 ring-offset-[#0B0E14]` : ""}`} style={{ borderColor: plan.color, ...(isSaved && { '--tw-ring-color': plan.color } as React.CSSProperties) }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-white font-bold text-base">{plan.name}</h2>
                    <p className="text-sm font-bold mt-1" style={{ color: plan.color }}>{plan.billing}</p>
                  </div>
                  <button onClick={() => setEditingId(plan.id)} className="p-2 bg-[#0B0E14] border border-[#272A31] rounded-xl text-[#8E9297] hover:text-white hover:border-[#454655] transition-all" title="Editar plano">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-[#0B0E14] border border-[#272A31] rounded-2xl p-4">
                  <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-1">Preço Mensal</label>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: plan.color }}>
                    {plan.price === 0 ? "Grátis" : `R$ ${plan.price}`}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Recursos Incluídos</p>
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className={`text-sm ${f.enabled ? "text-white" : "text-[#454655]"}`}>{f.label}</span>
                      <div className="flex items-center gap-2">
                        {f.value && <span className="text-xs font-bold" style={{ color: plan.color }}>{f.value}</span>}
                        <CheckCircle2 className={`w-4 h-4 ${!f.enabled ? "opacity-20" : ""}`} style={{ color: f.enabled ? plan.color : "#454655" }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-4 border-t border-[#272A31] flex items-center justify-between">
                  <span className="text-[#8E9297] text-xs">Assinantes ativos</span>
                  <span className="text-white font-bold tabular-nums">{plan.users.toLocaleString()}</span>
                </div>

                <button onClick={() => setEditingId(plan.id)} className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${isSaved ? "text-white border-transparent" : "bg-[#0B0E14] border-[#272A31] hover:bg-[#2F3136] text-white"}`} style={isSaved ? { backgroundColor: plan.color } : {}}>
                  {isSaved && <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Salvo!</span>}
                  {!isSaved && <span className="flex items-center gap-2"><ToggleLeft className="w-4 h-4" style={{ color: plan.color }} /> Editar plano</span>}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Trial Settings */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-6">
        <h2 className="text-base font-bold text-white mb-5">Configurações de Trial & Upgrade</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Dias de Trial Gratuito</label>
            <input type="number" defaultValue={14} className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 text-sm" />
          </div>
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Desconto Anual (%)</label>
            <input type="number" defaultValue={20} className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 text-sm" />
          </div>
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Cupom de Boas-vindas</label>
            <input type="text" defaultValue="RADAR20" className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 text-sm font-mono" />
          </div>
        </div>
      </div>
    </div>
  );
}
