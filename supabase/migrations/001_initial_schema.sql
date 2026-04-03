-- Migration: 001_initial_schema
-- Description: Create initial database schema for Radar Leilão
-- Author: Claude Code
-- Date: 2026-04-01

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: user_profiles
-- ============================================================================
-- Extends Supabase auth.users with application-specific user data
-- Note: This table references auth.users(id) which is created by Supabase Auth

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'war_room')),
    company TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure email is unique across user_profiles
    CONSTRAINT uq_user_profiles_email UNIQUE (email)
);

-- Index for tier-based queries (used for access control)
CREATE INDEX idx_user_profiles_tier ON user_profiles(tier);

-- Index for company-based queries (B2B features)
CREATE INDEX idx_user_profiles_company ON user_profiles(company) WHERE company IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: lots
-- ============================================================================
-- Stores auction lot data scraped from various auctioneers

CREATE TYPE risk_score_enum AS ENUM ('BAIXO', 'MÉDIO', 'ALTO');

CREATE TABLE IF NOT EXISTS lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    auctioneer TEXT NOT NULL,
    current_bid NUMERIC(15,2),
    image_url TEXT,
    risk_score risk_score_enum NOT NULL DEFAULT 'MÉDIO',
    category TEXT NOT NULL, -- Metais, Maquinário, Veículos, etc.
    edict_url TEXT, -- URL to PDF in Supabase Storage
    closing_at TIMESTAMP WITH TIME ZONE,
    location_lat NUMERIC(10,8), -- For map visualization
    location_lng NUMERIC(11,8), -- For map visualization
    location_city TEXT,
    location_state TEXT, -- UF (SP, MG, RJ, etc.)
    description TEXT,
    metadata JSONB DEFAULT '{}', -- Flexible data for scraper-specific fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure closing_at is in the future
    CONSTRAINT chk_lots_closing_at_future CHECK (closing_at IS NULL OR closing_at > CURRENT_TIMESTAMP)
);

-- Indexes for common queries
CREATE INDEX idx_lots_category ON lots(category);
CREATE INDEX idx_lots_auctioneer ON lots(auctioneer);
CREATE INDEX idx_lots_closing_at ON lots(closing_at) WHERE closing_at IS NOT NULL;
CREATE INDEX idx_lots_risk_score ON lots(risk_score);
CREATE INDEX idx_lots_location ON lots(location_state, location_city) WHERE location_state IS NOT NULL;
CREATE INDEX idx_lots_created_at ON lots(created_at DESC);

-- GIN index for metadata JSONB queries
CREATE INDEX idx_lots_metadata ON lots USING gin(metadata);

-- Full-text search index on title and description
CREATE INDEX idx_lots_title_search ON lots USING gin(to_tsvector('portuguese', title));
CREATE INDEX idx_lots_description_search ON lots USING gin(to_tsvector('portuguese', description));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_lots_updated_at
    BEFORE UPDATE ON lots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: watchlist
-- ============================================================================
-- User-saved lots for later review

CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate watchlist entries
    CONSTRAINT uq_watchlist_user_lot UNIQUE (user_id, lot_id)
);

-- Index for user's watchlist queries
CREATE INDEX idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX idx_watchlist_created_at ON watchlist(created_at DESC);

-- ============================================================================
-- TABLE: alerts
-- ============================================================================
-- User-configured alerts for new lots matching criteria

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,

    -- Search criteria (flexible JSONB for complex filters)
    criteria JSONB NOT NULL DEFAULT '{}',
    -- Example criteria structure:
    -- {
    --   "categories": ["Maquinário", "Veículos"],
    --   "states": ["SP", "MG"],
    --   "min_bid": 10000,
    --   "max_bid": 50000,
    --   "risk_scores": ["BAIXO", "MÉDIO"],
    --   "keywords": ["catraca", "esteira"]
    -- }

    -- Alert preferences
    notification_method TEXT DEFAULT 'email' CHECK (notification_method IN ('email', 'push', 'both')),
    notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'hourly', 'daily')),

    -- Tracking
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for user's active alerts
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_is_active ON alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_alerts_last_triggered ON alerts(last_triggered_at DESC);

-- GIN index for criteria JSONB queries
CREATE INDEX idx_alerts_criteria ON alerts USING gin(criteria);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- user_profiles: Users can read their own profile, authenticated users can read all
CREATE POLICY "Users can view all profiles"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- lots: Public read access, no write access (scrapers write via service role)
CREATE POLICY "Public can view lots"
    ON lots FOR SELECT
    TO authenticated, anon
    USING (true);

-- watchlist: Users can read/write own watchlist
CREATE POLICY "Users can view own watchlist"
    ON watchlist FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to own watchlist"
    ON watchlist FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist"
    ON watchlist FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from own watchlist"
    ON watchlist FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- alerts: Users can read/write own alerts
CREATE POLICY "Users can view own alerts"
    ON alerts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
    ON alerts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
    ON alerts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
    ON alerts FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: lots_with_watchlist_status
-- Shows lots with whether current user has them in watchlist
CREATE OR REPLACE VIEW lots_with_watchlist_status AS
SELECT
    l.*,
    CASE WHEN w.user_id IS NOT NULL THEN true ELSE false END AS is_in_watchlist
FROM lots l
LEFT JOIN watchlist w ON w.lot_id = l.id AND w.user_id = auth.uid();

-- View: user_alert_matches
-- Shows lots matching user's alert criteria (used by alert matcher)
CREATE OR REPLACE VIEW user_alert_matches AS
SELECT
    a.id AS alert_id,
    a.user_id,
    l.id AS lot_id,
    l.title,
    l.closing_at,
    a.notification_method,
    a.notification_frequency
FROM alerts a
CROSS JOIN lots l
WHERE a.is_active = true
  AND l.created_at > COALESCE(a.last_triggered_at, '1970-01-01'::timestamp)
  AND (
    -- Category match
    l.category = ANY((a.criteria->>'categories')::text[])
    OR a.criteria ? 'categories' IS FALSE
  )
  AND (
    -- Location match
    l.location_state = ANY((a.criteria->>'states')::text[])
    OR a.criteria ? 'states' IS FALSE
  )
  AND (
    -- Bid range match
    (a.criteria->>'min_bid')::numeric IS NULL
    OR l.current_bid >= (a.criteria->>'min_bid')::numeric
  )
  AND (
    (a.criteria->>'max_bid')::numeric IS NULL
    OR l.current_bid <= (a.criteria->>'max_bid')::numeric
  )
  AND (
    -- Risk score match
    l.risk_score = ANY((a.criteria->>'risk_scores')::text[])
    OR a.criteria ? 'risk_scores' IS FALSE
  );

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'Extended user profile data linked to Supabase Auth';
COMMENT ON TABLE lots IS 'Auction lots scraped from various auctioneers';
COMMENT ON TABLE watchlist IS 'User-saved lots for later review';
COMMENT ON TABLE alerts IS 'User-configured alerts for matching lots';

COMMENT ON COLUMN user_profiles.tier IS 'Subscription tier: free, pro (Engineering B2B), war_room';
COMMENT ON COLUMN lots.risk_score IS 'Risk assessment: BAIXO, MÉDIO, ALTO';
COMMENT ON COLUMN lots.edict_url IS 'URL to PDF edict stored in Supabase Storage';
COMMENT ON COLUMN alerts.criteria IS 'JSONB filter criteria for matching lots';
COMMENT ON COLUMN alerts.last_triggered_at IS 'Last time this alert found matching lots';
