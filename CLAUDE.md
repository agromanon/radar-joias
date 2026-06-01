# CLAUDE.md

Radar Joias — AI-powered jewelry auction discovery SaaS for Brazil.

## Project Overview

**Radar Joias** is a B2B/B2C SaaS platform for discovering and analyzing CAIXA jewelry auctions in Brazil. It features an AI-powered consultant (Joias Copilot) that analyzes auction edicts, assesses pricing, and provides bid guidance. Built on top of the Radar Leilão design system.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (dark glassmorphism theme)
- **Database**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **AI/LLM**: DeepSeek/minimax compatible via LLM gateway
- **Deployment**: Vercel
- **Proxy**: webshare.io (for CAIXA scraping)

## Application Routes

```
src/app/
├── (marketing)/         # Public landing page: /
├── (auth)/              # Login, register, password reset
├── (app)/               # Main application (authenticated)
│   ├── leiloes/        # Active auctions page (live lots)
│   ├── vendas/         # Completed/sold auctions page
│   ├── lote/[id]/      # Lot detail page
│   ├── mapa/           # Geographic view by city
│   ├── watchlist/      # Saved lots
│   ├── alertas/        # Price/scraper alerts
│   ├── copilot/        # AI chat interface
│   ├── notificacoes/   # Notifications
│   ├── equipe/         # Team/sharing
│   └── settings/       # Profile, billing, appearance, security
└── (admin)/             # Admin dashboard
    ├── admin/scrapers/ # Scraper management
    ├── admin/llm/      # LLM provider configuration
    ├── admin/users/    # User management
    ├── admin/plans/    # Subscription plans
    └── admin/payments/ # Payment history
```

## Data Architecture

### CAIXA Vitrine de Joias API
- **Base**: `https://servicebus2.caixa.gov.br/vitrinedejoias/api`
- **States**: `GET /busca/ufs`
- **Cities**: `GET /busca/cidades/{uf}`
- **Bid Periods**: `GET /busca/periodos/{cityCode}`
- **Lots**: `GET /busca/vitrine?codigoDaCidade=X&dataInicioLance=Y&dataFimLance=Z&pagina=N&quantidadeDeItens=81`
- Image base: `https://servicebus2.caixa.gov.br/vitrinearquivos/fotos`

### CAIXA API Discovery Sequence
```
1. GET /busca/ufs → list of states (UF)
2. For each UF: GET /busca/cidades/{uf} → cities with caixa_city_code
3. For each city: GET /busca/periodos/{cityCode} → bid date ranges
4. For each (city, period): GET /busca/vitrine?... → lots for that bid window
```
**Important**: The `/busca/vitrine` endpoint requires date filters (`dataInicioLance`, `dataFimLance`) to return results. Without date filters, it returns 0 lots.

### Database Schema (Supabase)
- **Project ID**: `fmsslhxijwkstaxnuxge`
- **Key tables**:
  - `states` (27 rows) — Brazilian states
  - `cities` (28 rows) — cities with `caixa_city_code` FK to state
  - `bid_periods` (30 rows) — active bid date ranges per city
  - `auctions` (106 rows) — per-auction metadata, status: UNKNOWN|COMPLETED
  - `lots` (38,877 rows) — jewelry lots with enrichment data
- **Storage**: `lot-images` bucket (public, 5MB/file limit)
- **RLS**: Enabled on all tables; public SELECT allowed for lots, auctions, cities, states

### Lot Enrichment
Lots go through LLM enrichment to extract:
- `title_enriched`, `description_enriched`
- `category_enriched`, `karat_enriched`, `weight_enriched`
- `tags` array (e.g., `["ouro", "amassado", "alianca"]`)
- Condition flags: `is_damaged`, `is_broken`, `is_incomplete`, `has_low_karat`, etc.

### Image Pipeline
1. Scraper fetches `url_imagem_capa` from CAIXA at scrape time
2. `sharp` optimizes images to WebP (capa, frente, verso)
3. Uploaded to Supabase Storage: `lot-images/lots/{lot_id}/capa.webp`
4. Frontend uses `imagem_capa_url` (storage) with fallback to CAIXA URL

