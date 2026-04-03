# Dynamic Auction Closing Time Strategy

## 🎯 Problem Identified

**User Insight:** Kwara extends auction time when there are last-minute bids!

**Example:**
- Auction scheduled to close at 15:00
- New bid at 14:59:30 → Timer extends to 15:01
- Another bid at 15:00:45 → Timer extends to 15:02
- Hot dispute can extend auction by 10+ minutes

**Impact:**
- ❌ Can't rely on `closing_at + 6 hours` strategy
- ❌ Need to detect ACTUAL closing, not scheduled closing
- ❌ Must monitor auctions more aggressively in last 30 minutes

---

## 💡 Solution Implemented

### **1. Enhanced Final Price Capture**

**Old Strategy:**
```python
# Check auctions 2-6 hours after scheduled closing
WHERE closing_at >= NOW() - INTERVAL '6 hours'
  AND closing_at < NOW() - INTERVAL '2 hours'
```

**New Strategy:**
```python
# Check auctions 2-12 hours after scheduled closing (handles extensions)
# Also check auction status field if available
WHERE closing_at >= NOW() - INTERVAL '12 hours'
  AND closing_at < NOW() - INTERVAL '2 hours'
  AND status IS NULL
```

**Logic:**
1. Fetch auction from Kwara API
2. Check `status` field:
   - If `status == 'closed'` → Capture final bid
   - If `status == 'active'` → Auction was extended! Update `closing_at`
3. If no status field, compare current bid vs stored bid:
   - If bid increased → Auction still active
   - If bid unchanged → Assume closed

---

### **2. Hot Dispute Monitoring (NEW)**

**Command:**
```bash
python3 price_refresh_strategy.py monitor-disputes --minutes 30
```

**Purpose:**
- Aggressively monitor lots in last 30 minutes
- Detect auction extensions in real-time
- Update `closing_at` when timer extends

**Strategy:**
- Refresh every 30 seconds (vs. 15 minutes for hot lots)
- Check if `closing_at` changed → Auction extended!
- Update database with new closing time
- Minimal delay (0.5s) between requests

**Cron Job:**
```bash
# Run every 5 minutes to check for disputes
*/5 * * * * python3 price_refresh_strategy.py monitor-disputes --minutes 30
```

---

### **3. User-Controlled Price Refresh**

**Frontend Feature:**
- "Preço Atual" button on lot detail page
- On-demand fetch from Kwara API
- Shows loading state while fetching
- Updates price + timestamp immediately

**API Endpoint:**
```
POST /api/lots/[id]/refresh
```

**Response:**
```json
{
  "success": true,
  "lot": {
    "id": "123",
    "current_bid": 15000,
    "last_scraped_at": "2026-04-02T15:30:00Z",
    "bids_count": 25
  },
  "message": "Price updated successfully"
}
```

**Benefits:**
- ✅ Users can verify prices themselves
- ✅ Reduces support burden
- ✅ Works during hot disputes
- ✅ Transparency builds trust

---

## 📋 Updated Cron Schedule

```bash
# crontab -e

# Hot disputes monitoring (every 5 min during active hours)
*/5 * * * * python3 price_refresh_strategy.py monitor-disputes --minutes 30 >> logs/disputes.log 2>&1

# Price refresh (hot lots < 6h) - every 15 min
*/15 * * * * python3 price_refresh_strategy.py refresh-hot --hours 6 >> logs/price_refresh.log 2>&1

# Price refresh (warm lots 6-48h) - every 2 hours
0 */2 * * * python3 price_refresh_strategy.py refresh-warm --min 6 --max 48 >> logs/price_refresh.log 2>&1

# Capture final prices - every hour
0 * * * * python3 price_refresh_strategy.py capture-final >> logs/price_capture.log 2>&1

# Archive old auctions - every Sunday at 3 AM
0 3 * * 0 python3 archive_closed_auctions.py archive --days 30 >> logs/archive.log 2>&1
```

---

## 🔄 Complete Refresh Strategy

| Time to Close | Frequency | Reason |
|---------------|-----------|---------|
| **< 30 min** | Every 30 sec | Hot dispute - rapid changes |
| **30 min - 6h** | Every 15 min | Hot lots - bidding active |
| **6h - 48h** | Every 2 hours | Warm lots - moderate activity |
| **> 48h** | On-demand | Cold lots - no bidding yet |
| **Closed** | One-time | Capture final bid for intel |

**API Usage:**
- Hot disputes: ~50 lots × 120 req/day = 6,000 requests
- Hot lots: ~100 lots × 96 req/day = 9,600 requests
- Warm lots: ~500 lots × 12 req/day = 6,000 requests
- **Total: ~21,600 requests/day** (still manageable!)

---

## 🎯 Key Improvements

### **1. Handles Extensions**
```python
# Detects when Kwara extends auction time
if new_closing_at > old_closing_at:
    logger.info(f"AUCTION EXTENDED! {old_closing_at} → {new_closing_at}")
    # Update database with new closing time
```

### **2. Status Field Detection**
```python
# Checks if Kwara provides auction status
auction_status = updated_lot.get('status')

if auction_status == 'closed':
    # Capture final bid
elif auction_status == 'active':
    # Auction still running (was extended!)
```

### **3. Bid Comparison Fallback**
```python
# If no status field, check if bids increased
if current_bid > stored_bid:
    # Auction still active with higher bid
else:
    # Assume closed (no status field, no new bids)
```

### **4. User-Controlled Refresh**
```typescript
// Frontend button for on-demand price check
<button onClick={refreshPrice}>
  <RefreshCw className="w-3.5 h-3.5" />
  Preço Atual
</button>
```

---

## 📊 Monitoring & Metrics

**Track These Metrics:**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Extension detection** | Catch 95%+ of extensions | Log "AUCTION EXTENDED!" count |
| **Final bid accuracy** | > 90% capture rate | Compare final_bid vs. scraped after 24h |
| **Hot dispute coverage** | < 1 min latency | Time from extension to detection |
| **API usage** | < 25K requests/day | Request counter logs |

---

## ✨ Benefits

1. **Accuracy:** Captures real closing times, not just scheduled
2. **Transparency:** Users can verify prices themselves
3. **Efficiency:** Only aggressive refresh when needed (last 30 min)
4. **Intelligence:** Still preserves historical data for market intel
5. **User Trust:** On-demand refresh gives users control

**Your system now handles dynamic auction closings intelligently!** 🚀
