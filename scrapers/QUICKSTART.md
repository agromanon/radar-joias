# Quick Start: Authenticated Kwara Scraping

## What I've Built

I've implemented a complete authenticated scraping system for Kwara.com.br that:

✅ **Captures full descriptions** (not just 44-char summaries)
✅ **Uses multiple user accounts** to avoid rate limits
✅ **Automatically rotates accounts** when one hits a limit
✅ **Fetches all images** from lot detail pages
✅ **Handles authentication** (login, session management, refresh)
✅ **Integrates with Supabase** via HTTP REST API

## Files Created

### Core Components
- `utils/auth_manager.py` - Multi-account authentication system
- `kwara_auth_scraper.py` - Authenticated scraper with full detail fetching
- `test_auth_setup.py` - Test script to verify your auth configuration

### Documentation
- `AUTH_SETUP.md` - Detailed authentication setup guide
- `scrapers/README.md` - Updated with authenticated scraping section
- `.env.example` - Updated with Kwara account variables

## Step-by-Step Setup

### Step 1: Create Kwara Accounts (5 minutes)

1. Go to https://www.kwara.com.br
2. Click "Registrar" (Sign up)
3. Create 2-3 accounts using Gmail aliases:
   - `yourname+kwara1@gmail.com`
   - `yourname+kwara2@gmail.com`
   - `yourname+kwara3@gmail.com`
4. All emails deliver to your main inbox (Gmail feature!)

### Step 2: Configure Environment Variables (2 minutes)

Add to your `.env` file:

```bash
# Account 1
KWARA_ACCOUNT_1_EMAIL=yourname+kwara1@gmail.com
KWARA_ACCOUNT_1_PASSWORD=your-password-1

# Account 2
KWARA_ACCOUNT_2_EMAIL=yourname+kwara2@gmail.com
KWARA_ACCOUNT_2_PASSWORD=your-password-2

# Account 3 (optional)
KWARA_ACCOUNT_3_EMAIL=yourname+kwara3@gmail.com
KWARA_ACCOUNT_3_PASSWORD=your-password-3
```

### Step 3: Apply Database Migration (2 minutes)

The scraper needs the `source_url` column in the database.

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Run this migration:

```sql
-- Add source_url column to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add index for source_url
CREATE INDEX IF NOT EXISTS idx_lots_source_url ON lots(source_url) WHERE source_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN lots.source_url IS 'Direct URL to the lot on the auctioneer website (e.g., https://www.kwara.com.br/lote/abc-123)';
```

### Step 4: Test Authentication (1 minute)

```bash
cd /Users/aromanon/radar-leilao/scrapers
python test_auth_setup.py
```

Expected output:
```
✓ Authentication setup is ready!
Total accounts configured: 3
Active accounts: 3
```

### Step 5: Run the Authenticated Scraper (2 minutes)

```bash
python kwara_auth_scraper.py
```

This will:
1. Scrape 1 page from the "metais" category
2. Fetch full descriptions for each lot
3. Show you a sample lot with all the enhanced data
4. Save to your Supabase database

## What You'll See

Example output:

```
Testing Kwara Authenticated Scraper
================================================================================

Auth Status:
  Total Accounts: 3
  Active Accounts: 3

✓ Authenticated scraping enabled!

Scraping lots with full details...
Fetching detail page: https://www.kwara.com.br/lote/sofa-2-lugares...
  ✓ Updated description (547 chars)
  ✓ Found 4 images
  ✓ Location: São Paulo, SP

Results:
  Total lots scraped: 20
  Detail fetch success: 20/20

Sample lot:
  Title: Sofá, Cadeiras, Armários, Enfeites e Outros
  Description length: 547 chars  ← Full description!
  Source URL: https://www.kwara.com.br/lote/sofa-2-lugares...
  Images: 4
  Location: São Paulo, SP

Stats:
  Detail fetch success: 20/20
  ✓ Saved 1 lot

✓ Authenticated scraper test completed!
```

## Using in Production

### Basic Usage

```python
from kwara_auth_scraper import KwaraAuthenticatedScraper

scraper = KwaraAuthenticatedScraper(save_to_db=True)

# Scrape with full descriptions
lots = scraper.scrape_lots_with_details(
    category_ids=['1335572015838398043'],  # Metais
    max_pages=3,
    fetch_details=True,
    delay_between_details=2.0  # 2 seconds between requests
)

print(f"Scraped {len(lots)} lots with full descriptions")
```

