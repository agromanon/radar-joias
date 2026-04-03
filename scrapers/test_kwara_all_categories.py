"""
Test all Kwara categories to find construction materials
"""

from kwara_scraper_final import KwaraAPIScraper

def test_all_categories():
    """Test multiple categories to find construction materials"""
    print("Testing Multiple Kwara Categories...")
    print("=" * 80)

    scraper = KwaraAPIScraper()

    # Test different category IDs
    categories = {
        'Casa & Construção': '1335572015838398043',
        'Industrial': '1335572023151306',
        'Eletrodomésticos': '1335572017063134',
        'Informática': '1335572021920138',
        'Veículos': '1335572025728918',
    }

    all_lots = {}

    for cat_name, cat_id in categories.items():
        print(f"\n{'=' * 80}")
        print(f"Category: {cat_name} (ID: {cat_id})")
        print("=" * 80)

        try:
            lots = scraper.scrape_lots([cat_id])

            if lots:
                print(f"\n✓ Found {len(lots)} lots in {cat_name}:")

                # Sample first 3 lots
                for i, lot in enumerate(lots[:3], 1):
                    print(f"\n{i}. {lot.title}")
                    print(f"   Category: {lot.category}")
                    print(f"   Bid: R$ {lot.current_bid:,.2f}" if lot.current_bid else "   Bid: N/A")
                    print(f"   Location: {lot.location}")

                # Category breakdown
                cat_breakdown = {}
                for lot in lots:
                    cat_breakdown[lot.category] = cat_breakdown.get(lot.category, 0) + 1

                print(f"\n  Sub-categories:")
                for subcat, count in sorted(cat_breakdown.items(), key=lambda x: -x[1]):
                    print(f"    {subcat}: {count}")

                all_lots[cat_name] = lots
            else:
                print(f"\n✗ No lots found in {cat_name}")

        except Exception as e:
            print(f"\n❌ Error scraping {cat_name}: {e}")

    # Summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print("=" * 80)

    for cat_name, lots in all_lots.items():
        if lots:
            total_value = sum(lot.current_bid for lot in lots if lot.current_bid)
            print(f"\n{cat_name}:")
            print(f"  Lots: {len(lots)}")
            print(f"  Total value: R$ {total_value:,.2f}")

            # Count categories
            cat_breakdown = {}
            for lot in lots:
                cat_breakdown[lot.category] = cat_breakdown.get(lot.category, 0) + 1

            print(f"  Categories: {dict(cat_breakdown)}")

    print(f"\n{'=' * 80}")
    total_all = sum(len(lots) for lots in all_lots.values())
    print(f"\n✓ Total lots across all categories: {total_all}")

if __name__ == '__main__':
    test_all_categories()
