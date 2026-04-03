"""
Inspect Kwara search page to find lot listing structure
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote
import re

def inspect_search_page():
    """Inspect search page to find actual lot listings"""
    print("Inspecting Kwara Search Page...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    # Casa & Construção category ID
    search_url = f'{base_url}/busca?assetCategoryIds[]=1335572015838398'

    try:
        print(f"\n📡 Fetching search page: {search_url}")
        response = requests.get(search_url, timeout=15, allow_redirects=True)
        print(f"✓ Status: {response.status_code}")
        print(f"  Final URL: {response.url}")

        if response.status_code != 200:
            print(f"❌ Failed to fetch search page")
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Get page title
        print(f"\n  Page Title: {soup.title.string if soup.title else 'No title'}")

        # =========================================================================
        # SECTION 1: Find product/lot cards
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 1: PRODUCT/LOT CARD DETECTION")
        print("=" * 80)

        # Look for all links that might be lots
        all_links = soup.find_all('a', href=True)
        lot_links = []

        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True)

            # Skip navigation, filters, etc.
            skip_patterns = ['javascript', 'mailto', 'tel:', '#', '/categorias', '/busca', 'como-funciona']
            if href and not any(skip in href for skip in skip_patterns):
                # Look for meaningful product titles
                if text and len(text) > 10:
                    full_url = urljoin(base_url, href)
                    lot_links.append({
                        'text': text,
                        'href': full_url,
                        'parent_classes': get_parent_classes(link)
                    })

        # Remove duplicates
        seen = set()
        unique_lots = []
        for lot in lot_links:
            if lot['href'] not in seen:
                seen.add(lot['href'])
                unique_lots.append(lot)

        print(f"\n  Found {len(unique_lots)} potential lot links:")
        for lot in unique_lots[:15]:
            print(f"    {lot['text'][:70]}")
            print(f"    → {lot['href'][:70]}")
            if lot['parent_classes']:
                print(f"    Parent: {lot['parent_classes']}")
            print()

        # =========================================================================
        # SECTION 2: URL Pattern Analysis
        # =========================================================================
        print("=" * 80)
        print("SECTION 2: URL PATTERN ANALYSIS")
        print("=" * 80)

        # Group by URL pattern
        patterns = {}
        for lot in unique_lots:
            href = lot['href']
            # Extract the path pattern
            match = re.match(r'(https://www\.kwara\.com\.br/[^/]+)', href)
            if match:
                pattern = match.group(1)
                if pattern not in patterns:
                    patterns[pattern] = []
                patterns[pattern].append(lot)

        print(f"\n  URL Patterns found:")
        for pattern, lots in sorted(patterns.items(), key=lambda x: -len(x[1])):
            print(f"\n    {pattern}")
            print(f"    Count: {len(lots)} lots")
            if lots:
                print(f"    Sample: {lots[0]['text'][:50]}")

        # =========================================================================
        # SECTION 3: Look for price elements
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 3: PRICE ELEMENTS")
        print("=" * 80)

        price_elements = []
        for elem in soup.find_all(['span', 'div', 'p', 'strong']):
            text = elem.get_text(strip=True)
            # Look for price patterns (R$, reais, numbers with commas)
            if re.search(r'R?\$\s*\d+[\d.,]*', text) or 'reais' in text.lower():
                if len(text) < 60 and len(text) > 3:
                    price_elements.append({
                        'tag': elem.name,
                        'classes': elem.get('class', []),
                        'text': text
                    })

        # Remove duplicates
        seen = set()
        unique_prices = []
        for price in price_elements:
            if price['text'] not in seen:
                seen.add(price['text'])
                unique_prices.append(price)

        print(f"\n  Found {len(unique_prices)} price elements:")
        for price in unique_prices[:10]:
            print(f"    <{price['tag']} class='{' '.join(price['classes'])}'>")
            print(f"    {price['text'][:60]}")
            print()

        # =========================================================================
        # SECTION 4: Look for image elements
        # =========================================================================
        print("=" * 80)
        print("SECTION 4: IMAGE ELEMENTS")
        print("=" * 80)

        images = soup.find_all('img', src=True)
        print(f"\n  Found {len(images)} images")

        # Filter to product images (skip icons, logos)
        product_images = []
        for img in images:
            src = img.get('src')
            # Skip small images (likely icons)
            if not any(skip in src.lower() for skip in ['icon', 'logo', 'svg', 'emoji']):
                alt = img.get('alt', '')
                full_url = urljoin(base_url, src)
                product_images.append({
                    'alt': alt,
                    'src': full_url
                })

        print(f"\n  Product images (non-icons): {len(product_images)}")
        for img in product_images[:10]:
            print(f"    {img['alt'][:40]}")
            print(f"    → {img['src'][:70]}")
            print()

        # =========================================================================
        # SECTION 5: Look for pagination
        # =========================================================================
        print("=" * 80)
        print("SECTION 5: PAGINATION")
        print("=" * 80)

        # Look for pagination elements
        pagination_links = []
        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True)

            # Look for page numbers, next/prev links
            if href and ('pagina' in href.lower() or 'page' in href.lower() or text.isdigit()):
                if text.isdigit() or text.lower() in ['próxima', 'próximo', 'seguinte', 'next', 'anterior', 'previous']:
                    full_url = urljoin(base_url, href)
                    pagination_links.append({
                        'text': text,
                        'href': full_url
                    })

        if pagination_links:
            print(f"\n  Found pagination links:")
            for link in pagination_links[:10]:
                print(f"    {link['text'][:30]} → {link['href'][:70]}")
        else:
            print("\n  No pagination links found (may be infinite scroll)")

        # =========================================================================
        # SUMMARY & RECOMMENDATIONS
        # =========================================================================
        print("\n" + "=" * 80)
        print("SUMMARY & RECOMMENDATIONS")
        print("=" * 80)

        print(f"\n  ✓ Found {len(unique_lots)} lot links on search page")

        if patterns:
            main_pattern = max(patterns.keys(), key=lambda k: len(patterns[k]))
            print(f"\n  ✓ Main URL Pattern: {main_pattern}")

        if unique_prices:
            print(f"\n  ✓ Found {len(unique_prices)} price elements")

        print(f"\n  ✓ Found {len(product_images)} product images")

        print("\n" + "=" * 80)
        print("RECOMMENDED SCRAPER STRATEGY:")
        print("=" * 80)
        print("\n  1. Use search URLs: /busca?assetCategoryIds[]={category_id}")
        print("  2. Extract lot links from search results page")
        print("  3. Visit each lot page to extract full details:")
        print("     - Title, Description, Price, Images")
        print("     - Auction closing date, Location, Category")
        print("  4. Handle pagination if present")
        print("  5. Iterate through all relevant categories")

        print("\n" + "=" * 80)
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_parent_classes(element, depth=3):
    """Get class names of parent elements"""
    classes = []
    current = element.parent
    d = 0
    while current and d < depth:
        cls = current.get('class', [])
        if cls:
            classes.append(f"{'.'.join(cls)}")
        current = current.parent
        d += 1
    return ' > '.join(classes) if classes else ''


if __name__ == '__main__':
    inspect_search_page()
