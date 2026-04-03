"""
Test individual Kwara auction events to find construction materials
"""

import requests
import json
from typing import List, Dict

def test_kwara_events():
    """Test individual auction events from index.json"""
    print("Testing Kwara Individual Auction Events...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    build_id = 'icEnlyKUxVs3w2HsvxZ12'

    # First, fetch the index to get event URLs
    index_url = f"{base_url}/_next/data/{build_id}/index.json"

    try:
        print(f"Fetching index.json to get event URLs...")
        response = requests.get(index_url, timeout=30)
        response.raise_for_status()

        data = response.json()
        page_props = data.get('pageProps', {})
        banners = page_props.get('banners', [])

        print(f"✓ Found {len(banners)} banners")

        # Extract event URLs from banners
        event_urls = []
        for banner in banners:
            link = banner.get('link', '')
            if link.startswith('/evento/'):
                event_urls.append(link)
                print(f"  Event: {link}")

        if not event_urls:
            print("No event URLs found in banners")
            return

        print(f"\n{'=' * 80}")
        print(f"Testing {len(event_urls)} events")
        print("=" * 80)

        all_lots = []

        for i, event_path in enumerate(event_urls, 1):
            print(f"\n[{i}/{len(event_urls)}] Testing: {event_path}")

            # Convert event path to API URL
            # Format: /evento/slug-K-1234 -> evento/slug-K-1234.json
            event_api_path = event_path.lstrip('/') + '.json'
            event_url = f"{base_url}/_next/data/{build_id}/{event_api_path}"

            try:
                response = requests.get(event_url, timeout=30)
                response.raise_for_status()

                data = response.json()
                page_props = data.get('pageProps', {})

                # Try to find lots data
                # Might be in different places depending on page structure
                lots_data = None

                # Check for auction data
                if 'auction' in page_props:
                    auction = page_props.get('auction', {})
                    lots_data = auction.get('lots', [])
                # Check for listing data
                elif 'listing' in page_props:
                    listing = page_props.get('listing', {})
                    lots_data = listing.get('items', [])
                # Check for items directly
                elif 'items' in page_props:
                    lots_data = page_props.get('items', [])

                if lots_data:
                    print(f"  ✓ Found {len(lots_data)} lots")

                    # Sample lots
                    for lot in lots_data[:3]:
                        title = lot.get('title', lot.get('item', {}).get('title', 'N/A'))
                        print(f"    - {title}")

                    all_lots.extend(lots_data)
                else:
                    print(f"  ✗ No lots found")

                    # Debug: show available keys
                    print(f"  Available keys: {list(page_props.keys())}")

            except Exception as e:
                print(f"  ❌ Error: {e}")

        # Summary
        print(f"\n{'=' * 80}")
        print("SUMMARY")
        print("=" * 80)
        print(f"Total lots found across all events: {len(all_lots)}")

        if all_lots:
            print(f"\nSample of lots found:")
            for i, lot in enumerate(all_lots[:10], 1):
                title = lot.get('title', lot.get('item', {}).get('title', 'N/A'))
                print(f"  {i}. {title}")

            if len(all_lots) > 10:
                print(f"\n  ... and {len(all_lots) - 10} more lots")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_kwara_events()
