import { Bell, Gem, Zap, CheckCircle2, Info, AlertTriangle, Star } from "lucide-react";

const ALL_NOTIFICATIONS = [
  {
    id: 1,
    icon: Gem,
    iconColor: "text-[#5865F2]",
    iconBg: "bg-[#5865F2]/10",
    title: "Novos lotes disponíveis",
    body: "CAIXA Vitrine de Jóias — 23 novas peças adicionadas ao catálogo hoje.",
    time: "Há 10 min",
    unread: true,
    category: "Novidade",
  },
  {
    id: 2,
    icon: Zap,
    iconColor: "text-[#F59E0B]",
    iconBg: "bg-[#F59E0B]/10",
    title: "Catálogo Atualizado detectado",
    body: "Leilão em SP teve 5 novos lotes incluídos. Verifique antes de fazer sua Estimate.",
    time: "Há 2h",
    unread: true,
    category: "Alerta",
  },
  {
    id: 3,
    icon: CheckCircle2,
    iconColor: "text-[#10B981]",
    iconBg: "bg-[#10B981]/10",
    title: "Lote arrematado",
    body: "O lote que você salvou foi vendido por R$ 4.500. Parabéns!",
    time: "Há 5h",
    unread: false,
    category: "Info",
  },
  {
    id: 4,
    icon: Star,
    iconColor: "text-[#F59E0B]",
    iconBg: "bg-[#F59E0B]/10",
    title: "Lote salvo por outro usuário",
    body: "Um lote que você visualizou foi adicionado à watchlist de outro usuário.",
    time: "Ontem",
    unread: false,
    category: "Info",
  },
  {
    id: 5,
    icon: Info,
    iconColor: "text-[#8E9297]",
    iconBg: "bg-[#272A31]",
    title: "Bem-vindo ao Radar Jóias",
    body: "Sua conta foi configurada com sucesso. Comece a explorar os lotes disponíveis.",
    time: "3 dias atrás",
    unread: false,
    category: "Sistema",
  },
];

export default function NotificacoesPage() {
  const unread = ALL_NOTIFICATIONS.filter((n) => n.unread);
  const read = ALL_NOTIFICATIONS.filter((n) => !n.unread);

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#5865F2]" /> Notificações
          </h1>
          <p className="text-[#8E9297] text-sm mt-1">
            {unread.length > 0 ? `${unread.length} não lida${unread.length > 1 ? "s" : ""}` : "Tudo em dia!"}
          </p>
        </div>
        {unread.length > 0 && (
          <button className="text-[#5865F2] text-sm font-bold hover:underline">
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Unread */}
      {unread.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#8E9297]">Não lidas</h2>
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl divide-y divide-[#272A31] overflow-hidden">
            {unread.map((n) => {
              const Icon = n.icon;
              return (
                <div key={n.id} className="flex gap-4 p-5 hover:bg-[#2F3136]/20 transition-colors bg-[#5865F2]/5 relative">
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#5865F2]" />
                  <div className={`w-10 h-10 rounded-xl ${n.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${n.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white font-bold text-sm">{n.title}</p>
                      <span className="text-[#454655] text-[10px] font-medium whitespace-nowrap">{n.time}</span>
                    </div>
                    <p className="text-[#8E9297] text-sm mt-1 leading-relaxed">{n.body}</p>
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/20">
                      {n.category}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Read */}
      {read.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#8E9297]">Anteriores</h2>
          <div className="bg-[#151A22] border border-[#272A31] rounded-2xl divide-y divide-[#272A31] overflow-hidden">
            {read.map((n) => {
              const Icon = n.icon;
              return (
                <div key={n.id} className="flex gap-4 p-5 hover:bg-[#2F3136]/20 transition-colors opacity-70">
                  <div className={`w-10 h-10 rounded-xl ${n.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${n.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[#8E9297] font-bold text-sm">{n.title}</p>
                      <span className="text-[#454655] text-[10px] font-medium whitespace-nowrap">{n.time}</span>
                    </div>
                    <p className="text-[#454655] text-sm mt-1 leading-relaxed">{n.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}