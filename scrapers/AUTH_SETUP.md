# Kwara Authentication Setup Guide

## Overview

The authenticated scraper uses multiple Kwara.com.br user accounts to:
- Fetch full lot descriptions (not just brief summaries)
- Access protected detail pages
- Distribute load across accounts to avoid rate limits
- Continue scraping even when one account hits a limit

## Account Strategy

### Why Multiple Accounts?

1. **Rate Limit Avoidance**: Kwara may limit requests per account
2. **Redundancy**: If one account fails, others continue working
3. **Extended Coverage**: More accounts = more lots can be scraped before limits
4. **Parallel Processing**: Multiple accounts can work simultaneously

### Recommended Number of Accounts

- **Development/Testing**: 1-2 accounts
- **Production**: 3-5 accounts (spread across different emails/IPs if possible)

## Setup Instructions

### Step 1: Create Kwara Accounts

1. Go to https://www.kwara.com.br
2. Click "Registrar" (Sign up)
3. Create accounts using different email addresses
   - Use Gmail aliases (user+1@gmail.com, user+2@gmail.com) for quick setup
   - Or use temporary email services for testing
4. Verify email addresses if required

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Account 1 (Primary)
KWARA_ACCOUNT_1_EMAIL=your-email1@example.com
KWARA_ACCOUNT_1_PASSWORD=your-password1

# Account 2 (Backup)
KWARA_ACCOUNT_2_EMAIL=your-email2@example.com
KWARA_ACCOUNT_2_PASSWORD=your-password2

# Account 3 (Additional)
KWARA_ACCOUNT_3_EMAIL=your-email3@example.com
KWARA_ACCOUNT_3_PASSWORD=your-password3

# Add more accounts as needed (KWARA_ACCOUNT_4_*, KWARA_ACCOUNT_5_*, etc.)
```

### Step 3: Security Considerations

⚠️ **IMPORTANT**: Keep your credentials secure!

1. **Never commit .env to git** (already in .gitignore)
2. **Use strong, unique passwords** for each account
3. **Don't use personal/main accounts** - create dedicated scraper accounts
4. **Rotate passwords periodically** (every 30-60 days)
5. **Monitor account status** - if accounts get blocked, replace them

### Step 4: Test Authentication

Run the test scraper:

```bash
cd /Users/aromanon/radar-leilao/scrapers
python kwara_auth_scraper.py
```

You should see output like:
```
Auth Status:
  Total Accounts: 3
  Active Accounts: 3
✓ Authenticated scraping enabled!
```

## How It Works

### Account Rotation

The `AuthManager` class uses round-robin rotation:

1. Gets next available account
2. Checks if account is rate-limited
3. Makes authenticated request
4. Handles rate limits (HTTP 429) automatically
5. Switches to next account if current one is limited

### Rate Limit Handling

When an account hits a rate limit:

```
Rate limit hit for account@email.com
Waiting until 2025-04-02 15:30:00
Switching to next account...
```

The scraper:
- Marks account as "rate limited"
- Waits for `Retry-After` header duration
- Automatically switches to another account
- Returns to rate-limited account after cooldown

### Session Management

- Each account maintains its own session cookies
- Sessions automatically refresh on auth failures (401/403)
- Sessions persist across requests (don't need to re-login every time)

## Usage Examples

### Basic Usage (Fetch All Lots with Full Descriptions)

```python
from kwara_auth_scraper import KwaraAuthenticatedScraper

scraper = KwaraAuthenticatedScraper(save_to_db=True)

lots = scraper.scrape_lots_with_details(
    category_ids=['1335572015838398043'],  # metais category
    max_pages=3,
    fetch_details=True,
    delay_between_details=2.0  # 2 seconds between requests
)

print(f"Scraped {len(lots)} lots with full descriptions")
```

### Control Detail Fetching

```python
# Only API data (fast, but brief descriptions)
lots = scraper.scrape_lots_with_details(
    category_ids=['1335572015838398043'],
    fetch_details=False  # Skip authenticated detail pages
)

