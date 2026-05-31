# Vitrine de Joias Scraper - Architecture Spec

## Overview

Automated scraper for CAIXA's Vitrine de Joias jewelry auction platform. Keeps a Supabase database updated with active lots, auction rules, and historical outcomes for a SaaS product.

## API Base URL

```
https://servicebus2.caixa.gov.br/vitrinedejoias/api
```

## Standard Headers (required for all requests)

```
accept: application/json, text/plain, */*
accept-language: pt-BR,pt;q=0.9,en;q=0.8
origin: https://vitrinedejoias.caixa.gov.br
referer: https://vitrinedejoias.caixa.gov.br/
user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36
sec-fetch-mode: cors
sec-fetch-site: same-site
```

---

## Database Schema

See `supabase/migrations/001_initial_schema.sql`

Tables: `states`, `cities`, `bid_periods`, `auctions`, `lots`, `lot_catalog_pages`, `scrape_log`

---

## Scraper Modes

The scraper is a single Node.js script invoked with `--mode` flags.

### Mode 1: `states-cities`

**Schedule:** Weekly (Sunday 2am)

**Purpose:** Refresh states and cities — catches new municipalities added to the platform.

```
Step 1: GET /busca/ufs
  → Upsert into states table (uf, last_refreshed_at)

Step 2: For each state:
  GET /busca/cidades/{uf}
  → Upsert into cities table (name, caixa_city_code, state_id FK)
```

---

### Mode 2: `bid-periods`

**Schedule:** Daily (6am)

**Purpose:** Discover new bid periods for all cities.

```
For each city in DB:
  GET /busca/periodos/{caixa_city_code}
  → If (city_id, start_date, end_date) not in bid_periods: INSERT
  → If period exists: update last_seen_at
  → If period end_date < today: set is_active = false
```

---

### Mode 3: `active-lots` (Main Lot Scrape)

**Schedule:** Every 4 hours during business days

**Purpose:** Keep lot metadata current for all active bid periods.

```
For each city with active bid_periods (is_active = true):
  For each active bid_period in that city:
    page = 1
    loop:
      GET /busca/vitrine?codigoDaCidade={cityCode}&dataInicioLance={start}&dataFimLance={end}&pagina={page}&quantidadeDeItens=81
      → If first page: total = response.totalDeItens; calculate pages
      → For each lot in response.lotes:
        INSERT if (city_id, lot_number) not exists: first_seen_at = now(), last_seen_at = now()
        UPDATE if exists: last_seen_at = now()
        → Also update: de_contrato, valor, url_imagem_* from API
        → Track catalogo/edital IDs from arquivosPublicados array
      page++ until all pages consumed
    → After all pages: mark lots not seen in this scrape (last_seen_at old) as potentially closed
```

**Note:** Do NOT write winning_bid_value or outcome_status here. Those come only from results scrape.

---

### Mode 4: `results`

**Schedule:** Daily (8am)

**Purpose:** Fetch auction outcomes and detect catalog updates for active auctions.

```
For each city in DB:
  GET /resultados-leiloes?codigoDaCidade={cityCode}&dataFimLance=&dataInicioLance=
  → Returns all result rows for this city (all time, filter client-side if needed)

  For each result row:
    A) Find matching lot by (lot_number, contract_number) in lots table

    B) Update outcome fields:
      outcome_status: map 'Venda Direta'→'sold', '2ª Venda Direta'→'sold_2nd_round',
                      'Encerrado'→'no_sale', 'Suspenso'→'suspended', 'Lote Devolvido'→'returned'
      winning_bid_value: parse "R$ 1.854,00" → decimal
      outcome_scrape_date: now()

    C) Detect catalog/atualizado updates for ACTIVE auctions:
      For each arquivo in arquivosPublicados where tipoArquivo = 'Catálogo Atualizado':
        → Check if auctions.has_catalogo_atualizado = true for this coLeilao
        → If false: download PDF → LLM extract → update lots in this auction
                     → set has_catalogo_atualizado = true, catalogo_atualizado_url = url
```

---

### Mode 5: `edital` (LLM Processing)

**Schedule:** Triggered when new auction_code is encountered

**Purpose:** Download Edital PDF, extract rules via LLM, store in auctions table.

