# Radar Leilão - Web Scrapers

Web scrapers for Brazilian auction sites, focused on **materiais** (construction materials, industrial equipment, metals).

**IMPORTANT**: These scrapers intentionally skip imóveis (real estate) and veículos (vehicles) auctions, focusing only on materials as specified in the PRD.

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Configuration

Create a `.env` file in the scrapers directory:

```bash
# Required: Supabase credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Proxy configuration
# See "Proxy Configuration" section below
```

Get these values from your Supabase project settings.

## Proxy Configuration

### Why Use Proxies?

Brazilian auction sites may block or rate-limit automated scraping. Proxies help:
- Avoid IP-based blocking
- Distribute requests across multiple IPs
- Bypass geographical restrictions

### Option 1: Direct Connection (Testing Only)
Leave proxy variables empty:
```bash
# No proxy configuration - use direct connection
```

### Option 2: Free Proxies (Unreliable)
```bash
USE_FREE_PROXIES=true
```
**Warning**: Free proxies are slow, unreliable, and often blocked. Only for testing.

### Option 3: Paid Proxy Service (Recommended)
Configure one of these paid services:

**WebShare.io** (https://www.webshare.io/) - Starts at $2.99/month (100 proxies) - **RECOMMENDED**
```bash
PAID_PROXY_SERVICE=webshare
WEBSHARE_API_KEY=your_api_key_here
```

**ScraperAPI** (https://scraperapi.com/) - Starts at $49/month
```bash
PAID_PROXY_SERVICE=scraperapi
SCRAPERAPI_KEY=your_api_key_here
```

**SmartProxy** (https://smartproxy.com/) - Starts at $75/month
```bash
PAID_PROXY_SERVICE=smartproxy
SMARTPROXY_USER=your_username
SMARTPROXY_PASS=your_password
```

**BrightData** (https://brightdata.com/) - Enterprise pricing
```bash
PAID_PROXY_SERVICE=brightdata
BRIGHTDATA_USER=your_username
BRIGHTDATA_PASS=your_password
```

### Option 4: Manual Proxy List
Provide your own proxies:
```bash
PROXY_LIST=proxy1.example.com:8080,proxy2.example.com:8080
```

## Running Scrapers

### Run all scrapers:
```bash
cd scrapers
python main.py
```

### Run individual scrapers:
```bash
cd scrapers
python -m scrapers.sodre_scraper
python -m scrapers.freitas_scraper
```

## Auctioneers Covered

- **Kwara Leilões**: Construction and industrial materials
- **Sodré Leilões**: Construction materials and industrial equipment (coming soon)
- **Freitas Leilões**: Industrial machinery and construction supplies (coming soon)

## Adding New Scrapers

1. Create a new scraper file in `scrapers/` directory
2. Inherit from `BaseScraper` class
3. Implement `scrape_lots()` method
4. Normalize categories to focus on materiais
5. Filter out imóveis and veículos
6. Add to `SCRAPERS` list in `main.py`

Example:
```python
from scrapers.base import BaseScraper, AuctionLot

class NewScraper(BaseScraper):
    def __init__(self, proxy_manager=None):
        super().__init__(
            base_url='https://example.com',
            proxy_manager=proxy_manager,
            delay_range=(3, 7)  # Random 3-7 second delays
        )

    def scrape_lots(self) -> List[AuctionLot]:
        # Implementation here
        # 1. Fetch listing pages
        # 2. Parse lot containers
        # 3. Extract data (title, price, image, etc.)
        # 4. Return list of AuctionLot objects
        pass
```

## Scraper Architecture

- **base.py**: `BaseScraper` abstract class with common functionality
  - `fetch_page()`: HTTP requests with proxy rotation
  - `parse_html()`: BeautifulSoup wrapper
  - `extract_price()`: Parse R$ prices from text
  - `calculate_risk_score()`: Risk assessment based on lot attributes

- **proxy_manager.py**: Proxy rotation and testing
  - `ProxySource`: Abstract base for proxy providers
  - `FreeProxyListSource`: Fetch free proxies from ProxyScrape API
  - `PaidProxySource`: Integration with ScraperAPI, SmartProxy, BrightData
  - `ProxyManager`: Rotation, testing, and failover

- **database.py**: Supabase integration
  - `save_lot()`: Insert or update individual lots
  - `insert_lots()`: Batch insert with upsert
  - `log_scraper_run()**: Track scraper execution

## Category Filtering

Scrapers automatically filter out:
- Real estate (imóveis)
- Vehicles (veículos, carros, motos)

And focus on:
- **construcao civil**: Cement, sand, bricks, steel
- **metais**: Copper, aluminum, steel sheets, tubes
- **maquinas**: Construction equipment, tractors, crushers
- **siderurgico**: Steel coils, bars, profiles

## Deployment

Recommended: Run via GitHub Actions every 6 hours:

```yaml
name: Scrapers
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Allow manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd scrapers
          pip install -r requirements.txt
      - name: Run scrapers
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          cd scrapers
          python main.py
```

## Database Schema

Scrapers insert into the `lots` table:
- `title`: Lot title
- `auctioneer`: Auctioneer name
- `category`: Materiais category
- `description`: Full description
- `current_bid`: Current bid amount
- `estimated_value`: Estimated value
- `location`: Geographic location
- `image_url`: Main image URL
- `edict_url`: Link to full edict
- `closing_at`: Auction closing datetime
- `risk_score`: low/medium/high
- `metadata`: Additional JSON data

## Monitoring

Scraper runs are logged to the `scraper_logs` table for monitoring:
- `auctioneer`: Which scraper
- `lots_count`: How many lots inserted
- `status`: success/error
- `error`: Error message if failed
- `ran_at`: Timestamp

## Troubleshooting

### No lots scraped
- Check if auctioneer site structure changed
- Verify CSS selectors in scraper
- Check network connectivity
- Review logs for specific errors

### Database errors
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Check Supabase project is active
- Ensure `lots` table exists (run migrations first)

### Rate limiting
Add delays between requests if needed:
```python
import time
time.sleep(2)  # 2 second delay
```

## Authenticated Scraping (NEW)

### Overview

For **Kwara.com.br**, we now support authenticated scraping to get:
- Full descriptions (not just brief summaries)
- All images from lot pages
- Detailed location information
- Additional metadata

### Two Scrapers Available

**1. API Scraper** (`kwara_scraper_final.py`)
- Fast scraping using Kwara's Next.js data API
- Brief descriptions (44-51 characters)
- No authentication required
- Good for testing and quick updates

**2. Authenticated Scraper** (`kwara_auth_scraper.py`)
- Slower but complete data
- Full descriptions from lot detail pages
- Requires Kwara user accounts
- Handles rate limits with account rotation

### Setting Up Authentication

See [AUTH_SETUP.md](AUTH_SETUP.md) for detailed instructions.

Quick setup:
1. Create Kwara accounts (use Gmail aliases: user+kwara1@gmail.com)
2. Add to `.env`:
   ```bash
   KWARA_ACCOUNT_1_EMAIL=user+kwara1@gmail.com
   KWARA_ACCOUNT_1_PASSWORD=password1
   KWARA_ACCOUNT_2_EMAIL=user+kwara2@gmail.com
   KWARA_ACCOUNT_2_PASSWORD=password2
   ```
3. Test: `python test_auth_setup.py`

### Using the Authenticated Scraper

```python
from kwara_auth_scraper import KwaraAuthenticatedScraper

scraper = KwaraAuthenticatedScraper(save_to_db=True)

# Scrape with full descriptions
lots = scraper.scrape_lots_with_details(
    category_ids=['1335572015838398043'],  # Metais
    max_pages=2,
    fetch_details=True,
    delay_between_details=2.0  # Seconds between requests
)
```

### Why Multiple Accounts?

- Avoid rate limits (Kwara limits requests per account)
- Redundancy (if one account fails, others continue)
- Extended coverage (more accounts = more lots)
- Parallel processing (distribute load)

### Account Rotation

The `AuthManager` automatically:
- Rotates through accounts using round-robin
- Handles rate limits (HTTP 429)
- Refreshes expired sessions
- Tracks account health and usage

### Monitoring Auth Usage

```python
stats = scraper.auth_manager.get_stats()

print(f"Active accounts: {stats['active_accounts']}")
print(f"Rate limited: {stats['rate_limited_accounts']}")
print(f"Total requests: {stats['total_requests']}")
```

### Performance Comparison

| Metric | API Scraper | Authenticated Scraper |
|--------|------------|---------------------|
| Speed | ~1 lot/sec | ~1 lot/2-3 sec |
| Description | 44-51 chars | Full (unlimited) |
| Images | Primary only | All images |
| Auth Required | No | Yes |
| Rate Limit Risk | Low | Medium (mitigated with multiple accounts) |
| Best For | Testing, quick updates | Production, complete data |
