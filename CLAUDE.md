# CLAUDE.md

Radar Joias — AI-powered jewelry auction discovery SaaS for Brazil.

## Project Overview

**Radar Joias** is a B2B/B2C SaaS platform for discovering and analyzing CAIXA jewelry auctions in Brazil. It features an AI-powered consultant (Joias Copilot) that analyzes auction edicts, assesses pricing, and provides bid guidance. Built on top of the Radar Leilão design system.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4 (dark glassmorphism theme)
- **Database**: Supabase (PostgreSQL, Auth, Storage)
- **AI/LLM**: Anthropic Claude for Edital analysis + Copilot
- **Deployment**: Vercel / Docker

## Architecture

```
src/app/
├── (marketing)/     # Public landing pages
├── (auth)/          # Login, register, password reset
├── (app)/           # Main application (protected)
│   ├── dashboard/   # Lot listing grid
│   ├── mapa/        # Geographic view by city
│   ├── watchlist/   # Saved lots
│   ├── alertas/     # Price/scraper alerts
│   ├── lote/[id]/   # Lot detail page
│   ├── copilot/     # AI chat interface
│   └── settings/    # Profile, billing, API keys
└── (admin)/         # Admin dashboard (ControlRoom)
    ├── admin/        # Overview, metrics
    ├── scrapers/    # Scraper management
    ├── llm/         # LLM configuration
    └── users/       # User management
```

## Data Sources

### CAIXA Vitrine de Joias API
- **Base**: `https://servicebus2.caixa.gov.br/vitrinedejoias/api`
- **States**: `GET /busca/ufs`
- **Cities**: `GET /busca/cidades/{uf}`
- **Bid Periods**: `GET /busca/periodos/{cityCode}`
- **Lots**: `GET /busca/vitrine?codigoDaCidade=X&dataInicioLance=Y&dataFimLance=Z`
- **Results**: `GET /resultados-leiloes?codigoDaCidade=X`
- **Files**: `GET /arquivos/{fileId}` (Edital, Catálogo PDFs)

### Database Schema (Supabase)
Schema: `supabase_joias/migrations/001_initial_schema.sql`

Tables:
- `states` — Brazilian states (UF)
- `cities` — cities with CAIXA codes
- `bid_periods` — active bid date ranges per city
- `auctions` — per-auction rules (edital data)
- `lots` — individual jewelry lots
- `lot_catalog_pages` — LLM-extracted catalog text
- `scrape_log` — scraper audit trail

## Scraper Modes

```bash
node scraper.js --mode=states-cities   # Weekly: refresh states + cities
node scraper.js --mode=bid-periods     # Daily: discover new bid periods
node scraper.js --mode=active-lots     # Every 4h: scrape lots
node scraper.js --mode=results         # Daily: fetch auction outcomes
node scraper.js --mode=edital --auction-code="119/2026"  # On-demand LLM extraction
```

## Design System

Colors from `globals.css`:
```css
--background: #0B0E14;
--surface: #151A22;
--surface-muted: #2F3136;
--primary: #5865F2;
--primary-hover: #4752C4;
--muted: #8E9297;
--foreground: #FFFFFF;
```

## Authentication

- **User Auth**: Supabase Auth (email/password)
- **Admin Auth**: Separate system with httpOnly cookies
- **Tiers**: `free`, `pro`, `war_room` (same as Radar Leilão)

## Important Files

| File | Purpose |
|------|---------|
| `scraper.js` | Main scraper (Node.js, all modes) |
| `proxy.js` | Rotating proxy handler |
| `supabase_joias/migrations/001_initial_schema.sql` | DB schema |
| `src/lib/supabase.ts` | Supabase client |
| `src/hooks/useUser.tsx` | Auth context + user profile |
| `src/app/(marketing)/page.tsx` | Landing page |
| `src/app/(app)/dashboard/page.tsx` | Main lot listing |

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
```

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_API_KEY=
LLM_PROVIDER=anthropic
PROXY_URLS=           # comma-separated, optional
```