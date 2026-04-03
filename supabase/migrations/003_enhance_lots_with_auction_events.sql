-- Migration: 003_enhance_lots_with_auction_events
-- Description: Add auction_events table and enhance lots with comprehensive fields
-- Author: Claude Code
-- Date: 2026-04-01

-- ============================================================================
-- NEW TABLE: auction_events
-- ============================================================================
-- Parent auction events that contain multiple lots
-- Example: "Leilão de Bens de Apartamentos Decorados - Cury"

CREATE TABLE IF NOT EXISTS auction_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    auctioneer TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'kwara', 'excel', 'braspress', etc.

    -- Event details
    event_type TEXT, -- 'logistica_reversa', 'judicial', 'extrajudicial', 'voluntario'
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled', 'suspended')),

    -- Links and resources
    event_url TEXT, -- Link to auction event page
    edict_url TEXT, -- URL to PDF edict (terms and conditions)
    edict_fetched BOOLEAN DEFAULT FALSE,
    edict_fetched_at TIMESTAMP WITH TIME ZONE,

    -- Location
    location_city TEXT,
    location_state TEXT,
    location_address TEXT,

    -- Timing
    starts_at TIMESTAMP WITH TIME ZONE,
    closes_at TIMESTAMP WITH TIME ZONE,
    actual_closed_at TIMESTAMP WITH TIME ZONE,

    -- Seller information
    seller_name TEXT,
    seller_document TEXT, -- CNPJ/CPF

    -- Statistics
    total_lots INTEGER DEFAULT 0,
    sold_lots INTEGER DEFAULT 0,
    total_value NUMERIC(15,2),
    sold_value NUMERIC(15,2),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    -- Example metadata:
    -- {
    --   "kwara_id": "K-2512",
    --   "listing_id": "1576926801161094701",
    --   "asset_categories": ["moveis", "eletrodomesticos"],
    --   "payment_methods": ["boleto", "pix", "cartao"],
    --   "pickup_info": "Diadema/SP - Agendar horário"
    -- }

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint: same event title from same auctioneer
    CONSTRAINT uq_auction_events_platform_event_id UNIQUE (platform, metadata->>'kwara_id')
);

-- Indexes for auction_events
CREATE INDEX idx_auction_events_auctioneer ON auction_events(auctioneer);
CREATE INDEX idx_auction_events_platform ON auction_events(platform);
CREATE INDEX idx_auction_events_status ON auction_events(status);
CREATE INDEX idx_auction_events_closes_at ON auction_events(closes_at) WHERE closes_at IS NOT NULL;
CREATE INDEX idx_auction_events_location ON auction_events(location_state, location_city);
CREATE INDEX idx_auction_events_metadata ON auction_events USING gin(metadata);

-- Full-text search
CREATE INDEX idx_auction_events_title_search ON auction_events USING gin(to_tsvector('portuguese', title));

-- ============================================================================
-- NEW TABLE: edict_documents
-- ============================================================================
-- Track PDF edict documents and their processing status

CREATE TABLE IF NOT EXISTS edict_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Links
    event_id UUID REFERENCES auction_events(id) ON DELETE CASCADE,
    lot_id UUID REFERENCES lots(id) ON DELETE CASCADE,

    -- Document info
    original_url TEXT NOT NULL, -- URL from auctioneer
    storage_url TEXT, -- URL in Supabase Storage (if downloaded)
    storage_path TEXT, -- Path in bucket

    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fetched', 'processed', 'error')),

    -- Content extraction
    content_text TEXT, -- Extracted text from PDF
    pages_count INTEGER,
    file_size_bytes INTEGER,

    -- AI analysis results
    analysis JSONB DEFAULT '{}',
    -- Example analysis:
    -- {
    --   "hidden_fees": ["taxa_administrativa: 5%", "comissao: 10%"],
    --   "payment_terms": "30 dias após leilão",
    --   "pickup_deadline": "5 dias úteis",
    --   "special_conditions": ["não_inclui_instalacao"]
    -- }

    -- Tracking
    fetched_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Either event_id or lot_id must be set
    CONSTRAINT chk_edict_has_reference CHECK (
        (event_id IS NOT NULL AND lot_id IS NULL) OR
        (event_id IS NULL AND lot_id IS NOT NULL) OR
        (event_id IS NOT NULL AND lot_id IS NOT NULL)
    )
);

