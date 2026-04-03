"""
Test scraping WITHOUT authentication
"""

import asyncio
from kwara_scraper_full_fields import KwaraFullFieldScraper

async def main():
    print("=" * 80)
    print("Testing Scraper WITHOUT Authentication")
    print("=" * 80)

    # Create scraper WITHOUT authentication
    scraper = KwaraFullFieldScraper(save_to_db=False, authenticate=False)

    # Scrape just 1 lot
    lots = await scraper.scrape_lots_complete(
        category_ids=['1335572015838398043'],  # metais
        max_pages=1,
        max_lots=1  # Test with just 1 lot
    )

    print(f"\n{'=' * 80}")
    print(f"RESULTS:")
    print(f"{'=' * 80}")

    if lots:
        for i, lot in enumerate(lots, 1):
            print(f"\n{i}. {lot.title}")
            print(f"   Reference: {lot.reference}")
            print(f"   Information: {lot.information}")
            print(f"   Description: {lot.description}")
            print(f"   Observations: {(lot.general_observations or '')[:100] if lot.general_observations else 'None'}...")
            print(f"   Event: {lot.event}")
            print(f"   Visitation: {(lot.visitation or '')[:100] if lot.visitation else 'None'}...")
            print(f"   Withdrawal: {(lot.withdrawal or '')[:100] if lot.withdrawal else 'None'}...")
            print(f"   Images: {len(lot.images)}")
            print(f"   Source: {lot.source_url}")

            # Show the saved dict structure
            print(f"\n   Database structure:")
            dict_data = lot.to_dict()
            print(f"   - metadata.information: {dict_data.get('metadata', {}).get('information', 'N/A')[:80]}")
            print(f"   - metadata.general_observations: {dict_data.get('metadata', {}).get('general_observations', 'N/A')[:80]}")

    print(f"\n{'=' * 80}")
    print(f"✓ Test complete!")

if __name__ == '__main__':
    asyncio.run(main())
