-- Rollback: 001_initial_schema
-- Description: Rollback initial database schema
-- WARNING: This will delete all data. Use with caution in production.

-- Drop views
DROP VIEW IF EXISTS user_alert_matches CASCADE;
DROP VIEW IF EXISTS lots_with_watchlist_status CASCADE;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
DROP TRIGGER IF EXISTS update_lots_updated_at ON lots;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can delete own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can delete from own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Users can insert own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can insert to own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Users can update own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can view own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Public can view lots" ON lots;

-- Drop indexes (indexes are automatically dropped with tables, but explicit is safer)
DROP INDEX IF EXISTS idx_alerts_criteria CASCADE;
DROP INDEX IF EXISTS idx_alerts_is_active CASCADE;
DROP INDEX IF EXISTS idx_alerts_last_triggered CASCADE;
DROP INDEX IF EXISTS idx_alerts_user_id CASCADE;

DROP INDEX IF EXISTS idx_watchlist_created_at CASCADE;
DROP INDEX IF EXISTS idx_watchlist_user_id CASCADE;

DROP INDEX IF EXISTS idx_lots_description_search CASCADE;
DROP INDEX IF EXISTS idx_lots_title_search CASCADE;
DROP INDEX IF EXISTS idx_lots_metadata CASCADE;
DROP INDEX IF EXISTS idx_lots_location CASCADE;
DROP INDEX IF EXISTS idx_lots_risk_score CASCADE;
DROP INDEX IF EXISTS idx_lots_closing_at CASCADE;
DROP INDEX IF EXISTS idx_lots_auctioneer CASCADE;
DROP INDEX IF EXISTS idx_lots_category CASCADE;
DROP INDEX IF EXISTS idx_lots_created_at CASCADE;

DROP INDEX IF EXISTS idx_user_profiles_company CASCADE;
DROP INDEX IF EXISTS idx_user_profiles_tier CASCADE;

-- Drop tables (order matters due to foreign key constraints)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS lots CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop types
DROP TYPE IF EXISTS risk_score_enum CASCADE;

-- Drop extensions (optional - usually kept)
-- DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
