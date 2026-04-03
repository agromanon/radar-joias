# Enhanced Database Schema - Complete Guide

## Overview

The database has been significantly enhanced to support all Radar Leilão features with comprehensive auction data tracking, edict document management, and AI analysis capabilities.

---

## New Tables & Relationships

### 1. `auction_events` (Parent Auctions)

**Purpose:** Group lots that belong to the same auction event

**Example:**
```json
{
  "title": "Leilão de Bens de Apartamentos Decorados - Cury",
  "auctioneer": "Kwara",
  "platform": "kwara",
  "status": "active",
  "closes_at": "2026-04-02T17:00:00Z",
  "total_lots": 12,
  "seller_name": "Cury Incorporações"
}
```

**Key Fields:**
- `title` - Auction event name
- `platform` - 'kwara', 'excel', 'braspress', etc.
- `status` - 'active', 'closed', 'cancelled', 'suspended'
- `edict_url` - Link to auction PDF edict
- `edict_fetched` - Whether PDF has been downloaded
- `total_lots` - Number of lots in event
- `metadata` - Platform-specific data (kwara_id, listing_id, etc.)

**Relationship:**
- One `auction_event` → Many `lots`

---

### 2. `edict_documents` (PDF Edicts)

**Purpose:** Track auction edict PDFs and their AI analysis

**Features:**
- Stores original URL and Supabase Storage URL
- Tracks fetch/processing status
- Stores extracted text content
- Stores AI analysis results (hidden fees, terms, conditions)

**Example Analysis:**
```json
{
  "hidden_fees": ["taxa_administrativa: 5%", "comissao: 10%"],
  "payment_terms": "30 dias após leilão",
  "pickup_deadline": "5 dias úteis",
  "special_conditions": ["não_inclui_instalacao"]
}
```

**Use Cases:**
- Radar Copilot analyzes edict when user asks about fees
- Risk assessment based on terms and conditions
- ROI calculation with all costs included

**Status Flow:**
```
pending → fetched → processed
          ↓
        error
```

---

### 3. `lots` (Enhanced)

**New Fields Added:**

#### Auction Relationship
- `auction_event_id` - Links to parent auction event
- `platform` - Which platform scraped it ('kwara', 'excel', etc.)

#### Enhanced Categories
- `category_primary` - Main category (from categories table)
- `category_secondary` - Subcategory for filtering
- `tags` - Array of tags for flexible search

#### Bidding Data
- `starting_bid` - Initial bid amount
- `min_bid_increment` - Minimum bid increase
- `bids_count` - Number of bids placed
- `bids_history` - Historical bid data JSON
- `winning_bid` - Final sale price
- `winning_bidder` - Winner information

#### Condition & Seller
- `condition` - 'new', 'used', 'refurbished', 'damaged'
- `seller_name` - Auction house name
- `seller_document` - CNPJ/CPF

#### Images & Media
- `images` - Array of all image URLs
- `primary_image_url` - Main display image

#### Location (Enhanced)
- `location_address` - Full address
- `location_zipcode` - CEP (Brazilian postal code)

#### Payment & Pickup
- `payment_methods` - Accepted payment types
- `pickup_info` - Pickup instructions

#### Tracking
- `first_seen_at` - When scraper first found it
- `last_seen_at` - Last time scraper saw it
- `source_url` - Original URL on auctioneer site
- `scraper_run_id` - Links to scraper_logs table
- `scraper_version` - Which scraper version found it

---

### 4. `categories` (Centralized)

**Purpose:** Unified category management across all platforms

**Hierarchy:**
```
Móveis (primary)
  └─ Sofás e Poltronas (secondary)
      └─ Tags: ['madeira', 'couro', 'reclinável']
```

**Features:**
- `name` - Display name
- `slug` - URL-friendly identifier
- `parent_id` - For subcategories
- `icon` - Icon name for UI
- `color` - Hex color for UI
- `synonyms` - Alternative names for matching
- `keywords` - Search keywords

**Pre-populated Categories:**
1. Móveis (Furniture)
2. Eletrodomésticos (Appliances)
3. Eletrônicos (Electronics)
4. Veículos (Vehicles)
5. Máquinas e Equipamentos (Industrial Equipment)
6. Metais (Metals)
7. Casa e Decoração (Home Decoration)
8. Ferramentas (Tools)

---

### 5. `scraper_logs` (Enhanced)

**New Fields:**
- `platform` - Which platform was scraped
- `lots_failed` - Count of lots that failed to parse
- `categories_found` - JSON with category breakdown
- `total_value` - Sum of all lot values
- `errors` - Array of error objects with details
- `config` - Scraper configuration used

---

## Key Features Enabled

### 1. **Edict PDF Management**
```python
# Store link only
lot.edict_url = "https://cdn.kwara.com.br/listing-terms/xxx.pdf"

# AI Agent fetches when needed
if user_asks_about_edict(lot_id):
    pdf_text = fetch_edict(lot.edict_url)
    analysis = analyze_with_ai(pdf_text)
```

**Benefits:**
- Save storage space (store URL, not file)
- Fetch on-demand when AI needs it
- Cache analysis results in database
- Track fetch status to avoid re-fetching

### 2. **Auction Event Grouping**
```python
# Get all lots from same auction
event = get_auction_event(lot.auction_event_id)
all_lots = get_lots_for_event(event.id)

# Show event statistics
print(f"Event: {event.title}")
print(f"Total lots: {event.total_lots}")
print(f"Sold: {event.sold_lots}")
print(f"Total value: R$ {event.total_value}")
```

