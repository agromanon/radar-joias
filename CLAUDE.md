# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Radar Leilão** is a B2B/B2C SaaS platform for discovering and analyzing industrial auctions in Brazil. It features an AI-powered consultant (Radar Copilot) that analyzes auction edicts, assesses risks, and provides ROI projections. The platform separates user-facing features from administrative controls into distinct domains.

## Development Commands

```bash
# Development
npm run dev          # Start dev server on http://localhost:3000

# Build & Deploy
npm run build        # Production build
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 (App Router) + React 19.2.4
- **Styling**: Tailwind CSS v4 (inline theme via `@theme inline`)
- **Maps**: Leaflet + React-Leaflet with CartoDB Dark tiles
- **Icons**: Lucide React
- **Backend**: Supabase (Auth, PostgreSQL, Storage) - **Currently mocked, needs real implementation**
- **AI/LLM**: Planned multi-provider routing via LiteLLM (DeepSeek, Qwen, GPT-4o)

### ⚠️ Next.js 16 Breaking Changes
This project uses Next.js 16 which has breaking changes from previous versions. **Always read the relevant guide in `node_modules/next/dist/docs/` before writing code.** Key differences:
- All request APIs are async: `await cookies()`, `await headers()`, `await params`
- `middleware.ts` renamed to `proxy.ts` (not yet implemented in this project)
- Turbopack config is top-level in `next.config.ts`
- Use Cache Components (`'use cache'`) instead of PPR

### Route Structure
The app uses Next.js App Router with route groups for domain separation:

```
src/app/
├── (marketing)/     # Public marketing pages (/)
├── (auth)/          # Authentication flows (/login, /register, /esqueci-senha)
├── (app)/           # Main application (protected)
│   ├── dashboard/   # Core listing grid
│   ├── mapa/        # Geographic heat map
│   ├── watchlist/   # Saved lots
│   ├── alertas/     # Configured alerts
│   ├── lote/[id]/   # Individual lot detail
│   ├── copilot/     # AI chat interface (War Room tier only)
│   └── settings/    # User profile, security, billing
└── (admin)/         # Admin dashboard (ControlRoom)
    ├── admin/       # Overview, metrics
    ├── scrapers/    # Scraper management
    ├── llm/         # LLM routing configuration
    └── users/       # User management
```

### Key Patterns

**Auth Context (`src/hooks/useUser.tsx`)**
- Currently uses a **mock user** for UI development
- Needs real Supabase Auth integration
- Exports `AuthProvider` wrapper and `useUser()` hook
- User tiers: `free`, `pro` (Engineering B2B), `war_room` (War Room)

**Layout Hierarchy**
- Root layout (`src/app/layout.tsx`): Provides `AuthProvider` and `ToastProvider`
- App layout (`src/app/(app)/layout.tsx`): Wraps with `SidebarProvider`, includes `Sidebar`, `Header`, and `RadarCopilot`
- Admin layout (`src/app/(admin)/layout.tsx`): Separate admin dashboard layout

**State Management**
- `SidebarContext.tsx`: Controls sidebar collapse/expand state
- Auth state managed via React Context (to be replaced with Supabase)

## Design System

### Colors (CSS Variables in `globals.css`)
```css
--background: #0B0E14;    /* Canvas Dark */
--surface: #151A22;        /* Surface Elevation 1 */
--surface-muted: #2F3136;  /* Midnight Purple */
--primary: #5865F2;        /* Discord Blurple (CTA) */
--primary-hover: #4752C4;
--muted: #8E9297;          /* Cool Grey */
--foreground: #FFFFFF;     /* Pure White */
```

### Design Principles
- **Glassmorphism**: Use `backdrop-blur-md` with low-opacity borders for floating panels
- **Typography**: Inter font, bold/black weights for titles
- **Spacing**: Generous padding and gaps - avoid data density
- **Rounded corners**: `rounded-xl` or `rounded-2xl` for cards and buttons
- **Shadows**: Plush shadows (diffuse, long) instead of hard 1px borders
- **Hover states**: All interactive cards get subtle lift or scale (2%)

### Component Patterns
- Buttons use Discord Blurple (#5865F2) with white text
- Inputs use "pill" style (rounded-full) with Midnight Purple background
- Cards have rounded-2xl corners with plush shadows
- Grid layout for lot listings (Airbnb-style)
- Sidebar navigation (Discord-style) instead of top nav

## Backend Implementation Status

**TODO: Critical Implementation Needed**

The frontend is fully structured and styled, but the backend is **mocked and non-functional**. The following need real implementation:

### Supabase Integration (`src/lib/supabase.ts`)
- Replace mock in `src/hooks/useUser.tsx` with real Supabase Auth listener:
  ```ts
  supabase.auth.onAuthStateChange((event, session) => { ... })
  ```
- Create `user_profiles` table with `tier` enum (free, pro, war_room)
- Implement RLS policies for tier-based access control

### Database Tables Needed
1. **`user_profiles`**: id, name, email, avatar_url, tier, company
2. **`lots`**: id, title, auctioneer, current_bid, image_url, risk_score, category, edict_url, closing_at
3. **`watchlist`**: user_id, lot_id relationships
4. **`alerts`**: user_id, search_terms, filters

### Environment Variables
Create `.env` with:
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
LITELLM_API_KEY=
RESEND_API_KEY=
```

## AI Features to Implement

### Radar Copilot (`src/app/(app)/copilot/page.tsx`)
- Create `/api/chat` API route for streaming responses
- Implement LiteLLM routing for cost efficiency
- Agentic skills needed:
  - `search_lots(query)`: Semantic search in lots database
  - `analyze_edict(pdf_url)`: Extract hidden fees, projected ROI
  - `set_alert(params)`: Create autonomous tracking

### Monetization Tiers
- **Free**: 50 lots/month view limit, no AI
- **Engineering B2B (R$ 149)**: Edict analysis, risk scoring, no Copilot
- **War Room (R$ 599)**: Full Radar Copilot access, multi-account, priority support

### Stripe Integration
- Implement checkout flow in `/settings/billing`
- Block `/copilot` access for non-War Room users
- Upgrade/downgrade tier management

## Important Notes

- **Mobile-First**: The app is PWA-focused, ensure responsive design
- **Maps**: Use Leaflet with CartoDB Dark Matter tiles for geographic visualization
- **Toast System**: Use `Toast.tsx` component for user notifications
- **Auth Shell**: Always wrap protected routes in `useUser()` check
- **Admin vs User**: Strict domain separation - admin features in `/admin`, user features in `/`
- **PDF Analysis**: Auction edicts are PDFs - need extraction/analysis pipeline
- **Real-time**: Scrapers continuously insert new lots - consider polling or subscriptions

## File Naming Conventions
- Route groups use parentheses: `(app)`, `(auth)`, `(marketing)`, `(admin)`
- Dynamic routes use brackets: `lote/[id]`
- Client components use `"use client"` directive at top of file
- Server components are default (no directive needed)

## Testing Strategy
- Auth flows: Test login/register/password reset
- Tier gates: Verify free/pro/war_room access controls
- AI responses: Test streaming in Copilot interface
- Map rendering: Verify Leaflet integration with custom tiles
- Mobile responsiveness: Test all views on mobile viewport
