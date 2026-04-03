-- Validation Script: 001_initial_schema
-- Description: Validate database schema after migration
-- Run this after applying migrations to verify integrity

-- ============================================================================
-- PRE-MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
    validation_errors TEXT[] := '{}';
    error_count INTEGER := 0;

BEGIN
    -- Check 1: Verify no NULL emails in auth.users
    PERFORM pg_sleep(0); -- Placeholder for pre-migration checks

    -- Log results
    IF array_length(validation_errors, 1) > 0 THEN
        RAISE EXCEPTION 'Pre-migration validation failed: %', array_to_string(validation_errors, ', ');
    END IF;

END $$;

-- ============================================================================
-- POST-MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
    validation_results TEXT[] := '{}';
    pass_count INTEGER := 0;
    fail_count INTEGER := 0;

    -- Validation check record
    check_result RECORD;

BEGIN
    -- Validation 1: Check user_profiles table exists and has correct structure
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'user_profiles'
        ) INTO check_result;

        IF check_result.exists THEN
            validation_results := array_append(validation_results, '✅ user_profiles table exists');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results, '❌ user_profiles table missing');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking user_profiles: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 2: Check lots table exists
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'lots'
        ) INTO check_result;

        IF check_result.exists THEN
            validation_results := array_append(validation_results, '✅ lots table exists');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results, '❌ lots table missing');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking lots: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 3: Check watchlist table exists
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'watchlist'
        ) INTO check_result;

        IF check_result.exists THEN
            validation_results := array_append(validation_results, '✅ watchlist table exists');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results, '❌ watchlist table missing');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking watchlist: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 4: Check alerts table exists
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'alerts'
        ) INTO check_result;

        IF check_result.exists THEN
            validation_results := array_append(validation_results, '✅ alerts table exists');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results, '❌ alerts table missing');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking alerts: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 5: Check risk_score_enum type exists
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM pg_type
            WHERE typname = 'risk_score_enum'
        ) INTO check_result;

        IF check_result.exists THEN
            validation_results := array_append(validation_results, '✅ risk_score_enum type exists');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results, '❌ risk_score_enum type missing');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking risk_score_enum: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 6: Check RLS is enabled on all tables
    BEGIN
        SELECT COUNT(*) INTO check_result
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('user_profiles', 'lots', 'watchlist', 'alerts')
          AND relrowsecurity = true;

        IF check_result.count = 4 THEN
            validation_results := array_append(validation_results, '✅ RLS enabled on all tables');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results,
                '❌ RLS not enabled on all tables (found: ' || check_result.count || '/4)');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking RLS: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 7: Check indexes exist
    BEGIN
        SELECT COUNT(DISTINCT indexname) INTO check_result
        FROM pg_indexes
        WHERE tablename IN ('user_profiles', 'lots', 'watchlist', 'alerts')
          AND indexname NOT LIKE '%_pkey'; -- Exclude primary key indexes

        IF check_result.count >= 10 THEN -- Expecting at least 10 indexes
            validation_results := array_append(validation_results,
                '✅ Indexes created (' || check_result.count || ' indexes found)');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results,
                '⚠️  Fewer indexes than expected (' || check_result.count || '/10)');
            pass_count := pass_count + 1; -- Warning, not failure
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking indexes: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 8: Check foreign key constraints
    BEGIN
        SELECT COUNT(*) INTO check_result
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
          AND table_name IN ('user_profiles', 'lots', 'watchlist', 'alerts');

        IF check_result.count >= 4 THEN -- Expecting at least 4 foreign keys
            validation_results := array_append(validation_results,
                '✅ Foreign key constraints created (' || check_result.count || ' found)');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results,
                '❌ Insufficient foreign key constraints (' || check_result.count || '/4)');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking foreign keys: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 9: Check trigger function exists
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM pg_proc
            WHERE proname = 'handle_new_user'
        ) INTO check_result;

        IF check_result.exists THEN
            validation_results := array_append(validation_results, '✅ handle_new_user function exists');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results, '❌ handle_new_user function missing');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking handle_new_user: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Validation 10: Check views exist
    BEGIN
        SELECT COUNT(*) INTO check_result
        FROM information_schema.views
        WHERE table_name IN ('lots_with_watchlist_status', 'user_alert_matches');

        IF check_result.count = 2 THEN
            validation_results := array_append(validation_results, '✅ Views created (2/2)');
            pass_count := pass_count + 1;
        ELSE
            validation_results := array_append(validation_results,
                '❌ Not all views created (' || check_result.count || '/2)');
            fail_count := fail_count + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        validation_results := array_append(validation_results, '❌ Error checking views: ' || SQLERRM);
        fail_count := fail_count + 1;
    END;

    -- Output all validation results
    RAISE NOTICE '';
    RAISE NOTICE '========== VALIDATION RESULTS ==========';
    RAISE NOTICE '';

    FOR i IN 1..array_length(validation_results, 1) LOOP
        RAISE NOTICE '%', validation_results[i];
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE 'Summary: % passed, % failed', pass_count, fail_count;
    RAISE NOTICE '========================================';

    -- Fail if any critical validations failed
    IF fail_count > 0 THEN
        RAISE EXCEPTION 'Migration validation failed with % errors', fail_count;
    END IF;

END $$;
