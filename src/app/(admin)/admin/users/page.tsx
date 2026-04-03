"use client";

import { useState, useEffect } from "react";
import {
  Users, Search, ShieldCheck, Ban, Mail, Crown, Plus, Edit2, Trash2, X, Save, Eye,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type Plan = "War Room" | "Engenharia B2B" | "Rastreador Básico";
type Status = "ATIVO" | "SUSPENSO";

interface User {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  status: Status;
  joined: string;
  alerts: number;
}

interface UserApiResponse {
  id: string;
  name: string | null;
  email: string;
  tier: "free" | "pro" | "war_room";
  created_at: string;
}

// Tier mapping functions
const tierToPlan = (tier: string): Plan => {
  switch (tier) {
    case "war_room": return "War Room";
    case "pro": return "Engenharia B2B";
    case "free": return "Rastreador Básico";
    default: return "Rastreador Básico";
  }
};

const planToTier = (plan: Plan): "free" | "pro" | "war_room" => {
  switch (plan) {
    case "War Room": return "war_room";
    case "Engenharia B2B": return "pro";
    case "Rastreador Básico": return "free";
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(date);
};

const PLAN_BADGE: Record<Plan, string> = {
  "War Room": "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30",
  "Engenharia B2B": "bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/30",
  "Rastreador Básico": "bg-[#272A31] text-[#8E9297] border-[#272A31]",
};

// ─── Modals ──────────────────────────────────────────────────────────────────

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function UserForm({
  initial,
  onSubmit,
  onClose,
  title,
  submitLabel,
  isCreating,
}: {
  initial: Partial<User> & { password?: string };
  onSubmit: (u: Omit<User, "id" | "joined" | "alerts"> & { password?: string }) => void;
  onClose: () => void;
  title: string;
  submitLabel: string;
  isCreating?: boolean;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [password, setPassword] = useState(initial.password ?? "");
  const [plan, setPlan] = useState<Plan>(initial.plan ?? "Rastreador Básico");
  const [status, setStatus] = useState<Status>(initial.status ?? "ATIVO");

  const valid = name.trim() && email.includes("@") && (!isCreating || password.length >= 6);

  return (
    <div className="bg-[#151A22] border border-[#272A31] rounded-3xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-[#272A31]">
        <h2 className="text-white font-bold flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-[#5865F2]" /> {title}
        </h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2F3136] text-[#8E9297] hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Nome Completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João da Silva"
            className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 placeholder:text-[#454655]" />
        </div>
        <div>
          <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="joao@empresa.com.br"
            className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 placeholder:text-[#454655]" />
        </div>
        {isCreating && (
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Senha</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mínimo 6 caracteres"
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 placeholder:text-[#454655]" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Plano</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)}
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50">
              <option>Rastreador Básico</option>
              <option>Engenharia B2B</option>
              <option>War Room</option>
            </select>
          </div>
          <div>
            <label className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest block mb-2">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full bg-[#0B0E14] border border-[#272A31] text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50">
              <option>ATIVO</option>
              <option>SUSPENSO</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 p-6 border-t border-[#272A31]">
        <button onClick={onClose} className="px-5 py-2.5 bg-[#2F3136] hover:bg-[#454655] text-white text-sm font-bold rounded-xl transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => valid && onSubmit({ name, email, plan, status, password })}
          disabled={!valid}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-[#5865F2]/20"
        >
          <Save className="w-4 h-4" /> {submitLabel}
        </button>
      </div>
    </div>
  );
}

function DeleteConfirm({ user, onConfirm, onClose }: { user: User; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="bg-[#151A22] border border-[#EF4444]/30 rounded-3xl shadow-2xl overflow-hidden">
      <div className="p-6 text-center">
        <div className="w-14 h-14 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-[#EF4444]" />
        </div>
        <h2 className="text-white font-bold text-lg mb-2">Apagar usuário?</h2>
        <p className="text-[#8E9297] text-sm">
          Você está prestes a remover <span className="text-white font-bold">{user.name}</span> permanentemente.
          Esta ação não pode ser desfeita.
        </p>
      </div>
      <div className="flex gap-3 p-6 border-t border-[#272A31]">
        <button onClick={onClose} className="flex-1 py-2.5 bg-[#2F3136] hover:bg-[#454655] text-white font-bold rounded-xl transition-colors text-sm">
          Cancelar
        </button>
        <button onClick={onConfirm} className="flex-1 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-[#EF4444]/20">
          Sim, apagar
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Modal = { type: "create" } | { type: "edit"; user: User } | { type: "delete"; user: User } | { type: "view"; user: User };

export default function UsersPage() {
  const { success, error, info } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);

  // Fetch users from API on mount
  useEffect(() => {
    async function fetchUsers() {
      try {
        console.log("Fetching users from /api/admin/users...");
        const response = await fetch("/api/admin/users");
        console.log("Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("API error response:", errorData);
          throw new Error(errorData.error || "Failed to fetch users");
        }
        const data = await response.json();
        console.log("Users data received:", data);

        // Transform API response to User format
        const transformedUsers: User[] = data.users.map((u: UserApiResponse) => ({
          id: u.id,
          name: u.name || "Sem nome",
          email: u.email,
          plan: tierToPlan(u.tier),
          status: "ATIVO", // Default status since API doesn't return it yet
          joined: formatDate(u.created_at),
          alerts: 0, // Default alerts since API doesn't return it yet
        }));

        console.log("Transformed users:", transformedUsers);
        setUsers(transformedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
        error("Erro ao carregar usuários", "Não foi possível carregar a lista de usuários.");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []); // Only fetch on mount, not when toasts are shown

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: Omit<User, "id" | "joined" | "alerts"> & { password?: string }) => {
    try {
      console.log("Creating user with data:", data);
      console.log("Password present:", !!data.password, "Password length:", data.password?.length);

      const payload = {
        name: data.name,
        email: data.email,
        password: data.password,
        tier: planToTier(data.plan),
      };

      console.log("Sending payload:", payload);

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(errorData.error || "Failed to create user");
      }

      // Refetch users to get updated list
      const updatedResponse = await fetch("/api/admin/users");
      const updatedData = await updatedResponse.json();

      const transformedUsers: User[] = updatedData.users.map((u: UserApiResponse) => ({
        id: u.id,
        name: u.name || "Sem nome",
        email: u.email,
        plan: tierToPlan(u.tier),
        status: "ATIVO",
        joined: formatDate(u.created_at),
        alerts: 0,
      }));

      setUsers(transformedUsers);
      setModal(null);
      success("Usuário criado!", `${data.name} foi adicionado com o plano ${data.plan}.`);
    } catch (err: any) {
      console.error("Error creating user:", err);
      error("Erro ao criar usuário", err.message || "Não foi possível criar o usuário.");
    }
  };

  const handleEdit = async (data: Omit<User, "id" | "joined" | "alerts">) => {
    if (modal?.type !== "edit") return;

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: modal.user.id,
          name: data.name,
          tier: planToTier(data.plan),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }

      // Update local state optimistically
      setUsers((prev) => prev.map((u) => (u.id === modal.user.id ? { ...u, ...data } : u)));
      setModal(null);
      success("Usuário atualizado", `As alterações de ${data.name} foram salvas.`);
    } catch (err: any) {
      console.error("Error updating user:", err);
      error("Erro ao atualizar usuário", err.message || "Não foi possível atualizar o usuário.");
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== "delete") return;
    const userId = modal.user.id;
    const name = modal.user.name;

    try {
      console.log("Deleting user:", userId);

      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete user");
      }

      console.log("User deleted successfully, removing from local state");

      // Remove user from local state
      setUsers((prev) => {
        const filtered = prev.filter((u) => u.id !== userId);
        console.log("Users before:", prev.length, "after:", filtered.length);
        return filtered;
      });

      setModal(null);
      error("Usuário removido", `${name} foi apagado permanentemente.`);
    } catch (err: any) {
      console.error("Error deleting user:", err);
      error("Erro ao remover usuário", err.message || "Não foi possível apagar o usuário.");
    }
  };

  const handleSendEmail = () => {
    info("Em breve", "Módulo de comunicados em massa disponível na próxima versão.");
  };

  const closeModal = () => setModal(null);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Modals */}
      {modal?.type === "create" && (
        <ModalWrapper onClose={closeModal}>
          <UserForm initial={{ password: "" }} onSubmit={handleCreate} onClose={closeModal} title="Criar Usuário" submitLabel="Criar Usuário" isCreating={true} />
        </ModalWrapper>
      )}
      {modal?.type === "edit" && (
        <ModalWrapper onClose={closeModal}>
          <UserForm initial={modal.user} onSubmit={handleEdit} onClose={closeModal} title="Editar Usuário" submitLabel="Salvar" isCreating={false} />
        </ModalWrapper>
      )}
      {modal?.type === "delete" && (
        <ModalWrapper onClose={closeModal}>
          <DeleteConfirm user={modal.user} onConfirm={handleDelete} onClose={closeModal} />
        </ModalWrapper>
      )}
      {modal?.type === "view" && (
        <ModalWrapper onClose={closeModal}>
          <div className="bg-[#151A22] border border-[#272A31] rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#272A31]">
              <h2 className="text-white font-bold text-base">Perfil do Usuário</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-[#2F3136] text-[#8E9297] hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#5865F2] flex items-center justify-center text-white text-xl font-bold">
                  {modal.user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{modal.user.name}</p>
                  <p className="text-[#8E9297] text-sm">{modal.user.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Plano", value: modal.user.plan },
                  { label: "Status", value: modal.user.status },
                  { label: "Membro desde", value: modal.user.joined },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0B0E14] border border-[#272A31] rounded-xl p-3">
                    <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
                    <p className="text-white text-sm font-bold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#0B0E14] border border-[#272A31] rounded-xl p-3">
                <p className="text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Alertas Ativos</p>
                <p className="text-white text-2xl font-bold tabular-nums mt-1">{modal.user.alerts}</p>
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#5865F2]" /> Gestão de Usuários
          </h1>
          <p className="text-[#8E9297] text-sm mt-1">Visualize e gerencie a base de clientes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSendEmail} className="flex items-center gap-2 bg-[#151A22] border border-[#272A31] hover:bg-[#2F3136] text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm">
            <Mail className="w-4 h-4" /> Comunicado
          </button>
          <button onClick={() => setModal({ type: "create" })} className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-[#5865F2]/20">
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: users.length.toString(), color: "text-white" },
          { label: "War Room", value: users.filter(u => u.plan === "War Room").length.toString(), color: "text-[#F59E0B]" },
          { label: "Pro (B2B)", value: users.filter(u => u.plan === "Engenharia B2B").length.toString(), color: "text-[#5865F2]" },
          { label: "Suspensos", value: users.filter(u => u.status === "SUSPENSO").length.toString(), color: "text-[#EF4444]" },
        ].map((s) => (
          <div key={s.label} className="bg-[#151A22] border border-[#272A31] rounded-2xl p-4">
            <p className="text-[#8E9297] text-[10px] uppercase tracking-widest font-bold">{s.label}</p>
            <h3 className={`text-2xl font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</h3>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#454655]" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#151A22] border border-[#272A31] text-white text-sm rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:ring-1 focus:ring-[#5865F2]/50 placeholder:text-[#454655]"
        />
      </div>

      {/* Table */}
      <div className="bg-[#151A22] border border-[#272A31] rounded-3xl overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-[#454655] text-sm">Carregando usuários...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#272A31] bg-[#0B0E14]/40">
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Plano</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest text-right">Alertas</th>
                <th className="px-6 py-4 text-[#8E9297] text-[10px] font-bold uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272A31]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#454655] text-sm">Nenhum usuário encontrado.</td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-[#2F3136]/10 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2] text-xs font-bold flex-shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{u.name}</p>
                        <p className="text-[#8E9297] text-[11px]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${PLAN_BADGE[u.plan]}`}>
                      {u.plan === "War Room" && <Crown className="w-2.5 h-2.5" />}
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.status === "ATIVO"
                      ? <span className="flex items-center gap-1.5 text-[#10B981] text-xs font-bold"><ShieldCheck className="w-3 h-3" />ATIVO</span>
                      : <span className="flex items-center gap-1.5 text-[#EF4444] text-xs font-bold"><Ban className="w-3 h-3" />SUSPENSO</span>}
                  </td>
                  <td className="px-6 py-4 text-white text-sm font-bold tabular-nums text-right">{u.alerts}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setModal({ type: "view", user: u })}
                        className="p-2 rounded-lg bg-[#0B0E14] border border-[#272A31] text-[#8E9297] hover:text-white hover:border-[#454655] transition-all"
                        title="Ver perfil"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setModal({ type: "edit", user: u })}
                        className="p-2 rounded-lg bg-[#0B0E14] border border-[#272A31] text-[#8E9297] hover:text-[#5865F2] hover:border-[#5865F2]/30 transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setModal({ type: "delete", user: u })}
                        className="p-2 rounded-lg bg-[#0B0E14] border border-[#272A31] text-[#8E9297] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-all"
                        title="Apagar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
