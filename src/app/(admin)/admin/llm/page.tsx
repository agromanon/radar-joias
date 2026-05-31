"use client";

import { useState, useEffect } from "react";
import { Cpu, Save, ShieldCheck, Zap, AlertTriangle, RefreshCw, Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface LLMProvider {
  id: string;
  name: string;
  provider_type: "anthropic" | "openai_compatible";
  base_url: string | null;
  model: string;
  api_key: string;
  is_active: boolean;
  is_fallback: boolean;
  priority: number;
  max_tokens: number;
  temperature: number;
  task_type: "enrich" | "edital" | "results" | "chat";
  created_at: string;
}

interface ProviderModal {
  type: "create" | "edit";
  provider?: LLMProvider;
}

function ProviderModal({
  modal,
  onClose,
  onSave,
}: {
  modal: ProviderModal;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(
    modal.type === "edit" && modal.provider
      ? {
          name: modal.provider.name,
          provider_type: modal.provider.provider_type,
          base_url: modal.provider.base_url || "",
          model: modal.provider.model,
          api_key: modal.provider.api_key,
          is_active: modal.provider.is_active,
          is_fallback: modal.provider.is_fallback,
          priority: modal.provider.priority,
          max_tokens: modal.provider.max_tokens,
          temperature: modal.provider.temperature,
          task_type: modal.provider.task_type,
        }
      : {
          name: "",
          provider_type: "openai_compatible" as const,
          base_url: "",
          model: "",
          api_key: "",
          is_active: true,
          is_fallback: false,
          priority: 0,
          max_tokens: 4096,
          temperature: 0.7,
          task_type: "enrich" as const,
        }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        base_url: formData.base_url || null,
      };

      if (modal.type === "edit" && modal.provider) {
        await fetch("/api/admin/llm", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: modal.provider.id, ...payload }),
        });
      } else {
        await fetch("/api/admin/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      await onSave(payload);
      onClose();
      success("Provedor salvo", `Configurações de ${formData.name} foram salvas.`);
    } catch (err: any) {
      error("Erro ao salvar", err.message || "Não foi possível salvar o provedor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#272A31] flex-shrink-0">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            {modal.type === "create" ? <Plus className="w-5 h-5 text-[#5865F2]" /> : <Edit2 className="w-5 h-5 text-[#5865F2]" />}
            {modal.type === "create" ? "Adicionar Provedor" : "Editar Provedor"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2F3136] text-[#8E9297] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Area */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Provider Type */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Tipo de Provedor</label>
            <select
              value={formData.provider_type}
              onChange={(e) => setFormData({ ...formData, provider_type: e.target.value as any })}
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
              required
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai_compatible">OpenAI Compatível</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Nome do Provedor</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: DeepSeek V3, GPT-4o"
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
              required
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Base URL (opcional)</label>
            <input
              type="url"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              placeholder={formData.provider_type === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1"}
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 font-mono text-sm"
            />
            <p className="text-[#454655] text-[11px] mt-1">Deixe em branco para usar a URL padrão do provedor</p>
          </div>

          {/* Model */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Modelo</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder={formData.provider_type === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o"}
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 font-mono text-sm"
              required
            />
          </div>

          {/* API Key */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">API Key</label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="sk-ant-..."
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 font-mono text-sm"
              required
            />
          </div>

          {/* Advanced Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Prioridade</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                min={0}
                max={100}
                className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
              />
              <p className="text-[#454655] text-[11px] mt-1">Menor = maior prioridade</p>
            </div>

            <div>
              <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Max Tokens</label>
              <input
                type="number"
                value={formData.max_tokens || 4096}
                onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 4096 })}
                min={1}
                max={128000}
                className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Temperatura: {formData.temperature}</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Tipo de Tarefa</label>
            <select
              value={formData.task_type}
              onChange={(e) => setFormData({ ...formData, task_type: e.target.value as any })}
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50"
              required
            >
              <option value="enrich">Enriquecimento de lotes (descriptions, extração de metadados)</option>
              <option value="edital">Extração de Edital (regras, prazos, formas de pagamento)</option>
              <option value="results">Resultados de leilão (lances, preços finais)</option>
              <option value="chat">Concierge (chat com ferramentas de busca e recomendação)</option>
            </select>
            <p className="text-[#454655] text-[11px] mt-1">Cada tarefa pode ter seu próprio provedor/modelo otimizado</p>
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-[#272A31] bg-[#0B0E14] text-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/50"
              />
              <span className="text-white text-sm">Provedor Ativo</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_fallback}
                onChange={(e) => setFormData({ ...formData, is_fallback: e.target.checked })}
                className="w-4 h-4 rounded border-[#272A31] bg-[#0B0E14] text-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/50"
              />
              <span className="text-white text-sm">Usar como Fallback</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#272A31]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#2F3136] hover:bg-[#454655] text-white text-sm font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-[#5865F2]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Salvando..." : <><Save className="w-4 h-4" /> Salvar</>}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LLMConfigPage() {
  const { success, error } = useToast();
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ProviderModal | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/admin/llm");
      if (!response.ok) throw new Error("Failed to fetch providers");

      const data = await response.json();
      setProviders(data.providers || []);
    } catch (err: any) {
      error("Erro ao carregar", err.message || "Não foi possível carregar os provedores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSave = async () => {
    await fetchProviders();
  };

  const handleDelete = async (provider: LLMProvider) => {
    if (!confirm(`Tem certeza que deseja remover o provedor "${provider.name}"?`)) return;

    try {
      const response = await fetch("/api/admin/llm", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: provider.id }),
      });

      if (!response.ok) throw new Error("Failed to delete provider");

      await fetchProviders();
      success("Provedor removido", `${provider.name} foi apagado.`);
    } catch (err: any) {
      error("Erro ao remover", err.message || "Não foi possível apagar o provedor.");
    }
  };

  const handleTestConnection = async (provider: LLMProvider) => {
    setTestingProvider(provider.id);
    setTestResults(prev => ({ ...prev, [provider.id]: { success: false, message: "Testando..." } }));

    try {
      const response = await fetch("/api/admin/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: provider.id }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(prev => ({ ...prev, [provider.id]: { success: true, message: "Conexão bem-sucedida!" } }));
        success("Teste de Conexão", `${provider.name} está funcionando corretamente.`);
      } else {
        setTestResults(prev => ({ ...prev, [provider.id]: { success: false, message: data.result?.error || "Falha na conexão" } }));
        error("Teste Falhou", `${provider.name}: ${data.result?.error || "Não foi possível conectar"}`);
      }
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [provider.id]: { success: false, message: err.message } }));
      error("Erro ao Testar", err.message || "Não foi possível testar a conexão.");
    } finally {
      setTestingProvider(null);
    }
  };

  const getProviderBadge = (provider: LLMProvider) => {
    if (provider.provider_type === "anthropic") {
      return <span className="text-[#D97706] text-[10px] font-bold">ANTHROPIC</span>;
    }
    return <span className="text-[#10B981] text-[10px] font-bold">OPENAI COMPATÍVEL</span>;
  };

  const getCostBadge = (provider: LLMProvider) => {
    if (provider.name.toLowerCase().includes("deepseek")) {
      return <span className="text-[#10B981] text-[10px] font-bold uppercase tracking-widest">Custo: Baixíssimo</span>;
    }
    if (provider.name.toLowerCase().includes("qwen")) {
      return <span className="text-[#F59E0B] text-[10px] font-bold uppercase tracking-widest">Custo: Baixo</span>;
    }
    return <span className="text-[#EF4444] text-[10px] font-bold uppercase tracking-widest">Custo: Alto</span>;
  };

  const getTaskBadge = (taskType: string) => {
    const map: Record<string, { label: string; color: string }> = {
      enrich: { label: "ENRIQUECIMENTO", color: "text-[#10B981]" },
      edilal: { label: "EDITAL", color: "text-[#5865F2]" },
      results: { label: "RESULTADOS", color: "text-[#F59E0B]" },
      chat: { label: "CONCIERGE", color: "text-[#EC4899]" },
    };
    const cfg = map[taskType] ?? { label: taskType.toUpperCase(), color: "text-[#8E9297]" };
    return <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {modal && <ProviderModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[#5865F2]" /> Gateway de IA
          </h1>
          <p className="text-[#8E9297] text-sm mt-1">Gerencie provedores de LLM e configure fallbacks.</p>
        </div>
        <button
          onClick={() => setModal({ type: "create" })}
          className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-[#5865F2]/20"
        >
          <Plus className="w-4 h-4" /> Adicionar Provedor
        </button>
      </div>

      {/* Active Providers */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-6">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#10B981]" /> Provedores Configurados
        </h2>

        {loading ? (
          <div className="text-center py-12 text-[#454655] text-sm">Carregando provedores...</div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12 text-[#8E9297] text-sm">
            Nenhum provedor configurado. Clique em "Adicionar Provedor" para começar.
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className={`bg-[#0B0E14] border rounded-2xl p-5 transition-all ${
                  provider.is_active
                    ? "border-[#272A31] hover:border-[#454655]"
                    : "border-[#454655] opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-bold text-base">{provider.name}</h3>
                      {provider.is_fallback && (
                        <span className="px-2 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold rounded-full">FALLBACK</span>
                      )}
                      {getProviderBadge(provider)}
                      {getTaskBadge(provider.task_type)}
                    </div>
                    <div className="flex items-center gap-4 text-[#8E9297] text-xs">
                      <span className="font-mono">{provider.model}</span>
                      <span>•</span>
                      <span>Priority: {provider.priority}</span>
                      <span>•</span>
                      <span>Max tokens: {provider.max_tokens.toLocaleString()}</span>
                    </div>
                    {provider.base_url && (
                      <div className="text-[#454655] text-[11px] mt-1 font-mono">{provider.base_url}</div>
                    )}
                    {testResults[provider.id] && (
                      <div className={`text-[11px] mt-2 ${testResults[provider.id].success ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                        {testResults[provider.id].message}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(provider)}
                      disabled={testingProvider === provider.id}
                      className={`p-2 border rounded-lg transition-all ${
                        testingProvider === provider.id
                          ? "bg-[#5865F2]/10 border-[#5865F2]/20 text-[#5865F2] animate-pulse"
                          : testResults[provider.id]?.success
                          ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/20"
                          : testResults[provider.id]?.success === false
                          ? "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/20"
                          : "bg-[#151A22] border-[#272A31] text-[#8E9297] hover:text-white hover:border-[#454655]"
                      }`}
                      title="Testar conexão"
                    >
                      {testingProvider === provider.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : testResults[provider.id]?.success ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setModal({ type: "edit", provider })}
                      className="p-2 bg-[#151A22] border border-[#272A31] rounded-lg text-[#8E9297] hover:text-white hover:border-[#454655] transition-all"
                      title="Editar provedor"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(provider)}
                      className="p-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] hover:bg-[#EF4444]/20 transition-all"
                      title="Remover provedor"
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

      {/* Fallback Strategy Info */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-6">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[#5865F2]" /> Estratégia de Fallback
        </h2>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-[#0B0E14] rounded-2xl border border-[#272A31]">
            <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-bold">Em caso de erro HTTP 429 / 5xx:</p>
              <p className="text-[#8E9297] text-xs mt-0.5">Tentar novamente 3 vezes com intervalo de 2s antes de alternar para o próximo provedor na lista.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-[#0B0E14] rounded-2xl border border-[#272A31]">
            <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-bold">Ordem de Prioridade:</p>
              <p className="text-[#8E9297] text-xs mt-0.5">Provedores com menor valor de "Prioridade" são tentados primeiro. Provedores marcados como "Fallback" são usados apenas quando os provedores ativos falham.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
