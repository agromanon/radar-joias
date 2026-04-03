# Browser-Based Scraper Setup Guide

## Overview

The browser-based scraper uses **Playwright** (a headless browser automation tool) to authenticate with Kwara.com.br and scrape full lot details.

**Why Browser-Based?**
- Kwara uses NextAuth.js or similar for authentication
- Login requires JavaScript execution and CSRF tokens
- Cannot be done with simple HTTP requests
- Browser handles cookies, sessions, and redirects automatically

## Installation

### Step 1: Install Playwright and Python Dependencies

```bash
# Install Python packages
pip install playwright beautifulsoup4 requests python-dotenv

# Install Playwright browsers (Chromium)
playwright install chromium
```

**Note**: The browser download is ~150-200MB, but it's a one-time download.

### Step 2: Verify Installation

```bash
# Test Playwright installation
python -c "from playwright.sync_api import sync_playwright; print('✓ Playwright installed')"
```

Expected output: `✓ Playwright installed`

## Usage

### Quick Test

```bash
cd /Users/aromanon/radar-leilao/scrapers
python kwara_browser_scraper.py
```

This will:
1. Load your Kwara account credentials from `.env.local`
2. Launch headless Chromium browser
3. Navigate to Kwara login page
4. Fill in email/password
5. Click login button
6. Wait for redirect
7. Fetch a sample detail page
8. Show you the results

### Expected Output

```
================================================================================
Kwara Browser Scraper - Test Run
================================================================================

📊 Authentication Status:
   Total accounts: 1
   Active accounts: 1

🔐 Testing browser login...
   ✓ Login successful for radar.leilao.br@gmail.com

📄 Testing detail page fetch...
   ✓ Fetched page: 45678 characters
   ✓ Description found: Sofá de 2 lugares, fabricado em madeira maciça...

✓ Test completed!
================================================================================
```

## How It Works

### Authentication Flow

1. **Launch Headless Browser**
   - Chromium runs in headless mode (no GUI)
   - Full JavaScript execution support
   - Handles cookies and sessions

2. **Navigate to Login Page**
   - Loads `https://www.kwara.com.br/login`
   - Waits for JavaScript to execute
   - Generates CSRF tokens automatically

3. **Fill and Submit Login Form**
   - Finds email/password input fields
   - Types in your credentials
   - Clicks login button
   - Handles any redirects

4. **Save Browser Context**
   - Extracts session cookies
   - Saves browser state for reuse
   - Can create new pages without re-login

5. **Scrape Detail Pages**
   - Uses authenticated browser context
   - Fetches full HTML of lot pages
   - Extracts descriptions, images, location

### Browser Context Reuse

Once logged in, the browser context is saved and reused:

```python
# Login once
await auth_manager.login_account(account)

# Create multiple pages without re-login
page1 = await context.new_page()
await page1.goto(url1)

page2 = await context.new_page()
await page2.goto(url2)

# Both pages share the same authenticated session
```

## Advantages vs HTTP-Only Scraper

| Feature | HTTP Scraper | Browser Scraper |
|---------|--------------|-----------------|
| **Authentication** | ❌ Requires REST API | ✅ Works with any login |
| **JavaScript** | ❌ No JS execution | ✅ Full JS support |
| **CSRF Tokens** | ❌ Manual handling | ✅ Automatic |
| **OAuth** | ❌ Complex | ✅ Automatic |
| **Speed** | ✅ Fast (1 lot/sec) | ⚠️ Slower (1 lot/2-3 sec) |
| **Setup** | ✅ Simple | ⚠️ Requires Playwright |
| **Reliability** | ⚠️ May break on API changes | ✅ More robust |

## Performance Tips

### 1. Reuse Browser Contexts

Don't login for every request. The context is saved and reused:

```python
# Good - reuse context
html = await auth_manager.make_authenticated_request(url1)
html = await auth_manager.make_authenticated_request(url2)  # No re-login

# Bad - logging in repeatedly
await auth_manager.login_account(account)  # Unnecessary
```

### 2. Use Appropriate Delays

Be polite with requests:

```python
lots = scraper.scrape_lots_with_browser_details(
    category_ids=['1335572015838398043'],
    max_pages=2
    # Internal 1s delay between requests
)
```

