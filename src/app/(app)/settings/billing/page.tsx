"use client";

import { Check, Zap, Sparkles, Building2, CreditCard, ArrowRight, ShieldCheck, Clock, BadgeCheck } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import Link from "next/link";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "R$ 0",
    description: "Para iniciantes no mercado de leilões.",
    features: [
      "Visualização de 50 lotes/mês",
      "Filtros básicos por estado",
      "Radar Geográfico modo Lite",
      "Suporte via e-mail (48h)",
    ],
    cta: "Plano Atual",
    active: true,
  },
  {
    id: "pro",
    name: "Engenharia B2B",
    price: "R$ 149",
    period: "/ mês",
    description: "Análise profunda de editais e precificação.",
    features: [
      "Visualização ilimitada de lotes",
      "Termômetro de Risco IA (MiniMax)",
      "Cálculo de ROI automático",
      "Extração de taxas dos editais",
      "Alertas Smart (ilimitados)",
    ],
    cta: "Começar Agora",
    popular: true,
  },
  {
    id: "war_room",
    name: "War Room",
    price: "R$ 599",
    period: "/ mês",
    description: "O poder total da Inteligência Agentica.",
    features: [
      "Acesso ao Radar Copilot (IA)",
      "Orquestrador de tarefas autônomo",
      "Busca cross-country semântica",
      "Auditoria de Edital em Real-time",
      "Suporte Prioritário (WhatsApp)",
      "Várias subcontas por empresa",
    ],
    cta: "Ser War Room",
    premium: true,
  },
];

export default function BillingPage() {
  const { user } = useUser();

  return (
    <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      
      {/* Header */}
      <header className="text-center space-y-4 pt-12 pb-8">
         <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] text-xs font-bold uppercase tracking-widest mb-2">
            <Zap className="w-4 h-4 fill-[#5865F2]" /> Upgrade Your Strategy
         </div>
         <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
            Escale seu <span className="text-[#5865F2]">Lucro</span> Industrial
         </h1>
         <p className="text-[#8E9297] text-lg max-w-2xl mx-auto leading-relaxed">
            Seja você um arrematante casual ou uma empresa de engenharia de sucatas, temos o radar certo para você.
         </p>
      </header>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
        {PLANS.map((plan) => (
          <div 
            key={plan.id}
            className={`relative flex flex-col p-8 rounded-[40px] border transition-all duration-500 overflow-hidden group ${
              plan.popular 
                ? "bg-[#1C2129] border-[#5865F2] shadow-2xl shadow-[#5865F2]/10 scale-105 z-10" 
                : plan.premium
                ? "bg-[#151A22] border-[#EF4444]/30 hover:border-[#EF4444] shadow-2xl"
                : "bg-[#151A22] border-[#272A31] hover:border-[#454655]"
            }`}
          >
            {/* Background Accent for Premium */}
            {plan.premium && (
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#EF4444]/10 rounded-full blur-[60px] -z-10 group-hover:bg-[#EF4444]/20 transition-all"></div>
            )}
            
            {plan.popular && (
              <div className="absolute top-6 right-6 px-3 py-1 bg-[#5865F2] text-white text-[10px] font-black rounded-lg shadow-lg uppercase tracking-widest">
                Mais Popular
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                {plan.premium ? <Sparkles className="w-5 h-5 text-[#EF4444]" /> : plan.popular ? <Zap className="w-5 h-5 text-[#5865F2]" /> : <Building2 className="w-5 h-5 text-[#8E9297]" />}
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1 mt-6">
                <span className="text-5xl font-black text-white tracking-tight">{plan.price}</span>
                {plan.period && <span className="text-[#454655] font-bold text-lg">{plan.period}</span>}
              </div>
              <p className="text-[#8E9297] text-sm mt-4 font-medium leading-relaxed">{plan.description}</p>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex gap-3 text-sm text-[#8E9297] font-medium leading-tight">
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${plan.popular ? "bg-[#5865F2]/20" : "bg-[#272A31]"}`}>
                    <Check className={`w-3 h-3 ${plan.popular ? "text-[#5865F2]" : "text-[#8E9297]"}`} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                plan.id === user?.tier
                  ? "bg-[#272A31] text-[#8E9297] cursor-default"
                  : plan.popular
                  ? "bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-xl shadow-[#5865F2]/20 hover:-translate-y-1"
                  : plan.premium
                  ? "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-xl shadow-[#EF4444]/20 hover:-translate-y-1"
                  : "bg-[#1C2129] hover:bg-[#2F3136] text-white border border-[#272A31] hover:-translate-y-1"
              }`}
            >
              {plan.cta}
              {plan.id !== user?.tier && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>

      {/* Trust Badges Section */}
      <div className="pt-12 border-t border-[#272A31] grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="flex items-center gap-4 group">
          <div className="w-12 h-12 bg-[#151A22] rounded-2xl border border-[#272A31] flex items-center justify-center group-hover:border-[#10B981] transition-all">
            <CreditCard className="w-6 h-6 text-[#10B981]" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">Pagamento Seguro</h4>
            <p className="text-[#454655] text-[10px] font-bold uppercase tracking-widest mt-1">Stripe Checkout</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 group">
          <div className="w-12 h-12 bg-[#151A22] rounded-2xl border border-[#272A31] flex items-center justify-center group-hover:border-[#5865F2] transition-all">
            <ShieldCheck className="w-6 h-6 text-[#5865F2]" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">Garantia 7 Dias</h4>
            <p className="text-[#454655] text-[10px] font-bold uppercase tracking-widest mt-1">Reembolso Total</p>
          </div>
        </div>

        <div className="flex items-center gap-4 group">
          <div className="w-12 h-12 bg-[#151A22] rounded-2xl border border-[#272A31] flex items-center justify-center group-hover:border-[#F59E0B] transition-all">
            <Clock className="w-6 h-6 text-[#F59E0B]" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">Setup Imediato</h4>
            <p className="text-[#454655] text-[10px] font-bold uppercase tracking-widest mt-1">Acesso em segundos</p>
          </div>
        </div>

        <div className="flex items-center gap-4 group">
          <div className="w-12 h-12 bg-[#151A22] rounded-2xl border border-[#272A31] flex items-center justify-center group-hover:border-[#10B981] transition-all">
            <BadgeCheck className="w-6 h-6 text-[#10B981]" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">Certificado Digital</h4>
            <p className="text-[#454655] text-[10px] font-bold uppercase tracking-widest mt-1">Segurança de Dados</p>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-[32px] p-8 text-center max-w-3xl mx-auto">
        <p className="text-[#8E9297] text-sm leading-relaxed">
          Os valores são faturados em Reais (BRL). Empresas em regime de Lucro Real podem abater o investimento como despesa operacional de software IA. 
          Dúvidas sobre faturamento corporativo via Boleto ou NF? <Link href="#" className="text-white font-bold hover:underline">Fale com um consultor</Link>.
        </p>
      </div>

    </div>
  );
}
