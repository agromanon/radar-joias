-- Migration: 005_add_llm_providers
-- Description: Add LLM provider configurations for Radar Copilot
-- Author: Claude Code
-- Date: 2026-04-02

-- ============================================================================
-- TABLE: llm_providers
-- ============================================================================
-- Store LLM provider configurations for AI gateway

CREATE TABLE IF NOT EXISTS llm_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('anthropic', 'openai_compatible')),
    base_url TEXT,
    model TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_fallback BOOLEAN NOT NULL DEFAULT false,
    priority INTEGER NOT NULL DEFAULT 0,
    max_tokens INTEGER DEFAULT 4096,
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying active providers
CREATE INDEX idx_llm_providers_active ON llm_providers(is_active, priority);

-- Index for querying fallback providers
CREATE INDEX idx_llm_providers_fallback ON llm_providers(is_fallback, priority);

-- Unique constraint on provider name
CREATE UNIQUE INDEX idx_llm_providers_name_unique ON llm_providers(name);

-- RLS Policies
ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;

-- Only service role can manage providers
CREATE POLICY "Service role can manage llm providers"
    ON llm_providers FOR ALL
    TO service_role
    USING (true);

-- Authenticated users can view providers (for admin dashboard)
CREATE POLICY "Authenticated users can view llm providers"
    ON llm_providers FOR SELECT
    TO authenticated
    USING (true);

-- Updated timestamp trigger
CREATE TRIGGER update_llm_providers_updated_at
    BEFORE UPDATE ON llm_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE llm_providers IS 'LLM provider configurations for AI gateway routing';
COMMENT ON COLUMN llm_providers.name IS 'Display name for the provider (e.g., "DeepSeek V3", "GPT-4o")';
COMMENT ON COLUMN llm_providers.provider_type IS 'anthropic or openai_compatible';
COMMENT ON COLUMN llm_providers.base_url IS 'Custom base URL for OpenAI-compatible APIs';
COMMENT ON COLUMN llm_providers.model IS 'Model name (e.g., "claude-sonnet-4-20250514", "gpt-4o")';
COMMENT ON COLUMN llm_providers.api_key IS 'API key for the provider';
COMMENT ON COLUMN llm_providers.is_active IS 'Whether this provider is currently enabled';
COMMENT ON COLUMN llm_providers.is_fallback IS 'Whether this provider is used as fallback';
COMMENT ON COLUMN llm_providers.priority IS 'Priority for provider selection (lower = higher priority)';
COMMENT ON COLUMN llm_providers.max_tokens IS 'Maximum tokens for requests';
COMMENT ON COLUMN llm_providers.temperature IS 'Default temperature for requests';
