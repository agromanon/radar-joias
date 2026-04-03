"""
Test script to check what data the API actually returns
"""

import requests
import json

build_id = 'ziWczoweSgRNOjgvfT9eZ'
api_url = f"https://www.kwara.com.br/_next/data/{build_id}/busca.json"

response = requests.get(
    api_url,
    params={
        'assetCategoryIds[]': '1335572015838398043',  # metais category
        'page': 1,
        'pageSize': 2  # Just get 2 lots for inspection
    },
    headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'},
    timeout=30
)

data = response.json()
items = data.get('pageProps', {}).get('searchResult', {}).get('items', [])

print(f"Found {len(items)} lots\n")
print("=" * 80)

for i, item in enumerate(items, 1):
    print(f"\nLOT {i}:")
    print("-" * 80)

    listing = item.get('listing', {})

    # Title
    title = listing.get('title', 'No title')
    print(f"Title: {title[:100]}...")

    # Description
    description = listing.get('description', '')
    print(f"\nDescription ({len(description)} chars):")
    print(description[:500] if len(description) > 500 else description)
    if len(description) > 500:
        print(f"... (truncated)")

    # Source URL
    slug = item.get('slug', '')
    source_url = f"https://www.kwara.com.br/lote/{slug}" if slug else 'No source URL'
    print(f"\nSource URL: {source_url}")

    # Images
    images = item.get('images', [])
    print(f"\nImages: {len(images)} found")
    if images:
        print(f"  Primary: {images[0]}")

    # Price
    price_cents = item.get('cachedPriceAmountCents')
    if price_cents:
        print(f"\nCurrent Bid: R$ {price_cents / 100:,.2f}")

    print("\n" + "=" * 80)
