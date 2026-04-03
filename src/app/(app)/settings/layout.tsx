"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Key, CreditCard, Sun } from "lucide-react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const NAV_ITEMS = [
    { href: "/settings", icon: User, label: "Meu Perfil" },
    { href: "/settings/security", icon: Key, label: "Senha e Segurança" },
    { href: "/settings/appearance", icon: Sun, label: "Aparência e Tema" },
    { href: "/settings/billing", icon: CreditCard, label: "Assinatura e Faturamento" },
  ];

  return (
    <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto flex flex-col md:flex-row gap-8 animate-in fade-in duration-500">
      
      {/* Settings Navigation Sidebar */}
      <div className="w-full md:w-72 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white mb-6">Configurações</h1>
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  active
                    ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20"
                    : "hover:bg-[#151A22] text-[#8E9297] hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-white" : "text-[#5865F2]"}`} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 w-full min-w-0">
        {children}
      </div>
    </div>
  );
}
