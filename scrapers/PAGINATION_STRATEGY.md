# Pagination Strategy for Recursive Scraping

## Current Issue
The scraper only fetches **12 lots** (1 page), but Kwara supports:
- **12 lots per page** (default)
- **48 lots per page** (maximum)

With 60+ lots currently on Kwara, we need to scrape **multiple pages**.

## Solution: Recursive Pagination

### Option 1: URL-Based Pagination (Recommended)

Kwara likely uses cursor-based pagination or offset parameters.

```python
class KwaraAPIScraper(BaseScraper):
    def scrape_all_lots(self, max_pages: int = None) -> List[AuctionLot]:
        """
        Recursively scrape all pages until no more lots

        Args:
            max_pages: Maximum pages to scrape (None = unlimited)
        """
        all_lots = []
        page = 1

        while True:
            # Check page limit
            if max_pages and page > max_pages:
                logger.info(f"Reached max pages limit: {max_pages}")
                break

            logger.info(f"Scraping page {page}...")

            # Fetch lots for this page
            lots = self._fetch_page(page)

            if not lots:
                logger.info(f"No more lots on page {page}, stopping")
                break

            all_lots.extend(lots)
            logger.info(f"  → Found {len(lots)} lots (total: {len(all_lots)})")

            page += 1

            # Polite delay between requests
            time.sleep(random.uniform(2, 5))

        return all_lots

    def _fetch_page(self, page: int) -> List[AuctionLot]:
        """Fetch lots from specific page"""
        api_url = f"{self.base_url}/_next/data/{self.build_id}/busca.json"

        response = self.session.get(
            api_url,
            params={
                'assetCategoryIds[]': '1335572015838398043',
                'page': page,  # Try page parameter
                'limit': 48,   # Try to increase page size
            },
            timeout=30
        )

        # Parse and return lots
        data = json.loads(response.text)
        items = data.get('pageProps', {}).get('searchResult', {}).get('items', [])

        return [self._parse_api_item(item) for item in items]
```

### Option 2: Cursor-Based Pagination

If Kwara uses cursor tokens (more likely for infinite scroll):

```python
def scrape_all_lots_with_cursor(self):
    """Scrape using cursor-based pagination"""
    all_lots = []
    cursor = None

    while True:
        lots, next_cursor = self._fetch_with_cursor(cursor)

        if not lots:
            break

        all_lots.extend(lots)

        if not next_cursor:
            break  # No more pages

        cursor = next_cursor
        time.sleep(2)

    return all_lots
```

### Option 3: "Load More" Button Simulation

Some sites require simulating the "load more" button action:

```python
def scrape_all_lots_simulate_scroll(self):
    """Simulate scrolling to load all lots"""
    all_lots = []

    # Initial load
    lots = self._fetch_initial_batch()
    all_lots.extend(lots)

    # Keep loading "more" until exhausted
    while len(lots) > 0:
        lots = self._fetch_more_batch()
        if not lots:
            break
        all_lots.extend(lots)
        time.sleep(2)

    return all_lots
```

## Implementation Priority

1. **Phase 1**: Add page-based pagination (try page=1, page=2, etc.)
2. **Phase 2**: Add page size increase (try limit=48)
3. **Phase 3**: Add cursor-based pagination if needed
4. **Phase 4**: Add "load more" simulation if needed

## Best Practices

- **Rate limiting**: Add 2-5 second delays between pages
- **Error handling**: Continue if one page fails
- **Progress tracking**: Log page numbers and totals
- **Duplicate detection**: Skip lots already seen across pages
- **Stop condition**: Stop when page returns 0 lots

## Testing Pagination

```python
# Test pagination
scraper = KwaraAPIScraper()
lots = scraper.scrape_all_lots(max_pages=5)

print(f"Total lots scraped: {len(lots)}")
print(f"Page 1: {sum(1 for lot in lots if lot.metadata.get('page') == 1)}")
print(f"Page 2: {sum(1 for lot in lots if lot.metadata.get('page') == 2)}")
```

## Expected Results

With proper pagination, you should scrape:
- **Page 1**: 48 lots
- **Page 2**: 48 lots
- **Page 3**: X lots (if available)
- **Total**: 100+ lots from all categories

## Monitoring

Track scraping efficiency:

```python
# Log pagination statistics
logger.info(f"Pagination Statistics:")
logger.info(f"  Pages scraped: {page_count}")
logger.info(f"  Total lots: {len(all_lots)}")
logger.info(f"  Avg lots/page: {len(all_lots) / page_count:.1f}")
logger.info(f"  Time elapsed: {elapsed_time} seconds")
```

This ensures **100% coverage** of Kwara's inventory, not just the first page!
