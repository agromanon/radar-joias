"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Brain, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signUp } from "@/lib/auth-client";
import { useUser } from "@/hooks/useUser";
import { Toast } from "@/components/ui/Toast";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { refreshProfile } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setToast(null);

    try {
      const result = await signUp(data.email, data.password, data.name);

      if (result.success) {
        await refreshProfile();
        setToast({ type: 'success', message: 'Conta criada com sucesso! Bem-vindo ao Radar.' });
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setToast({ type: 'error', message: result.error || 'Erro ao criar conta' });
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Erro ao criar conta. Tente novamente.' });
    } finally {
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
          <ArrowLeft className="w-4 h-4" /> Fechar
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

      {/* LEFT COLUMN: The Magic (Value Proposition) hidden on small screens */}
      <div className="hidden md:flex flex-col flex-1 bg-[#10131A] p-16 justify-center relative border-r border-[#272A31]">
        <div className="max-w-md mx-auto space-y-10 z-10">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-white mb-4">
              Invista com Inteligência Artificial
            </h2>
            <p className="text-[#8E9297] text-lg">
              Dezenas de leiloeiros cruzados em tempo real no Brasil, extraindo a margem do edital em segundos.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-[#5865F2]" />
              </div>
              <div>
                <h4 className="text-white font-bold">Leitura Automática de Editais</h4>
                <p className="text-[#8E9297] text-sm mt-1">Nós mapeamos as entrelinhas e as taxas do pátio para você ignorar o leilão ruim.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <h4 className="text-white font-bold">Risco Balizado no Lucro Real</h4>
                <p className="text-[#8E9297] text-sm mt-1">Conheça o Teto do Lote para não perder com a emoção do Pregão Presencial/Online.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <h4 className="text-white font-bold">Alertas Instantâneos (Meus Alertas)</h4>
                <p className="text-[#8E9297] text-sm mt-1">Trackeie as palavras-chave (Ex: Cobre, Triturador) na Madrugada e receba Pushes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: The Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-16 z-10 animate-in fade-in slide-in-from-right-8 duration-700">
        <div className="w-full max-w-sm">

          <div className="text-center md:text-left mb-8">
            <h3 className="text-2xl font-bold tracking-tight text-white mb-2">Construa sua base</h3>
            <p className="text-[#8E9297]">São 30 dias ilimitados em nossa engine B2B. Comece sem cartão de crédito.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#c6c5d7] mb-2">Nome Completo</label>
              <input
                type="text"
                id="name"
                placeholder="Ex: João Silva"
                disabled={isLoading}
                {...register('name')}
                className="w-full bg-[#151A22] border border-[#272A31] text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 focus:border-[#5865F2] transition-all placeholder:text-[#454655] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.name && (
                <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#c6c5d7] mb-2">E-mail</label>
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
              <label htmlFor="password" className="block text-sm font-medium text-[#c6c5d7] mb-2">Sua Senha Mestra</label>
              <input
                type="password"
                id="password"
                placeholder="No mínimo 8 caracteres"
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
              className="w-full bg-white hover:bg-gray-200 text-[#0B0E14] py-3.5 rounded-xl text-sm font-bold mt-4 transition-all shadow-[0_4px_14px_0_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Criando conta...' : 'Criar Conta Gratuita'}
            </button>
          </form>

          <p className="text-center md:text-left text-[#8E9297] text-sm mt-8">
            Já possui um login B2B ativo? <Link href="/login" className="text-white hover:text-[#5865F2] font-semibold transition-colors">Acessar</Link>
          </p>

        </div>
      </div>

    </div>
  );
}
