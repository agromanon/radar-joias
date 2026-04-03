"""
Test Kwara Scraper with WebShare Proxies
Run this to test the actual scraping functionality
"""

import os
import sys
import logging
from dotenv import load_dotenv

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kwara_scraper import run_kwara_scraper
from utils.proxy_manager import create_proxy_manager

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_kwara_scraper():
    """Test Kwara scraper with WebShare proxies"""
    print("=" * 60)
    print("Testing Kwara Scraper with WebShare Proxies")
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

    # Test proxy by making a simple request first
    logger.info("Testing proxy connection...")
    test_proxy = proxy_manager.get_next_proxy()
    if test_proxy:
        logger.info(f"✓ Using proxy: {test_proxy.host}:{test_proxy.port}")
    else:
        logger.warning("No proxy available, using direct connection")

    print("\n" + "=" * 60)
    print("Starting Kwara scraper...")
    print("=" * 60 + "\n")

    try:
        # Run the scraper
        count = run_kwara_scraper(proxy_manager=proxy_manager)

        print("\n" + "=" * 60)
        print(f"✓ Scraper completed successfully!")
        print(f"  Lots scraped: {count}")
        print("=" * 60)

        return count > 0

    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ Scraper failed with error:")
        print(f"  {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_kwara_scraper()

    if success:
        print("\n✓ Test successful! The scraper is working.")
        print("Next steps:")
        print("  1. Check database to see scraped lots")
        print("  2. Review the data quality")
        print("  3. Adjust CSS selectors if needed")
    else:
        print("\n❌ Test failed. Check:")
        print("  1. WebShare API key is valid")
        print("  2. Website is accessible")
        print("  3. CSS selectors need updating")
        print("  4. Network connectivity")
