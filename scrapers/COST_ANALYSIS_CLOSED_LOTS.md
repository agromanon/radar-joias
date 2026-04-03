# Closed Auction Lots: Cost Analysis & Policy Recommendation

## Executive Summary

**Question:** Should we keep closed auction lots in the database for price intelligence, or delete them immediately when auctions end?

**Short Answer:** **Keep closed lots** - the cost is negligible compared to the value provided.

---

## Cost Projection Models

### Assumptions

**Scraping Volume (Conservative):**
- 5 platforms (Kwara, Excel, Braspress, Metal-Maquina, Nacional)
- 100 lots per platform per month
- Average auction duration: 7 days
- 50% of lots sell (winning bid captured)

**Growth:**
- Year 1: 5 platforms
- Year 2: 10 platforms
- Year 3: 15 platforms

---

## Policy A: Delete Immediately (Clean Slate)

**Definition:** Delete lot from database when `closing_at < NOW()`

### Database Size Over Time

| Month | Active Lots | Closed Lots (Deleted) | Total Size |
|-------|-------------|------------------------|------------|
| 1 | 500 | 250 (deleted) | ~3.5 MB |
| 6 | 500 | 1,500 (deleted) | ~3.5 MB |
| 12 | 500 | 3,000 (deleted) | ~3.5 MB |
| 24 | 500 | 6,000 (deleted) | ~3.5 MB |

**Storage Cost:** **$0.00** (well under 1GB free tier)

**Pros:**
- ✅ Minimal database size
- ✅ Fast queries (smaller table)
- ✅ No cleanup needed

**Cons:**
- ❌ **Zero historical data** - users can't see past auction results
- ❌ **No price anchoring** - users don't know what similar items sold for
- ❌ **Lost competitive advantage** - this data is valuable intel
- ❌ **Worse user experience** - users must research past auctions manually

---

## Policy B: Keep Closed Lots (Price Intelligence)

**Definition:** Keep lots forever, update status to 'sold'/'unsold', capture winning bid

### Database Size Over Time

| Month | Active Lots | Closed Lots (Kept) | Total Size | Cost |
|-------|-------------|---------------------|------------|------|
| 1 | 500 | 250 | ~5 MB | $0.00 |
| 6 | 500 | 1,500 | ~15 MB | $0.00 |
| 12 | 500 | 3,000 | ~30 MB | $0.00 |
| 24 | 500 | 6,000 | ~60 MB | $0.00 |
| 36 | 500 | 9,000 | ~90 MB | $0.00 |
| 60 | 500 | 15,000 | ~150 MB | $0.00 |

**Storage Cost:** **$0.00** (still under 1GB free tier at 60 months!)

### Per-Lot Size Calculation

```
Basic lot row: ~2KB
- title, auctioneer, category: 500 bytes
- current_bid, starting_bid: 100 bytes
- timestamps: 100 bytes
- indexes: 200 bytes
- row overhead: 1KB

Metadata JSONB: ~5KB
- Platform data: 500 bytes
- Images array (3 URLs): 300 bytes
- Tags, categorization: 400 bytes
- Raw API data: 2KB
- JSON overhead: 1.8KB

Total per lot: ~7KB
```

### Growth Projection (5 Years)

| Year | Platforms | Lots/Year | Cumulative Lots | Database Size | Monthly Cost* |
|------|-----------|----------|-----------------|---------------|---------------|
| 1 | 5 | 6,000 | 6,000 | 42 MB | $0.00 |
| 2 | 10 | 12,000 | 18,000 | 126 MB | $0.00 |
| 3 | 15 | 18,000 | 36,000 | 252 MB | $0.00 |
| 4 | 20 | 24,000 | 60,000 | 420 MB | $0.00 |
| 5 | 25 | 30,000 | 90,000 | 630 MB | $0.00 |

\*Assuming Supabase paid tier ($0.021/GB/month)

**5-Year Cost:** **$0.13/month average** = **$1.56/year**

