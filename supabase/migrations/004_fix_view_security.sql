-- ============================================================================
-- Migration: Fix Security Vulnerability in Views
-- ============================================================================
-- Security Issue: user_alert_matches view returns ALL users' alerts
-- Impact: Users can see other users' alert criteria and matched lots
-- Fix: Add WHERE clause to filter by current user (auth.uid())
-- ============================================================================

-- ============================================================================
-- Step 1: Fix user_alert_matches view - Add user_id filter
-- ============================================================================

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
WHERE a.user_id = auth.uid()  -- 🔒 SECURITY FIX: Only show current user's alerts
  AND a.is_active = true
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
-- Step 2: Validate security fix
-- ============================================================================

DO $$
DECLARE
    view_definition TEXT;
    has_user_filter BOOLEAN;
BEGIN
    -- Get the view definition
    SELECT pg_get_viewdef('user_alert_matches', true)
    INTO view_definition;

    -- Check if user_id filter exists
    has_user_filter := view_definition LIKE '%a.user_id = auth.uid()%';

    IF has_user_filter THEN
        RAISE NOTICE '✅ Security fix applied: user_alert_matches filters by auth.uid()';
    ELSE
        RAISE EXCEPTION 'Security vulnerability: user_alert_matches does not filter by user!';
    END IF;
END $$;

-- ============================================================================
-- Step 3: Verify lots_with_watchlist_status is secure
-- ============================================================================

DO $$
DECLARE
    view_definition TEXT;
    has_user_filter BOOLEAN;
BEGIN
    -- Get the view definition
    SELECT pg_get_viewdef('lots_with_watchlist_status', true)
    INTO view_definition;

    -- Check if auth.uid() filter exists
    has_user_filter := view_definition LIKE '%auth.uid()%';

    IF has_user_filter THEN
        RAISE NOTICE '✅ lots_with_watchlist_status is secure (uses auth.uid())';
    ELSE
        RAISE EXCEPTION 'Security vulnerability: lots_with_watchlist_status does not filter by user!';
    END IF;
END $$;

-- ============================================================================
-- Validation Results
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '========== SECURITY FIX VALIDATION ==========';
RAISE NOTICE '';
RAISE NOTICE '✅ user_alert_matches: Now filters by current user (auth.uid())';
RAISE NOTICE '✅ lots_with_watchlist_status: Already secure (uses auth.uid())';
RAISE NOTICE '';
RAISE NOTICE 'Users can now ONLY see their own alerts and watchlist data';
RAISE NOTICE '';
