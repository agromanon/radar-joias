"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map as MapIcon, Target, Star, Settings, Bell, X, Sparkles } from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { useWatchlist } from "@/contexts/WatchlistContext";

const NAV_ITEMS = [
  { href: "/copilot", icon: Sparkles, label: "Radar Copilot", badge: "Beta" },
  { href: "/dashboard", icon: Compass, label: "Explorar Lotes" },
  { href: "/mapa", icon: MapIcon, label: "Radar Geográfico" },
  { href: "/alertas", icon: Target, label: "Meus Alertas", count: true },
  { href: "/watchlist", icon: Star, label: "Lotes Salvos" },
];

function SidebarContent({ onClose, watchlistCount }: { onClose?: () => void; watchlistCount: number }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-[#151A22]">
      {/* Logo Area - Matching Header exactly */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-[#272A31] flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 text-white font-semibold text-xl tracking-tight hover:opacity-80 transition-opacity">
          <Bell className="w-5 h-5 text-[#5865F2]" />
          Radar<span className="text-[#5865F2]">Leilão</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-colors md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
        <div className="text-[10px] font-bold text-[#454655] uppercase tracking-[0.2em] mb-4 px-2">
          Descobrir
        </div>

        {NAV_ITEMS.map(({ href, icon: Icon, label, badge, count }) => {
          const active = pathname === href;
          const shouldShowCount = count && watchlistCount > 0;

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                active
                  ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20"
                  : "text-[#8E9297] hover:bg-[#2F3136] hover:text-white"
              }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 ${
                  active ? "text-white" : "group-hover:text-[#5865F2] transition-colors"
                }`}
              />
              <span className="font-medium text-sm flex items-center gap-2">
                {label}
                {(badge || shouldShowCount) && (
                  <span
                    className={`py-0.5 px-2 rounded-full text-[10px] font-bold ${
                      active ? "bg-white/20 text-white" : "bg-[#5865F2]/20 text-[#5865F2]"
                    }`}
                  >
                    {badge || (shouldShowCount ? watchlistCount : null)}
                  </span>
                )}
              </span>
            </Link>
          );
        })}

        <div className="my-6 border-t border-[#272A31]" />

        <div className="text-[10px] font-bold text-[#454655] uppercase tracking-[0.2em] mb-4 px-2">
          Conta
        </div>

        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
            pathname.startsWith("/settings")
              ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20"
              : "text-[#8E9297] hover:bg-[#2F3136] hover:text-white"
          }`}
        >
          <Settings className="w-5 h-5 flex-shrink-0 group-hover:text-[#5865F2] transition-colors" />
          <span className="font-medium text-sm">Configurações</span>
        </Link>
      </nav>

      {/* User mini */}
      <div className="p-4 border-t border-[#272A31] flex-shrink-0">
        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#2F3136] transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-[#5865F2]/10">
            US
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">Usuário Teste</p>
            <p className="text-[10px] text-[#8E9297] truncate uppercase font-bold tracking-wider">Plano PRO</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { open, setOpen } = useSidebar();
  const pathname = usePathname();
  const { count: watchlistCount } = useWatchlist();

  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-[#151A22] border-r border-[#272A31] flex-col h-full sticky top-0 flex-shrink-0">
        <SidebarContent watchlistCount={watchlistCount} />
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
        className={`md:hidden fixed top-0 left-0 h-full w-72 bg-[#151A22] border-r border-[#272A31] z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent onClose={() => setOpen(false)} watchlistCount={watchlistCount} />
      </aside>
    </>
  );
}