**Break-even point:** Database would need to reach **48 GB** before costing $1/month. At current growth rates, this would take **80 years**.

---

## Performance Impact Analysis

### Query Performance: Active vs Historical

**Query 1: Get active lots (dashboard)**
```sql
SELECT * FROM lots
WHERE status = 'active'
  AND closing_at > NOW();
```

- **Policy A (500 rows):** ~5ms
- **Policy B (500 rows):** ~5ms
- **Impact:** ✅ None (historical lots filtered out)

**Query 2: Search all lots (including historical)**
```sql
SELECT * FROM lots
WHERE title LIKE '%sofá%';
```

- **Policy A (500 rows):** ~10ms
- **Policy B (6,000 rows after 1 year):** ~15ms
- **Impact:** ⚠️ Slight slowdown (5ms)

**Query 3: Price history analysis**
```sql
SELECT category, AVG(winning_bid)
FROM lots
WHERE status = 'sold'
  AND closing_at > NOW() - INTERVAL '6 months'
GROUP BY category;
```

- **Policy A:** ❌ Query impossible (no data)
- **Policy B:** ~25ms (only possible with historical data)
- **Impact:** ✅ New feature enabled!

### Indexing Strategy

Add index on status for fast filtering:
```sql
CREATE INDEX idx_lots_status ON lots(status);
CREATE INDEX idx_lots_closing_at ON lots(closing_at DESC);
```

**Result:** Historical data has **zero impact** on active lot queries.

---

## Value Analysis: Price Intelligence

### User Value Proposition

**Scenario:** User is interested in industrial equipment auctions

**With Policy A (No Historical Data):**
- User sees: Current auctions only
- User thinks: "What should I bid?"
- User action: Manual research across multiple sites (hours)
- **User Experience:** 😕 Frustrating, time-consuming

**With Policy B (Historical Data):**
- User sees: Current auctions + past sales
- User thinks: "Similar compressors sold for R$ 5,000-8,000 last month"
- User action: Make informed bid immediately
- **User Experience:** 😊 Confident, efficient

### Competitive Advantage

**Radar Leilão becomes a price intelligence platform:**

```
Feature: "Price History for This Category"

📊 Industrial Compressors - Last 90 Days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Category: Compressores
Avg Sale Price: R$ 6,500
Price Range: R$ 4,200 - R$ 9,800
Lots Sold: 47
Auction Success Rate: 73%

Recent Sales:
• Compressor 10HP - R$ 5,800 (Excel Leilões)
• Compressor 15HP - R$ 7,200 (Kwara)
• Compressor 20HP - R$ 8,100 (Braspress)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**This is impossible with Policy A.**

### Business Impact

**Retention:**
- Historical data = users return to check prices
- Price intelligence = unique value proposition
- Moat against competitors = they only show current auctions

**Monetization:**
- **Pro tier ($149/mo):** Users pay for price history
- **War Room ($599/mo):** Users pay for advanced analytics
- **Impossible without historical data.**

---

## Archival Strategy (Hybrid Approach)

### Recommended: Tiered Retention

**Hot Data (0-90 days after close):**
- Keep in main `lots` table
- Full query access
- Used for: "Recent sales" feature

**Warm Data (90-365 days after close):**
- Keep in main `lots` table
- Materialized view for aggregation
- Used for: "Price trends" feature

**Cold Data (365+ days after close):**
- Archive to separate `lots_historical` table
- Compress metadata
- Used for: "Historical analytics" (rare access)

### Cleanup Function

```python
def cleanup_closed_lots():
    """
    Archive lots that have been closed for >365 days
    """
    # Move to historical table
    supabase.rpc('archive_old_lots', {
        'days_threshold': 365
    })

    # Compress metadata
    supabase.rpc('compress_historical_metadata')

    logger.info("Archived lots older than 365 days")
