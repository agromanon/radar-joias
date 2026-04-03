"""
Test scraper with database save - 2 pages only
Quick test to verify database integration works before full scrape
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from kwara_scraper_final import KwaraAPIScraper
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_scrape_to_database():
    """Scrape 2 pages and save to database"""
    print("=" * 80)
    print("TESTING SCRAPER WITH DATABASE SAVE (2 pages only)")
    print("=" * 80)

    # Initialize scraper with database save enabled
    scraper = KwaraAPIScraper(save_to_db=True)

    # Scrape first 2 pages only (quick test)
    print("\nScraping first 2 pages...")
    lots = scraper.scrape_lots(max_pages=2)

    print(f"\n{'='*80}")
    print(f"TEST COMPLETE!")
    print(f"{'='*80}")
    print(f"Lots scraped: {len(lots)}")
    print(f"Database save: {'ENABLED' if scraper.save_to_db else 'DISABLED'}")

    if lots:
        print(f"\nFirst lot preview:")
        lot = lots[0]
        print(f"  Title: {lot.title[:70]}...")
        print(f"  Category: {lot.category}")
        print(f"  Platform: {lot.platform}")
        print(f"  Current Bid: R$ {lot.current_bid:,.2f}" if lot.current_bid else "  Current Bid: N/A")

    print(f"\n{'='*80}")
    print(f"Next steps:")
    print(f"  1. Verify lots in database: python verify_data.py")
    print(f"  2. If successful, run full scrape: python kwara_scraper_final.py")
    print(f"{'='*80}")

    return len(lots)

if __name__ == '__main__':
    test_scrape_to_database()
