# Kwara Two-Stage Scraper - Complete Guide

## Architecture Overview

### Two-Stage Scraping Process

**Stage 1: Batch Fetch (Fast)**
- Endpoint: `/_next/data/{build_id}/busca.json`
- Fetches: All lots from search API
- Speed: ~300 lots in 6 seconds
- Fields: title, slug, current_bid, images, location, closing_at
- Purpose: Quick inventory update

**Stage 2: Detail Fetch (Slow)**
- Endpoint: `/_next/data/{build_id}/bens/{slug}.json`
- Fetches: Extended fields for each individual lot
- Speed: ~1-2 seconds per lot
- Fields: refs, description, observations, visiting, pickup, fees, seller
- Purpose: Complete lot data for Radar Leilão features

### Why Two Stages?

1. **Performance**: Get basic inventory quickly, enrich details later
2. **Resumable**: Can resume from last basic lot if interrupted
3. **Rate Limiting**: Distribute load across proxies to avoid blocking
4. **Scalable**: Can scale Stage 2 horizontally with more proxies

## Database Schema Changes

### New Columns (Migration 006)

```sql
-- Extended lot detail fields
refs TEXT[]                    -- Reference codes (e.g., ["ab-64672"])
slug TEXT                     -- URL slug for detail pages
general_observations TEXT     -- Observações gerais
visiting_observations TEXT    -- Visitação rules
visiting_address TEXT         -- Visitação location
pickup_observations TEXT      -- Retirada rules
pickup_address TEXT           -- Retirada location
measurements TEXT             -- Medidas/dimensions
listing_title TEXT            -- Event/auction name
starting_bid NUMERIC          -- Lance inicial
buyer_fee_percentage NUMERIC  -- Taxa de compra (%)
minimum_increment NUMERIC    -- Incremento mínimo
views INTEGER                 -- View count
bids_count INTEGER            -- Number of bids
seller_name TEXT              -- Vendedor nome
seller_logo_url TEXT          -- Vendedor logo

-- Scrape tracking
scrape_stage TEXT             -- 'basic' or 'detailed'
last_scraped_at TIMESTAMP     -- Last update time
```

### Indexes for Performance

```sql
CREATE INDEX idx_lots_scrape_stage ON lots(scrape_stage);
CREATE INDEX idx_lots_slug ON lots(slug);
CREATE INDEX idx_lots_last_scraped ON lots(last_scraped_at DESC);
```

## Installation & Setup

### 1. Apply Database Migration

```bash
# From project root
cd supabase/migrations
psql $DATABASE_URL -f 006_add_kwara_extended_fields.sql

# Or using Supabase CLI
supabase migration up --file 006_add_kwara_extended_fields.sql
```

### 2. Configure Environment

Create `/scrapers/.env`:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Webshare Proxies (optional but recommended)
WEBSHARE_API_KEY=your-webshare-api-key
```

### 3. Install Dependencies

```bash
cd scrapers
pip install requests python-dotenv
```

## Usage

### Quick Test (5 lots)

```bash
cd scrapers
python test_two_stage_scraper.py
```

### Full Production Scrape

```bash
# Scrape all lots (~300 lots, ~10 minutes)
python kwara_two_stage_scraper.py

# With custom rate limiting (slower = safer)
python kwara_two_stage_scraper.py --stage1-delay 3.0 --stage2-delay 2.5

# Test with limited lots
python kwara_two_stage_scraper.py --max-lots 50

# Run without proxies (not recommended for production)
python kwara_two_stage_scraper.py --no-proxy
```

### Command-Line Options

```
--max-lots N         Limit number of lots (for testing)
--no-proxy          Disable proxy rotation
--stage1-delay N    Seconds between Stage 1 requests (default: 2.0)
--stage2-delay N    Seconds between Stage 2 requests (default: 1.5)
```

## Proxy Configuration

### Webshare IO Setup

1. **Get API Key**: Sign up at https://webshare.io/
2. **Add Proxies**: Add proxies to your Webshare dashboard
3. **Configure**: Set `WEBSHARE_API_KEY` in `.env`

### Proxy Rotation

The scraper automatically:
- Loads all proxies from Webshare API
- Rotates through proxies (round-robin for Stage 1, random for Stage 2)
- Handles proxy failures gracefully
- Logs proxy usage

### Scaling Recommendations

| Lots per Day | Proxies Needed | Recommendation |
|--------------|----------------|----------------|
| 300          | 10             | Free plan (current) |
| 1,000        | 25             | Upgrade plan |
| 5,000+       | 100            | Premium plan |

## Performance Metrics

### Expected Performance

```
Stage 1 (300 lots):
  - Without proxies: ~6 seconds
  - With proxies: ~8-10 seconds

