# PRD: Radar Leilão - O SaaS Definitivo de Oportunidades Industriais

## 1. Visão Geral do Produto (Product Overview)
O **Radar Leilão** é um SaaS completo (B2C/B2B) focado na curadoria de **leilões de sucatas, maquinários e oportunidades industriais**. O produto difere dos agregadores padrão pela experiência moderna e fluida ("Airbnb-style"), suporte 100% responsivo (Mobile/PWA), e por trazer um **Consultor de Inteligência Artificial** (Radar Copilot) que quantifica riscos e lucros de leilões lendo os editais. 

---

## 2. Separação de Domínios (User vs. Admin)
Uma fundação estrita da arquitetura é a total separação entre o ambiente do cliente (User App) e o ambiente de gerenciamento (Admin Dashboard).

### 2.1 Visão do Usuário (User App - PWA)
- **Marketing & Onboarding:** Sales Page Premium com tabelas de preços escalonadas, Planos de Assinatura, e fluxos de Register/Login estilizados.
- **Dashboard Core:** Grid de lotes "Airbnb-style", Watchlist (Lotes Salvos), e Mapa de Calor (Radar Geográfico).
- **Radar Copilot (AI Agent):** Chat flutuante persistente disponível para assinantes de alto valor. Capaz de executar buscas complexas, configurar alertas e ler editais via linguagem natural.
- **Configurações:** Perfil, Segurança (2FA), Aparência (Dark/Light) e Billing (Gestão de Faturamento e Upgrade).

### 2.2 Visão Administrativa (Admin Dashboard - ControlRoom)
- **Overview de Negócios:** Métricas SaaS (MRR, churn-rate simulado), Logs de Scrapers e Status de Infraestrutura.
- **Controle de IA (LLM Routing):** Área para definir tokens, modelos (DeepSeek, Qwen, etc.) e custos de operação por lote.
- **Gerenciamento:** Listagem de usuários, controle de permissões e monitoramento de falhas em tempo real nos robôs coletores.

---

## 3. Estratégia de Monetização & AI Tiers
O Radar Copilot exige alto consumo de tokens e foi posicionado como diferencial competitivo premium:
- **Free:** Apenas visualização limitada de lotes (50/mês). Sem IA.
- **Engenharia B2B (R$ 149):** Auditoria de editais e IA preditiva de riscos. Sem Copilot.
- **War Room (R$ 599):** Acesso full ao Agente AI (Radar Copilot), multicontas e suporte prioritário.

---

## 4. Radar Copilot: Agentic AI Experience
O Radar Copilot é um orquestrador de skills capaz de:
- **Ações de Sistema:** "Crie um alerta de Macbook em SP", "Salve este lote na minha watchlist".
- **Consultoria de Dados:** "Quais leilões de máquinas pesadas em MG têm menor risco hoje?".
- **Análise Contextual:** Analisa editais PDF em tempo real, informando ônus judiciais e ROI projetado.
- **Interface:** Floating bubble com design glassmorphism, suporte a Markdown e rich components dentro do chat.

---

## 5. Arquitetura Técnica (Handover)
1. **Frontend:** Next.js (App Router), Tailwind CSS v4, Lucide React, Leaflet (Mapas).
2. **Backend:** Supabase (Auth, RLS, Database), Resend (Emails), LiteLLM (Roteamento Multi-LLM).
3. **Scrappers:** Scripts Python especialistas em coleta de PDF de editais e estruturação de JSON.

---

*Documento atualizado em: 01 de Abril de 2026*
