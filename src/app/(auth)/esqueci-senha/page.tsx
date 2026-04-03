"use client";

import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/lib/auth-client";
import { Toast } from "@/components/ui/Toast";

const resetSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

type ResetFormData = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    setToast(null);

    try {
      const result = await resetPassword(data.email);

      if (result.success) {
        setIsSuccess(true);
        setToast({ type: 'success', message: 'E-mail de recuperação enviado com sucesso!' });
      } else {
        setToast({ type: 'error', message: result.error || 'Erro ao enviar e-mail de recuperação' });
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Erro ao enviar e-mail. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col justify-center items-center p-6 relative overflow-hidden">

      {/* Background Ornaments (Aesthetic) */}
      <div className="absolute top-0 right-0 w-full h-1/2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#EF4444]/10 via-[#0B0E14] to-transparent pointer-events-none"></div>

      {/* Back button */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10">
        <Link href="/login" className="flex items-center gap-2 text-[#8E9297] hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Login
        </Link>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-8">
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      <div className="w-full max-w-sm z-10 animate-in fade-in zoom-in-95 duration-500">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#151A22] border border-[#272A31] rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-[#EF4444]/5 mb-6">
            <Target className="w-8 h-8 text-[#8E9297]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Recuperar Acesso</h1>
          <p className="text-[#8E9297] text-sm leading-relaxed">Não se preocupe, a gente envia um Magic Link seguro para você reconfigurar sua conta corporativa.</p>
        </div>

        {/* Success Message */}
        {isSuccess ? (
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8 shadow-[0_20px_40px_rgb(0,0,0,0.4)] text-center">
            <div className="w-16 h-16 bg-[#10B981]/10 border border-[#10B981]/30 rounded-full mx-auto flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">E-mail Enviado!</h2>
            <p className="text-[#8E9297] text-sm mb-6">
              Verifique sua caixa de entrada e clique no link para criar uma nova senha.
            </p>
            <Link
              href="/login"
              className="inline-block bg-[#5865F2] hover:bg-[#4752C4] text-white py-3 px-8 rounded-xl text-sm font-bold transition-all shadow-[0_4px_14px_0_rgba(88,101,242,0.39)]"
            >
              Voltar ao Login
            </Link>
          </div>
        ) : (
          /* Form Box */
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl p-8 shadow-[0_20px_40px_rgb(0,0,0,0.4)]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#c6c5d7] mb-2">Qual seu e-mail cadastrado?</label>
                <input
                  type="email"
                  id="email"
                  placeholder="nome@empresa.com"
                  disabled={isLoading}
                  {...register('email')}
                  className="w-full bg-[#0B0E14] border border-[#2F3136] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 focus:border-[#5865F2] transition-all placeholder:text-[#454655] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-3.5 rounded-xl text-sm font-bold mt-2 transition-all shadow-[0_4px_14px_0_rgba(88,101,242,0.39)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enviando...' : 'Enviar Link de Reset'}
              </button>
            </form>
          </div>
        )}

      </div>

    </div>
  );
}