**Benefits:**
- Better organization of related lots
- Event-level statistics
- Easier to show "similar lots from same auction"

### 3. **Enhanced Search & Filtering**
```python
# Search by primary category
lots = lots.filter(category_primary='Móveis')

# Search by tags
lots = lots.filter(tags=['madeira', 'montado'])

# Search by condition
lots = lots.filter(condition='usado')

# Search by price range
lots = lots.filter(current_bid_between=(1000, 5000))

# Combined search
lots = lots.filter(
    category_primary='Móveis',
    tags=['madeira'],
    location_state='SP'
)
```

### 4. **Geolocation & Maps**
```python
# Get lots for map visualization
lots = get_lots_for_map()
# Returns: lots with location_lat, location_lng

# Filter by state
lots_sp = lots.filter(location_state='SP')

# Filter by city
lots_saopaulo = lots.filter(location_city='São Paulo')
```

### 5. **Bid History & Trends**
```python
# Track bid history
lot.bids_history = [
    {"timestamp": "2026-04-01T10:00:00Z", "bid": 1000, "bidder": "user1"},
    {"timestamp": "2026-04-01T10:05:00Z", "bid": 1200, "bidder": "user2"},
    {"timestamp": "2026-04-01T10:10:00Z", "bid": 1500, "bidder": "user3"}
]

# Calculate price trend
price_increase = lot.winning_bid - lot.starting_bid
percentage_increase = (price_increase / lot.starting_bid) * 100
```

### 6. **Watchlist Integration**
```python
# Add to watchlist
add_to_watchlist(user_id, lot_id, notes="Interessante para escritório")

# Get watchlist with lot details
watchlist = get_user_watchlist(user_id)
# Returns lots with full details including current bids, status, etc.

# Check if lot is in watchlist
is_saved = check_watchlist(user_id, lot_id)
```

### 7. **Alert Matching**
```python
# Create alert with complex criteria
alert = {
    "name": "Móveis em São Paulo",
    "categories": ["Móveis"],
    "states": ["SP"],
    "min_bid": 500,
    "max_bid": 5000,
    "tags": ["madeira"],
    "risk_scores": ["BAIXO", "MÉDIO"]
}

# System automatically matches new lots to alerts
# Sends notifications when matches found
```

---

## Database Views

### `auction_events_with_lots_count`
Shows auction events with real-time lot statistics.

### `lots_with_event_details`
Shows lots with parent auction event information.

### `active_lots_for_map`
Pre-filtered view for map visualization (only active lots with coordinates).

---

## Migration Steps

### 1. Apply Migration
```bash
# Using Supabase CLI
supabase migration up --file supabase/migrations/003_enhance_lots_with_auction_events.sql
```

### 2. Verify Schema
```sql
-- Check new tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('auction_events', 'edict_documents', 'categories');

-- Check new columns on lots
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lots'
  AND column_name IN ('auction_event_id', 'platform', 'category_primary', 'tags');
```

### 3. Test Scraper
```bash
cd scrapers
python3 run_kwara_with_db.py
```

---

## AI Agent Integration

### How Radar Copilot Uses Edict Documents

**User Question:** "Quais são os custos ocultos deste lote?"

**Flow:**
1. Check if `edict_documents` has analysis for this lot
2. If not, fetch PDF from `lot.edict_url`
3. Extract text from PDF
4. Analyze with AI model
5. Save analysis to `edict_documents.analysis`
6. Return formatted answer to user

**Example Response:**
```
Baseado no edital oficial:

💰 Taxas e Custos:
• Taxa administrativa: 5%
• Comissão leiloeiro: 10%
• IOF: 2% sobre arremate

📋 Condições:
• Pagamento: 30 dias após leilão
• Retirada: 5 dias úteis (Diadema/SP)
• Não inclui instalação

⚠️ Riscos:
• Bem pode ter danos não especificados
• Responsabilidade por transporte do comprador
```

---

## Performance Considerations

### Indexes Created
- Geographic queries: `idx_lots_location`
- Category filtering: `idx_lots_category_primary`, `idx_lots_category_secondary`
- Tag search: `idx_lots_tags` (GIN index)
- Full-text search: `idx_lots_title_search`
- JSONB queries: `idx_lots_metadata` (GIN index)

### Query Optimization
```sql
-- Fast category filter
SELECT * FROM lots
WHERE category_primary = 'Móveis'
  AND status = 'active'
  AND closing_at > CURRENT_TIMESTAMP
LIMIT 20;

-- Fast tag search
SELECT * FROM lots
WHERE 'madeira' = ANY(tags)
  AND location_state = 'SP';

-- Full-text search
SELECT * FROM lots
WHERE to_tsvector('portuguese', title) @@ to_tsquery('portuguese', 'armário | gaveta');
```

---

## Summary

**✅ Enhanced Schema Supports:**
1. Auction event grouping (lots belong to auctions)
2. Edict PDF management (store link, fetch on-demand)
3. AI analysis tracking (store results in database)
4. Enhanced categorization (primary, secondary, tags)
5. Bid history tracking (price trends)
6. Comprehensive location data (maps feature)
7. Watchlist integration (user saved lots)
8. Alert matching (complex criteria)
9. Scraper tracking (audit trail)
10. Multi-platform support (kwara, excel, braspress, etc.)

**🚀 Ready for:**
- Radar Copilot AI analysis
- Map visualization with heat maps
- Watchlist and alerts features
- Bid history and price trends
- Risk assessment with edict terms
- Multi-auctioneer comparison

The scraper now saves **comprehensive data** for all Radar Leilão features!