# Full descriptions with custom delay
lots = scraper.scrape_lots_with_details(
    category_ids=['1335572015838398043'],
    fetch_details=True,
    delay_between_details=3.0  # Slower = safer
)
```

### Get Authentication Stats

```python
auth_stats = scraper.auth_manager.get_stats()

print(f"Active accounts: {auth_stats['active_accounts']}")
print(f"Rate limited: {auth_stats['rate_limited_accounts']}")
print(f"Total requests: {auth_stats['total_requests']}")

for account in auth_stats['accounts']:
    print(f"{account['email']}: {account['request_count']} requests")
```

## Monitoring and Maintenance

### Check Account Health

```python
stats = scraper.auth_manager.get_stats()

for account in stats['accounts']:
    if not account['active']:
        print(f"⚠️  Account inactive: {account['email']}")
    elif account.get('rate_limited_until'):
        print(f"⏸️  Account rate limited until: {account['rate_limited_until']}")
    else:
        print(f"✓ Account healthy: {account['email']}")
```

### Refresh All Sessions

```python
scraper.auth_manager.refresh_all_sessions()
```

## Troubleshooting

### "No authenticated accounts configured"

**Problem**: No accounts in environment variables

**Solution**:
1. Check `.env` file exists
2. Verify `KWARA_ACCOUNT_1_EMAIL` and `KWARA_ACCOUNT_1_PASSWORD` are set
3. Restart Python process after updating `.env`

### "All accounts are rate limited"

**Problem**: All accounts hit rate limits

**Solution**:
1. Wait for rate limits to expire (check `rate_limited_until`)
2. Add more accounts
3. Increase `delay_between_details` to reduce request frequency
4. Consider scraping less frequently

### "Login failed for account"

**Problem**: Incorrect credentials or account issue

**Solution**:
1. Verify email/password are correct
2. Check if account is blocked on Kwara website
3. Try logging in manually on the website
4. Replace account with new one

### "Auth failed during scraping"

**Problem**: Session expired or invalid

**Solution**:
- The scraper will automatically attempt to re-login
- If it persists, the account may be blocked
- Replace the affected account

## Best Practices

### For Development

- Use 1-2 accounts only
- Set `delay_between_details=2.0` or higher
- Scrape 1-2 pages max for testing

### For Production

- Use 3-5 accounts minimum
- Set `delay_between_details=1.0` to `2.0`
- Monitor account health daily
- Have backup accounts ready
- Run scrapers during off-peak hours (Brazilian night = US morning)

### Scraping Etiquette

1. **Be polite**: Don't overload Kwara's servers
2. **Use delays**: Always use `delay_between_details`
3. **Respect limits**: Honor rate limit responses
4. **Rotate accounts**: Distribute load evenly
5. **Monitor impact**: If you notice issues, slow down

## Account Creation Tips

### Quick Setup (Testing)

Use Gmail aliases:
- `yourname+kwara1@gmail.com`
- `yourname+kwara2@gmail.com`
- `yourname+kwara3@gmail.com`

All deliver to same inbox, but count as separate accounts.

### Production Setup

- Use separate email addresses
- Consider temporary email services for privacy
- Create accounts gradually over time
- Document which email/password corresponds to which account number

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Never share account credentials in code/chat
- [ ] Use unique passwords for each account
- [ ] Change passwords if credentials are accidentally exposed
- [ ] Monitor Kwara accounts for suspicious activity
- [ ] Have a plan to replace compromised accounts

## Next Steps

1. Create your Kwara accounts
2. Add credentials to `.env`
3. Test with `python kwara_auth_scraper.py`
4. Monitor auth stats during first run
5. Adjust `delay_between_details` based on rate limiting

## Support

If you encounter issues:

1. Check logs for error messages
2. Verify accounts work on kwara.com.br website
3. Review auth stats: `scraper.auth_manager.get_stats()`
4. Check if Kwara site structure changed
5. Consider that rate limits may have tightened

---

**Last Updated**: 2025-04-02
**Scraper Version**: kwara_auth_scraper.py v1.0
