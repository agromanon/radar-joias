import { Shield, Smartphone, Key } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Change Password Card */}
      <section className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
           <Key className="w-5 h-5 text-[#5865F2]" /> Alterar Senha
        </h2>
        
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-[#c6c5d7] mb-2">Senha Atual</label>
            <input type="password" placeholder="••••••••" className="w-full bg-[#0B0E14] border border-[#2F3136] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#c6c5d7] mb-2">Nova Senha</label>
            <input type="password" placeholder="Mínimo 8 caracteres" className="w-full bg-[#0B0E14] border border-[#2F3136] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#c6c5d7] mb-2">Confirmar Nova Senha</label>
            <input type="password" placeholder="••••••••" className="w-full bg-[#0B0E14] border border-[#2F3136] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 transition-all" />
          </div>
        </div>

        <button className="bg-[#2F3136] hover:bg-[#454655] text-white px-6 py-3 rounded-xl font-bold mt-8 transition-colors text-sm">
           Atualizar Senha
        </button>
      </section>

      {/* Two-Factor Authentication Box */}
      <section className="bg-gradient-to-tr from-[#151A22] to-[#0B0E14] border border-[#10B981]/20 rounded-3xl p-8 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-[#10B981]/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
         
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
               <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#10B981]" /> Autenticação de Dois Fatores (2FA)
               </h2>
               <p className="text-[#8E9297] text-sm max-w-md">Adicione uma camada extra de segurança à sua conta usando um aplicativo de autenticação (Google Authenticator ou Authy).</p>
               <div className="mt-4 flex items-center gap-2 text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full text-xs font-bold w-fit">
                  <Smartphone className="w-3 h-3" /> Recomendado
               </div>
            </div>
            <button className="bg-[#10B981] hover:bg-[#059669] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg text-sm">
               Configurar 2FA
            </button>
         </div>
      </section>

      {/* Login Sessions */}
      <section className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8">
        <h2 className="text-sm font-bold text-[#8E9297] uppercase tracking-widest mb-6">Sessões Ativas</h2>
        <div className="space-y-4">
           {[
             { device: "MacBook Pro (Chrome)", location: "São Paulo, Brasil", active: true },
             { device: "iPhone 15 Pro", location: "São Paulo, Brasil", active: false }
           ].map((session, i) => (
             <div key={i} className="flex items-center justify-between p-4 bg-[#0B0E14] rounded-2xl border border-[#2F3136]">
               <div>
                  <p className="text-white font-bold text-sm">{session.device}</p>
                  <p className="text-[#8E9297] text-xs">{session.location} • {session.active ? <span className="text-[#10B981] font-bold">Atual</span> : "Acesso há 2h"}</p>
               </div>
               {!session.active && (
                 <button className="text-[#EF4444] text-xs font-bold hover:underline">Sair</button>
               )}
             </div>
           ))}
        </div>
      </section>
    </div>
  );
}
