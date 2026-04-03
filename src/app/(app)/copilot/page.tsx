"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, Target, Zap, ChevronRight, Mic, Paperclip, MessageSquare } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  status?: "done" | "working";
}

import { useUser } from "@/hooks/useUser";

export default function CopilotPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Olá! Sou o **Radar Copilot**, seu agente de inteligência artificial para estratégia de leilões. Como posso ajudar você hoje?\n\nPosso analisar editais, buscar lotes específicos com métricas de ROI ou configurar rastreadores autônomos para você.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTimeout(() => {
      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: "Entendido. Iniciando varredura nos editais de SP e MG para localizar retroescavadeiras JCB abaixo do preço de mercado...",
        timestamp: new Date(),
        status: "working",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      setTimeout(() => {
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === assistantMsg.id 
              ? { ...msg, content: "Identifiquei **2 lotes críticos** de Retroescavadeiras JCB 3CX (2019) no interior de SP com ROI projetado de 28%. O edital indica que não há dívidas ativas pendentes. Gostaria de ver o relatório detalhado de ROI?", status: "done" }
              : msg
          )
        );
      }, 2500);
    }, 500);
  };

  const isWarRoom = user?.tier === "war_room";

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0B0E14] overflow-hidden relative">
      
      {/* Decorative Blur Backdrops - Behind everything */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#5865F2]/5 rounded-full blur-[140px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#EF4444]/5 rounded-full blur-[140px] pointer-events-none -z-10"></div>

      {/* Message List Area - This takes all available space and scrolls */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-4 md:px-6 pt-8 pb-10 space-y-10 scroll-smooth custom-scrollbar ${!isWarRoom ? "blur-sm pointer-events-none select-none" : ""}`}
      >
        <div className="max-w-4xl mx-auto w-full">
           {/* Welcome Info */}
           {messages.length === 1 && (
             <div className="py-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="w-16 h-16 rounded-3xl bg-[#5865F2] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#5865F2]/20">
                   <Bot className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tighter">Radar Copilot</h1>
                <p className="text-[#8E9297] text-base max-w-md mx-auto leading-relaxed">
                  Sua inteligência agentica de borda. <br/>
                  <span className="text-[#5865F2] font-bold">Assinante {user?.tier?.replace("_", " ") || "Free"} Detectado.</span>
                </p>
             </div>
           )}

           {/* Actual Conversation */}
           <div className="space-y-8">
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex gap-4 md:gap-6 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 shadow-xl border ${
                    msg.role === "assistant" 
                      ? "bg-[#1C2129] border-[#272A31] text-[#5865F2]" 
                      : "bg-[#5865F2] border-[#5865F2]/20 text-white"
                  }`}>
                    {msg.role === "assistant" ? <Bot className="w-5 h-5" /> : <div className="text-xs font-black">US</div>}
                  </div>

                  <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`p-6 rounded-[32px] text-[15px] leading-relaxed shadow-2xl relative ${
                      msg.role === "user" 
                        ? "bg-[#5865F2] text-white rounded-tr-none ring-4 ring-[#5865F2]/5" 
                        : "bg-[#151A22] text-[#c6c5d7] border border-[#272A31] rounded-tl-none ring-4 ring-white/5"
                    }`}>
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-3" : ""}>{line}</p>
                      ))}
                      
                      {msg.status === "working" && (
                        <div className="flex gap-1.5 mt-5 items-center">
                          <span className="w-1.5 h-1.5 bg-[#5865F2] rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-[#5865F2] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="w-1.5 h-1.5 bg-[#5865F2] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-[#454655] mt-3 font-bold uppercase tracking-[0.2em] px-2 opacity-80 font-sans">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
           </div>

           {/* Suggestion Cards */}
           {messages.length === 1 && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-16 max-w-2xl mx-auto">
                <button onClick={() => setInput("Analisar o ROI dos lotes de ontem")} className="p-5 bg-[#151A22] border border-[#272A31] rounded-[24px] text-sm text-[#8E9297] hover:border-[#5865F2] hover:text-white transition-all text-left flex items-center justify-between group shadow-xl hover:bg-[#1C2129]">
                   <div className="flex items-center gap-4">
                     <div className="p-3 rounded-xl bg-[#5865F2]/10 text-[#5865F2]">
                       <Target className="w-5 h-5" />
                     </div>
                     <span className="font-bold">Analise meu ROI Recente</span>
                   </div>
                   <ChevronRight className="w-5 h-5 text-[#454655] group-hover:text-[#5865F2] transition-colors" />
                </button>
                <button onClick={() => setInput("Quero configurar alertas para caminhões")} className="p-5 bg-[#151A22] border border-[#272A31] rounded-[24px] text-sm text-[#8E9297] hover:border-[#5865F2] hover:text-white transition-all text-left flex items-center justify-between group shadow-xl hover:bg-[#1C2129]">
                   <div className="flex items-center gap-4">
                     <div className="p-3 rounded-xl bg-[#EF4444]/10 text-[#EF4444]">
                       <Zap className="w-5 h-5" />
                     </div>
                     <span className="font-bold">Configurar Alerta Smart</span>
                   </div>
                   <ChevronRight className="w-5 h-5 text-[#454655] group-hover:text-[#EF4444] transition-colors" />
                </button>
             </div>
           )}
        </div>
      </div>

      {/* Dock Area - PURE FLEX ITEM, NOT ABSOLUTE */}
      <div className="bg-[#0B0E14] border-t border-[#272A31] px-4 md:px-10 pb-8 pt-4 flex-shrink-0 z-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1C2129]/90 backdrop-blur-3xl border-2 border-[#272A31] rounded-[40px] p-2.5 shadow-2xl ring-1 ring-white/10 group focus-within:border-[#5865F2]/50 transition-all">
            <div className="flex items-center gap-3 pl-4">
              <button className="p-2.5 text-[#454655] hover:text-[#5865F2] transition-colors">
                <Paperclip className="w-6 h-6" />
              </button>
              <textarea 
                rows={1}
                autoFocus
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) {
                      handleSend();
                      // Reset height after sending
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                    }
                  }
                }}
                placeholder="Diga ao Copilot o que fazer hoje..."
                className="flex-1 bg-transparent py-5 text-base text-white placeholder:text-[#454655] outline-none resize-none max-h-[200px] custom-scrollbar h-auto"
              />
              <div className="flex items-center gap-3 pr-2">
                <button className="p-2.5 text-[#454655] hover:text-white transition-colors hidden sm:block">
                  <Mic className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-20 disabled:grayscale text-white p-4 rounded-3xl shadow-xl shadow-[#5865F2]/20 transition-all hover:scale-105 active:scale-95"
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 opacity-40">
             <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#5865F2]" />
                <span className="text-[9px] text-white font-black uppercase tracking-[0.2em]">War Room Active</span>
             </div>
             <p className="text-[9px] text-white font-black uppercase tracking-[0.2em]">
               Pressione <span className="text-[#5865F2]">ENTER</span> para orquestrar
             </p>
          </div>
        </div>
      </div>
      {/* Upgrade Overlay */}
      {!isWarRoom && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[#0B0E14]/40 backdrop-blur-sm">
           <div className="bg-[#151A22] border-2 border-[#5865F2] rounded-[40px] p-10 max-w-lg w-full text-center shadow-2xl shadow-[#5865F2]/20 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-3xl bg-[#5865F2] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#5865F2]/40">
                 <Zap className="w-10 h-10 text-white fill-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">Acesso Restrito</h2>
              <p className="text-[#8E9297] mb-8 leading-relaxed">
                O <strong>Radar Copilot</strong> é uma ferramenta exclusiva para assinantes do plano <span className="text-[#5865F2] font-bold">War Room</span>. 
                Sua IA pessoal para análise de ROI e automação de lances.
              </p>
              <div className="space-y-4">
                 <Link href="/settings/billing" className="block w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-[#5865F2]/30">
                    Fazer Upgrade Agora
                 </Link>
                 <Link href="/dashboard" className="block w-full bg-[#1C2129] border border-[#272A31] text-[#8E9297] hover:text-white py-4 rounded-2xl font-bold transition-all">
                    Voltar ao Dashboard
                 </Link>
              </div>
              <p className="mt-8 text-[10px] text-[#454655] font-black uppercase tracking-[0.2em]">
                TECNOLOGIA EXCLUSIVA RADAR IA
              </p>
           </div>
        </div>
      )}
    </div>
  );
}
