"""
Inspect Kwara main categorias page
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

def inspect_categorias_page():
    """Inspect main categorias page to find actual category URLs"""
    print("Inspecting Kwara Categorias Page...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    categorias_url = f'{base_url}/categorias'

    try:
        print(f"\n📡 Fetching: {categorias_url}")
        response = requests.get(categorias_url, timeout=15, allow_redirects=True)
        print(f"✓ Status: {response.status_code}")
        print(f"  Final URL: {response.url}")

        if response.status_code != 200:
            print(f"❌ Failed to fetch categorias page")
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Get page title
        print(f"\n  Page Title: {soup.title.string if soup.title else 'No title'}")

        # =========================================================================
        # Find all category links
        # =========================================================================
        print("\n" + "=" * 80)
        print("CATEGORY LINKS")
        print("=" * 80)

        all_links = soup.find_all('a', href=True)
        category_links = []

        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True)

            # Look for category links
            if href and '/categoria' in href:
                full_url = urljoin(base_url, href)
                category_links.append({
                    'text': text,
                    'href': full_url
                })

        # Remove duplicates
        seen = set()
        unique_categories = []
        for cat in category_links:
            if cat['href'] not in seen:
                seen.add(cat['href'])
                unique_categories.append(cat)

        print(f"\n  Found {len(unique_categories)} category links:")
        for cat in unique_categories[:20]:
            print(f"    {cat['text'][:60]}")
            print(f"    → {cat['href'][:70]}")
            print()

        # =========================================================================
        # Also look for product/auction links directly
        # =========================================================================
        print("=" * 80)
        print("PRODUCT/AUCTION LINKS")
        print("=" * 80)

        product_links = []

        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True)

            # Skip navigation and category links
            if href and '/categoria' not in href and href not in ['/', '#']:
                # Look for individual product/auction pages
                if len(text) > 10 and text[0].isupper():  # Likely a product title
                    full_url = urljoin(base_url, href)
                    product_links.append({
                        'text': text,
                        'href': full_url
                    })

        # Remove duplicates
        seen = set()
        unique_products = []
        for prod in product_links:
            if prod['href'] not in seen:
                seen.add(prod['href'])
                unique_products.append(prod)

        print(f"\n  Found {len(unique_products)} potential product/auction links:")
        for prod in unique_products[:15]:
            print(f"    {prod['text'][:60]}")
            print(f"    → {prod['href'][:70]}")
            print()

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    inspect_categorias_page()
