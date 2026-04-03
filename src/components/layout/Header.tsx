"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, Menu, Target, Zap, CheckCircle2, X, ChevronDown, Settings, Shield, LogOut } from "lucide-react";
import { useSidebar } from "./SidebarContext";

const NOTIFICATIONS = [
  {
    id: 1,
    type: "alert",
    icon: Target,
    iconColor: "text-[#10B981]",
    iconBg: "bg-[#10B981]/10",
    title: "Alerta disparado!",
    body: "Sodré Santoro — Lote 902: Sucata de Alumínio, 4T. Compatível com seu tracker.",
    time: "Há 5 min",
    unread: true,
  },
  {
    id: 2,
    type: "risk",
    icon: Zap,
    iconColor: "text-[#F59E0B]",
    iconBg: "bg-[#F59E0B]/10",
    title: "Risco Médio detectado",
    body: "Lote 047 — Trator Valtra BH140 tem dívida de IPVA em aberto de R$ 4.200.",
    time: "Há 1h",
    unread: true,
  },
  {
    id: 3,
    type: "info",
    icon: CheckCircle2,
    iconColor: "text-[#5865F2]",
    iconBg: "bg-[#5865F2]/10",
    title: "Leilão encerrado",
    body: "O lote 019 (CNC Romi) que você salvou foi arrematado por R$ 92.000.",
    time: "Há 3h",
    unread: false,
  },
];

import { useUser } from "@/hooks/useUser";

