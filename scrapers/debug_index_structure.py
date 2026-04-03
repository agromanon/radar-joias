"""
Debug Kwara index.json structure
"""

import requests
import json

def debug_index():
    """Debug index.json to find auction events"""
    print("Debugging Kwara index.json...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    build_id = 'icEnlyKUxVs3w2HsvxZ12'

    index_url = f"{base_url}/_next/data/{build_id}/index.json"

    try:
        print(f"Fetching: {index_url}")
        response = requests.get(index_url, timeout=30)
        response.raise_for_status()

        data = response.json()

        # Show top-level keys
        print(f"\nTop-level keys: {list(data.keys())}")

        page_props = data.get('pageProps', {})
        print(f"\npageProps keys: {list(page_props.keys())}")

        # Check for different possible event listings
        for key in page_props.keys():
            value = page_props[key]
            print(f"\n{key}:")
            print(f"  Type: {type(value)}")

            if isinstance(value, list):
                print(f"  Length: {len(value)}")
                if len(value) > 0:
                    print(f"  First item type: {type(value[0])}")
                    if isinstance(value[0], dict):
                        print(f"  First item keys: {list(value[0].keys())}")
                        print(f"  First item: {json.dumps(value[0], indent=2)[:200]}")
            elif isinstance(value, dict):
                print(f"  Keys: {list(value.keys())}")
            elif isinstance(value, str) and len(value) < 200:
                print(f"  Value: {value}")

        # Save full response for inspection
        with open('index_debug.json', 'w') as f:
            json.dump(data, f, indent=2)
        print(f"\n✓ Full response saved to index_debug.json")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    debug_index()
