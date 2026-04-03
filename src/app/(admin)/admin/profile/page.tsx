import { ShieldAlert, User, Mail, Calendar, Key, Lock, Activity } from "lucide-react";

export default function AdminProfilePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Card */}
      <div className="relative group">
        <div className="absolute inset-0 bg-[#EF4444]/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-[#EF4444]/10 transition-all duration-1000"></div>
        <div className="relative bg-[#151A22] border border-[#272A31] rounded-[40px] p-8 md:p-12 overflow-hidden shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 rounded-3xl bg-[#EF4444] flex items-center justify-center text-white text-4xl font-black shadow-[0_10px_40px_rgb(239,68,68,0.3)] ring-4 ring-[#EF4444]/10">
              AD
            </div>
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-black uppercase tracking-widest mb-4">
                SaaS Owner • Full Access
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-2">Admin Master</h1>
              <p className="text-[#8E9297] font-medium flex items-center justify-center md:justify-start gap-2">
                <Mail className="w-4 h-4 text-[#454655]" /> admin@radarleilao.com.br
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#151A22] border border-[#272A31] rounded-[32px] p-8">
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-[#EF4444]" /> Detalhes da Conta
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
               <div>
                  <label className="text-[10px] font-black text-[#454655] uppercase tracking-widest mb-2 block">Nome de Exibição</label>
                  <p className="text-white font-bold bg-[#0B0E14] px-4 py-3 rounded-2xl border border-[#272A31]">Admin Master</p>
               </div>
               <div>
                  <label className="text-[10px] font-black text-[#454655] uppercase tracking-widest mb-2 block">Departamento</label>
                  <p className="text-white font-bold bg-[#0B0E14] px-4 py-3 rounded-2xl border border-[#272A31]">Core Backend Team</p>
               </div>
               <div>
                  <label className="text-[10px] font-black text-[#454655] uppercase tracking-widest mb-2 block">Criado em</label>
                  <p className="text-white font-bold bg-[#0B0E14] px-4 py-3 rounded-2xl border border-[#272A31] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#454655]" /> 01 Jan 2026
                  </p>
               </div>
               <div>
                  <label className="text-[10px] font-black text-[#454655] uppercase tracking-widest mb-2 block">ID do Sistema</label>
                  <p className="text-white font-bold bg-[#0B0E14] px-4 py-3 rounded-2xl border border-[#272A31] font-mono text-xs">RADAR-OWN-0001</p>
               </div>
            </div>
          </div>

          <div className="bg-[#151A22] border border-[#272A31] rounded-[32px] p-8">
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
               <ShieldAlert className="w-5 h-5 text-[#EF4444]" /> Privilégios & Permissões
            </h3>
            <div className="flex flex-wrap gap-2">
               {['ROOT_ACCESS', 'DB_WRITE', 'LLM_CONFIG_EDIT', 'USER_MANAGEMENT', 'PAYMENT_AUDIT', 'SCRAPER_CONTROL'].map((perm) => (
                 <span key={perm} className="bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-black p-2 rounded-lg border border-[#EF4444]/20">
                   {perm}
                 </span>
               ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
           <div className="bg-gradient-to-br from-[#151A22] to-[#0B0E14] border border-[#272A31] rounded-[32px] p-8 shadow-xl">
              <h4 className="text-white font-bold text-sm mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#EF4444]" /> Sessão Atual
              </h4>
              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-[#0B0E14] p-4 rounded-2xl border border-[#272A31]">
                    <span className="text-[#8E9297] text-xs font-medium">Status</span>
                    <span className="flex items-center gap-1.5 text-[#10B981] text-[10px] font-black uppercase tracking-widest leading-none">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span> Ativo
                    </span>
                 </div>
                 <div className="flex justify-between items-center bg-[#0B0E14] p-4 rounded-2xl border border-[#272A31]">
                    <span className="text-[#8E9297] text-xs font-medium">IP Logado IP</span>
                    <span className="text-white text-xs font-mono">192.168.0.1</span>
                 </div>
              </div>
           </div>

           <div className="bg-[#151A22] border border-[#272A31] rounded-[32px] p-8">
              <h4 className="text-white font-bold text-sm mb-6 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#EF4444]" /> Segurança
              </h4>
              <p className="text-[#8E9297] text-xs mb-6">Mantenha sua chave mestre atualizada.</p>
              <button className="w-full bg-[#EF4444] hover:bg-[#D32F2F] text-white py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-[#EF4444]/20 transition-all">
                Alterar Master Key
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