```

### Estimated Sizes with Tiers

| Tier | Lots | Size | Monthly Cost |
|------|------|------|--------------|
| Hot (0-90d) | 1,500 | 10 MB | $0.00 |
| Warm (90-365d) | 3,500 | 25 MB | $0.00 |
| Cold (365d+) | 10,000+ | 70 MB | $0.00 |
| **Total** | **15,000** | **105 MB** | **$0.00** |

Still under free tier!

---

## Policy Comparison Matrix

| Factor | Delete Immediately | Keep Forever | Hybrid (Recommended) |
|--------|-------------------|--------------|----------------------|
| **Storage Cost (Year 1)** | $0.00 | $0.00 | $0.00 |
| **Storage Cost (Year 5)** | $0.00 | $1.56/year | $0.50/year |
| **Query Performance** | Excellent | Good (with indexes) | Excellent |
| **Price Intelligence** | ❌ None | ✅ Full | ✅ Full (hot/warm) |
| **Historical Analytics** | ❌ None | ✅ Full | ⚠️ Limited |
| **User Value** | Low | High | High |
| **Competitive Moat** | Weak | Strong | Strong |
| **Implementation** | Simple | Simple | Moderate |
| **Maintenance** | Low | Low | Moderate |

---

## Final Recommendation

### ✅ Adopt Policy B (Keep Closed Lots) **with** Hybrid Archival

**Reasoning:**

1. **Cost is negligible:** Even with 90,000 lots (5 years), cost is $0.00
2. **User value is massive:** Price intelligence is a key differentiator
3. **Monetization requires it:** Can't charge for insights without data
4. **Competitive advantage:** Historical data = moat against competitors
5. **Performance is fine:** Proper indexing = no slowdown

**Implementation Plan:**

**Phase 1: Now (Simple Retention)**
```python
# Update scraper to capture winning bid
if auction_closed:
    lot.status = 'sold'
    lot.winning_bid = extract_winning_bid(page_html)
    lot.winning_bidder = extract_winner(page_html)
```

**Phase 2: Month 3 (Add Archival)**
```python
# Create archive function for lots >365 days old
def archive_old_lots():
    # Move to separate table
    # Compress metadata
    # Create materialized views
```

**Phase 3: Month 6 (Analytics Features)**
```python
# Add price history endpoints
@app.get('/api/price-history')
async def get_price_history(category: str, days: int):
    return query_historical_lots(category, days)
```

### Capture Winning Bid Strategy

```python
def capture_final_auction_results(lot_id: str):
    """
    Fetch final auction results after closing

    This should be run 24-48 hours after lot closes
    """
    lot = get_lot(lot_id)

    if lot.closing_at < NOW() - INTERVAL('24 hours'):
        # Fetch from auctioneer site
        final_data = fetch_auction_results(lot.source_url)

        # Update with winning bid
        if final_data.get('sold'):
            lot.status = 'sold'
            lot.winning_bid = final_data['winning_bid']
            lot.winning_bidder = final_data['winner']
        else:
            lot.status = 'unsold'

        save_lot(lot)
```

---

## Summary

**Verdict:** Keep closed lots forever (with archival for very old data)

**Cost:** $0.00 - $1.56/year (negligible)

**Value:**
- ✅ Price intelligence for users
- ✅ Historical analytics
- ✅ Competitive moat
- ✅ Premium feature monetization

**ROI:** Infinite value for near-zero cost

**The database storage cost is so small that it's not even a factor in the decision.** Focus on user value and competitive advantage.

---

## Implementation Checklist

- [ ] Add `winning_bid` and `winning_bidder` columns to lots table
- [ ] Create `capture_final_results()` function
- [ ] Schedule daily job to check lots closed in last 48 hours
- [ ] Add price history API endpoint
- [ ] Create "Price History" UI component
- [ ] Add archival function for lots >365 days old
- [ ] Create materialized views for fast queries
- [ ] Add indexes on status, closing_at, winning_bid
- [ ] Monitor database size (alert at 500MB)
