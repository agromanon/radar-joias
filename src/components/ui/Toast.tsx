"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Config map ──────────────────────────────────────────────────────────────

const CONFIG: Record<ToastType, { icon: ReactNode; bar: string; bg: string; border: string }> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-[#10B981]" />,
    bar: "bg-[#10B981]",
    bg: "bg-[#0F1A15]",
    border: "border-[#10B981]/30",
  },
  error: {
    icon: <XCircle className="w-5 h-5 text-[#EF4444]" />,
    bar: "bg-[#EF4444]",
    bg: "bg-[#1A0F0F]",
    border: "border-[#EF4444]/30",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />,
    bar: "bg-[#F59E0B]",
    bg: "bg-[#1A160A]",
    border: "border-[#F59E0B]/30",
  },
  info: {
    icon: <Info className="w-5 h-5 text-[#5865F2]" />,
    bar: "bg-[#5865F2]",
    bg: "bg-[#0F1020]",
    border: "border-[#5865F2]/30",
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const cfg = CONFIG[toast.type];

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 min-w-[320px] max-w-sm w-full rounded-2xl border ${cfg.border} ${cfg.bg} p-4 shadow-2xl shadow-black/40 animate-in slide-in-from-right-5 fade-in duration-300`}
    >
      {/* Accent bar */}
      <div className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${cfg.bar}`} />

      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-bold leading-tight">{toast.title}</p>
        {toast.message && (
          <p className="text-[#8E9297] text-xs mt-1 leading-relaxed">{toast.message}</p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg text-[#454655] hover:text-white hover:bg-white/5 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]);
  }, []);

  const ctx: ToastContextValue = {
    toast: add,
    success: (title, message) => add({ type: "success", title, message }),
    error: (title, message) => add({ type: "error", title, message }),
    warning: (title, message) => add({ type: "warning", title, message }),
    info: (title, message) => add({ type: "info", title, message }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Portal */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ─── Standalone Toast Component (for auth pages, etc.) ────────────────────────

interface StandaloneToastProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

export function Toast({ type, message, onClose }: StandaloneToastProps) {
  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-[#10B981]" />,
      bg: "bg-[#0F1A15]",
      border: "border-[#10B981]/30",
      bar: "bg-[#10B981]",
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-[#EF4444]" />,
      bg: "bg-[#1A0F0F]",
      border: "border-[#EF4444]/30",
      bar: "bg-[#EF4444]",
    },
  };

  const cfg = config[type];

  return (
    <div
      className={`flex items-start gap-3 min-w-[320px] max-w-md w-full rounded-2xl border ${cfg.border} ${cfg.bg} p-4 shadow-2xl shadow-black/40 animate-in slide-in-from-right-5 fade-in duration-300`}
    >
      {/* Accent bar */}
      <div className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${cfg.bar}`} />

      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm">{message}</p>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded-lg text-[#454655] hover:text-white hover:bg-white/5 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
