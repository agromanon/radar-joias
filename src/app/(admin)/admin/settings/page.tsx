import { Settings, Globe, Bell, Eye, Database, ShieldCheck, Mail, Save } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
        <div className="text-center md:text-left">
           <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-2">Configurações Base</h1>
           <p className="text-[#8E9297] font-medium font-sans">Gerencie o comportamento global do ecossistema Radar Jóias.</p>
        </div>
        <button className="bg-[#EF4444] hover:bg-[#D32F2F] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#EF4444]/20 transition-all flex items-center gap-2">
           <Save className="w-4 h-4" /> Salvar Alterações
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Global SEO & Brand */}
        <div className="bg-[#151A22] border border-[#272A31] rounded-[40px] p-8 space-y-8">
           <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#EF4444]" /> Marca & SEO Global
           </h3>
           <div className="space-y-6">
              <div>
                 <label className="text-[10px] font-black text-[#454655] uppercase tracking-widest mb-2 block">Título Meta do SaaS</label>
                 <input type="text" defaultValue="Radar Jóias | Inteligência B2B" className="w-full bg-[#0B0E14] border border-[#272A31] rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#EF4444] transition-colors" />
              </div>
              <div>
                 <label className="text-[10px] font-black text-[#454655] uppercase tracking-widest mb-2 block">Descrição Principal</label>
                 <textarea rows={3} defaultValue="O maior agregador de leilões industriais do Brasil apoiado por IA." className="w-full bg-[#0B0E14] border border-[#272A31] rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-[#EF4444] transition-colors resize-none" />
              </div>
           </div>
        </div>

        {/* System Thresholds */}
        <div className="bg-[#151A22] border border-[#272A31] rounded-[40px] p-8 space-y-8">
           <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-[#EF4444]" /> Limites de Sistema
           </h3>
           <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#0B0E14] rounded-2xl border border-[#272A31]">
                 <div>
                    <p className="text-white font-bold text-sm">Modo de Manutenção</p>
                    <p className="text-[#8E9297] text-[10px]">Bloqueia acesso a usuários comuns.</p>
                 </div>
                 <div className="w-12 h-6 bg-[#272A31] rounded-full relative cursor-pointer group">
                    <div className="absolute top-1 left-1 w-4 h-4 bg-[#454655] rounded-full transition-all group-hover:bg-[#EF4444]/50"></div>
                 </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0B0E14] rounded-2xl border border-[#272A31]">
                 <div>
                    <p className="text-white font-bold text-sm">Cache de Lotes (minutos)</p>
                    <p className="text-[#8E9297] text-[10px]">Taxa de renovação do frontend.</p>
                 </div>
                 <input type="number" defaultValue="15" className="w-16 bg-[#151A22] text-center border border-[#272A31] rounded-lg text-xs p-2 text-white" />
              </div>
           </div>
        </div>

        {/* Notifications Config */}
        <div className="bg-[#151A22] border border-[#272A31] rounded-[40px] p-8 space-y-8">
           <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#EF4444]" /> Notificações de Infra
           </h3>
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <input type="checkbox" defaultChecked className="w-4 h-4 rounded-lg bg-[#0B0E14] border-[#272A31] text-[#EF4444] focus:ring-0" />
                 <span className="text-[#c6c5d7] text-sm">Alertar falhas críticas no Telegram</span>
              </div>
              <div className="flex items-center gap-3">
                 <input type="checkbox" defaultChecked className="w-4 h-4 rounded-lg bg-[#0B0E14] border-[#272A31] text-[#EF4444] focus:ring-0" />
                 <span className="text-[#c6c5d7] text-sm">Emails diários de métricas (MRR)</span>
              </div>
              <div className="flex items-center gap-3 opacity-40">
                 <input type="checkbox" disabled className="w-4 h-4 rounded-lg bg-[#0B0E14] border-[#272A31] text-[#EF4444] focus:ring-0" />
                 <span className="text-[#c6c5d7] text-sm">WhatsApp Bridge (Coming soon)</span>
              </div>
           </div>
        </div>

        {/* Communication */}
        <div className="bg-[#151A22] border border-[#272A31] rounded-[40px] p-8 space-y-8">
           <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#EF4444]" /> E-mails Transacionais
           </h3>
           <div className="space-y-4">
              <div className="bg-[#0B0E14] p-4 rounded-2xl border border-[#272A31] flex items-center justify-between">
                 <span className="text-xs text-[#8E9297] font-medium">Template de Boas-vindas</span>
                 <button className="text-[10px] text-[#EF4444] font-black uppercase hover:underline">Editar HTML</button>
              </div>
              <div className="bg-[#0B0E14] p-4 rounded-2xl border border-[#272A31] flex items-center justify-between">
                 <span className="text-xs text-[#8E9297] font-medium">Recuperação de Senha</span>
                 <button className="text-[10px] text-[#EF4444] font-black uppercase hover:underline">Editar HTML</button>
              </div>
           </div>
        </div>
      </div>
      
      {/* Risk Section */}
      <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-[40px] p-8 mt-12">
         <h4 className="text-[#EF4444] font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
           <ShieldCheck className="w-4 h-4" /> Zona de Risco Máximo
         </h4>
         <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-[#8E9297] text-sm font-medium">Ao clicar neste botão, todos os caches de LLM serão invalidados e o sistema forçará uma nova varredura completa. Isto consumirá créditos em escala.</p>
            <button className="px-6 py-3 bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#EF4444] hover:text-white transition-all whitespace-nowrap">
               Forçar Cold Rebuild de Cache
            </button>
         </div>
      </div>
    </div>
  );
}