### 3. Limit Concurrent Operations

Don't create too many browser contexts:

```python
# Good - one context at a time
html1 = await auth_manager.make_authenticated_request(url1)
html2 = await auth_manager.make_authenticated_request(url2)

# Bad - multiple contexts (memory intensive)
```

## Troubleshooting

### "playwright not found"

**Problem**: Playwright package not installed

**Solution**:
```bash
pip install playwright
playwright install chromium
```

### "Browser download failed"

**Problem**: Chromium download failed

**Solution**:
```bash
# Try again
playwright install chromium --force

# Or use system Chrome
playwright install-deps chromium
```

### "Login failed"

**Problem**: Wrong credentials or login form changed

**Solution**:
1. Verify credentials in `.env.local`
2. Try logging in manually on kwara.com.br
3. Check if Kwara changed their login flow

### "Timeout waiting for selector"

**Problem**: Page didn't load in time

**Solution**:
- Increase timeout in `auth_browser.py`
- Check your internet connection
- Verify Kwara site is accessible

### "Cannot find login button"

**Problem**: Kwara changed login page HTML

**Solution**:
1. Inspect login page in browser dev tools
2. Update login selectors in `auth_browser.py`
3. Add new selector to `login_selectors` list

## Deployment Considerations

### GitHub Actions

Add to your workflow:

```yaml
- name: Install Python dependencies
  run: |
    pip install playwright
    playwright install chromium

- name: Run browser scraper
  env:
    KWARA_ACCOUNT_1_EMAIL: ${{ secrets.KWARA_ACCOUNT_1_EMAIL }}
    KWARA_ACCOUNT_1_PASSWORD: ${{ secrets.KWARA_ACCOUNT_1_PASSWORD }}
  run: |
    cd scrapers
    python kwara_browser_scraper.py
```

### Memory Requirements

Headless browser uses ~100-200MB RAM per context.

**For GitHub Actions**:
- Default runner: 7GB RAM (plenty)
- Can run 20-30 contexts safely

**For Local**:
- 8GB RAM recommended
- Close other browser windows during scraping

### CPU Requirements

Chromium is CPU-intensive (~5-10% per context).

**Recommendations**:
- Multi-core CPU helpful
- Limit to 5-10 concurrent operations
- Use delays between requests

## Security Best Practices

### 1. Never Commit Credentials

```bash
# .gitignore
.env.local
*.state.json
playwright-state/
```

### 2. Use Dedicated Accounts

Don't use personal accounts for scraping:
- Create dedicated Kwara accounts
- Use strong, unique passwords
- Rotate passwords monthly

### 3. Monitor Account Health

Check accounts regularly:
```python
stats = auth_manager.get_stats()
for account in stats['accounts']:
    if not account['active']:
        print(f"⚠️  Account inactive: {account['email']}")
```

### 4. Clean Up Resources

Always cleanup when done:
```python
try:
    # Your scraping code
    await scraper.scrape()
finally:
    await auth_manager.cleanup()
```

## Alternative: Use API-Only Mode

If you don't need full descriptions, use the faster API-only scraper:

```python
from kwara_scraper_final import KwaraAPIScraper

scraper = KwaraAPIScraper(save_to_db=True)
lots = scraper.scrape_lots(
    category_ids=['1335572015838398043'],
    max_pages=3
)
```

**Trade-off**: Brief descriptions (44 chars) vs full descriptions

## Next Steps

1. ✅ Install Playwright: `pip install playwright && playwright install chromium`
2. ✅ Add credentials to `.env.local`
3. ✅ Run test: `python kwara_browser_scraper.py`
4. ✅ Verify login works
5. ✅ Start scraping with full descriptions
6. ✅ Monitor account health

## Support

If you encounter issues:

1. **Check Playwright docs**: https://playwright.dev/python/
2. **Verify credentials**: Test login manually on kwara.com.br
3. **Check logs**: Error messages show what failed
4. **Inspect login page**: Use browser dev tools to see HTML structure

---

**Last Updated**: 2025-04-02
**Playwright Version**: 1.40+
**Python Version**: 3.9+
