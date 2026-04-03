"""
Test script for Kwara authentication setup
Verifies that accounts are configured and can log in
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

import logging
from utils.auth_manager import get_auth_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_auth_setup():
    """Test authentication setup and provide helpful feedback"""
    print("=" * 80)
    print("Kwara Authentication Setup Test")
    print("=" * 80)

    auth_manager = get_auth_manager()
    stats = auth_manager.get_stats()

    print(f"\n📊 Authentication Status:")
    print(f"   Total accounts configured: {stats['total_accounts']}")
    print(f"   Active accounts: {stats['active_accounts']}")
    print(f"   Rate-limited accounts: {stats['rate_limited_accounts']}")
    print(f"   Total requests made: {stats['total_requests']}")

    if stats['total_accounts'] == 0:
        print("\n" + "=" * 80)
        print("⚠️  NO AUTHENTICATED ACCOUNTS CONFIGURED")
        print("=" * 80)
        print("\nTo enable authenticated scraping, add accounts to your .env file:")
        print("\n1. Open or create .env file:")
        print("   cd /Users/aromanon/radar-leilao")
        print("   nano .env  # or use your preferred editor")
        print("\n2. Add the following lines:")
        print("   KWARA_ACCOUNT_1_EMAIL=your-email1@example.com")
        print("   KWARA_ACCOUNT_1_PASSWORD=your-password1")
        print("\n   KWARA_ACCOUNT_2_EMAIL=your-email2@example.com")
        print("   KWARA_ACCOUNT_2_PASSWORD=your-password2")
        print("\n3. Save and exit")
        print("\n4. Run this test again: python scrapers/test_auth_setup.py")
        print("\n" + "=" * 80)
        print("💡 Why use multiple accounts?")
        print("- Avoid rate limits")
        print("- Continue scraping if one account fails")
        print("- Distribute load across accounts")
        print("\nSee AUTH_SETUP.md for detailed instructions.")
        print("=" * 80)
        return False

    print("\n" + "-" * 80)
    print("Account Details:")
    print("-" * 80)

    for i, account in enumerate(stats['accounts'], 1):
        status = "✓ Active" if account['active'] else "✗ Inactive"
        if account.get('rate_limited_until'):
            status = f"⏸️  Rate Limited until {account['rate_limited_until']}"

        print(f"\n{i}. {account['email']}")
        print(f"   Status: {status}")
        print(f"   Requests: {account['request_count']}")
        if account.get('last_used'):
            print(f"   Last used: {account['last_used']}")

    print("\n" + "=" * 80)
    print("✓ Authentication setup is ready!")
    print("=" * 80)

    print("\n🚀 Next Steps:")
    print("1. Test the authenticated scraper:")
    print("   python scrapers/kwara_auth_scraper.py")
    print("\n2. Or run a quick scrape test:")
    print("   python scrapers/test_scraper_integration.py")

    return True


if __name__ == '__main__':
    try:
        success = test_auth_setup()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
