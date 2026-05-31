import Link from "next/link";
import { Gem, ArrowRight, Brain, Bot, CheckCircle2, X, Sparkles, MessageSquare, Zap, ShieldAlert, Globe, MapPin, Eye, TrendingUp, Clock } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col font-sans selection:bg-[#5865F2]/30">

      {/* Navbar */}
      <header className="h-20 border-b border-[#272A31] flex items-center justify-between px-6 md:px-12 bg-[#0B0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="flex items-center gap-2 text-white font-bold text-2xl tracking-tight">
          <Gem className="w-6 h-6 text-[#5865F2]" />
          Radar<span className="text-[#5865F2]">Jóias</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[#8E9297] font-medium text-sm">
          <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona?</a>
          <a href="#copilot" className="hover:text-white transition-colors">Agente IA</a>
          <a href="#precos" className="hover:text-white transition-colors font-bold text-[#5865F2]">Planos</a>
          <Link href="/login" className="hover:text-white transition-colors font-semibold pl-4 border-l border-[#272A31]">Login</Link>
        </nav>
        <div>
          <Link href="/register" className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2.5 rounded-full font-bold transition-all shadow-[0_4px_30px_rgb(88,101,242,0.3)] text-sm hover:scale-105 active:scale-95">
            Criar Conta Grátis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 py-20 md:py-32 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#5865F2]/15 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151A22] border border-[#272A31] text-[#8E9297] text-[10px] font-black uppercase tracking-[0.2em] mb-8 relative z-10">
          <span className="flex h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
          Leilões de Joias da CAIXA — Atualizado Diariamente
        </div>

        <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter max-w-5xl leading-[0.95] mb-8 relative z-10">
          Encontre joias, <br/> ignore o <span className="text-[#5865F2]">risco.</span>
        </h1>

        <p className="text-[#8E9297] text-lg md:text-xl max-w-2xl mb-12 relative z-10 leading-relaxed font-medium">
          Scraper 24/7 da Vitrine de Joias CAIXA. Nossa IA lê o edital,
          extrai as regras e te entrega o lance justo — sem mistério.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full max-w-md">
          <Link href="/register" className="flex-1 bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_10px_40px_rgb(88,101,242,0.3)] flex items-center gap-2 justify-center hover:-translate-y-1">
            Ver Lotes Agora <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="#como-funciona" className="flex-1 bg-[#151A22] border border-[#272A31] text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#2F3136] transition-all flex items-center justify-center">
            Como Funciona
          </a>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="px-6 py-12 md:py-24 border-t border-[#272A31] bg-[#0B0E14] relative z-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-[40px] bg-[#151A22] border border-[#272A31] hover:border-[#454655] transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center mb-6 text-[#5865F2]">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Scraper Automático</h3>
            <p className="text-[#8E9297] text-sm leading-relaxed">
              Varremos a Vitrine de Joias CAIXA 24/7. Novos lotes são detectados em minutos, não dias.
            </p>
          </div>
          <div className="p-8 rounded-[40px] bg-[#151A22] border border-[#272A31] hover:border-[#454655] transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center mb-6 text-[#F59E0B]">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Mapa por Cidade</h3>
            <p className="text-[#8E9297] text-sm leading-relaxed">
              Visualize a concentração de leilões por cidade. Descubra onde estão as melhores oportunidades.
            </p>
          </div>
          <div className="p-8 rounded-[40px] bg-[#151A22] border border-[#272A31] hover:border-[#454655] transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center mb-6 text-[#10B981]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Histórico de Lances</h3>
            <p className="text-[#8E9297] text-sm leading-relaxed">
              Acompanhe preços de venda anteriores. Descubra quais joias tiveram lance acima do esperado.
            </p>
          </div>
        </div>
      </section>

      {/* Joias Copilot Feature */}
      <section id="copilot" className="px-6 py-24 bg-[#10131A] relative border-y border-[#272A31] overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#5865F2]/5 rounded-full blur-[120px]"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 text-left relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] text-[10px] font-black uppercase tracking-widest mb-6">
              Novo Agente IA
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-none">
              O Copiloto que <br/> <span className="text-[#5865F2]">vai direto</span> ao ponto.
            </h2>
            <p className="text-[#8E9297] text-lg leading-relaxed mb-8 font-medium">
              Não precisa filtrar tabela. Peça ao Joias Copilot em linguagem natural
              e ele encontra o lote certo, analisa o edital e configura um alerta.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white font-bold group bg-[#151A22] p-4 rounded-2xl border border-[#272A31] hover:border-[#5865F2] transition-colors cursor-default">
                <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center shadow-lg shadow-[#5865F2]/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
                "Me mostra aliança de ouro em SP com lance abaixo de R$ 2.000"
              </div>
              <div className="flex items-center gap-3 text-white font-bold group bg-[#151A22] p-4 rounded-2xl border border-[#272A31] hover:border-[#5865F2] transition-colors cursor-default">
                <div className="w-10 h-10 rounded-xl bg-[#10B981] flex items-center justify-center shadow-lg shadow-[#10B981]/20">
                  <Bot className="w-5 h-5" />
                </div>
                "Quais lotes têm prazo de retirada этой semana?"
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
                  <h4 className="text-white font-black text-lg">Joias Copilot</h4>
                  <span className="text-[#5865F2] text-[10px] font-black uppercase tracking-[0.2em]">Assistente IA</span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-[#1C2129] p-5 rounded-3xl text-sm text-[#8E9297] border border-[#272A31] relative">
                  Quero colar de ouro 18k em São Paulo com peso acima de 10g e lance até R$ 3.000.
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center flex-shrink-0 animate-bounce">
                    <Brain className="w-4 h-4 text-[#5865F2]" />
                  </div>
                  <div className="bg-[#5865F2]/10 p-5 rounded-3xl text-sm text-white border border-[#5865F2]/20 shadow-xl shadow-[#5865F2]/5">
                    <p className="font-bold mb-2">Encontrados 12 lotes...</p>
                    Melhor oportunidade: <strong>Colar 18k - 13,14g - Lote 0262.000972-8</strong><br />
                    Lance atual: <strong>R$ 1.854,00</strong> | Retirada em São Paulo<br />
                    Quer que eu adicione à Watchlist?
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

      {/* How it Works */}
      <section id="como-funciona" className="px-6 py-24 bg-[#0B0E14] border-t border-[#272A31]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
              Simples de usar. <span className="text-[#5865F2]">Poderoso</span> por baixo.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center mb-6 text-[#5865F2]">
                <MapPin className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">1. Escolha a Cidade</h3>
              <p className="text-[#8E9297] text-sm">Filtre por estado e cidade. Veja todos os lotes disponíveis na região.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center mb-6 text-[#5865F2]">
                <Eye className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">2. Explore os Lotes</h3>
              <p className="text-[#8E9297] text-sm">Fotos, peso, descrição e valor de lance — tudo em uma interface moderna.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center mb-6 text-[#5865F2]">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">3. Dê seu Lance</h3>
              <p className="text-[#8E9297] text-sm">Vá ao terminal CAIXA com seu lance. Nós avisamos o melhor momento.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="px-6 py-24 bg-[#0B0E14] relative border-t border-[#272A31]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-7xl font-black text-white tracking-tighter mb-4 leading-none">
              Invista pouco. <br/> <span className="text-[#5865F2]">Arranque muito.</span>
            </h2>
            <p className="text-[#8E9297] text-lg font-medium max-w-2xl mx-auto">
              Cancele quando quiser. Semanasanas escondidas. Acesso ilimitado aos melhores lances.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

            {/* Free */}
            <div className="bg-[#151A22] p-10 rounded-[48px] border border-[#272A31] flex flex-col hover:border-[#454655] transition-all">
              <h3 className="text-xl font-bold text-white mb-2 underline decoration-[#5865F2] decoration-2 underline-offset-4">Explorador</h3>
              <p className="text-[#8E9297] text-sm mb-8 font-medium">Ideal para quem está começando no mercado de joias.</p>

              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-white">R$ 0</span>
                <span className="text-[#454655] font-bold text-sm mb-1 uppercase">/mês</span>
              </div>

              <div className="space-y-5 mb-10 flex-1">
                <div className="flex items-center gap-3 text-sm text-[#c6c5d7] font-medium">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> 50 lotes/mês
                </div>
                <div className="flex items-center gap-3 text-sm text-[#c6c5d7] font-medium">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> Busca por cidade
                </div>
                <div className="flex items-center gap-3 text-sm text-[#454655] line-through">
                  <X className="w-5 h-5" /> Análise de Edital por IA
                </div>
                <div className="flex items-center gap-3 text-sm text-[#454655] line-through">
                  <X className="w-5 h-5" /> Joias Copilot Agente IA
                </div>
              </div>

              <Link href="/register" className="block text-center w-full bg-[#2F3136] hover:bg-white hover:text-black text-white py-4 rounded-2xl font-black text-sm transition-all uppercase tracking-widest">
                Começar Grátis
              </Link>
            </div>

            {/* Pro (Recommended) */}
            <div className="bg-gradient-to-b from-[#151A22] to-[#0B0E14] p-10 rounded-[48px] border-4 border-[#5865F2] flex flex-col relative shadow-[0_30px_70px_rgb(88,101,242,0.2)] transform md:-translate-y-6">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#5865F2] text-white text-[10px] font-black uppercase tracking-[0.3em] py-2 px-6 rounded-full shadow-lg shadow-[#5865F2]/40">
                RECOMENDADO
              </div>

              <h3 className="text-xl font-bold text-white mb-2">Joalheria B2B</h3>
              <p className="text-[#8E9297] text-sm mb-8 font-medium">Para compradores recorrentes e revendedores.</p>

              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-white">R$ 149</span>
                <span className="text-[#8E9297] font-bold text-sm mb-1 uppercase">/mês</span>
              </div>

              <div className="space-y-5 mb-10 flex-1">
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#5865F2]" /> Lotes ilimitados
                </div>
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#5865F2]" /> Análise de Edital por IA
                </div>
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#5865F2]" /> Histórico de preços
                </div>
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#5865F2]" /> Alertas por cidade
                </div>
                <div className="flex items-center gap-2 text-[10px] bg-[#EF4444]/10 text-[#EF4444] px-3 py-1 rounded-full font-black uppercase tracking-widest w-fit">
                  Sem Copilot
                </div>
              </div>

              <Link href="/register" className="block text-center w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-5 rounded-2xl font-black text-sm transition-all shadow-xl shadow-[#5865F2]/40 uppercase tracking-widest hover:scale-105 active:scale-95">
                Assinar Agora
              </Link>
            </div>

            {/* War Room */}
            <div className="bg-[#151A22] p-10 rounded-[48px] border border-[#272A31] flex flex-col hover:border-[#5865F2]/50 transition-all relative overflow-hidden group">
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-[#5865F2]/10 rounded-full blur-3xl group-hover:bg-[#5865F2]/20 transition-all"></div>

              <h3 className="text-xl font-bold text-white mb-2">Sala de Guerra</h3>
              <p className="text-[#8E9297] text-sm mb-8 font-medium">Para fundos e compradores em escala industrial.</p>

              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-white">R$ 599</span>
                <span className="text-[#454655] font-bold text-sm mb-1 uppercase">/mês</span>
              </div>

              <div className="space-y-5 mb-10 flex-1">
                <div className="flex items-center gap-3 text-sm text-white font-black group-hover:text-[#5865F2] transition-colors">
                  <Sparkles className="w-5 h-5 text-[#5865F2] animate-pulse" /> Joias Copilot Agente Full IA
                </div>
                <div className="flex items-center gap-3 text-sm text-[#c6c5d7] font-medium">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> Multicontas (Até 5)
                </div>
                <div className="flex items-center gap-3 text-sm text-[#c6c5d7] font-medium">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> Acesso antecipado a lotes
                </div>
              </div>

              <button className="w-full bg-[#2F3136] hover:bg-[#5865F2] text-white py-4 rounded-2xl font-black text-sm transition-all uppercase tracking-widest">
                Contactar Vendas
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#272A31] pt-16 pb-8 bg-[#0B0E14]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 text-white font-black text-2xl mb-6">
                <Gem className="w-6 h-6 text-[#5865F2]" />
                Radar<span className="text-[#5865F2]">Jóias</span>
              </div>
              <p className="text-[#8E9297] text-sm leading-relaxed mb-6 font-medium">
                O agregador inteligente de leilões de joias da CAIXA. Dados em tempo real, análise por IA.
              </p>
            </div>

            <div>
              <h4 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-6">Produto</h4>
              <ul className="space-y-4">
                <li><a href="#como-funciona" className="text-[#8E9297] hover:text-[#5865F2] text-sm transition-colors font-medium">Como Funciona</a></li>
                <li><a href="#copilot" className="text-[#8E9297] hover:text-[#5865F2] text-sm transition-colors font-medium">Joias Copilot</a></li>
                <li><a href="#precos" className="text-[#8E9297] hover:text-[#5865F2] text-sm transition-colors font-medium">Planos</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-6">Empresa</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-[#8E9297] hover:text-white text-sm transition-colors font-medium">Sobre</a></li>
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
            <p className="text-[#454655] text-xs font-medium">© 2026 Radar Jóias B2B. Tecnologia Brasileira para Investidores de Joias.</p>
            <div className="flex gap-6">
              <ShieldAlert className="w-4 h-4 text-[#454655]" />
              <Globe className="w-4 h-4 text-[#454655]" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}