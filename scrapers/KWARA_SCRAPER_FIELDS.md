# Kwara Scraper - Database Fields Mapping

## Quick Reference: What Gets Saved to Database

For each lot scraped from Kwara, the following fields are populated:

---

## Core Fields (Always Present)

| Field | Example | Source |
|-------|---------|--------|
| `title` | "Armário suspenso com 10 portas..." | API: listing.title + item.title |
| `auctioneer` | "Kwara" | Hardcoded |
| `platform` | "kwara" | Hardcoded |
| `status` | "active" | Hardcoded (will update when auction closes) |
| `category` | "moveis" | Keyword matching |
| `category_primary` | "Móveis" | Enhanced category system |
| `category_secondary` | "Armários e Estantes" | Enhanced category system |
| `tags` | ["madeira", "montado"] | Keyword extraction |
| `description` | Full description text | API: listing.description |
| `current_bid` | 1120.00 | API: cachedPriceAmountCents / 100 |
| `starting_bid` | 1000.00 | API: feeStructure lowest tier |
| `estimated_value` | 1120.00 | Same as current_bid (for now) |

---

## Location Fields

| Field | Example | Source |
|-------|---------|--------|
| `location` | "São Paulo/SP" | API: listing.location |
| `location_city` | "São Paulo" | Parsed from location |
| `location_state` | "SP" | Parsed from location |
| `location_lat` | NULL | Not provided by Kwara API |
| `location_lng` | NULL | Not provided by Kwara API |

**Note:** Geolocation (lat/lng) not available in Kwara API - would need geocoding service.

---

## Bidding Fields

| Field | Example | Source |
|-------|---------|--------|
| `bids_count` | 44 | API: cachedBidsCount |
| `min_bid_increment` | NULL | Not provided by Kwara API |
| `winning_bid` | NULL | Auction not closed yet |
| `winning_bidder` | NULL | Auction not closed yet |
| `bids_history` | [] | Empty array (would need scraping) |

---

## Auction Event Fields

| Field | Example | Source |
|-------|---------|--------|
| `auction_event_id` | NULL | Not created yet (future enhancement) |
| `seller_name` | "Teixeira Duarte" | API: listing.sellerName |
| `seller_document` | NULL | Not provided by Kwara API |

---

## Media Fields

| Field | Example | Source |
|-------|---------|--------|
| `image_url` | "https://cdn.kwara.com.br/..." | API: images[0] |
| `primary_image_url` | "https://cdn.kwara.com.br/..." | API: images[0] |
| `images` | ["url1", "url2", ...] | API: images array |
| `edict_url` | "https://cdn.kwara.com.br/terms/..." | API: listing.termsUrl |

---

## Timing Fields

| Field | Example | Source |
|-------|---------|--------|
| `closing_at` | "2026-04-13T19:00:00Z" | API: listing.scheduledEndAt |
| `first_seen_at` | "2026-04-01T..." | Auto-generated (now) |
| `last_seen_at` | "2026-04-01T..." | Auto-generated (now) |
| `source_url` | "https://www.kwara.com.br/lote/..." | Generated from slug |

---

## Risk & Condition Fields

| Field | Example | Source |
|-------|---------|--------|
| `risk_score` | "medium" | Calculated by base class |
| `condition` | NULL | Not provided by Kwara API |

---

## Metadata (JSONB)

**Stores all raw API data for flexibility:**

```json
{
  "listing_id": "1578137092788062004",
  "item_id": "1578137092788062004",
  "status": "OPEN",
  "type": "LOT",
  "kwara_id": "K-2512",
  "slug": "armario-suspenso-10-portas",
  "views": 123,
  "is_public": true,
  "asset_category_id": "1335572015838398043",
  "check_out_type": "PICK_UP_V0",
  "cached_price_cents": 112000,
  "created_at": "2026-03-18T12:56:36.079Z"
}
```

---

## What's NOT Available from Kwara API

The following fields exist in schema but **cannot be populated from Kwara API**:

| Field | Reason |
|-------|--------|
| `location_lat` / `location_lng` | Not provided (would need geocoding service) |
| `min_bid_increment` | Not provided in API |
| `winning_bid` | Auction not closed yet |
| `winning_bidder` | Auction not closed yet |
| `bids_history` | Would need real-time scraping during auction |
| `condition` | Not provided by Kwara |
| `payment_methods` | Would need to fetch from edict PDF |
| `pickup_info` | Would need to fetch from edict PDF |
| `location_address` | Not provided (only city/state) |
| `location_zipcode` | Not provided |

**Solution:** These fields can be populated later by:
1. Fetching and analyzing edict PDF (edict_documents table)
2. Geocoding service (Google Maps API, etc.)
3. Real-time auction monitoring (future enhancement)

