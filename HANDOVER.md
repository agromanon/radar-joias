# Handover Documentation: Radar Leilão Backend & Agentic Logic

Este documento orienta a implementação do backend e da lógica de IA para o projeto **Radar Leilão** usando **Claude Code**.

---

## 1. Visão Geral da Arquitetura
O frontend está **100% estruturado** com uma estética premium (glassmorphism/dark grays). A fundação técnica é:
- **Framework:** Next.js 16 (App Router) + React 19.
- **Styling:** Tailwind CSS v4 (usando `@theme inline` em `globals.css`).
- **Icons:** Lucide React.
- **Maps:** Leaflet + React-Leaflet.
- **Auth Shell:** `src/hooks/useUser.tsx` (atualizado com mocks funcionais para UI).

---

## 2. Status do Frontend (Done)
As seguintes rotas estão prontas e estilizadas:
- [x] **Marketing:** `/` (Sales Page / Onboarding).
- [x] **Auth:** `/login`, `/register`, `/esqueci-senha`.
- [x] **Core App:** `/dashboard`, `/mapa`, `/watchlist`, `/alertas`, `/notificacoes`.
- [x] **Product Detail:** `/lote/[id]` (com termômetro de risco e cálculo de ROI IA).
- [x] **Settings:** `/settings`, `/settings/billing` (pricing tables incluídas).
- [x] **Admin Dashboard:** `/admin`, `/admin/scrapers`, `/admin/llm`.
- [x] **Sidebar & Header:** Totalmente responsivos com controles de estado em `SidebarContext.tsx`.

---

## 3. Guia de Implementação para Claude Code

### A. Autenticação (Supabase)
1. **Substituir o Mock:** Em `src/hooks/useUser.tsx`, remova o `mockUser` e implemente o listener real do Supabase:
   ```ts
   supabase.auth.onAuthStateChange((event, session) => { ... })
   ```
2. **Registro de Perfil:** Garanta que, ao criar um usuário, seja inserida uma linha na tabela `user_profiles` com o `tier` inicial `free`.

### B. Banco de Dados (Supabase/PostgreSQL)
Implementar as seguintes tabelas (usar os tipos TS já definidos no frontend como guia):

1. **`user_profiles`**
   - `id`: id (ref `auth.users`)
   - `name`: text
   - `email`: text
   - `avatar_url`: text
   - `tier`: enum (`free`, `pro`, `war_room`)
   - `company`: text

2. **`lots`** (Onde os scrapers inserem os dados)
   - `id`: uuid
   - `title`: text
   - `auctioneer`: text
   - `current_bid`: numeric
   - `image_url`: text
   - `risk_score`: text (`BAIXO`, `MÉDIO`, `ALTO`)
   - `category`: text (`Metais`, `Maquinário`, etc)
   - `edict_url`: text (link para PDF no Storage)
   - `closing_at`: timestamptz

3. **`watchlist`** e **`alerts`**
   - Relacionar `user_id` com `lot_id` ou termos de busca.

### C. Radar Copilot (Agentic Logic)
O Copilot em `src/app/(app)/copilot/page.tsx` está pronto para receber streams de texto.
1. **API Route:** Criar `/api/chat`.
2. **LiteLLM Routing:** Configurar o roteamento para múltiplos modelos (DeepSeek-V3 ou GPT-4o) para eficiência de custo.
3. **Agentic Skills (LangGraph/LangChain):**
   - `search_lots(query)`: Busca por similaridade semântica no banco de lotes.
   - `analyze_edict(pdf_url)`: Extrai taxas oculta e ROI projetado do edital.
   - `set_alert(params)`: Cria um tracker autônomo para o usuário.

### D. Monetização (Stripe)
Implementar o fluxo de checkout em `/settings/billing`:
- **Free:** Bloqueia acesso ao `/copilot` via interceptor ou check no componente.
- **Pro B2B:** Habilita `analyze_edict` e `risk_score` detalhado.
- **War Room:** Libera o `Radar Copilot` (Chat).

---

## 4. Variáveis de Ambiente Necessárias
Configurar em um arquivo `.env` real:
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
LITELLM_API_KEY=
RESEND_API_KEY=
```

---

## 5. Padrões de Design a Manter
- **Cores:** Use as variáveis CSS definidas em `globals.css` (`--primary`, `--surface`, etc).
- **Glassmorphism:** Use `backdrop-blur-md` e bordas com baixa opacidade em painéis flutuantes.
- **Tipografia:** Inter (padrão) com pesos bold/black para títulos industriais.

---
*Assinado: Antigravity Agent (Stitch)*
*Data: 01 de Abril de 2026*