-- Indexes for edict_documents
CREATE INDEX idx_edict_documents_event_id ON edict_documents(event_id);
CREATE INDEX idx_edict_documents_lot_id ON edict_documents(lot_id);
CREATE INDEX idx_edict_documents_status ON edict_documents(status);
CREATE INDEX idx_edict_documents_storage_url ON edict_documents(storage_url) WHERE storage_url IS NOT NULL;

-- ============================================================================
-- ALTER TABLE: lots (add new fields)
-- ============================================================================

-- Add auction event relationship
ALTER TABLE lots ADD COLUMN IF NOT EXISTS auction_event_id UUID REFERENCES auction_events(id) ON DELETE SET NULL;

-- Add platform tracking
ALTER TABLE lots ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'kwara';

-- Add enhanced category fields
ALTER TABLE lots ADD COLUMN IF NOT EXISTS category_primary TEXT; -- Main category
ALTER TABLE lots ADD COLUMN IF NOT EXISTS category_secondary TEXT; -- Subcategory
ALTER TABLE lots ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'; -- Flexible tagging

-- Add status field
ALTER TABLE lots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'sold', 'unsold', 'cancelled'));

-- Add bidding details
ALTER TABLE lots ADD COLUMN IF NOT EXISTS starting_bid NUMERIC(15,2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS min_bid_increment NUMERIC(15,2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS bids_count INTEGER DEFAULT 0;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS bids_history JSONB DEFAULT '[]';
ALTER TABLE lots ADD COLUMN IF NOT EXISTS winning_bid NUMERIC(15,2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS winning_bidder TEXT;

-- Add estimated value
ALTER TABLE lots ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(15,2);

-- Add condition
ALTER TABLE lots ADD COLUMN IF NOT EXISTS condition TEXT CHECK (condition IN ('new', 'used', 'refurbished', 'damaged', 'unknown'));

-- Add seller info
ALTER TABLE lots ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS seller_document TEXT;

-- Add multiple images support
ALTER TABLE lots ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE lots ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Add detailed location
ALTER TABLE lots ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS location_zipcode TEXT;

-- Add payment/pickup info
ALTER TABLE lots ADD COLUMN IF NOT EXISTS payment_methods TEXT[];
ALTER TABLE lots ADD COLUMN IF NOT EXISTS pickup_info TEXT;

-- Add tracking fields
ALTER TABLE lots ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS source_url TEXT; -- Original URL from auctioneer

-- Add scraper metadata
ALTER TABLE lots ADD COLUMN IF NOT EXISTS scraper_version TEXT DEFAULT '1.0';
ALTER TABLE lots ADD COLUMN IF NOT EXISTS scraper_run_id UUID; -- Link to scraper_logs table

-- Indexes for new lots fields
CREATE INDEX idx_lots_auction_event_id ON lots(auction_event_id);
CREATE INDEX idx_lots_platform ON lots(platform);
CREATE INDEX idx_lots_status ON lots(status);
CREATE INDEX idx_lots_seller_name ON lots(seller_name);
CREATE INDEX idx_lots_tags ON lots USING gin(tags);
CREATE INDEX idx_lots_first_seen_at ON lots(first_seen_at DESC);
CREATE INDEX idx_lots_category_primary ON lots(category_primary);
CREATE INDEX idx_lots_category_secondary ON lots(category_secondary);

-- ============================================================================
-- NEW TABLE: categories (for categorization hierarchy)
-- ============================================================================
-- Centralized category management with synonyms

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,

    -- Categorization
    primary_category BOOLEAN DEFAULT FALSE, -- Is this a top-level category?
    display_order INTEGER DEFAULT 0,

    -- UI settings
    icon TEXT, -- Icon name for UI
    color TEXT, -- Hex color for UI

    -- Metadata
    description TEXT,
    synonyms TEXT[] DEFAULT '{}', -- Alternative names
    keywords TEXT[] DEFAULT '{}', -- Search keywords

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for categories
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_primary ON categories(primary_category);
CREATE INDEX idx_categories_synonyms ON categories USING gin(synonyms);
CREATE INDEX idx_categories_keywords ON categories USING gin(keywords);

-- Insert initial categories
INSERT INTO categories (name, slug, primary_category, display_order, icon, color, description, synonyms, keywords) VALUES
('Móveis', 'moveis', true, 1, 'armchair', '#8B5CF6', 'Furniture and home furnishings', ARRAY['mobília', 'mobiliario'], ARRAY['armário', 'estante', 'mesa', 'cadeira', 'sofá', 'poltrona', 'cama', 'colchão']),
('Eletrodomésticos', 'eletrodomesticos', true, 2, 'appliance', '#EC4899', 'Home appliances', ARRAY['aparelho', 'utensílio'], ARRAY['geladeira', 'refrigerador', 'fogão', 'microondas', 'lavadora', 'ar_condicionado']),
('Eletrônicos', 'eletronicos', true, 3, 'monitor', '#3B82F6', 'Electronic devices', ARRAY['eletrônico'], ARRAY['tv', 'televisor', 'computador', 'notebook', 'celular', 'tablet']),
('Veículos', 'veiculos', true, 4, 'car', '#EF4444', 'Vehicles and transportation', ARRAY['veículo', 'transporte'], ARRAY['carro', 'moto', 'caminhão', 'ônibus']),
('Máquinas e Equipamentos', 'maquinas_equipamentos', true, 5, 'settings', '#F59E0B', 'Industrial equipment and machinery', ARRAY['industrial', 'equipamento'], ARRAY['bomba', 'compressor', 'motor', 'gerador', 'betoneira']),
('Metais', 'metais', true, 6, 'wrench', '#6366F1', 'Metals and raw materials', ARRAY['metal', 'siderurgico'], ARRAY['ferro', 'aço', 'cobre', 'alumínio', 'chapa', 'tubo', 'barra']),
('Casa e Decoração', 'casa_e_decoracao', true, 7, 'home', '#10B981', 'Home decoration and accessories', ARRAY['decoração', 'utensílios'], ARRAY['tapete', 'cortina', 'espelho', 'vaso', 'quadro', 'luminária']),
('Ferramentas', 'ferramentas', true, 8, 'tool', '#8B5A2B', 'Tools and hardware', ARRAY['ferramenta'], ARRAY['martelo', 'serra', 'furadeira', 'parafusadeira', 'chave'])
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- NEW TABLE: scraper_logs (enhanced)
-- ============================================================================
-- Track scraper execution with more detail

CREATE TABLE IF NOT EXISTS scraper_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auctioneer TEXT NOT NULL,
    platform TEXT NOT NULL,

    -- Run details
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),

    -- Results
    lots_found INTEGER DEFAULT 0,
    lots_created INTEGER DEFAULT 0,
    lots_updated INTEGER DEFAULT 0,
    lots_failed INTEGER DEFAULT 0,

    -- Statistics
    total_value NUMERIC(15,2),
    categories_found JSONB DEFAULT '{}', -- { "moveis": 10, "eletrodomesticos": 5 }

    -- Error tracking
    errors JSONB DEFAULT '[]', -- Array of error objects
    error_message TEXT,

    -- Configuration
    scraper_version TEXT,
    config JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for scraper_logs
CREATE INDEX idx_scraper_logs_platform ON scraper_logs(platform);
CREATE INDEX idx_scraper_logs_status ON scraper_logs(status);
CREATE INDEX idx_scraper_logs_started_at ON scraper_logs(started_at DESC);
CREATE INDEX idx_scraper_logs_errors ON scraper_logs USING gin(errors);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Update auction_events stats when lots change
CREATE OR REPLACE FUNCTION update_auction_event_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment total lots
        UPDATE auction_events
        SET total_lots = COALESCE(total_lots, 0) + 1
        WHERE id = NEW.auction_event_id;

        -- Update total value
        IF NEW.current_bid IS NOT NULL THEN
            UPDATE auction_events
            SET total_value = COALESCE(total_value, 0) + NEW.current_bid
            WHERE id = NEW.auction_event_id;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Recalculate if status changed to sold
        IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sold' THEN
            UPDATE auction_events
            SET sold_lots = COALESCE(sold_lots, 0) + 1,
                sold_value = COALESCE(sold_value, 0) + COALESCE(NEW.winning_bid, NEW.current_bid, 0)
            WHERE id = NEW.auction_event_id;
        END IF;

        -- Update total value if bid changed
        IF OLD.current_bid IS DISTINCT FROM NEW.current_bid THEN
            UPDATE auction_events
            SET total_value = COALESCE(total_value, 0) - COALESCE(OLD.current_bid, 0) + COALESCE(NEW.current_bid, 0)
            WHERE id = NEW.auction_event_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auction_event_stats_trigger
    AFTER INSERT OR UPDATE ON lots
    FOR EACH ROW
    WHEN (NEW.auction_event_id IS NOT NULL)
    EXECUTE FUNCTION update_auction_event_stats();

-- Update updated_at trigger
CREATE TRIGGER update_auction_events_updated_at
    BEFORE UPDATE ON auction_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_edict_documents_updated_at
    BEFORE UPDATE ON edict_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraper_logs_updated_at
    BEFORE UPDATE ON scraper_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: auction_events_with_lots_count
CREATE OR REPLACE VIEW auction_events_with_lots_count AS
SELECT
    ae.*,
    COUNT(DISTINCT l.id) AS actual_lots_count,
    SUM(CASE WHEN l.status = 'sold' THEN 1 ELSE 0 END) AS actual_sold_lots,
    SUM(COALESCE(l.current_bid, 0)) AS actual_total_value
FROM auction_events ae
LEFT JOIN lots l ON l.auction_event_id = ae.id
GROUP BY ae.id;

-- View: lots_with_event_details
CREATE OR REPLACE VIEW lots_with_event_details AS
SELECT
    l.*,
    ae.title AS auction_event_title,
    ae.seller_name,
    ae.location_city AS event_city,
    ae.location_state AS event_state,
    ae.status AS event_status
FROM lots l
LEFT JOIN auction_events ae ON ae.id = l.auction_event_id;

-- View: active_lots_for_map
CREATE OR REPLACE VIEW active_lots_for_map AS
SELECT
    l.id,
    l.title,
    l.category_primary,
    l.current_bid,
    l.location_lat,
    l.location_lng,
    l.location_city,
    l.location_state,
    l.primary_image_url,
    l.auctioneer,
    l.status,
    l.closing_at,
    ae.title AS auction_event_title
FROM lots l
LEFT JOIN auction_events ae ON ae.id = l.auction_event_id
WHERE l.status = 'active'
  AND l.closing_at > CURRENT_TIMESTAMP
  AND l.location_lat IS NOT NULL
  AND l.location_lng IS NOT NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE auction_events IS 'Parent auction events containing multiple lots';
COMMENT ON TABLE edict_documents IS 'PDF edict documents with extraction and analysis tracking';
COMMENT ON TABLE categories IS 'Centralized category management with hierarchy';
COMMENT ON TABLE scraper_logs IS 'Scraper execution logs with detailed statistics';

COMMENT ON COLUMN auction_events.metadata IS 'Flexible JSONB for platform-specific data (kwara_id, listing_id, etc.)';
COMMENT ON COLUMN edict_documents.analysis IS 'AI-extracted insights from edict PDF (fees, terms, conditions)';
COMMENT ON COLUMN lots.bids_history IS 'Historical bid data for price trend analysis';
COMMENT ON COLUMN lots.tags IS 'Flexible tagging system for advanced filtering';
COMMENT ON COLUMN lots.scraper_run_id IS 'Link to scraper_logs table for traceability';