---

## Category Mapping Logic

### Primary Category (category_primary)

**Rules (checked in order):**
1. If contains 'armário', 'estante', 'mesa', 'cadeira', 'sofá' → **Móveis**
2. If contains 'geladeira', 'refrigerador', 'fogão' → **Eletrodomésticos**
3. If contains 'tv', 'computador', 'celular' → **Eletrônicos**
4. If contains 'carro', 'moto', 'caminhão' → **Veículos**
5. If contains 'bomba', 'compressor', 'motor' → **Máquinas e Equipamentos**
6. If contains 'ferro', 'aço', 'metal' → **Metais**
7. If contains 'tapete', 'cortina', 'espelho' → **Casa e Decoração**
8. If contains 'martelo', 'serra', 'furadeira' → **Ferramentas**
9. Else → **Outros**

### Secondary Category (category_secondary)

**Rules (checked within primary category):**

**Móveis:**
- 'sofá' or 'poltrona' → **Sofás e Poltronas**
- 'cama' or 'colchão' → **Camas e Colchões**
- 'armário' or 'estante' → **Armários e Estantes**
- 'mesa' or 'cadeira' → **Mesas e Cadeiras**

**Eletrodomésticos:**
- 'geladeira' or 'refrigerador' → **Refrigeração**
- 'fogão', 'cooktop', 'forno' → **Cozinha**
- 'ar_condicionado' or 'condicionador' → **Climatização**

### Tags (Automatic)

**Material tags:**
- 'madeira' - if contains 'madeira', 'mdf', 'compensado'
- 'metal' - if contains 'metal', 'aço', 'ferro', 'alumínio'
- 'vidro' - if contains 'vidro', 'espelho'
- 'pedra' - if contains 'pedra', 'granito', 'mármore'
- 'tecido' - if contains 'tecido', 'couro', 'courino'

**Condition tags:**
- 'novo' - if 'novo' or 'nunca usado'
- 'usado' - if 'usado'
- 'reformado' - if 'reformado' or 'restaurado'

**Feature tags:**
- 'com_pano' - if 'pano'
- 'eletrificado' - if 'elétrico' or 'eletrônico'
- 'montado' - if 'montado'

---

## Example: Complete Lot Record

```json
{
  "id": "uuid-here",
  "title": "Armário suspenso com 10 portas, nicho em pedra com cuba dupla",
  "auctioneer": "Kwara",
  "platform": "kwara",
  "category": "moveis",
  "category_primary": "Móveis",
  "category_secondary": "Armários e Estantes",
  "tags": ["madeira", "vidro", "pedra"],
  "description": "Armário suspenso com 10 portas...",
  "current_bid": 1120.00,
  "starting_bid": 1000.00,
  "estimated_value": 1120.00,
  "bids_count": 44,
  "status": "active",
  "risk_score": "medium",

  "location": "São Paulo/SP",
  "location_city": "São Paulo",
  "location_state": "SP",

  "image_url": "https://cdn.kwara.com.br/images/...",
  "primary_image_url": "https://cdn.kwara.com.br/images/...",
  "images": ["https://cdn.kwara.com.br/images/1.jpg", "https://cdn.kwara.com.br/images/2.jpg"],

  "edict_url": "https://cdn.kwara.com.br/listing-terms/xxx.pdf",

  "closing_at": "2026-04-13T19:00:00Z",
  "seller_name": "Teixeira Duarte",

  "source_url": "https://www.kwara.com.br/lote/armario-suspenso",

  "first_seen_at": "2026-04-01T14:30:00Z",
  "last_seen_at": "2026-04-01T14:30:00Z",

  "metadata": {
    "listing_id": "1578137092788062004",
    "kwara_id": "K-2512",
    "slug": "armario-suspenso-10-portas",
    "views": 123,
    "cached_price_cents": 112000
  }
}
```

---

## Summary

**✅ What Gets Saved:**
- 30+ fields per lot
- Enhanced categorization (primary, secondary, tags)
- Full auction metadata
- Seller information
- All image URLs
- Edict PDF links
- Bid counts and pricing

**📊 Coverage:**
- 100% of lots have: title, auctioneer, category, price, images, edict URL, closing date
- 100% of lots have: Enhanced categorization
- 100% of lots have: Seller name
- 0% of lots have: Geolocation (not provided by API)

**🚀 Ready For:**
- Search and filtering
- Category browsing
- Watchlist saving
- Alert matching
- Map display (city/state level)
- Edict PDF fetching (on-demand)
- AI analysis (with edict data)

The scraper now saves **comprehensive data** for each lot!
