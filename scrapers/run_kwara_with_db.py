"""
Run Kwara scraper with database saving
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from kwara_scraper_final import KwaraAPIScraper

def main():
    """Run Kwara scraper and save to database"""
    print("=" * 80)
    print("Kwara Scraper - Database Integration Test")
    print("=" * 80)

    # Check environment variables
    if not os.getenv('SUPABASE_URL'):
        print("❌ SUPABASE_URL not found in environment")
        print("   Please set up your .env file with:")
        print("   SUPABASE_URL=your_supabase_url")
        print("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
        return

    # Initialize scraper with database saving
    scraper = KwaraAPIScraper(save_to_db=True)

    # Scrape all categories
    print("\nScraping all Kwara categories...")
    lots = scraper.scrape_lots()

    if lots:
        print(f"\n{'=' * 80}")
        print(f"✓ Successfully scraped {len(lots)} lots")

        # Category breakdown
        category_counts = {}
        for lot in lots:
            category_counts[lot.category] = category_counts.get(lot.category, 0) + 1

        print(f"\nCategory breakdown:")
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {count}")

        # Value summary
        total_value = sum(lot.current_bid for lot in lots if lot.current_bid)
        if total_value > 0:
            print(f"\nTotal value of all lots: R$ {total_value:,.2f}")

        print(f"\n{'=' * 80}")
        print("✓ Scraping complete - lots saved to database")
        print("=" * 80)
    else:
        print("\n❌ No lots found")

if __name__ == '__main__':
    main()
