"""
Test individual Kwara auction listings to find construction materials
"""

import requests
import json
from typing import List, Dict

def test_kwara_listings():
    """Test individual auction listings from discoverByListings"""
    print("Testing Kwara Individual Auction Listings...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    build_id = 'icEnlyKUxVs3w2HsvxZ12'

    # First, fetch the index to get listings
    index_url = f"{base_url}/_next/data/{build_id}/index.json"

    try:
        print(f"Fetching index.json to get listings...")
        response = requests.get(index_url, timeout=30)
        response.raise_for_status()

        data = response.json()
        page_props = data.get('pageProps', {})
        initial_data = page_props.get('initialData', {})
        listings = initial_data.get('discoverByListings', [])

        print(f"✓ Found {len(listings)} active listings")

        if not listings:
            print("No listings found")
            return

        print(f"\n{'=' * 80}")
        print(f"Testing listings")
        print("=" * 80)

        all_lots = []
        listing_titles = []

        for i, listing in enumerate(listings, 1):
            title = listing.get('title', 'N/A')
            seller = listing.get('seller', {}).get('displayName', 'N/A')
            listing_id = listing.get('id', listing.get('kwaraId', 'N/A'))

            print(f"\n[{i}/{len(listings)}] {title}")
            print(f"  Seller: {seller}")
            print(f"  ID: {listing_id}")

            # Check if listing has lots directly
            if 'items' in listing:
                items = listing.get('items', [])
                print(f"  Direct items: {len(items)}")

                if items:
                    for item in items[:3]:
                        item_title = item.get('title', 'N/A')
                        print(f"    - {item_title}")

                    all_lots.extend(items)
                    listing_titles.append(title)
                    continue

            # If no direct items, try to fetch from listing page
            slug = listing.get('slug')
            if not slug:
                print(f"  ✗ No slug found")
                continue

            # Convert slug to API URL
            # Slug format like "leilao-de-cadeiras-herman-miller-padronizadas"
            listing_api_url = f"{base_url}/_next/data/{build_id}/leilao/{slug}.json"

            try:
                print(f"  Fetching: {listing_api_url}")
                response = requests.get(listing_api_url, timeout=30)
                response.raise_for_status()

                listing_data = response.json()
                listing_props = listing_data.get('pageProps', {})

                # Try to find lots data in different possible locations
                lots_data = None

                # Check for auction data
                if 'auction' in listing_props:
                    auction = listing_props.get('auction', {})
                    lots_data = auction.get('lots', [])
                # Check for listing data
                elif 'listing' in listing_props:
                    listing_obj = listing_props.get('listing', {})
                    lots_data = listing_obj.get('items', []) or listing_obj.get('lots', [])
                # Check for items directly
                elif 'items' in listing_props:
                    lots_data = listing_props.get('items', [])
                # Check for lots directly
                elif 'lots' in listing_props:
                    lots_data = listing_props.get('lots', [])

                if lots_data:
                    print(f"  ✓ Found {len(lots_data)} lots")

                    # Sample lots
                    for lot in lots_data[:3]:
                        lot_title = lot.get('title', lot.get('item', {}).get('title', 'N/A'))
                        print(f"    - {lot_title}")

                    all_lots.extend(lots_data)
                    listing_titles.append(title)
                else:
                    print(f"  ✗ No lots found")
                    print(f"  Available keys: {list(listing_props.keys())}")

            except Exception as e:
                print(f"  ❌ Error fetching listing: {e}")

        # Summary
        print(f"\n{'=' * 80}")
        print("SUMMARY")
        print("=" * 80)
        print(f"Total lots found across all listings: {len(all_lots)}")
        print(f"Listings with lots: {len(listing_titles)}")

        # Categorize lots
        from collections import Counter

        # Try to extract categories from lot data
        categories = []
        for lot in all_lots:
            # Check different possible category fields
            category = None
            if 'category' in lot:
                cat = lot.get('category', {})
                category = cat.get('name') if isinstance(cat, dict) else cat
            elif 'assetCategory' in lot:
                cat = lot.get('assetCategory', {})
                category = cat.get('name') if isinstance(cat, dict) else cat
            elif 'assetCategoryId' in lot:
                category = lot.get('assetCategoryId')

            if category:
                categories.append(category)

        if categories:
            print(f"\nCategory breakdown:")
            for cat, count in Counter(categories).most_common():
                print(f"  {cat}: {count}")

        # Sample lots from all listings
        print(f"\nSample lots from different listings:")
        for i, lot in enumerate(all_lots[:15], 1):
            title = lot.get('title', lot.get('item', {}).get('title', 'N/A'))
            print(f"  {i}. {title}")

        if len(all_lots) > 15:
            print(f"\n  ... and {len(all_lots) - 15} more lots")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_kwara_listings()