export function Header() {
  const { user, signOut } = useUser();
  const { setOpen } = useSidebar();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [isMac, setIsMac] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (notifOpen || userMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, userMenuOpen]);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  const dismiss = (id: number) => setNotifications((prev) => prev.filter((n) => n.id !== id));

  return (
    <header className="h-16 border-b border-[#272A31] bg-[#0B0E14]/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 shrink-0">

      {/* Left: hamburger (mobile) + search hint (desktop) */}
      <div className="flex items-center gap-4 flex-1 min-w-0 h-full">
        <button
          onClick={() => setOpen(true)}
          className="md:hidden p-2 rounded-xl bg-[#151A22] border border-[#272A31] text-[#8E9297] hover:text-white transition-colors flex-shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/dashboard" className="md:hidden flex items-center gap-1.5 text-white font-bold text-lg tracking-tight hover:opacity-80 transition-opacity whitespace-nowrap">
          <Bell className="w-4 h-4 text-[#5865F2]" />
          Radar<span className="text-[#5865F2]">Leilão</span>
        </Link>

        <div className="hidden md:flex items-center text-[#8E9297] text-sm hover:text-white cursor-pointer transition-colors h-full">
          <Search className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">
            Pressione <kbd className="bg-[#2F3136] px-1.5 py-0.5 rounded text-[10px] ml-1 font-sans">{isMac ? "⌘" : "Ctrl"}</kbd>
            {" "}+{" "}
            <kbd className="bg-[#2F3136] px-1.5 py-0.5 rounded text-[10px] font-sans">K</kbd> para buscar
          </span>
        </div>
      </div>

      {/* Right: notifications + profile brief */}
      <div className="flex items-center gap-3 flex-shrink-0 h-full" ref={panelRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative p-2 text-[#8E9297] hover:text-white hover:bg-[#2F3136] rounded-xl transition-colors group h-10 w-10 flex items-center justify-center"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#EF4444] rounded-full border-2 border-[#0B0E14] flex items-center justify-center text-white text-[9px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-2xl bg-[#151A22] border border-[#272A31] hover:border-[#454655] transition-all group h-10 min-w-[140px]"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5865F2] to-[#7289da] flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-[#5865F2]/20 uppercase">
              {user?.name.split(" ").map(n => n[0]).join("") || "US"}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-[11px] font-bold truncate leading-tight">{user?.name || "Usuário"}</p>
              <div className="flex items-center gap-1">
                <span className={`w-1 h-1 rounded-full ${user?.tier === "free" ? "bg-[#8E9297]" : "bg-[#5865F2]"}`}></span>
                <p className={`${user?.tier === "free" ? "text-[#8E9297]" : "text-[#5865F2]"} text-[9px] font-black uppercase tracking-widest truncate`}>
                  {user?.tier?.replace("_", " ") || "Free Account"}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-[#454655] group-hover:text-white transition-transform duration-300 ${userMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {/* User Dropdown */}
          {userMenuOpen && (
            <div className="absolute top-[110%] right-0 w-64 bg-[#151A22] border border-[#272A31] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              {/* Profile Header */}
              <div className="p-5 border-b border-[#272A31] bg-[#1C2129]">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5865F2] to-[#7289da] flex items-center justify-center text-white text-sm font-black shadow-xl uppercase">
                      {user?.name.split(" ").map(n => n[0]).join("") || "US"}
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{user?.name || "Usuário"}</p>
                      <p className="text-[#8E9297] text-xs truncate">{user?.email || ""}</p>
                   </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-2">
                 <Link 
                   href="/settings" 
                   onClick={() => setUserMenuOpen(false)}
                   className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-all group"
                 >
                    <div className="w-8 h-8 rounded-lg bg-[#2F3136]/50 flex items-center justify-center group-hover:bg-[#5865F2]/10 transition-colors">
                      <Settings className="w-4 h-4 group-hover:text-[#5865F2]" />
                    </div>
                    <span className="text-sm font-semibold">Configurações</span>
                 </Link>

                 <Link 
                   href="/admin" 
                   onClick={() => setUserMenuOpen(false)}
                   className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-all group"
                 >
                    <div className="w-8 h-8 rounded-lg bg-[#2F3136]/50 flex items-center justify-center group-hover:bg-[#EF4444]/10 transition-colors">
                      <Shield className="w-4 h-4 group-hover:text-[#EF4444]" />
                    </div>
                    <span className="text-sm font-semibold">Painel Admin</span>
                 </Link>
                 
                 <div className="h-px bg-[#272A31] my-2 mx-2"></div>

                 <button
                   onClick={(e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     if (isSigningOut) return;

                     console.log("Logout button clicked");
                     setUserMenuOpen(false);
                     setIsSigningOut(true);

                     signOut().then(() => {
                       console.log("SignOut completed");
                     }).catch((err) => {
                       console.error("SignOut error:", err);
                       setIsSigningOut(false);
                     });
                   }}
                   disabled={isSigningOut}
                   className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#EF4444] hover:bg-[#EF4444]/10 transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    <div className="w-8 h-8 rounded-lg bg-[#EF4444]/5 flex items-center justify-center group-hover:bg-[#EF4444]/20 transition-colors">
                      {isSigningOut ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-sm font-bold">
                      {isSigningOut ? "Encerrando..." : "Encerrar Sessão"}
                    </span>
                 </button>
              </div>

              {/* Footer */}
              <div className="bg-[#0B0E14] px-5 py-3 border-t border-[#272A31]">
                 <p className="text-[10px] text-[#454655] font-bold text-center uppercase tracking-widest">v2.4.0 Codename "Agentic"</p>
              </div>
            </div>
          )}
        </div>

        {/* Notification Panel */}
        {notifOpen && (
          <div className="absolute top-[80%] right-12 mt-3 w-80 md:w-96 bg-[#151A22] border border-[#272A31] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#272A31]">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[#5865F2] text-xs font-semibold hover:underline">
                    Marcar todas lidas
                  </button>
                )}
                <button onClick={() => setNotifOpen(false)} className="p-1 rounded-lg text-[#454655] hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-[#272A31]">
              {notifications.length === 0 && (
                <div className="px-5 py-10 text-center text-[#454655] text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  Nenhuma notificação por enquanto.
                </div>
              )}
              {notifications.map((n) => {
                const Icon = n.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-5 py-4 transition-colors hover:bg-[#2F3136]/30 relative ${n.unread ? "bg-[#5865F2]/5" : ""}`}
                  >
                    {/* Unread dot */}
                    {n.unread && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#5865F2]" />
                    )}

                    <div className={`w-9 h-9 rounded-xl ${n.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${n.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-tight ${n.unread ? "text-white" : "text-[#8E9297]"}`}>
                        {n.title}
                      </p>
                      <p className="text-[#8E9297] text-xs mt-1 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[#454655] text-[10px] mt-1.5 font-medium">{n.time}</p>
                    </div>

                    <button
                      onClick={() => dismiss(n.id)}
                      className="flex-shrink-0 p-1 rounded-lg text-[#272A31] hover:text-[#8E9297] transition-colors self-start"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#272A31]">
              <Link
                href="/notificacoes"
                onClick={() => setNotifOpen(false)}
                className="text-[#5865F2] text-xs font-semibold hover:underline w-full text-center block"
              >
                Ver todas as notificações
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
