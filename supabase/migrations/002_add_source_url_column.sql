-- Migration: 002_add_source_url_column
-- Description: Add source_url column to lots table for direct auction links
-- Author: Claude Code
-- Date: 2026-04-02

-- Add source_url column to lots table
-- This stores the direct URL to the lot on the auctioneer's website
ALTER TABLE lots ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add index for source_url (useful for lookups and deduplication)
CREATE INDEX IF NOT EXISTS idx_lots_source_url ON lots(source_url) WHERE source_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN lots.source_url IS 'Direct URL to the lot on the auctioneer website (e.g., https://www.kwara.com.br/lote/abc-123)';
