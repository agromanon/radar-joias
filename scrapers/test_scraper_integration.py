"""
Test scraper with HTTP database manager
"""

import sys
from pathlib import Path
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from kwara_scraper_final import KwaraAPIScraper

    print("Testing scraper with HTTP database manager...")
    print("=" * 80)

    # Create scraper with database enabled
    scraper = KwaraAPIScraper(save_to_db=True)

    # Scrape just 1 page from 1 category to test
    print("\n1. Testing: Scrape 1 page from metais category...")
    lots = scraper.scrape_lots(
        category_ids=['1335572015838398043'],  # metais
        max_pages=1
    )

    if lots:
        print(f"   ✓ Scraped {len(lots)} lots")

        # Show sample data
        lot = lots[0]
        print(f"\n2. Sample lot data:")
        print(f"   Title: {lot.title[:80]}...")
        print(f"   Source URL: {lot.source_url}")
        print(f"   Has images: {len(lot.images) if lot.images else 0}")
        print(f"   Current bid: R$ {lot.current_bid:,.2f}" if lot.current_bid else "   Current bid: None")

        # Test database save
        print(f"\n3. Testing: Save to database...")
        if scraper.db_manager:
            saved = scraper.db_manager.insert_lots([lot.to_dict()])
            print(f"   ✓ Saved {saved} lot to database")
        else:
            print(f"   ✗ No database manager available")

    else:
        print("   ✗ No lots scraped")

    print("\n" + "=" * 80)
    print("✓ Scraper integration test completed!")

except Exception as e:
    print(f"\n✗ Scraper test failed: {e}")
    import traceback
    traceback.print_exc()
