-- ============================================================
-- PROXY POOL MANAGEMENT
-- ============================================================

-- Proxy pool: tracks working/blocked/replacing status for each WebShare proxy
CREATE TABLE IF NOT EXISTS working_proxies (
  id                  serial PRIMARY KEY,

  -- Proxy identification (from WebShare)
  proxy_address       inet NOT NULL,
  port                int NOT NULL DEFAULT 8082,
  username            text,
  password            text,

  -- Status workflow:
  --   pending   : newly added, awaiting first CAIXA test
  --   active    : tested and working with CAIXA
  --   blocked   : tested 3 times, failed all — pending replacement
  --   replacing : replacement requested via WebShare API, awaiting new proxy
  status              text DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'blocked', 'replacing')),

  -- CAIXA validation
  caixa_tested_at     timestamptz,
  caixa_works          boolean,               -- NULL = untested, true = works, false = blocked

  -- Failure tracking (consecutive failures before marking blocked)
  failure_count       int DEFAULT 0,

  -- WebShare metadata
  webshare_proxy_id   text,                   -- WebShare's internal proxy identifier

  -- Usage tracking
  last_used_at        timestamptz,
  use_count           int DEFAULT 0,

  -- Timestamps
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE (proxy_address, port)
);

CREATE INDEX idx_working_proxies_status ON working_proxies(status);
CREATE INDEX idx_working_proxies_caixa_works ON working_proxies(caixa_works) WHERE caixa_works = true;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_working_proxies_updated_at
  BEFORE UPDATE ON working_proxies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Proxy test history (for auditing and tuning)
CREATE TABLE IF NOT EXISTS proxy_test_log (
  id              serial PRIMARY KEY,
  proxy_id        int REFERENCES working_proxies(id) ON DELETE CASCADE,
  tested_at       timestamptz DEFAULT now(),
  test_url        text,
  response_code   int,
  response_valid  boolean,
  error_message   text,
  duration_ms     int
);

CREATE INDEX idx_proxy_test_log_proxy_id ON proxy_test_log(proxy_id);
CREATE INDEX idx_proxy_test_log_tested_at ON proxy_test_log(tested_at);