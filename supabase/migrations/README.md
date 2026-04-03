# Database Migrations

This directory contains SQL migrations for the Radar Leilão PostgreSQL database in Supabase.

## Migration Files

### `001_initial_schema.sql`
Creates the core database schema:
- **user_profiles**: Extended user data linked to Supabase Auth
- **lots**: Auction lot data with risk scoring and location data
- **watchlist**: User-saved lots
- **alerts**: User-configured alerts for matching lots
- Row Level Security (RLS) policies
- Indexes for performance
- Triggers and functions
- Views for common queries

## How to Apply Migrations

### Option 1: Via Supabase Dashboard (Recommended for Initial Setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy contents of `001_initial_schema.sql`
4. Paste into SQL Editor and run
5. Run `validate_schema.sql` to verify

### Option 2: Via psql CLI (Local Development)

```bash
# Set environment variables
export SUPABASE_DB_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Apply migration
psql $SUPABASE_DB_URL -f 001_initial_schema.sql

# Validate
psql $SUPABASE_DB_URL -f validate_schema.sql
```

### Option 3: Via Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref [project-ref]

# Apply migration
supabase db push 001_initial_schema.sql
```

## Rollback

If you need to rollback the initial schema:

```bash
psql $SUPABASE_DB_URL -f rollback/001_initial_schema_rollback.sql
```

**WARNING**: Rollback will delete all data. Use with caution in production.

## Validation

Run validation after migration to verify integrity:

```bash
psql $SUPABASE_DB_URL -f validate_schema.sql
```

Expected output:
```
========== VALIDATION RESULTS ==========
✅ user_profiles table exists
✅ lots table exists
✅ watchlist table exists
✅ alerts table exists
✅ risk_score_enum type exists
✅ RLS enabled on all tables
✅ Indexes created (15 indexes found)
✅ Foreign key constraints created (5 found)
✅ handle_new_user function exists
✅ Views created (2/2)

Summary: 10 passed, 0 failed
========================================
```

## Schema Overview

### user_profiles
Extends Supabase `auth.users` with application data:
- `tier`: Subscription tier (free, pro, war_room)
- `company`: For B2B users
- Automatically created on user signup via trigger

### lots
Core auction data:
- `risk_score`: BAIXO, MÉDIO, ALTO
- `location_lat/lng`: For map visualization
- `edict_url`: Link to PDF in Supabase Storage
- Full-text search indexes on title/description
- JSONB metadata for flexible scraper data

### watchlist
User-saved lots:
- Prevents duplicates via unique constraint
- Tracks when lot was added

### alerts
Smart alerts for matching lots:
- JSONB criteria for flexible filters
- Supports notification methods (email, push, both)
- Tracks last triggered time and count

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

- **user_profiles**: Users can read all profiles, update own
- **lots**: Public read access (authenticated and anon)
- **watchlist**: Users can CRUD own watchlist only
- **alerts**: Users can CRUD own alerts only

## Views

### lots_with_watchlist_status
Shows lots with boolean `is_in_watchlist` for current user.

### user_alert_matches
Joins alerts with lots to find matches. Used by alert matcher system.

## Triggers

### handle_new_user()
Automatically creates `user_profiles` record when user signs up via Supabase Auth.

### update_updated_at_column()
Automatically updates `updated_at` timestamp on row modification.

## Next Steps

After applying initial schema:

1. **Set up Supabase Storage**: Create bucket `edicts` for auction PDFs
2. **Configure environment variables**: Update `.env.local` with Supabase credentials
3. **Update frontend auth**: Replace mock in `src/hooks/useUser.tsx` with real Supabase Auth
4. **Implement scraper**: Create Python scripts to populate `lots` table
5. **Set up alert matcher**: Background job to check `user_alert_matches` view
6. **Implement Stripe**: For subscription tier management

## Troubleshooting

### Migration fails with "role does not exist"
Ensure you're running as the `postgres` user or have appropriate permissions.

### RLS policies blocking access
Check that policies are created correctly:
```sql
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```

### Trigger not firing
Verify trigger exists and is enabled:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

## Migration Best Practices

1. **Always validate** after applying migrations
2. **Test rollbacks** in development before production
3. **Backup first** before destructive operations
4. **Use transactions** for multi-step migrations
5. **Index after data load** for large datasets
6. **Monitor performance** after index changes

## Additional Resources

- [Supabase Database Docs](https://supabase.com/docs/guides/database)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SQL Migration Best Practices](https://schema-blog.wanderingstanza.com/sql-migrations-best-practices/)
