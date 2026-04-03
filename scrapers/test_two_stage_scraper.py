"""
Test the two-stage scraper with a small sample
Run this first to verify everything works before doing a full scrape
"""

from kwara_two_stage_scraper import KwaraTwoStageScraper
import logging

logging.basicConfig(level=logging.INFO)

def test_two_stage_scraper():
    """Test with 10 lots to verify both stages work"""
    print("="*80)
    print("TESTING TWO-STAGE SCRAPER (10 lots)")
    print("="*80)

    scraper = KwaraTwoStageScraper(
        save_to_db=True,
        use_proxies=False,  # Disable proxies for quick test
        stage1_delay=1.0,   # Faster delays for testing
        stage2_delay=1.0
    )

    # Scrape only 10 lots for quick test
    lots = scraper.scrape_all(max_lots=10)

    print(f"\n{'='*80}")
    print("TEST RESULTS")
    print(f"{'='*80}")
    print(f"Total lots scraped: {len(lots)}")

    # Show breakdown by scrape stage
    basic_count = sum(1 for lot in lots if lot.scrape_stage == 'basic')
    detailed_count = sum(1 for lot in lots if lot.scrape_stage == 'detailed')
    print(f"Basic stage: {basic_count}")
    print(f"Detailed stage: {detailed_count}")

    # Show sample lot with all fields
    if lots:
        print(f"\n{'='*80}")
        print("SAMPLE LOT (first lot)")
        print(f"{'='*80}")
        lot = lots[0]
        print(f"Title: {lot.title}")
        print(f"Slug: {lot.slug}")
        print(f"Refs: {lot.refs}")
        print(f"Category: {lot.category}")
        print(f"Current Bid: R$ {lot.current_bid:,.2f}" if lot.current_bid else "Current Bid: N/A")
        print(f"Starting Bid: R$ {lot.starting_bid:,.2f}" if lot.starting_bid else "Starting Bid: N/A")
        print(f"Location: {lot.location_city}/{lot.location_state}")
        print(f"Description: {lot.description[:100]}..." if lot.description and len(lot.description) > 100 else f"Description: {lot.description}")
        print(f"Visiting: {lot.visiting_address}" if lot.visiting_address else "Visiting: N/A")
        print(f"Pickup: {lot.pickup_address}" if lot.pickup_address else "Pickup: N/A")
        print(f"Stage: {lot.scrape_stage}")
        print(f"Source URL: {lot.source_url}")

    print(f"\n{'='*80}")
    if detailed_count == len(lots):
        print("✓ TEST PASSED: All lots reached detailed stage")
    else:
        print("⚠ PARTIAL SUCCESS: Some lots only reached basic stage")
    print(f"{'='*80}")

if __name__ == '__main__':
    test_two_stage_scraper()
