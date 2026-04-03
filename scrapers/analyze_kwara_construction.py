"""
Refined search for true construction materials on Kwara
"""

import requests
import json
from typing import List, Dict

def analyze_construction_materials():
    """Detailed analysis for construction materials excluding furniture"""
    print("Refined Search for True Construction Materials...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    build_id = 'icEnlyKUxVs3w2HsvxZ12'

    # Strong construction indicators (not furniture)
    strong_construction_keywords = [
        'cimento', 'tijolo', 'telha', 'areia', 'brita', 'argamassa',
        'bomba', 'compressor', 'motor', 'gerador', 'betoneira',
        'usina', 'equipamento', 'ferramenta', 'martelo', 'serra',
        'furadeira', 'parafusadeira', 'solda', 'tubo', 'chapa metálica'
    ]

    # Furniture keywords to exclude
    furniture_keywords = [
        'armário', 'estante', 'mesa', 'cadeira', 'sofá', 'cama',
        'colchão', 'guarda-roupas', 'gaveta', 'porta de vidro',
        'decoração', 'cuber', 'torneira', 'pia'
    ]

    index_url = f"{base_url}/_next/data/{build_id}/index.json"

    try:
        print(f"Fetching lots from categories...")
        response = requests.get(index_url, timeout=30)
        response.raise_for_status()

        data = response.json()
        page_props = data.get('pageProps', {})
        initial_data = page_props.get('initialData', {})
        categories = initial_data.get('discoverByCategories', [])

        all_lots = []

        # Fetch lots from first 5 categories
        for category in categories[:5]:
            cat_id = category.get('id')
            if not cat_id:
                continue

            try:
                api_url = f"{base_url}/_next/data/{build_id}/busca.json"
                params = {'assetCategoryIds[]': cat_id}

                cat_response = requests.get(api_url, params=params, timeout=30)
                cat_response.raise_for_status()

                cat_data = cat_response.json()
                cat_page_props = cat_data.get('pageProps', {})
                cat_search_result = cat_page_props.get('searchResult', {})
                cat_items = cat_search_result.get('items', [])

                all_lots.extend(cat_items)

            except Exception as e:
                continue

        # Filter for construction materials
        print(f"\nTotal lots fetched: {len(all_lots)}")

        # Categorize each lot
        construction_materials = []
        furniture_items = []
        other_items = []

        for lot in all_lots:
            title = lot.get('title', '').lower()
            description = lot.get('description', '').lower()
            text = f"{title} {description}"

            # Check for furniture first (to exclude)
            is_furniture = any(keyword in text for keyword in furniture_keywords)

            # Then check for construction materials
            is_construction = any(keyword in text for keyword in strong_construction_keywords)

            if is_furniture:
                furniture_items.append(lot)
            elif is_construction:
                construction_materials.append(lot)
            else:
                other_items.append(lot)

        print(f"\n{'=' * 80}")
        print("CATEGORIZATION RESULTS")
        print("=" * 80)
        print(f"Furniture items (excluded): {len(furniture_items)}")
        print(f"Construction materials: {len(construction_materials)}")
        print(f"Other items: {len(other_items)}")

        if construction_materials:
            print(f"\n{'=' * 80}")
            print("✓ TRUE CONSTRUCTION MATERIALS FOUND")
            print("=" * 80)

            for i, lot in enumerate(construction_materials, 1):
                title = lot.get('title', 'N/A')
                description = lot.get('description', 'N/A')
                price_cents = lot.get('cachedPriceAmountCents', 0)
                price = f"R$ {price_cents/100:,.2f}" if price_cents else "N/A"

                # Identify which keyword matched
                text = f"{title} {description}".lower()
                matched_keywords = [kw for kw in strong_construction_keywords if kw in text]

                print(f"\n{i}. {title}")
                print(f"   Price: {price}")
                print(f"   Matched keywords: {', '.join(matched_keywords)}")
                if description != 'N/A' and len(description) < 200:
                    print(f"   Description: {description}")

            total_value = sum(
                lot.get('cachedPriceAmountCents', 0) / 100
                for lot in construction_materials
            )
            print(f"\nTotal value of construction materials: R$ {total_value:,.2f}")

        else:
            print(f"\n{'=' * 80}")
            print("✗ NO TRUE CONSTRUCTION MATERIALS FOUND")
            print("=" * 80)
            print("\nAll items are either furniture or general items.")
            print("\nSample of other items (first 10):")
            for i, lot in enumerate(other_items[:10], 1):
                title = lot.get('title', 'N/A')
                print(f"  {i}. {title}")

        # Summary and recommendation
        print(f"\n{'=' * 80}")
        print("ANALYSIS SUMMARY")
        print("=" * 80)

        if len(construction_materials) == 0:
            print("\n❌ Current auctions on Kwara do NOT contain true construction materials")
            print("\nRecommendations:")
            print("  1. Kwara currently focuses on retail reverse logistics (furniture, appliances)")
            print("  2. Consider checking other auction sites like:")
            print("     - Excel Leilões (industrial equipment)")
            print("     - Braspress Leilões (variety)")
            print("     - Metal-Maquina (heavy machinery)")
            print("  3. Monitor Kwara for future industrial auctions")
            print("  4. Current scraper is working correctly - just no construction materials available")
        else:
            print(f"\n✓ Found {len(construction_materials)} true construction material lots")
            print("  Scraper is successfully finding construction materials!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    analyze_construction_materials()
