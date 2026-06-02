"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Database, Bell, ShieldAlert,
  BarChart3, LogOut, Cpu, CreditCard, Crown, Menu, X, Settings, User, ExternalLink, Home, Shield
} from "lucide-react";
import { useUser } from "@/hooks/useUser";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", iconColor: "text-[#EF4444]" },
  { href: "/admin/llm", icon: Cpu, label: "Gateway LLM" },
  { href: "/admin/scrapers", icon: Database, label: "Robôs Scrapers" },
  { href: "/admin/proxies", icon: Shield, label: "Proxy Pool" },
  { href: "/admin/users", icon: Users, label: "Gestão de Usuários" },
  { href: "/admin/plans", icon: Crown, label: "Planos" },
  { href: "/admin/payments", icon: CreditCard, label: "Pagamentos" },
  { href: "/admin/stats", icon: BarChart3, label: "Métricas (MRR)" },
];

const ADMIN_NOTIFS = [
  { id: 1, title: "Scraper Sodré Falhou", body: "O robô parou de responder após mudança seletora.", time: "10m atrás", type: "error" },
  { id: 2, title: "Novo Upgrade: War Room", body: "Usuário 'empresa_x' assinou o plano anual.", time: "1h atrás", type: "success" },
  { id: 3, title: "Uso de LLM Alto", body: "Consumo de DeepSeek atingiu 80% da quota diária.", time: "2h atrás", type: "warning" },
];

function AdminSidebarContent({ onClose, signOut }: { onClose?: () => void; signOut: () => Promise<void> }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 px-6 border-b border-[#272A31] flex items-center justify-between flex-shrink-0">
        <Link href="/admin" className="hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2 text-white font-bold text-xl tracking-tight">
            <ShieldAlert className="w-6 h-6 text-[#EF4444]" />
            Control<span className="text-[#EF4444]">Room</span>
          </div>
          <p className="text-[10px] text-[#454655] font-bold uppercase tracking-widest mt-1">SaaS Infrastructure</p>
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-lg text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-colors md:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, iconColor }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-sm ${
                active
                  ? "bg-[#EF4444]/10 text-white border border-[#EF4444]/20"
                  : "text-[#8E9297] hover:text-white hover:bg-[#151A22]"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-[#EF4444]" : (iconColor ?? "")}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#272A31] flex-shrink-0">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#8E9297] hover:text-white transition-colors text-xs font-semibold">
          <ExternalLink className="w-4 h-4" /> Voltar ao Portal
        </Link>
        <button
          onClick={() => void signOut()}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors text-xs font-semibold mt-1"
        >
          <LogOut className="w-4 h-4" /> Sair do Painel
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useUser();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const pathname = usePathname();

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  // Handle outside clicks
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0B0E14] font-sans">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-[#10131A] border-r border-[#272A31] flex-col flex-shrink-0">
        <AdminSidebarContent signOut={signOut} />
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-[#10131A] border-r border-[#272A31] z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AdminSidebarContent onClose={() => setOpen(false)} signOut={signOut} />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        <header className="h-16 border-b border-[#272A31] flex items-center justify-between px-4 md:px-10 bg-[#0B0E14]/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#151A22] border border-[#272A31] text-[#8E9297] hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/admin" className="md:hidden flex items-center gap-2 text-white font-bold text-lg tracking-tight hover:opacity-80 transition-opacity whitespace-nowrap">
              <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
              Control<span className="text-[#EF4444]">Room</span>
            </Link>
            <div className="text-white font-bold text-sm hidden md:block">Visão Geral do Sistema</div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setNotifOpen(!notifOpen)}
                className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                  notifOpen 
                    ? "bg-[#EF4444]/10 border-[#EF4444]/50 text-white" 
                    : "bg-[#151A22] border-[#272A31] text-[#8E9297] hover:text-white hover:border-[#454655]"
                }`}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#EF4444] rounded-full border-2 border-[#151A22]"></span>
              </button>

              {notifOpen && (
                <div className="absolute top-full right-0 mt-3 w-80 bg-[#151A22] border border-[#272A31] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-[#272A31] flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Alertas de Infra</span>
                    <span className="text-[10px] text-[#EF4444] font-black uppercase tracking-widest">3 novas</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {ADMIN_NOTIFS.map((n) => (
                      <div key={n.id} className="p-4 hover:bg-[#2F3136]/30 border-b border-[#272A31] last:border-0 cursor-pointer transition-colors group">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-white font-bold text-xs group-hover:text-[#EF4444] transition-colors">{n.title}</h4>
                          <span className="text-[#454655] text-[9px] font-medium">{n.time}</span>
                        </div>
                        <p className="text-[#8E9297] text-[11px] leading-relaxed">{n.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-[#0B0E14]/50 text-center">
                    <button className="text-[10px] text-[#8E9297] font-bold hover:text-white transition-colors">LIMPAR TODOS</button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={userRef}>
              <button 
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`flex items-center gap-3 pl-3 md:pl-4 border-l border-[#272A31] hover:opacity-80 transition-opacity ${userDropdownOpen ? "opacity-100" : ""}`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#EF4444] flex items-center justify-center text-white text-xs font-black shadow-lg shadow-[#EF4444]/20 ring-2 ring-[#EF4444]/20">AD</div>
                <div className="hidden sm:block text-left">
                  <p className="text-white text-xs font-bold leading-none mb-1">Admin Master</p>
                  <p className="text-[#8E9297] text-[10px] font-medium">Backoffice Root</p>
                </div>
              </button>

              {userDropdownOpen && (
                <div className="absolute top-full right-0 mt-3 w-56 bg-[#151A22] border border-[#272A31] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                   <div className="p-4 bg-[#0B0E14]/50 border-b border-[#272A31]">
                      <p className="text-white text-xs font-bold">Logado como</p>
                      <p className="text-[#8E9297] text-[10px] truncate">admin@radarleilao.com.br</p>
                   </div>
                   <div className="p-2">
                      <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-all text-xs font-medium group">
                        <Home className="w-4 h-4 group-hover:text-[#EF4444]" /> Voltar ao App
                      </Link>
                      <div className="my-2 border-t border-[#272A31]" />
                      <Link href="/admin/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-all text-xs font-medium group">
                         <User className="w-4 h-4 group-hover:text-[#EF4444]" /> Meu Perfil
                      </Link>
                      <Link href="/admin/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-all text-xs font-medium group">
                         <Settings className="w-4 h-4 group-hover:text-[#EF4444]" /> Configurações
                      </Link>
                      <div className="my-2 border-t border-[#272A31]" />
                      <button
                        onClick={signOut}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#EF4444] hover:bg-[#EF4444]/10 transition-all text-xs font-bold group"
                      >
                        <LogOut className="w-4 h-4" /> Sair da Sessão
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
