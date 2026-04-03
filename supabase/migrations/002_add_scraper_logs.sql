-- Migration: 002_add_scraper_logs
-- Description: Add scraper monitoring table
-- Author: Claude Code
-- Date: 2026-04-01

-- ============================================================================
-- TABLE: scraper_logs
-- ============================================================================
-- Logs scraper execution for monitoring and debugging

CREATE TABLE IF NOT EXISTS scraper_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auctioneer TEXT NOT NULL,
    lots_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
    error TEXT,
    ran_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying recent scraper runs
CREATE INDEX idx_scraper_logs_ran_at ON scraper_logs(ran_at DESC);

-- Index for querying by auctioneer
CREATE INDEX idx_scraper_logs_auctioneer ON scraper_logs(auctioneer);

-- Index for querying by status
CREATE INDEX idx_scraper_logs_status ON scraper_logs(status);

-- RLS Policies
ALTER TABLE scraper_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (scrapers use service role key)
CREATE POLICY "Service role can insert scraper logs"
    ON scraper_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Authenticated users can read logs (for admin dashboard)
CREATE POLICY "Authenticated users can view scraper logs"
    ON scraper_logs FOR SELECT
    TO authenticated
    USING (true);

-- Comments
COMMENT ON TABLE scraper_logs IS 'Logs from web scraper runs for monitoring';
COMMENT ON COLUMN scraper_logs.auctioneer IS 'Name of the auctioneer (Sodré, Freitas, etc.)';
COMMENT ON COLUMN scraper_logs.lots_count IS 'Number of lots inserted/updated';
COMMENT ON COLUMN scraper_logs.status IS 'success, error, or running';
COMMENT ON COLUMN scraper_logs.ran_at IS 'When the scraper execution started';
