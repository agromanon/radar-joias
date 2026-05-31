# Radar Joias — AI-Powered Jewelry Auction Discovery

**Radar Joias** is a B2C/B2B SaaS that discovers and analyzes CAIXA jewelry auctions in Brazil. It features an AI consultant (Joias Copilot) that reads auction edicts, assesses pricing, and provides bid guidance — replacing CAIXA's clunky interface with a modern glassmorphism experience.

## Key Features

- **Joias Copilot (AI Agent):** War Room exclusive. Natural language chat to search lots, configure alerts, and analyze Edital PDFs.
- **Edital Auditing:** Multi-LLM engine extracts payment terms, pickup deadlines, and penalty clauses from CAIXA PDFs.
- **City Heat Map:** Interactive map of Brazil showing active auction density by city.
- **Watchlist + Alerts:** Save lots and get notified of price drops or new auctions.
- **Admin Control Room:** Scraper management, LLM config, SaaS metrics (MRR, churn).

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React
- **Maps:** Leaflet with CartoDB Dark tiles
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **AI:** Anthropic Claude for Edital extraction + Copilot

## Quick Start

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) for the marketing page or [/dashboard](http://localhost:3000/dashboard) for the app.

## Scraper

The scraper runs via Node.js and connects to the CAIXA Vitrine de Joias API:

```bash
node scraper.js --mode=states-cities   # populate states & cities
node scraper.js --mode=bid-periods     # discover active periods
node scraper.js --mode=active-lots     # scrape lots (run every 4h)
node scraper.js --mode=results         # fetch auction outcomes (daily)
```

See `SCRAPER_SPEC.md` for full documentation.