```
Trigger: new auction_code found (not in auctions table)

Step 1: Get any lot from this auction that has arquivosPublicados with tipoArquivo = 'Edital'
        Extract the 'nome' field (file ID)

Step 2: Download PDF:
  GET /arquivos/{editalId}
  → Save to Supabase Storage

Step 3: LLM Extract (Claude/GPT-4o):
  Prompt: "Extraia deste Edital de leilão de joias CAIXA os seguintes dados em JSON:
    auction_code, result_date, bid_increment_rule, payment_method,
    payment_deadline_days, pickup_deadline_days, penalty_clause,
    centralizer_unit, gilie_code, contact_email"

Step 4: Upsert auctions table with extracted fields + edital_pdf_url

Step 5: Link all lots in this coLeilao to auction_id
```

---

## Image URL Construction

Lot images come as relative paths. Full URL construction:

```
Base: https://servicebus2.caixa.gov.br/vitrinedejoias
Example: /0262/0/0262213000309370/FRENTEP.JPG
Full:  https://servicebus2.caixa.gov.br/vitrinedejoias/0262/0/0262213000309370/FRENTEP.JPG
```

Similarly for catalog/edital files:
```
GET /arquivos/{nome}  →  https://servicebus2.caixa.gov.br/vitrinedejoias/api/arquivos/{nome}
```

---

## File Download Function

```js
async function downloadFile(fileId, tipoArquivo, destination) {
  // fileId: the 'nome' field from arquivosPublicados
  // tipoArquivo: 'Edital', 'Catálogo', 'Catálogo Atualizado'
  // destination: local path or Supabase Storage path

  const url = `https://servicebus2.caixa.gov.br/vitrinedejoias/api/arquivos/${fileId}`;
  const response = await fetch(url, { headers: STANDARD_HEADERS });
  const buffer = await response.arrayBuffer();

  // Optionally compress images with Sharp before upload
  // For PDFs: store as-is

  // Upload to Supabase Storage
  await supabase.storage.from('joias-files').upload(destination, buffer, {
    contentType: getMimeType(fileId)
  });

  return destination;
}
```

---

## Conflict Handling

| Field Set By | Written In Mode | Notes |
|---|---|---|
| lot metadata (de_contrato, valor, etc.) | `active-lots` | Non-destructive upsert |
| outcome_status, winning_bid_value | `results` | Overwrites if re-scrape |
| description_source, catalogo_pdf_url | `results` + `edital` | Re-process if newer version |

**No conflicts** because metadata and outcomes are written in separate scrape modes.

---

## Batch / Queue Strategy

For scale, runs are queued:

```
bid-periods → discovers new (city, period) pairs → queues active-lots for those
active-lots  → discovers new co_leilao → queues edilal if not processed
results      → discovers new auction_code → queues edilal if not processed
             → detects catalogo atualizado → queues re-extract for affected lots
edital       → LLM processing, slow → separate queue
```

Simplest implementation: sequential Node.js script, no queue. Add Redis/BullMQ only if scraping exceeds 30min runtime.

---

## Error Handling & Retry

- HTTP 429 (rate limit): wait 60s, retry up to 3x with exponential backoff
- HTTP 5xx: log error, continue to next item, retry on next run
- Empty response: log warning, skip
- Missing lot match in results: log `lot_number + contract_number` to `scrape_log.errors`

---

## Scrape Log

Every run writes to `scrape_log`:
```sql
INSERT INTO scrape_log (job_name, city_id, auction_code, items_found, items_new, items_updated, errors, duration_ms, started_at, completed_at)
```

Use this to audit coverage and diagnose missing data.

---

## Cron Schedule Summary

```cron
# Weekly: refresh states + cities
0 2 * * 0  node scraper.js --mode=states-cities

# Daily 6am: discover new bid periods
0 6 * * *  node scraper.js --mode=bid-periods

# Every 4h business days: scrape active lots
0 8,12,16 * * 1-5  node scraper.js --mode=active-lots

# Daily 8am: fetch results + detect catalog updates
0 8 * * *  node scraper.js --mode=results

# On-demand for edilal processing (queued by active-lots/results)
node scraper.js --mode=edital --auction-code="119/2026"
```

---

## Next Steps After DB Setup

1. Apply `001_initial_schema.sql` to Supabase
2. Run `states-cities` to populate cities table
3. Run `bid-periods` to discover active periods
4. Run `active-lots` to seed initial lot data
5. Set up cron jobs per schedule above
6. Build edilal queue processor (triggered manually or via queue)