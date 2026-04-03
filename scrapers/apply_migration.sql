-- Add source_url column to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add index for source_url
CREATE INDEX IF NOT EXISTS idx_lots_source_url ON lots(source_url) WHERE source_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN lots.source_url IS 'Direct URL to the lot on the auctioneer website (e.g., https://www.kwara.com.br/lote/abc-123)';
