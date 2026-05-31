# PRD: Radar Joias — AI-Powered Jewelry Auction Discovery

## 1. Product Overview

**Radar Joias** is a B2C/B2B SaaS for discovering and analyzing CAIXA jewelry auctions in Brazil. It features an AI-powered consultant (Joias Copilot) that analyzes auction edicts, assesses pricing, and provides bid guidance. Built on the Radar Leilão design system with dark glassmorphism UI.

## 2. Domain Separation (User vs. Admin)

### 2.1 User App (PWA)
- **Marketing & Onboarding:** Landing page, pricing tiers, register/login
- **Dashboard Core:** Jewelry lot grid (Airbnb-style), Watchlist, City heat map
- **Joias Copilot:** AI chat for bid guidance, Edital analysis, alert setup
- **Settings:** Profile, security, billing

### 2.2 Admin Dashboard (ControlRoom)
- **Overview:** SaaS metrics (MRR, lots scraped, success rate)
- **Scrapers:** CAIXA scraper status, error logs, schedule management
- **LLM Config:** Edital extraction settings, cost tracking
- **Users:** User management, tier assignments

## 3. Monetization & AI Tiers

- **Free:** 50 lots/month, no AI
- **Engenharia B2B (R$ 149):** Unlimited lots, Edital analysis, alerts, no Copilot
- **War Room (R$ 599):** Full Joias Copilot, multi-account, priority support

## 4. Joias Copilot: Agentic AI

- **System Actions:** Create alerts, save to watchlist, search lots
- **Data Consulting:** "Which gold lots in SP have best value right now?"
- **Contextual Analysis:** Analyzes Edital PDFs for hidden fees, payment terms, pickup deadlines
- **Interface:** Floating glassmorphism bubble, Markdown support

## 5. Technical Architecture

- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4, Lucide React, Leaflet maps
- **Backend:** Supabase (Auth, RLS, PostgreSQL, Storage)
- **Scraper:** Node.js (scraper.js), CAIXA API v2, rotating proxies
- **LLM:** Anthropic Claude for Edital extraction + Copilot chat

## 6. Data Pipeline

```
CAIXA API → States → Cities → Bid Periods → Active Lots
                                    ↓
                              Results API → Lot outcomes (sold/unsold)
                                    ↓
                              Edital PDFs → LLM extraction → Auction rules
```

## 7. Key Differentiators vs. CAIXA UI

- Modern glassmorphism interface
- AI-powered bid recommendations
- Historical winning price data
- City/state heat maps
- Watchlist + alerts
- Natural language search via Copilot