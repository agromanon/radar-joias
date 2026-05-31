"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Brain, Target, Compass } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn, signInWithGoogle, signInWithApple } from "@/lib/auth-client";
import { useUser } from "@/hooks/useUser";
import { Toast } from "@/components/ui/Toast";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setToast(null);

    try {
      const result = await signIn(data.email, data.password);

      if (result.success) {
        await refreshProfile();
        setToast({ type: 'success', message: 'Login realizado com sucesso!' });
        setTimeout(() => router.push('/dashboard'), 500);
      } else {
        setToast({ type: 'error', message: result.error || 'Erro ao fazer login' });
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Erro ao fazer login. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        setToast({ type: 'error', message: result.error || 'Erro ao entrar com Google' });
        setIsLoading(false);
      }
      // Redirects automatically, so don't clear loading state
    } catch (error) {
      setToast({ type: 'error', message: 'Erro ao entrar com Google' });
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithApple();
      if (!result.success) {
        setToast({ type: 'error', message: result.error || 'Erro ao entrar com Apple' });
        setIsLoading(false);
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Erro ao entrar com Apple' });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col md:flex-row overflow-hidden relative">

      {/* Background Ornaments (Aesthetic) */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#5865F2]/20 via-[#0B0E14] to-transparent pointer-events-none"></div>

      {/* Back button */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 z-50">
        <Link href="/" className="flex items-center gap-2 text-[#8E9297] hover:text-white transition-colors text-sm font-medium bg-[#151A22]/50 px-4 py-2 rounded-full border border-[#272A31] backdrop-blur-md">
          <ArrowLeft className="w-4 h-4" /> Voltar
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

      {/* LEFT COLUMN: Returning Value Prop */}
      <div className="hidden md:flex flex-col flex-1 bg-[#10131A] p-16 justify-center relative border-r border-[#272A31]">
        <div className="max-w-md mx-auto space-y-10 z-10">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
              Acesse seu Radar Jóias
            </h2>
            <p className="text-[#8E9297] text-lg">
              Dezenas de milhares de peças foram processadas pela nossa IA enquanto você estava fora.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center flex-shrink-0">
                <Target className="w-6 h-6 text-[#5865F2]" />
              </div>
              <div>
                <h4 className="text-white font-bold">Meus Alertas de Jóias</h4>
                <p className="text-[#8E9297] text-sm mt-1">Verifique as correspondências que a IA encontrou para suas palavras-chave rastreadas hoje.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center flex-shrink-0">
                <Compass className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <h4 className="text-white font-bold">Radar Geográfico Atualizado</h4>
                <p className="text-[#8E9297] text-sm mt-1">Novas zonas quentes de joias apareceram no mapa. Planeje sua visita aos pickup locations.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <h4 className="text-white font-bold">Catálogos Atualizados</h4>
                <p className="text-[#8E9297] text-sm mt-1">Nossos Scrapers detectaram novos lotes na Vitrine CAIXA. Atualize suas Estimates.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: The Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-16 z-10 animate-in fade-in slide-in-from-right-8 duration-700">
        <div className="w-full max-w-sm">

          <div className="text-center md:text-left mb-8">
            <h3 className="text-2xl font-bold tracking-tight text-white mb-2">Bem-vindo de volta</h3>
            <p className="text-[#8E9297]">Faça login para checar suas jóias rastreadas.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#c6c5d7] mb-2">E-mail Profissional</label>
              <input
                type="email"
                id="email"
                placeholder="nome@empresa.com"
                disabled={isLoading}
                {...register('email')}
                className="w-full bg-[#151A22] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 focus:border-[#5865F2] transition-all placeholder:text-[#454655] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-[#c6c5d7]">Senha</label>
                <Link href="/esqueci-senha" className="text-xs font-semibold text-[#5865F2] hover:underline">Esqueceu a senha?</Link>
              </div>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                disabled={isLoading}
                {...register('password')}
                className="w-full bg-[#151A22] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 focus:border-[#5865F2] transition-all placeholder:text-[#454655] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-3.5 rounded-xl text-sm font-bold mt-4 transition-all shadow-[0_4px_14px_0_rgba(88,101,242,0.39)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Entrando...' : 'Entrar no Radar'}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#2F3136]"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0B0E14] px-3 font-semibold text-[#8E9297] tracking-wider">Ou continue com</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Google */}
             <button
               type="button"
               onClick={handleGoogleSignIn}
               disabled={isLoading}
               className="flex items-center justify-center gap-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
               </svg>
             </button>
             {/* Apple */}
             <button
               type="button"
               onClick={handleAppleSignIn}
               disabled={isLoading}
               className="flex items-center justify-center gap-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                 <path d="M17.05 15.35c-.04-2.59 2.11-3.85 2.21-3.9-1.21-1.78-3.08-2.02-3.75-2.05-1.59-.16-3.11.94-3.93.94-.82 0-2.06-.92-3.37-.9-1.7.02-3.26.99-4.14 2.52-1.78 3.1-.46 7.69 1.28 10.21.85 1.23 1.86 2.61 3.17 2.56 1.26-.05 1.74-.82 3.28-.82 1.54 0 1.99.82 3.3.79 1.34-.02 2.21-1.25 3.06-2.48.98-1.43 1.38-2.82 1.4-2.89-.03-.02-2.61-1-2.66-3.98zm-2.09-6c.68-.83 1.14-1.99 1.01-3.15-1 .04-2.23.66-2.94 1.5-.63.74-1.18 1.93-1.02 3.06 1.11.09 2.26-.58 2.95-1.41z"/>
               </svg>
             </button>
          </div>

          <p className="text-center md:text-left text-[#8E9297] text-sm mt-8">
            Ainda não mapeou o mercado? <Link href="/register" className="text-white hover:text-[#5865F2] font-semibold transition-colors">Crie sua conta</Link>
          </p>

        </div>
      </div>

    </div>
  );
}