## Scraper Modes

```bash
node scraper.js --mode=states-cities  # Weekly: refresh states + cities
node scraper.js --mode=bid-periods    # Daily: discover new bid periods
node scraper.js --mode=active-lots    # Every 4h: scrape lots for active periods
node scraper.js --mode=results        # Daily: fetch auction outcomes
node scraper.js --mode=edital --auction-code="119/2026"  # On-demand LLM extraction
```

The scraper is a standalone Node.js ESM script (`scraper.js`), NOT an API route.

## `/leiloes` Page — Active Lots Filter Logic

The `/api/lots` endpoint (and thus `/leiloes`) uses a two-stage filtering approach:

**Stage 1 — Base Query (Supabase)**:
```sql
WHERE outcome_status IS NULL
  AND enrichment_status = 'enriched'
  AND valor IS NOT NULL
```

**Stage 2 — Post-Fetch Filtering (JavaScript)**:
```typescript
// Exclude lots from COMPLETED auctions (status=COMPLETED OR result_date < today)
// Keep lots from UNKNOWN auctions with null result_date IF city still has future bid periods
// Exclude orphan lots: city has no future bid periods AND auction is UNKNOWN/absent
```

**Current result**: ~27 lots pass the filter (from cities Criciuma, Caxias do Sul, Passo Fundo, Goiânia that have future bid periods and UNKNOWN-null-result auctions).

### Why So Few Lots?
The CAIXA `/busca/vitrine` API requires date filters. Without `dataInicioLance`/`dataFimLance`, it returns 0. The scraper only fetched lots when it had specific bid period dates. Many cities have COMPLETED auctions or bid periods that ended — those lots are correctly excluded.

The `bid_periods` table only has 30 rows (one per city) because CAIXA only returns data for cities that have active bid periods. When a bid period ends, it may not appear in subsequent scrapes, leaving the `bid_periods` table stale.

## `/vendas` Page — Completed Sales

Shows lots from COMPLETED auctions with `outcome_status` set, plus lots from completed auctions awaiting results (`outcome_status=null` but `auction.status=COMPLETED`).

## Known Issues / Technical Debt

1. **Limited active lots**: Only ~27 lots shown because only 4 cities have active bid periods + UNKNOWN auctions. Scraping needs re-running with current bid period dates to surface more lots.

2. **Image downloader running**: `mode=download-images` backfill in progress for 4,266 lots.

3. **Pagination bug**: `/api/lots` with `page=2` for `leiloes=true` returns the same 27 items as page 1 (slicing bug in API, affects all sorts).

4. **Auction status staleness**: `auctions.status=UNKNOWN` for many active auctions — CAIXA doesn't provide explicit active/completed status, so we infer from `result_date`. Lots from UNKNOWN auctions with future city bid periods are kept; lots from UNKNOWN auctions whose city bid periods ended are excluded.

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
--accent: #EC4899;  /* pink for weight slider, etc. */
```

## Authentication

- **User Auth**: Supabase Auth (email/password)
- **Admin**: Separate `/admin/*` routes
- **Tiers**: `free`, `pro`, `war_room` (tracked in `user_profiles.tier`)

## Important Files

| File | Purpose |
|------|---------|
| `scraper.js` | Main scraper (Node.js ESM, all modes) |
| `http-proxy-utils.js` | Proxy rotation for CAIXA requests |
| `llm-gateway.js` | LLM provider abstraction (DeepSeek/minimax compatible) |
| `src/app/api/lots/route.ts` | Lots listing API with leiloes/vendas filter logic |
| `src/lib/supabase.ts` | Supabase client |
| `src/hooks/useUser.tsx` | Auth context + user profile |

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # Production build
node scraper.js --mode=active-lots  # Run scraper directly
```

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_API_KEY=
LLM_PROVIDER=anthropic|deepseek|minimax
PROXY_URLS=   # comma-separated webshare.io proxies
```