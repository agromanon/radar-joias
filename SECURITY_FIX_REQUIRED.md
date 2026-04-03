# 🔒 CRITICAL SECURITY FIX REQUIRED

## Vulnerability Details

**Issue:** The `user_alert_matches` database view returns **ALL users' alerts** without filtering by the current user.

**Impact:**
- Users can see other users' alert criteria
- Users can see what lots other users are tracking
- Exposure of user behavior, interests, and bidding strategies
- **GDPR/Privacy violation**

**Current View Definition (VULNERABLE):**
```sql
CREATE VIEW user_alert_matches AS
SELECT ...
FROM alerts a
CROSS JOIN lots l
WHERE a.is_active = true  -- ❌ NO USER FILTER!
  AND l.created_at > ...
```

**Required Fix:**
```sql
CREATE VIEW user_alert_matches AS
SELECT ...
FROM alerts a
CROSS JOIN lots l
WHERE a.user_id = auth.uid()  -- ✅ FILTER BY CURRENT USER
  AND a.is_active = true
  AND l.created_at > ...
```

---

## How to Apply the Fix

### Option 1: Supabase Dashboard (Recommended - 2 minutes)

1. **Open SQL Editor:**
   ```
   https://supabase.com/dashboard/project/jelikvfcxvumdhwkirje/sql
   ```

2. **Copy and paste this SQL:**

```sql
-- ============================================================================
-- Security Fix: Filter user_alert_matches by current user
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
```

3. **Click "Run"**

4. **Verify the fix:**
   - You should see: `✅ Security fix applied: user_alert_matches now filters by auth.uid()`

---

### Option 2: Use Migration File (Automated)

1. The migration file is ready at:
   ```
   /Users/aromanon/radar-leilao/supabase/migrations/004_fix_view_security.sql
   ```

2. Apply via Supabase CLI (if installed):
   ```bash
   cd /Users/aromanon/radar-leilao
   supabase db push
   ```

---

## What This Fixes

### Before (Vulnerable ❌)
```typescript
// User A queries their alerts
const { data } = await supabase
  .from('user_alert_matches')
  .select('*');

// Result: Returns User A's alerts + User B's alerts + User C's alerts...
// Massive privacy leak!
```

### After (Secure ✅)
```typescript
// User A queries their alerts
const { data } = await supabase
  .from('user_alert_matches')
  .select('*');

// Result: Returns ONLY User A's alerts
// User privacy protected!
```

---

## Verification

After applying the fix, verify it works:

```typescript
// Test: User should only see their own alerts
const { data, error } = await supabase
  .from('user_alert_matches')
  .select('*');

console.log('Alerts returned:', data.length);

// All returned alerts should have user_id === currentUser.id
const allOwnedByUser = data.every(alert =>
  alert.user_id === currentUser.id
);

console.log('All alerts owned by user:', allOwnedByUser); // Should be true
```

---

## Other Views Status

### ✅ lots_with_watchlist_status (Already Secure)
This view already filters by `auth.uid()`:
```sql
WHERE w.user_id IS NOT NULL AND w.user_id = auth.uid()
```
**No fix needed.**

---

## Summary

| View | Before | After | Status |
|------|--------|-------|--------|
| `user_alert_matches` | ❌ Shows all users' alerts | ✅ Shows only current user's | **NEEDS FIX** |
| `lots_with_watchlist_status` | ✅ Already filters by user | ✅ Already secure | ✅ Secure |

---

## Timeline

- **Discovery:** Now
- **Fix Created:** Now
- **Fix Applied:** TBD (waiting for you to apply)
- **Verification:** TBD

---

## Why This Matters

Without this fix, a malicious user could:
1. Query `user_alert_matches`
2. See every alert configured by all users
3. Identify high-interest lots (lots many users are tracking)
4. Infer bidding strategies from alert patterns
5. **Competitive advantage stolen**

**With the fix:** Each user sees ONLY their own data, protecting privacy and competitive intelligence.

---

## Next Steps

1. ✅ Review this document
2. ⏳ Apply the SQL fix in Supabase Dashboard
3. ⏳ Verify the fix with validation query
4. ⏳ Test in application to confirm behavior

**Estimated time:** 2 minutes

---

## Questions?

If you encounter any issues:
1. Check the SQL ran successfully (look for "✅ Security fix applied")
2. Verify in Supabase dashboard: Database → Views → user_alert_matches
3. Test with actual user accounts to confirm data isolation

---

**🔒 SECURITY IS EVERYONE'S RESPONSIBILITY**