### Multiple Categories

```python
categories = {
    '1335572015838398043': 'Metais',
    '1335572015838398044': 'Máquinas',
    '1335572015838398045': 'Veículos'
}

for cat_id, cat_name in categories.items():
    lots = scraper.scrape_lots_with_details(
        category_ids=[cat_id],
        max_pages=2
    )
    print(f"{cat_name}: {len(lots)} lots")
```

### Check Account Health

```python
stats = scraper.auth_manager.get_stats()

for account in stats['accounts']:
    status = "✓ Active" if account['active'] else "✗ Inactive"
    print(f"{account['email']}: {status} ({account['request_count']} requests)")
```

## Rate Limiting

The scraper handles rate limits automatically:

- When an account hits a limit (HTTP 429), it switches to another account
- Shows: "Rate limit hit for account@email.com. Waiting until 2025-04-02 15:30:00"
- Automatically resumes with next available account
- Returns to rate-limited account after cooldown

**To avoid rate limits:**
- Use 3-5 accounts minimum
- Set `delay_between_details=2.0` or higher
- Scrape during off-peak hours (Brazilian night = US morning)

## Comparison: Before vs After

### Before (API Only)
```
Description: "Sofá, Cadeiras, Armários, Enfeites e Outros" (44 chars)
Images: 1 (primary only)
Location: None
```

### After (Authenticated)
```
Description: "Sofá de 2 lugares, fabricado em madeira maciça com...
[full 500+ character description with complete details]" (547 chars)
Images: 4 (all gallery images)
Location: "São Paulo, SP - Zona Sul"
Source URL: https://www.kwara.com.br/lote/sofa-2-lugares-manta...
```

## Troubleshooting

### "No authenticated accounts configured"

**Problem**: Accounts not in `.env`

**Solution**:
1. Open `.env` file
2. Add `KWARA_ACCOUNT_1_EMAIL` and `KWARA_ACCOUNT_1_PASSWORD`
3. Run `python test_auth_setup.py` again

### "All accounts are rate limited"

**Problem**: All accounts hit limits

**Solution**:
1. Wait 5-10 minutes for limits to expire
2. Add more accounts (KWARA_ACCOUNT_4_*, etc.)
3. Increase `delay_between_details` to 3.0 or higher

### "Database migration needed"

**Problem**: `source_url` column doesn't exist

**Solution**:
1. Go to Supabase SQL Editor
2. Run the migration SQL from Step 3 above
3. Verify column exists: Check table schema

### "Login failed for account"

**Problem**: Wrong credentials or account blocked

**Solution**:
1. Try logging in manually on kwara.com.br
2. Verify email/password in `.env` are correct
3. If blocked, create new account and update `.env`

## Best Practices

### Security
- ✅ Never commit `.env` to git
- ✅ Use unique passwords for each account
- ✅ Don't use personal/main accounts
- ✅ Monitor accounts for suspicious activity

### Performance
- ✅ Start with `delay_between_details=3.0` (conservative)
- ✅ Use 3-5 accounts for production
- ✅ Monitor account stats during scraping
- ✅ Scrape during off-peak hours

### Maintenance
- ✅ Check account health weekly
- ✅ Rotate passwords monthly
- ✅ Have backup accounts ready
- ✅ Update scrapers if Kwara changes site structure

## Next Steps

1. ✅ Create your Kwara accounts
2. ✅ Add credentials to `.env`
3. ✅ Apply database migration
4. ✅ Test with `python test_auth_setup.py`
5. ✅ Run full scraper: `python kwara_auth_scraper.py`
6. ✅ Monitor results in Supabase dashboard
7. ✅ Set up scheduled scraping (GitHub Actions recommended)

## Support

If you need help:

1. **Check logs** - Error messages show what's wrong
2. **Review AUTH_SETUP.md** - Detailed authentication guide
3. **Verify accounts** - Log in to kwara.com.br manually
4. **Check auth stats** - Run `python test_auth_setup.py`

---

**You're all set!** 🎉

The authenticated scraper is ready to fetch complete auction data with full descriptions, all images, and detailed locations. Just add your Kwara credentials to `.env` and start scraping!

**Last Updated**: 2025-04-02
