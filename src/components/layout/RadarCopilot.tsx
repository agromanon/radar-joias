"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, MessageSquare, Target } from "lucide-react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "action_result";
  metadata?: any;
}

export function RadarCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content: "Olá! Sou o **Radar Copilot**. Posso te ajudar a encontrar leilões, analisar editais ou configurar alertas. O que você procura?",
    }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: "Analisando bases de dados... Encontrei **3 lotes** de equipamentos industriais em São Paulo com ROI estimado acima de 20%. Deseja que eu gere o relatório de auditoria de edital agora?",
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-[#5865F2] text-white shadow-[0_8px_30px_rgb(88,101,242,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[60] group border border-white/20"
      >
        <Bot className="w-7 h-7 group-hover:hidden" />
        <Sparkles className="w-7 h-7 hidden group-hover:block animate-pulse" />
      </button>
    );
  }

  return (
    <div 
      className={`fixed right-6 z-[60] transition-all duration-300 ease-in-out shadow-2xl overflow-hidden flex flex-col ${
        isMinimized 
          ? "bottom-6 w-72 h-14 translate-y-0" 
          : "bottom-6 w-[380px] md:w-[420px] h-[600px] max-h-[85vh] translate-y-0"
      } bg-[#151A22]/95 backdrop-blur-2xl border border-[#272A31] rounded-[32px]`}
    >
      {/* Header */}
      <div className="p-4 border-b border-[#272A31] flex items-center justify-between bg-[#5865F2]/5 flex-shrink-0 cursor-pointer" onClick={() => isMinimized && setIsMinimized(false)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5865F2] flex items-center justify-center shadow-lg shadow-[#5865F2]/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm leading-none flex items-center gap-1.5">
              Radar Copilot
              {!isMinimized && <span className="bg-[#10B981]/20 text-[#10B981] text-[9px] font-black uppercase px-1 py-0.5 rounded tracking-tighter">Pro Agent</span>}
            </h3>
            {!isMinimized && <p className="text-[#8E9297] text-[10px] mt-1">Online • IA Versão 3.5</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1.5 rounded-lg text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="p-1.5 rounded-lg text-[#8E9297] hover:text-white hover:bg-[#2F3136] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Scrollable Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            style={{ scrollBehavior: 'smooth' }}
          >
            {messages.map((m) => (
              <div 
                key={m.id} 
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div 
                  className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative whitespace-pre-wrap ${
                    m.role === "user" 
                      ? "bg-[#5865F2] text-white rounded-tr-none shadow-[#5865F2]/10" 
                      : "bg-[#2F3136] text-[#c6c5d7] rounded-tl-none border border-[#454655]/30"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Dock Area */}
          <div className="flex-shrink-0 bg-[#0B0E14]/50 border-t border-[#272A31]">
            {/* Quick Actions */}
            <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-[#272A31]/50">
              <button 
                onClick={() => setInputValue("Quais os lotes de Macs em SP?")}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#151A22] border border-[#272A31] text-[10px] text-[#8E9297] hover:text-white hover:border-[#5865F2] transition-all flex items-center gap-1.5"
              >
                <MessageSquare className="w-3 h-3" /> Buscar Macs
              </button>
              <button 
                onClick={() => setInputValue("Configurar alerta de gerador")}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#151A22] border border-[#272A31] text-[10px] text-[#8E9297] hover:text-white hover:border-[#5865F2] transition-all flex items-center gap-1.5"
              >
                <Target className="w-3 h-3" /> Novo Alerta
              </button>
            </div>

            {/* Input Dock */}
            <div className="p-4">
              <div className="relative flex items-center gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    // Auto-resize
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (inputValue.trim()) {
                        handleSend();
                        // Reset height
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                      }
                    }
                  }}
                  autoFocus
                  placeholder="Escreva sua dúvida aqui..."
                  className="w-full bg-[#151A22] border border-[#272A31] rounded-2xl py-3 pl-4 pr-12 text-sm text-white placeholder-[#454655] focus:outline-none focus:border-[#5865F2] transition-colors resize-none h-auto max-h-[150px] custom-scrollbar leading-relaxed"
                  rows={1}
                />
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="absolute right-2 top-1.5 p-2 rounded-xl bg-[#5865F2] text-white disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#5865F2]/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[9px] text-[#454655] text-center mt-3 font-bold uppercase tracking-[0.15em]">
                Assinante **War Room** • IA Ativa
              </p>
            </div>
          </div>
        </>
      )}

      {isMinimized && (
        <button 
          onClick={() => setIsMinimized(false)}
          className="flex-1 flex items-center px-4 text-white font-bold text-sm"
        >
          <Bot className="w-4 h-4 mr-2 text-[#5865F2] animate-pulse" />
          Continuar conversa...
        </button>
      )}
    </div>
  );
}
