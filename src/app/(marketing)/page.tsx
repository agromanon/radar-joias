import Link from "next/link";
import { ArrowRight, Target, Brain, Bot, CheckCircle2, X, Sparkles, MessageSquare, Zap, ShieldAlert, Globe, LayoutDashboard } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col font-sans selection:bg-[#5865F2]/30 text-selection:white">
      
      {/* Marketing Navbar */}
      <header className="h-20 border-b border-[#272A31] flex items-center justify-between px-6 md:px-12 bg-[#0B0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="flex items-center gap-2 text-white font-bold text-2xl tracking-tight">
           <Target className="w-6 h-6 text-[#5865F2]" />
           Radar<span className="text-[#5865F2]">Leilão</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[#8E9297] font-medium text-sm">
           <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona?</a>
           <a href="#copilot" className="hover:text-white transition-colors">Agente IA</a>
           <a href="#precos" className="hover:text-white transition-colors font-bold text-[#5865F2]">Planos B2B</a>
           <Link href="/login" className="hover:text-white transition-colors font-semibold pl-4 border-l border-[#272A31]">Login</Link>
        </nav>
        <div>
           <Link href="/register" className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2.5 rounded-full font-bold transition-all shadow-[0_4px_30px_rgb(88,101,242,0.3)] text-sm hover:scale-105 active:scale-95">
             Criar Conta Grátis
           </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-32 flex flex-col items-center text-center overflow-hidden">
        {/* Decorative lighting */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#5865F2]/15 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151A22] border border-[#272A31] text-[#8E9297] text-[10px] font-black uppercase tracking-[0.2em] mb-8 relative z-10">
           <span className="flex h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
           O Maior Agregador Apoiado por IA do Brasil
        </div>

        <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter max-w-5xl leading-[0.95] mb-8 relative z-10">
          Encontre lucro, <br/> ignore <span className="text-[#5865F2]">o risco.</span>
        </h1>
        
        <p className="text-[#8E9297] text-lg md:text-xl max-w-2xl mb-12 relative z-10 leading-relaxed font-medium">
          Robôs que varrem +120 leiloeiros judiciais 24/7. 
          Nossa IA lê o edital, calcula taxas ocultas e te entrega o ROI real de bandeja.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full max-w-md">
           <Link href="/register" className="flex-1 bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_10px_40px_rgb(88,101,242,0.3)] flex items-center gap-2 justify-center hover:-translate-y-1">
             Explorar Lotes <ArrowRight className="w-5 h-5" />
           </Link>
           <a href="#como-funciona" className="flex-1 bg-[#151A22] border border-[#272A31] text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#2F3136] transition-all flex items-center justify-center">
             Ver Demo
           </a>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="px-6 py-12 md:py-24 border-t border-[#272A31] bg-[#0B0E14] relative z-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="p-8 rounded-[40px] bg-[#151A22] border border-[#272A31] hover:border-[#454655] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center mb-6 text-[#5865F2]">
                 <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Auditoria de Editais</h3>
              <p className="text-[#8E9297] text-sm leading-relaxed">
                 A IA rastreia expressões de ônus, dívidas ativas e cobranças de pátio que humanos levam horas para encontrar.
              </p>
           </div>
           <div className="p-8 rounded-[40px] bg-[#151A22] border border-[#272A31] hover:border-[#454655] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center mb-6 text-[#F59E0B]">
                 <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Radar Geográfico</h3>
              <p className="text-[#8E9297] text-sm leading-relaxed">
                 Mapeamento logístico em tempo real. Saiba exatamente onde retirar seu lote e quanto custará o reboque antes do lance.
              </p>
           </div>
           <div className="p-8 rounded-[40px] bg-[#151A22] border border-[#272A31] hover:border-[#454655] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center mb-6 text-[#10B981]">
                 <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Alertas Preditivos</h3>
              <p className="text-[#8E9297] text-sm leading-relaxed">
                 Seja notificado via WhatsApp e Push no exato milissegundo que uma oportunidade for listada em qualquer portal do país.
              </p>
           </div>
        </div>
      </section>

      {/* Radar Copilot Feature (Exclusivity Highlight) */}
      <section id="copilot" className="px-6 py-24 bg-[#10131A] relative border-y border-[#272A31] overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#5865F2]/5 rounded-full blur-[120px]"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
           <div className="flex-1 text-left relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] text-[10px] font-black uppercase tracking-widest mb-6">
                 New Feature Agentic IA
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-none">
                 O Fim da Busca <br/> Manual com o <span className="text-[#5865F2]">Copilot.</span>
              </h2>
              <p className="text-[#8E9297] text-lg leading-relaxed mb-8 font-medium">
                 Não perca tempo filtrando tabelas. Comande seu agente via linguagem natural e ele configurará alertas, monitorará pátios e analisará ROI para você.
              </p>
              <div className="space-y-4">
                 <div className="flex items-center gap-3 text-white font-bold group bg-[#151A22] p-4 rounded-2xl border border-[#272A31] hover:border-[#5865F2] transition-colors cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center shadow-lg shadow-[#5865F2]/20">
                       <MessageSquare className="w-5 h-5" />
                    </div>
                    "Acesse o edital do lote 45 e me diga se há dívida de IPVA."
                 </div>
                 <div className="flex items-center gap-3 text-white font-bold group bg-[#151A22] p-4 rounded-2xl border border-[#272A31] hover:border-[#5865F2] transition-colors cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-[#10B981] flex items-center justify-center shadow-lg shadow-[#10B981]/20">
                       <Target className="w-5 h-5" />
                    </div>
                    "Copilot, configure alerta mensal para geradores de 500kva em SP."
                 </div>
              </div>
           </div>

           <div className="flex-1 w-full max-w-lg relative">
              <div className="bg-[#151A22] border border-[#272A31] rounded-[40px] shadow-2xl p-6 relative overflow-hidden group">
                 <div className="h-4 w-4 absolute top-6 right-6">
                    <Sparkles className="text-[#5865F2] animate-pulse" />
                 </div>
                 <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-[#5865F2] flex items-center justify-center shadow-xl shadow-[#5865F2]/30">
                       <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                       <h4 className="text-white font-black text-lg">Radar Copilot</h4>
                       <span className="text-[#5865F2] text-[10px] font-black uppercase tracking-[0.2em]">IA Personal Assistant</span>
                    </div>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="bg-[#1C2129] p-5 rounded-3xl text-sm text-[#8E9297] border border-[#272A31] relative">
                       Busque vans Master e Sprinter no PR com lucro maior que 25% após impostos.
                    </div>
                    <div className="flex gap-4">
                       <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center flex-shrink-0 animate-bounce">
                          <Brain className="w-4 h-4 text-[#5865F2]" />
                       </div>
                       <div className="bg-[#5865F2]/10 p-5 rounded-3xl text-sm text-white border border-[#5865F2]/20 shadow-xl shadow-[#5865F2]/5">
                          <p className="font-bold mb-2">Processando multi-editais...</p>
                          Filtrei <strong>7 lotes</strong> do Leiloeiro Superbid. <br/>
                          ROI médio: <strong>28,4%</strong>. <br/>
                          Quer que eu adicione à sua Watchlist?
                       </div>
                    </div>
                 </div>
                 
                 <div className="mt-8 pt-6 border-t border-[#272A31] text-center">
                    <p className="text-[10px] text-[#EF4444] font-black uppercase tracking-[0.3em]">Exclusividade Plano War Room</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="px-6 py-24 bg-[#0B0E14] relative border-t border-[#272A31]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="text-[#5865F2] font-black text-sm uppercase tracking-widest mb-4">Investimento & ROI</div>
            <h2 className="text-4xl md:text-7xl font-black text-white tracking-tighter mb-4 leading-none">
              Pague com seus <br/> <span className="text-[#5865F2]">Lucros Novos.</span>
            </h2>
            <p className="text-[#8E9297] text-lg font-medium max-w-2xl mx-auto">
              Cancele quando quiser. Nenhuma taxa oculta. Auditoria profissional ao seu alcance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* Free Tier */}
            <div className="bg-[#151A22] p-10 rounded-[48px] border border-[#272A31] flex flex-col hover:border-[#454655] transition-all">
              <h3 className="text-xl font-bold text-white mb-2 underline decoration-[#5865F2] decoration-2 underline-offset-4">Rastreador Free</h3>
              <p className="text-[#8E9297] text-sm mb-8 font-medium">Ideal para curiosos ou iniciantes no mercado.</p>
              
              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-white">R$ 0</span>
                <span className="text-[#454655] font-bold text-sm mb-1 uppercase">/mês</span>
              </div>

              <div className="space-y-5 mb-10 flex-1">
                <div className="flex items-center gap-3 text-sm text-[#c6c5d7] font-medium">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> Radar de 50 lotes/mês
                </div>
                <div className="flex items-center gap-3 text-sm text-[#454655] line-through decoration-[#EF4444]/50">
                  <X className="w-5 h-5" /> Auditoria de Edital por IA
                </div>
                <div className="flex items-center gap-3 text-sm text-[#454655] line-through decoration-[#EF4444]/50">
                  <X className="w-5 h-5" /> Radar Copilot Agente IA
                </div>
              </div>

              <Link href="/register" className="block text-center w-full bg-[#2F3136] hover:bg-white hover:text-black text-white py-4 rounded-2xl font-black text-sm transition-all uppercase tracking-widest">
                Começar Grátis
              </Link>
            </div>

            {/* Pro Tier (Recommended) */}
            <div className="bg-gradient-to-b from-[#151A22] to-[#0B0E14] p-10 rounded-[48px] border-4 border-[#5865F2] flex flex-col relative shadow-[0_30px_70px_rgb(88,101,242,0.2)] transform md:-translate-y-6">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#5865F2] text-white text-[10px] font-black uppercase tracking-[0.3em] py-2 px-6 rounded-full shadow-lg shadow-[#5865F2]/40">
                RECOMENDADO
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">Engenharia B2B</h3>
              <p className="text-[#8E9297] text-sm mb-8 font-medium">Análise de risco ilimitada para investidores recorrentes.</p>
              
              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-white">R$ 149</span>
                <span className="text-[#8E9297] font-bold text-sm mb-1 uppercase">/mês</span>
              </div>

              <div className="space-y-5 mb-10 flex-1">
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#5865F2]" /> Radar Ilimitado de Lotes
                </div>
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#5865F2]" /> Auditoria de Edital por IA
                </div>
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#5865F2]" /> Alertas Preditivos (WhatsApp)
                </div>
                <div className="flex items-center gap-2 text-[10px] bg-[#EF4444]/10 text-[#EF4444] px-3 py-1 rounded-full font-black uppercase tracking-widest w-fit">
                   Sem Agente Copilot
                </div>
              </div>

              <Link href="/register" className="block text-center w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-5 rounded-2xl font-black text-sm transition-all shadow-xl shadow-[#5865F2]/40 uppercase tracking-widest hover:scale-105 active:scale-95">
                Assinar Agora
              </Link>
            </div>

            {/* Enterprise Tier (Action Specific) */}
            <div className="bg-[#151A22] p-10 rounded-[48px] border border-[#272A31] flex flex-col hover:border-[#5865F2]/50 transition-all relative overflow-hidden group">
               <div className="absolute -right-12 -top-12 w-32 h-32 bg-[#5865F2]/10 rounded-full blur-3xl group-hover:bg-[#5865F2]/20 transition-all"></div>
               
               <h3 className="text-xl font-bold text-white mb-2">War Room</h3>
               <p className="text-[#8E9297] text-sm mb-8 font-medium">Para fundos ou investidores em escala industrial.</p>
               
               <div className="flex items-end gap-1 mb-8">
                 <span className="text-5xl font-black text-white">R$ 599</span>
                 <span className="text-[#454655] font-bold text-sm mb-1 uppercase">/mês</span>
               </div>
 
               <div className="space-y-5 mb-10 flex-1">
                 <div className="flex items-center gap-3 text-sm text-white font-black group-hover:text-[#5865F2] transition-colors">
                   <Sparkles className="w-5 h-5 text-[#5865F2] animate-pulse" /> Radar Copilot Agente Full IA
                 </div>
                 <div className="flex items-center gap-3 text-sm text-[#c6c5d7] font-medium">
                   <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> Multicontas Gerenciadas (Até 5)
                 </div>
                 <div className="flex items-center gap-3 text-sm text-[#c6c5d7] font-medium">
                   <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> Faturamento em Lote via boleto/CNPJ
                 </div>
               </div>
 
               <button className="w-full bg-[#2F3136] hover:bg-[#5865F2] text-white py-4 rounded-2xl font-black text-sm transition-all uppercase tracking-widest">
                 Contactar Vendas
               </button>
             </div>

          </div>
        </div>
      </section>

      {/* Full Corporate Footer */}
      <footer className="border-t border-[#272A31] pt-16 pb-8 bg-[#0B0E14]">
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 underline-offset-4">
               <div className="md:col-span-1">
                  <div className="flex items-center gap-2 text-white font-black text-2xl mb-6">
                     <Target className="w-6 h-6 text-[#5865F2]" />
                     Radar<span className="text-[#5865F2]">Leilão</span>
                  </div>
                  <p className="text-[#8E9297] text-sm leading-relaxed mb-6 font-medium">
                     O primeiro ecossistema de inteligência preditiva para leilões industriais do Brasil.
                  </p>
               </div>
               
               <div>
                  <h4 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-6">Produto</h4>
                  <ul className="space-y-4">
                     <li><a href="#como-funciona" className="text-[#8E9297] hover:text-[#5865F2] text-sm transition-colors font-medium">Termômetro de Risco</a></li>
                     <li><a href="#copilot" className="text-[#8E9297] hover:text-[#5865F2] text-sm transition-colors font-medium">Radar Copilot Agente</a></li>
                     <li><a href="#precos" className="text-[#8E9297] hover:text-[#5865F2] text-sm transition-colors font-medium">Planos B2B Profissionais</a></li>
                  </ul>
               </div>

               <div>
                  <h4 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-6">Empresa</h4>
                  <ul className="space-y-4">
                     <li><a href="#" className="text-[#8E9297] hover:text-white text-sm transition-colors font-medium">Sobre a Marca</a></li>
                     <li><a href="#" className="text-[#8E9297] hover:text-white text-sm transition-colors font-medium">Trabalhe Conosco</a></li>
                  </ul>
               </div>

               <div>
                  <h4 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-6">Suporte</h4>
                  <ul className="space-y-4">
                     <li><a href="#" className="text-[#8E9297] hover:text-white text-sm transition-colors font-medium">Ajuda & FAQ</a></li>
                     <li><a href="#" className="text-[#8E9297] hover:text-white text-sm transition-colors font-medium">Política de Conteúdo</a></li>
                  </ul>
               </div>
            </div>
            
            <div className="border-t border-[#272A31] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
               <p className="text-[#454655] text-xs font-medium">© 2026 Radar Leilão B2B. Tecnologia Brasileira para Investidores Globais.</p>
               <div className="flex gap-6">
                  <ShieldAlert className="w-4 h-4 text-[#454655]" />
                  <LayoutDashboard className="w-4 h-4 text-[#454655]" />
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
}
