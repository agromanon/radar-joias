-- ============================================================================
-- QUICK SECURITY FIX - Copy this to Supabase SQL Editor
-- ============================================================================
-- Go to: https://supabase.com/dashboard/project/jelikvfcxvumdhwkirje/sql
-- Paste and click Run

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
WHERE a.user_id = auth.uid()  -- 🔒 SECURITY: Only show current user's alerts
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
-- Validation: Confirm fix is applied
-- ============================================================================

DO $$
DECLARE
    view_definition TEXT;
    has_user_filter BOOLEAN;
BEGIN
    SELECT pg_get_viewdef('user_alert_matches', true)
    INTO view_definition;

    has_user_filter := view_definition LIKE '%a.user_id = auth.uid()%';

    IF has_user_filter THEN
        RAISE NOTICE '✅ Security fix applied: user_alert_matches now filters by auth.uid()';
    ELSE
        RAISE EXCEPTION '❌ Security fix NOT applied!';
    END IF;
END $$;
