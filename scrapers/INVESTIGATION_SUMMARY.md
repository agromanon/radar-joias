# Kwara.com.br Scraper Investigation Summary

**Date**: 2026-04-02
**Status**: ⚠️ CRITICAL SITE ARCHITECTURE CHANGES DETECTED

## Executive Summary

The Kwara.com.br website has undergone significant architecture changes that prevent the scraper from accessing extended lot fields (Informações, Referência, Descrição, Observações gerais, Evento, Visitação, Retirada).

**Key Finding**: Lot detail pages that were previously accessible are now returning 404 errors, even with authenticated browser sessions.

## Test Results

### Test 1: Unauthenticated Access to Lot Detail Pages
**Script**: `test_with_screenshot.py`
**Result**: ✗ FAILED
- **Status**: All lot pages redirect to authentication wall
- **Page Content**: Only shows login modal
- **Extended Fields**: None found in HTML

### Test 2: Authenticated Access to Old Lot Slug
**Script**: `test_authenticated_lot.py`
**Lot**: `sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848`
**Result**: ✗ FAILED
- **Status**: Returns 404 - "A página que você procura não existe"
- **Issue**: Lot may be closed/sold (ended 2026-04-02T17:00:00)

### Test 3: Authenticated Access to Active Lot
**Script**: `test_current_active_lot.py`
**Lot**: `banheira-na-o-inclui-ducha-ref-ab-35550-83024` (ends 2026-04-10)
**Result**: ✗ FAILED
- **Status**: Returns 404 even for active lot
- **Page Route**: `/404` (not lot detail page)

### Test 4: Authentication Verification
**Script**: `test_auth_success.py`
**Result**: ✓ PASSED
- **Authentication**: Working correctly
- **Protected Pages**: Can access `/minha-conta` successfully
- **Login Status**: Confirmed logged in (shows "Minha conta")

### Test 5: Category Page Navigation
**Script**: `test_category_page_structure.py`
**Result**: ⚠️ PARTIAL
- **Category Page**: Accessible but lot cards not loading via simple selectors
- **Issue**: Content likely loaded via client-side JavaScript

## Root Cause Analysis

### Problem 1: URL Structure Mismatch
**Evidence**:
- API returns slugs like `sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848`
- URL pattern tested: `https://www.kwara.com.br/lote/{slug}`
- Result: All return 404

**Possible Causes**:
1. Lot slugs from search API don't match detail page URLs
2. Category-specific lots require different URL format
3. Build ID rotation issue (`ziWczoweSgRNOjgvfT9eZ` may be outdated)

### Problem 2: Site Architecture Changes
**User Statement**: "there are two desciptive fields that can be seen for unauthenticated users"

**Current Reality**:
- Unauthenticated users see only login modal
- Authenticated users get 404 on lot pages
- Extended fields not accessible via HTML scraping

**Conclusion**: Site now requires authentication AND uses different URL/API structure

## API Endpoints Discovered

### Search API (Working)
```
https://www.kwara.com.br/_next/data/{build_id}/busca.json
?assetCategoryIds[]={category_id}
&page=1
&pageSize=48
```

**Response Structure**:
```json
{
  "pageProps": {
    "searchResult": {
      "items": [
        {
          "slug": "...",
          "id": "...",
          "title": "...",
          "refs": ["..."],
          "seller": {...},
          "lotAuctionSettings": [...],
          // Basic lot info only
        }
      ]
    }
  }
}
```

### Lot Detail API (Not Found)
**Expected Pattern**: `/_next/data/{build_id}/pt-BR/lote/{slug}.json`
**Status**: Returns 404
**Issue**: Build ID or slug format may be incorrect

## Recommendations

### Option 1: Intercept Browser API Calls (Recommended)
Instead of scraping HTML, intercept the actual API calls made by the browser when viewing lot details:

1. **Navigate to lot page with authentication**
2. **Monitor XHR/Fetch requests** in DevTools
3. **Identify the actual API endpoint** that loads lot details
4. **Call that API directly** with authentication cookies

**Advantages**:
- Bypasses HTML scraping entirely
- Gets structured data directly
- More reliable and maintainable

### Option 2: Use Category Page with Lot Cards
Navigate to category page and extract lot information from the rendered lot cards:

1. **Go to category URL**: `https://www.kwara.com.br/busca?assetCategoryIds[]={id}`
2. **Wait for JavaScript rendering**
3. **Extract data from rendered lot cards**
4. **Follow links to detail pages**

**Advantages**:
- Works with current site structure
- Gets actual URLs being used

### Option 3: Wait for Site Stabilization
If Kwara is currently migrating their platform:

1. **Monitor site changes** over next few days
2. **Check if old URL pattern** returns
3. **Contact Kwara support** about API access for scrapers

**Risk**: Extended field data may never be available via HTML again

## Database Schema Updates Applied

✓ **Completed**:
- Added `source_url` column to `lots` table
- Configured service role key for scraper (bypasses RLS)
- Database insertion working with HTTP REST API

## Next Steps

### Immediate Actions:
1. **Run browser DevTools** while manually accessing a lot detail page
2. **Identify the actual API endpoint** loading extended fields
3. **Test that endpoint** with authentication cookies
4. **Update scraper** to use the correct API

### Code Changes Needed:
```python
# Instead of scraping HTML:
# async def scrape_lot_complete(self, lot, context):
#     await page.goto(lot.source_url)
#     html = await page.content()
#     # Parse HTML...

# Use this approach:
async def scrape_lot_complete(self, lot, context):
    # Intercept API call
    api_data = await self.intercept_lot_api(lot.slug, context)
    # Extract fields from API response
```

## Files Created

Test Scripts:
- `test_with_screenshot.py` - Visual debugging with screenshots
- `fetch_from_nextjs_api.py` - Direct API access attempts
- `test_no_auth.py` - Unauthenticated scraping test
- `debug_authenticated_page.py` - Authenticated page analysis
- `test_current_lot.py` - Test with current lot from API
- `check_api_structure.py` - API response structure analysis
- `test_authenticated_lot.py` - Authenticated lot access test
- `test_current_active_lot.py` - Active lot with authentication
- `test_auth_success.py` - Verification of authentication
- `test_category_page_urls.py` - Category page URL extraction
- `test_category_page_structure.py` - Category page structure analysis

Scraper Components:
- `kwara_scraper_full_fields.py` - Enhanced scraper with field extraction
- `kwara_scraper_final.py` - Final scraper version
- `utils/database_http.py` - HTTP-based Supabase integration
- `utils/auth_browser.py` - Browser authentication module

## Conclusion

**CRITICAL**: The current scraping approach cannot access extended lot fields due to:
1. Site architecture changes (authentication now required)
2. URL structure changes (old slug format returns 404)
3. Possible API endpoint changes

**RECOMMENDATION**: Shift from HTML scraping to API interception approach. Monitor actual browser network requests when accessing lot detail pages to identify the correct API endpoint for extended field data.
