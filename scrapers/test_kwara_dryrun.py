"""
Test Kwara Scraper (Dry Run - No Database)
Tests scraping without saving to database
"""

import os
import sys
import logging
from dotenv import load_dotenv

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kwara_scraper import KwaraScraper
from utils.proxy_manager import create_proxy_manager

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_kwara_dryrun():
    """Test Kwara scraper without database"""
    print("=" * 60)
    print("Kwara Scraper - Dry Run (No Database)")
    print("=" * 60)

    # Setup proxy manager with WebShare
    logger.info("Setting up WebShare proxy manager...")
    proxy_manager = create_proxy_manager(
        use_free=False,
        use_paid=True,
        paid_service='webshare',
        paid_config={'api_key': os.getenv('WEBSHARE_API_KEY')}
    )

    # Load proxies
    proxy_manager.load_proxies()
    logger.info(f"Loaded {len(proxy_manager.proxies)} proxies")

    print("\n" + "=" * 60)
    print("Starting scraper (dry run)...")
    print("=" * 60 + "\n")

    try:
        # Create scraper instance
        scraper = KwaraScraper(proxy_manager=proxy_manager)

        # Scrape lots (without saving to database)
        lots = scraper.scrape_lots()

        print("\n" + "=" * 60)
        print(f"✓ Scraped {len(lots)} lots")
        print("=" * 60)

        if lots:
            print("\n📋 Sample lots (first 5):")
            for i, lot in enumerate(lots[:5], 1):
                print(f"\n{i}. {lot.title[:60]}...")
                print(f"   Category: {lot.category}")
                print(f"   Current Bid: {lot.current_bid}")
                print(f"   Risk Score: {lot.risk_score}")
                if lot.description:
                    print(f"   Description: {lot.description[:80]}...")

            if len(lots) > 5:
                print(f"\n... and {len(lots) - 5} more lots")

        print("\n" + "=" * 60)
        print("✓ Dry run completed!")
        print("=" * 60)
        return True

    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ Dry run failed:")
        print(f"  {type(e).__name__}: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_kwara_dryrun()

    if success:
        print("\n✅ Scraper is working! Ready to run with database.")
        print("\nNext steps:")
        print("  1. Configure Supabase credentials in .env")
        print("  2. Run: python3 main.py")
        print("  3. Or run scraper with database: python3 test_kwara_scraper.py")
    else:
        print("\n❌ Issues found. Check:")
        print("  1. WebShare proxies working? Run: python3 test_webshare.py")
        print("  2. Website accessible?")
        print("  3. CSS selectors need customization")
