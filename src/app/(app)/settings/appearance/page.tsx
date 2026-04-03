import { Moon, Sun, Monitor, Type, Layout } from "lucide-react";

export default function AppearancePage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Theme Card */}
      <section className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
           <Layout className="w-5 h-5 text-[#5865F2]" /> Tema Visual
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
           <button className="bg-[#2F3136] border-2 border-[#5865F2] rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors relative">
             <div className="absolute top-3 right-3 w-4 h-4 bg-[#5865F2] rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(88,101,242,0.8)]">
               <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
             </div>
             <Moon className="w-10 h-10 text-[#5865F2]" />
             <span className="font-bold text-white text-sm">Escuro (Luxe)</span>
           </button>
           
           <button className="bg-[#151A22] border-2 border-[#272A31] hover:border-[#454655] rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors opacity-60">
             <Sun className="w-10 h-10 text-[#8E9297]" />
             <span className="font-medium text-[#8E9297] text-sm">Claro (Clássico)</span>
             <span className="absolute bottom-2 text-[10px] bg-[#2F3136] text-[#8E9297] px-2 py-0.5 rounded-full font-bold">EM BREVE</span>
           </button>

           <button className="bg-[#151A22] border-2 border-[#272A31] hover:border-[#454655] rounded-2xl p-6 flex flex-col items-center gap-3 transition-colors">
             <Monitor className="w-10 h-10 text-[#8E9297]" />
             <span className="font-medium text-[#8E9297] text-sm">Sistema</span>
           </button>
        </div>

        <div className="pt-8 border-t border-[#272A31]">
           <h3 className="text-sm font-bold text-[#c6c5d7] mb-6 flex items-center gap-2">
              <Type className="w-4 h-4 text-[#5865F2]" /> Preferências de Interface
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                 <label className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[#8E9297] text-sm font-medium group-hover:text-white transition-colors">Modo de Alta Densidade</span>
                    <div className="w-10 h-5 bg-[#2F3136] rounded-full relative p-0.5 border border-[#272A31]">
                       <div className="w-4 h-4 bg-[#8E9297] rounded-full"></div>
                    </div>
                 </label>
                 <label className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[#8E9297] text-sm font-medium group-hover:text-white transition-colors">Animações Reduzidas</span>
                    <div className="w-10 h-5 bg-[#2F3136] rounded-full relative p-0.5 border border-[#272A31]">
                       <div className="w-4 h-4 bg-[#8E9297] rounded-full"></div>
                    </div>
                 </label>
              </div>
              <div className="space-y-4">
                 <label className="flex items-center justify-between group cursor-pointer">
                    <span className="text-white text-sm font-bold">Notificações Sonoras</span>
                    <div className="w-10 h-5 bg-[#5865F2] rounded-full relative p-0.5 flex justify-end shadow-[0_0_8px_rgba(88,101,242,0.4)]">
                       <div className="w-4 h-4 bg-white rounded-full"></div>
                    </div>
                 </label>
                 <label className="flex items-center justify-between group cursor-pointer opacity-50 cursor-not-allowed">
                    <span className="text-[#454655] text-sm font-medium">Mapas em 3D</span>
                    <div className="w-10 h-5 bg-[#151A22] rounded-full relative p-0.5 border border-[#272A31]">
                       <div className="w-4 h-4 bg-[#2F3136] rounded-full"></div>
                    </div>
                 </label>
              </div>
           </div>
        </div>
      </section>

      {/* Language Box */}
      <section className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8">
        <h2 className="text-xl font-bold text-white mb-6">Idioma e Região</h2>
        <div className="flex flex-wrap gap-4">
           <button className="bg-[#0B0E14] border border-[#5865F2] text-white px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-3">
              🇧🇷 Português (Brasil)
           </button>
           <button className="bg-[#0B0E14] border border-[#2F3136] text-[#8E9297] px-6 py-3 rounded-xl font-medium hover:border-[#454655] transition-all text-sm flex items-center gap-3 opacity-50">
              🇺🇸 English (US)
           </button>
           <button className="bg-[#0B0E14] border border-[#2F3136] text-[#8E9297] px-6 py-3 rounded-xl font-medium hover:border-[#454655] transition-all text-sm flex items-center gap-3 opacity-50">
              🇪🇸 Español
           </button>
        </div>
      </section>
    </div>
  );
}