Stage 2 (300 lots):
  - Without proxies: ~8-10 minutes
  - With 10 proxies: ~10-12 minutes
  - With 100 proxies: ~8-10 minutes
```

### Rate Limiting Best Practices

1. **Start Conservative**: Begin with `--stage2-delay 2.5`
2. **Monitor Logs**: Check `kwara_scraper.log` for errors
3. **Gradual Increase**: Reduce delay if no blocking occurs
4. **Use Proxies**: Always enable proxies in production

## Monitoring & Logging

### Log File

```bash
tail -f kwara_scraper.log
```

### Key Metrics to Watch

- `Failed to fetch details` - Possible blocking
- `429 Client Error` - Rate limiting
- `Connection timeout` - Proxy issues
- `Saved X/Y lots` - Database insertion rate

### Progress Tracking

The scraper logs progress every 10 lots:
```
Progress: 50/300 lots (16.7%)
Progress: 100/300 lots (33.3%)
```

## Troubleshooting

### Issue: "Failed to fetch details"

**Cause**: Rate limiting or proxy failure
**Solution**:
1. Increase `--stage2-delay` to 2.5 or 3.0
2. Check proxy status in Webshare dashboard
3. Verify `build_id` is current

### Issue: "Database insertion failed"

**Cause**: Missing migration or invalid data
**Solution**:
1. Run migration: `psql $DATABASE_URL -f 006_add_kwara_extended_fields.sql`
2. Check logs for specific validation errors
3. Verify `SERVICE_ROLE_KEY` has correct permissions

### Issue: "No lots found in Stage 1"

**Cause**: Incorrect `build_id` or API changed
**Solution**:
1. Check if `build_id` is current: `9cYkevqRi1YyTe6cMTdam`
2. Manually access https://www.kwara.com.br/busca
3. Open DevTools → Network
4. Find the latest `build_id` in API requests
5. Update `kwara_two_stage_scraper.py`

## Data Fields Mapping

### Stage 1 (Basic)

| API Field | Database Column | Type |
|-----------|-----------------|------|
| title | title | TEXT |
| slug | slug | TEXT |
| cachedPriceAmountCents | current_bid | NUMERIC |
| location | location_city, location_state | TEXT |
| scheduledEndAt | closing_at | TIMESTAMP |
| images | images, image_url | TEXT[] |
| termsUrl | edict_url | TEXT |
| views | views | INTEGER |
| cachedBidsCount | bids_count | INTEGER |

### Stage 2 (Extended)

| API Field | Database Column | Type |
|-----------|-----------------|------|
| refs | refs | TEXT[] |
| description | description | TEXT |
| generalObservations | general_observations | TEXT |
| visitingObservations | visiting_observations | TEXT |
| visitingAddress | visiting_address | TEXT |
| pickUpObservations | pickup_observations | TEXT |
| pickUpAddress | pickup_address | TEXT |
| measurements | measurements | TEXT |
| listing.title | listing_title | TEXT |
| startingBidCents | starting_bid | NUMERIC |
| buyerFeePercentage | buyer_fee_percentage | NUMERIC |
| minimumIncrementCents | minimum_increment | NUMERIC |
| seller.displayName | seller_name | TEXT |
| seller.logoUrl | seller_logo_url | TEXT |

## Future Enhancements

### Potential Improvements

1. **Parallel Scraping**: Use asyncio to fetch Stage 2 concurrently
2. **Incremental Updates**: Only update lots changed since last scrape
3. **Retry Logic**: Automatic retry for failed detail fetches
4. **Metrics Dashboard**: Real-time scraping statistics
5. **Alert System**: Notify when scraping fails or finds issues

### Parallel Scraping Example

```python
import asyncio
import aiohttp

async def fetch_details_async(lots, session):
    tasks = [fetch_lot_detail(lot, session) for lot in lots]
    return await asyncio.gather(*tasks)

# Could reduce Stage 2 from 10 minutes to 2-3 minutes
```

## Contact & Support

For issues or questions:
1. Check logs: `kwara_scraper.log`
2. Review this README
3. Check database migration status
4. Verify environment variables

## License

MIT License - Radar Leilão Project 2026
