-- Migration: 006_add_kwara_extended_fields
-- Description: Add extended fields for Kwara lot details (two-stage scraping)
-- Author: Claude Code
-- Date: 2026-04-02

-- Add extended lot detail fields
ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS refs TEXT[], -- Referência codes (e.g., ["ab-64672"])
  ADD COLUMN IF NOT EXISTS slug TEXT, -- URL slug for detail pages
  ADD COLUMN IF NOT EXISTS general_observations TEXT, -- Observações gerais
  ADD COLUMN IF NOT EXISTS visiting_observations TEXT, -- Visitação rules
  ADD COLUMN IF NOT EXISTS visiting_address TEXT, -- Visitação location
  ADD COLUMN IF NOT EXISTS pickup_observations TEXT, -- Retirada rules
  ADD COLUMN IF NOT EXISTS pickup_address TEXT, -- Retirada location
  ADD COLUMN IF NOT EXISTS measurements TEXT, -- Medidas/dimensions
  ADD COLUMN IF NOT EXISTS listing_title TEXT, -- Event/auction name
  ADD COLUMN IF NOT EXISTS starting_bid NUMERIC(15,2), -- Lance inicial
  ADD COLUMN IF NOT EXISTS buyer_fee_percentage NUMERIC(5,2), -- Taxa de compra (%)
  ADD COLUMN IF NOT EXISTS minimum_increment NUMERIC(15,2), -- Incremento mínimo
  ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0, -- View count
  ADD COLUMN IF NOT EXISTS bids_count INTEGER DEFAULT 0, -- Number of bids
  ADD COLUMN IF NOT EXISTS seller_name TEXT, -- Vendedor nome
  ADD COLUMN IF NOT EXISTS seller_logo_url TEXT, -- Vendedor logo
  ADD COLUMN IF NOT EXISTS scrape_stage TEXT DEFAULT 'basic' CHECK (scrape_stage IN ('basic', 'detailed')),
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE;

-- Indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_lots_scrape_stage ON lots(scrape_stage) WHERE scrape_stage = 'basic';
CREATE INDEX IF NOT EXISTS idx_lots_slug ON lots(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lots_seller_name ON lots(seller_name) WHERE seller_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lots_last_scraped ON lots(last_scraped_at DESC);

-- Composite index for two-stage scraping workflow
CREATE INDEX IF NOT EXISTS idx_lots_stage_scraped ON lots(scrape_stage, last_scraped_at)
  WHERE scrape_stage = 'basic';

-- Comment to document the scraping workflow
COMMENT ON COLUMN lots.scrape_stage IS 'Scraping stage: basic=search API only, detailed=full lot details fetched';
COMMENT ON COLUMN lots.last_scraped_at IS 'Last time this lot was scraped (for incremental updates)';
COMMENT ON COLUMN lots.refs IS 'Array of reference codes from auctioneer (e.g., ["ab-64672"])';
COMMENT ON COLUMN lots.slug IS 'URL slug for constructing detail page URLs';
COMMENT ON COLUMN lots.starting_bid IS 'Initial/starting bid amount (lance inicial)';
COMMENT ON COLUMN lots.buyer_fee_percentage IS 'Buyer fee/tax percentage charged on winning bids';
COMMENT ON COLUMN lots.minimum_increment IS 'Minimum bid increment (incremento mínimo)';
