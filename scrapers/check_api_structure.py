"""
Check the actual structure of the Kwara API response
"""

import requests
import json

build_id = 'ziWczoweSgRNOjgvfT9eZ'
category_id = '1335572015838398043'  # metais
kwara_api_url = f"https://www.kwara.com.br/_next/data/{build_id}/busca.json"

print(f"Fetching from: {kwara_api_url}")
print(f"Category ID: {category_id}")
print("=" * 80)

response = requests.get(kwara_api_url, params={
    'assetCategoryIds[]': category_id,
    'page': 1,
    'pageSize': 5
})

print(f"Status: {response.status_code}")
print(f"Content-Type: {response.headers.get('content-type')}")

if response.status_code == 200:
    data = response.json()
    print(f"\nTop-level keys: {list(data.keys())}")

    # Check pageProps
    if 'pageProps' in data:
        page_props = data['pageProps']
        print(f"\npageProps keys: {list(page_props.keys())}")

        # Check for lots
        if 'lots' in page_props:
            lots = page_props['lots']
            print(f"\nlots type: {type(lots)}")
            print(f"lots keys: {list(lots.keys()) if isinstance(lots, dict) else 'not a dict'}")

            # Look for auctions
            if isinstance(lots, dict):
                if 'auctions' in lots:
                    auctions = lots['auctions']
                    print(f"\nauctions type: {type(auctions)}")
                    print(f"Number of auctions: {len(auctions) if isinstance(auctions, list) else 'not a list'}")

                    if isinstance(auctions, list) and len(auctions) > 0:
                        print(f"\nFirst auction keys: {list(auctions[0].keys()) if isinstance(auctions[0], dict) else 'not a dict'}")
                        print(f"\nFirst auction sample:")
                        print(json.dumps(auctions[0], indent=2, ensure_ascii=False)[:500])

    # Save full response
    with open('/tmp/kwara_api_response.json', 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Saved full response to /tmp/kwara_api_response.json")
else:
    print(f"\nResponse text: {response.text[:500]}")
