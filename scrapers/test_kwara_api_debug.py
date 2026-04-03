"""
Debug Kwara API response
"""

import requests
import json

def test_kwara_api():
    """Test Kwara API and debug response"""
    print("Testing Kwara API...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    build_id = 'icEnlyKUxVs3w2HsvxZ12'
    category_id = '1335572015838398043'

    api_url = f"{base_url}/_next/data/{build_id}/busca.json"
    params = {
        'assetCategoryIds[]': category_id
    }

    try:
        print(f"Fetching: {api_url}")
        print(f"Params: {params}")
        print()

        response = requests.get(
            api_url,
            params=params,
            headers={
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout=30
        )

        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        print(f"Content-Length: {len(response.content)} bytes")
        print()

        # Check if response is empty
        if not response.content:
            print("❌ Response is empty!")
            return

        # Show first 500 chars of response
        preview = response.text[:500]
        print(f"Response preview:\n{preview}")
        print()

        # Try to parse JSON
        try:
            data = response.json()
            print(f"✓ JSON parsed successfully")

            # Show structure
            page_props = data.get('pageProps', {})
            search_result = page_props.get('searchResult', {})
            items = search_result.get('items', [])

            print(f"✓ Found {len(items)} items")

            if items:
                print(f"\nFirst item structure:")
                first_item = items[0]
                print(f"  Keys: {list(first_item.keys())}")

                listing = first_item.get('listing', {})
                if listing:
                    print(f"\n  Listing keys: {list(listing.keys())}")
                    print(f"  Title: {listing.get('title', 'N/A')}")
                    print(f"  Location: {listing.get('location', 'N/A')}")
                    print(f"  Status: {listing.get('status', 'N/A')}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
            print(f"  Response was not valid JSON")
            return

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return

    print("\n" + "=" * 80)
    print("✓ API test complete")

if __name__ == '__main__':
    test_kwara_api()
