"""
Comprehensive test of all Kwara data sections to find construction materials
"""

import requests
import json
from typing import List, Dict
from collections import Counter

def test_all_kwara_sections():
    """Test all discoverBy sections to find construction materials"""
    print("Testing All Kwara Data Sections...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    build_id = 'icEnlyKUxVs3w2HsvxZ12'

    index_url = f"{base_url}/_next/data/{build_id}/index.json"

    try:
        print(f"Fetching index.json...")
        response = requests.get(index_url, timeout=30)
        response.raise_for_status()

        data = response.json()
        page_props = data.get('pageProps', {})
        initial_data = page_props.get('initialData', {})

        # All discoverBy sections
        sections = {
            'discoverByCategories': 'Categories with lots',
            'discoverByListings': 'Active listings',
            'discoverByNewListings': 'New listings',
            'discoverByNewArrivals': 'New arrivals (lots)',
            'discoverByLotsWithMostDiscounts': 'Lots with discounts',
        }

        all_lots = []
        section_results = {}

        for section_key, section_name in sections.items():
            print(f"\n{'=' * 80}")
            print(f"Section: {section_name}")
            print("=" * 80)

            section_data = initial_data.get(section_key, [])
            print(f"Total items in section: {len(section_data)}")

            if not section_data:
                print("  No items found")
                continue

            # Process based on section type
            lots = []

            if 'Arrivals' in section_name or 'Discounts' in section_name:
                # These are actual lots
                lots = section_data
                print(f"  ✓ Found {len(lots)} lots")

                # Sample first few
                for lot in lots[:3]:
                    title = lot.get('title', 'N/A')
                    category = lot.get('assetCategory', {}).get('name', 'N/A')
                    price_cents = lot.get('cachedPriceAmountCents', 0)
                    price = f"R$ {price_cents/100:,.2f}" if price_cents else "N/A"
                    print(f"    - {title}")
                    print(f"      Category: {category}")
                    print(f"      Price: {price}")

                all_lots.extend(lots)
                section_results[section_name] = lots

            elif 'Listings' in section_name:
                # These are auction listings - need to extract items
                print(f"  Processing {len(section_data)} listings...")

                for listing in section_data:
                    # Check if items are embedded
                    if 'items' in listing:
                        items = listing.get('items', [])
                        if items:
                            title = listing.get('title', 'N/A')
                            print(f"    Listing: {title} ({len(items)} items)")
                            lots.extend(items)

                if lots:
                    print(f"  ✓ Found {len(lots)} lots from listings")
                    all_lots.extend(lots)
                    section_results[section_name] = lots
                else:
                    print(f"  ✗ No embedded lots found")

            elif 'Categories' in section_name:
                # Categories - try to get lots from each
                print(f"  Processing {len(section_data)} categories...")

                for category in section_data[:5]:  # Limit to first 5
                    cat_id = category.get('id', 'N/A')
                    cat_name = category.get('name', f'Category {cat_id}')

                    # Try to fetch lots for this category
                    try:
                        api_url = f"{base_url}/_next/data/{build_id}/busca.json"
                        params = {'assetCategoryIds[]': cat_id}

                        cat_response = requests.get(api_url, params=params, timeout=30)
                        cat_response.raise_for_status()

                        cat_data = cat_response.json()
                        cat_page_props = cat_data.get('pageProps', {})
                        cat_search_result = cat_page_props.get('searchResult', {})
                        cat_items = cat_search_result.get('items', [])

                        if cat_items:
                            print(f"    {cat_name}: {len(cat_items)} lots")
                            lots.extend(cat_items)

                    except Exception as e:
                        print(f"    {cat_name}: Error - {e}")
                        continue

                if lots:
                    print(f"  ✓ Found {len(lots)} lots from categories")
                    all_lots.extend(lots)
                    section_results[section_name] = lots
                else:
                    print(f"  ✗ No lots found from categories")

        # Summary
        print(f"\n{'=' * 80}")
        print("OVERALL SUMMARY")
        print("=" * 80)
        print(f"Total lots found across all sections: {len(all_lots)}")

        # Deduplicate lots by ID
        unique_lots = {}
        for lot in all_lots:
            lot_id = lot.get('id') or lot.get('kwaraId') or str(hash(str(lot)))
            if lot_id not in unique_lots:
                unique_lots[lot_id] = lot

        unique_lots_list = list(unique_lots.values())
        print(f"Unique lots (after deduplication): {len(unique_lots_list)}")

        # Categorize all lots
        categories = []
        for lot in unique_lots_list:
            category = None
            if 'assetCategory' in lot:
                cat = lot.get('assetCategory', {})
                category = cat.get('name') if isinstance(cat, dict) else cat
            elif 'category' in lot:
                cat = lot.get('category', {})
                category = cat.get('name') if isinstance(cat, dict) else cat

            if category:
                categories.append(category)

        if categories:
            print(f"\nCategory breakdown:")
            for cat, count in Counter(categories).most_common(10):
                print(f"  {cat}: {count}")

        # Look for construction materials
        print(f"\n{'=' * 80}")
        print("SEARCHING FOR CONSTRUCTION MATERIALS")
        print("=" * 80)

        construction_keywords = [
            'cimento', 'tijolo', 'telha', 'piso', 'construção',
            'parede', 'porta', 'janela', 'tinta', 'areia', 'brita',
            'bomba', 'compressor', 'motor', 'gerador', 'betoneira',
            'usina', 'máquina', 'equipamento', 'ferramenta',
            'ferro', 'aço', 'metal', 'cobre', 'alumínio',
            'chapa', 'tubo', 'perfil', 'barra'
        ]

        found_construction = []
        for lot in unique_lots_list:
            title = lot.get('title', '').lower()
            description = lot.get('description', '').lower()
            text = f"{title} {description}"

            if any(keyword in text for keyword in construction_keywords):
                found_construction.append(lot)

        if found_construction:
            print(f"✓ Found {len(found_construction)} construction-related lots:\n")
            for i, lot in enumerate(found_construction[:10], 1):
                title = lot.get('title', 'N/A')
                category = lot.get('assetCategory', {}).get('name', 'N/A') if isinstance(lot.get('assetCategory'), dict) else lot.get('assetCategory', 'N/A')
                price_cents = lot.get('cachedPriceAmountCents', 0)
                price = f"R$ {price_cents/100:,.2f}" if price_cents else "N/A"

                print(f"{i}. {title}")
                print(f"   Category: {category}")
                print(f"   Price: {price}")

            if len(found_construction) > 10:
                print(f"\n  ... and {len(found_construction) - 10} more construction lots")
        else:
            print("✗ No construction materials found in current data")
            print("\nAll lots found (first 20):")
            for i, lot in enumerate(unique_lots_list[:20], 1):
                title = lot.get('title', 'N/A')
                print(f"  {i}. {title}")

            if len(unique_lots_list) > 20:
                print(f"  ... and {len(unique_lots_list) - 20} more lots")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_all_kwara_sections()
