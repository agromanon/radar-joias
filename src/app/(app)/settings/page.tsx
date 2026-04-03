"use client";

import { useState } from "react";
import { User, Bell, Shield, Eye, Smartphone, Zap, CheckCircle2 } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import Link from "next/link";

export default function SettingsPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("perfil");

  const TABS = [
    { id: "perfil", label: "Perfil", icon: User },
    { id: "notificacoes", label: "Notificações", icon: Bell },
    { id: "seguranca", label: "Segurança", icon: Shield },
    { id: "aparencia", label: "Aparência", icon: Eye },
  ];

  return (
    <div className="min-h-full p-6 md:p-10 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Configurações</h1>
          <p className="text-[#8E9297] mt-1 text-lg">Gerencie sua conta e preferências do Radar.</p>
        </div>
        
        {/* Billing Mini Banner */}
        <div className="bg-gradient-to-r from-[#5865F2]/20 to-[#EF4444]/10 border border-[#5865F2]/20 p-4 rounded-2xl flex items-center gap-4 group hover:border-[#5865F2]/40 transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center text-white shadow-lg shadow-[#5865F2]/20">
             <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#5865F2] uppercase tracking-[0.2em] mb-0.5">Plano Atual</div>
            <div className="text-white font-bold text-sm tracking-tight capitalize">{user?.tier?.replace("_", " ") || "Free"}</div>
          </div>
          <Link href="/settings/billing" className="ml-4 bg-[#1C2129] hover:bg-[#2F3136] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-[#272A31]">
            Gerenciar
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar Tabs */}
        <aside className="lg:col-span-1 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  active 
                    ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20" 
                    : "text-[#8E9297] hover:bg-[#151A22] hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-white" : "group-hover:text-[#5865F2]"}`} />
                {tab.label}
              </button>
            );
          })}
        </aside>

        {/* Tab Panel */}
        <main className="lg:col-span-3">
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
             
             {/* Profile Tab */}
             {activeTab === "perfil" && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-6 pb-8 border-b border-[#272A31]">
                    <div className="w-20 h-20 rounded-3xl bg-[#5865F2] flex items-center justify-center text-white text-2xl font-black shadow-2xl shadow-[#5865F2]/20 uppercase">
                      {user?.name.split(" ").map(n => n[0]).join("") || "US"}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">Foto de Perfil</h3>
                      <p className="text-[#8E9297] text-sm">Atualize seu avatar para os relatórios da IA.</p>
                      <div className="flex items-center gap-3 mt-4">
                        <button className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">Alterar Foto</button>
                        <button className="bg-[#0B0E14] border border-[#272A31] text-[#8E9297] hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">Remover</button>
                      </div>
                    </div>
                  </div>

                  <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#454655] uppercase tracking-widest pl-1">Nome Completo</label>
                       <input 
                         type="text" 
                         defaultValue={user?.name}
                         className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5865F2]/50 outline-none transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-[#454655] uppercase tracking-widest pl-1">E-mail de Trabalho</label>
                       <input 
                         type="email" 
                         defaultValue={user?.email}
                         className="w-full bg-[#0B0E14] border border-[#272A31] text-[#454655] rounded-xl py-3 px-4 cursor-not-allowed"
                         disabled
                       />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-xs font-bold text-[#454655] uppercase tracking-widest pl-1">Empresa / Grupo Industrial</label>
                       <input 
                         type="text" 
                         placeholder="Ex: Alubar Metais"
                         className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#5865F2]/50 outline-none transition-all"
                       />
                    </div>
                  </form>

                  <div className="pt-6 flex justify-end">
                    <button className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-3 rounded-xl font-bold transition-all shadow-xl shadow-[#5865F2]/20">Salvar Alterações</button>
                  </div>
                </div>
             )}

             {/* Notifications Tab */}
             {activeTab === "notificacoes" && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                   <div>
                      <h3 className="text-xl font-bold text-white mb-2">Push & Email</h3>
                      <p className="text-[#8E9297] text-sm">Como você deseja ser avisado sobre leilões críticos?</p>
                   </div>

                   <div className="space-y-4">
                      {[
                        { title: "Alertas do Copilot", desc: "IA avisar quando encontrar algo na sua Watchlist.", icon: Zap },
                        { title: "Resumo Semanal", desc: "Principais oportunidades industriais da semana no seu email.", icon: Smartphone },
                        { title: "Mudanças de Preço", desc: "Avisar se houver lances nos últimos 5 minutos.", icon: CheckCircle2 },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-[#0B0E14] border border-[#272A31] rounded-2xl">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-[#2F3136] flex items-center justify-center text-[#8E9297]">
                                <item.icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-white font-bold text-sm">{item.title}</p>
                                <p className="text-[#454655] text-xs">{item.desc}</p>
                              </div>
                           </div>
                           <div className="w-12 h-6 bg-[#5865F2] rounded-full relative p-1 cursor-pointer">
                              <div className="w-4 h-4 bg-white rounded-full absolute right-1"></div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             )}

             {activeTab === "seguranca" && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                   <div>
                      <h3 className="text-xl font-bold text-white mb-2">Controle de Segurança</h3>
                      <p className="text-[#8E9297] text-sm">Mantenha seu Radar blindado com autenticação multifator.</p>
                   </div>

                   <div className="p-6 bg-[#5865F2]/5 border border-[#5865F2]/20 rounded-2xl flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] flex-shrink-0">
                        <Smartphone className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold">2FA via Autenticador</p>
                        <p className="text-[#8E9297] text-xs mt-1 leading-relaxed">Adicione uma camada extra usando Microsoft ou Google Authenticator.</p>
                      </div>
                      <button className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#5865F2]/10 whitespace-nowrap">Habilitar</button>
                   </div>

                   <div className="pt-8 border-t border-[#272A31]">
                      <h4 className="text-[#EF4444] font-bold text-sm mb-4">Zona de Perigo</h4>
                      <p className="text-[#8E9297] text-xs mb-6 leading-relaxed">Sair de todos os dispositivos ou desativar conta. A desativação removerá permanentemente seu histórico de lances e alertas.</p>
                      <div className="flex gap-4">
                        <button className="bg-[#1C2129] border border-[#272A31] text-[#8E9297] hover:text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all">Sair de Tudo</button>
                        <button className="bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/30 text-[#EF4444] px-5 py-2.5 rounded-xl text-xs font-bold transition-all">Desativar Conta</button>
                      </div>
                   </div>
                </div>
             )}

          </div>
        </main>

      </div>
      
    </div>
  );
}
