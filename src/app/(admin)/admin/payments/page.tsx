import { CreditCard, ShieldCheck, Key, ExternalLink, AlertTriangle, CheckCircle2, Save } from "lucide-react";

export default function PaymentsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[#10B981]" /> Payment Gateway
        </h1>
        <p className="text-[#8E9297] text-sm mt-1">Configure os processadores de pagamento e webhooks de cobrança.</p>
      </div>

      {/* Active Gateway Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stripe */}
        <div className="bg-[#0B0E14] border-2 border-[#5865F2] rounded-2xl p-5 relative">
          <div className="absolute top-3 right-3 bg-[#5865F2] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Ativo</div>
          <div className="w-10 h-10 bg-[#635BFF]/10 border border-[#635BFF]/30 rounded-xl flex items-center justify-center mb-3">
            <span className="text-[#635BFF] font-black text-lg">S</span>
          </div>
          <h3 className="text-white font-bold">Stripe</h3>
          <p className="text-[#8E9297] text-xs mt-1">Recomendado. Cobertura global, fácil integração com Supabase.</p>
        </div>

        {/* MercadoPago */}
        <div className="bg-[#151A22] border border-[#272A31] hover:border-[#454655] rounded-2xl p-5 transition-colors cursor-pointer">
          <div className="w-10 h-10 bg-[#009EE3]/10 border border-[#009EE3]/20 rounded-xl flex items-center justify-center mb-3">
            <span className="text-[#009EE3] font-black text-xs">MP</span>
          </div>
          <h3 className="text-[#8E9297] font-bold">Mercado Pago</h3>
          <p className="text-[#454655] text-xs mt-1">Ideal para cobrança em BRL com Pix e boleto.</p>
        </div>

        {/* PagSeguro */}
        <div className="bg-[#151A22] border border-[#272A31] hover:border-[#454655] rounded-2xl p-5 transition-colors cursor-pointer">
          <div className="w-10 h-10 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl flex items-center justify-center mb-3">
            <span className="text-[#F59E0B] font-black text-xs">PS</span>
          </div>
          <h3 className="text-[#8E9297] font-bold">PagSeguro</h3>
          <p className="text-[#454655] text-xs mt-1">Alternativa nacional com suporte a cartão parcelado.</p>
        </div>
      </div>

      {/* Stripe Config */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-[#5865F2]" /> Credenciais Stripe
          </h2>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="text-[#5865F2] text-xs font-semibold flex items-center gap-1 hover:underline">
            Dashboard Stripe <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="block text-[#8E9297] text-[10px] font-bold uppercase tracking-widest mb-2">Chave Pública (Publishable Key)</label>
            <div className="flex items-center gap-3">
              <input type="text" defaultValue="pk_live_••••••••••••••••••••••••" readOnly className="flex-1 bg-[#0B0E14] border border-[#272A31] text-[#8E9297] rounded-xl py-3 px-4 text-sm font-mono focus:outline-none" />
              <button className="px-4 py-3 bg-[#2F3136] hover:bg-[#454655] border border-[#272A31] text-white text-xs font-bold rounded-xl transition-colors">Editar</button>
            </div>
          </div>
          <div>
            <label className="block text-[#8E9297] text-[10px] font-bold uppercase tracking-widest mb-2">Chave Secreta (Secret Key)</label>
            <div className="flex items-center gap-3">
              <input type="password" defaultValue="sk_live_••••••••••••••••••••••••" className="flex-1 bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50" />
              <button className="px-4 py-3 bg-[#2F3136] hover:bg-[#454655] border border-[#272A31] text-white text-xs font-bold rounded-xl transition-colors">Editar</button>
            </div>
          </div>
          <div>
            <label className="block text-[#8E9297] text-[10px] font-bold uppercase tracking-widest mb-2">Webhook Endpoint Secret</label>
            <div className="flex items-center gap-3">
              <input type="password" defaultValue="whsec_••••••••••••••••••••••••" className="flex-1 bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50" />
              <button className="px-4 py-3 bg-[#2F3136] hover:bg-[#454655] border border-[#272A31] text-white text-xs font-bold rounded-xl transition-colors">Editar</button>
            </div>
          </div>
        </div>

        <button className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-xl font-bold transition-all text-sm shadow-lg shadow-[#5865F2]/20">
          <Save className="w-4 h-4" /> Salvar Credenciais
        </button>
      </div>

      {/* Webhook Events */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8">
        <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#10B981]" /> Eventos Webhook Monitorados
        </h2>
        <div className="space-y-3">
          {[
            { event: "checkout.session.completed", desc: "Ativa plano após pagamento confirmado", ok: true },
            { event: "customer.subscription.deleted", desc: "Rebaixa conta ao plano Básico no cancelamento", ok: true },
            { event: "invoice.payment_failed", desc: "Notifica o usuário e suspende acesso após 3 falhas", ok: true },
            { event: "customer.subscription.updated", desc: "Sincroniza upgrade/downgrade entre planos", ok: false },
          ].map((item) => (
            <div key={item.event} className="flex items-center gap-4 p-4 bg-[#0B0E14] rounded-xl border border-[#272A31]">
              {item.ok
                ? <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-mono font-bold truncate">{item.event}</p>
                <p className="text-[#8E9297] text-[11px] mt-0.5">{item.desc}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 ${item.ok ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F59E0B]/10 text-[#F59E0B]"}`}>
                {item.ok ? "Ativo" : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
