"""
Inspect Kwara category page to find lot listing structure
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

def inspect_category_page():
    """Inspect Casa & Construção category page to find lot listings"""
    print("Inspecting Kwara Category Page...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    category_url = f'{base_url}/categorias/casa-e-construcao'

    try:
        print(f"\n📡 Fetching category page: {category_url}")
        response = requests.get(category_url, timeout=15, allow_redirects=True)
        print(f"✓ Status: {response.status_code}")
        print(f"  Final URL: {response.url}")

        if response.status_code != 200:
            print(f"❌ Failed to fetch category page")
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Get page title
        print(f"\n  Page Title: {soup.title.string if soup.title else 'No title'}")

        # =========================================================================
        # SECTION 1: Find all product/lot cards
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 1: PRODUCT/LOT CARD DETECTION")
        print("=" * 80)

        # Look for links to individual lots/products
        all_links = soup.find_all('a', href=True)
        lot_links = []

        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True)

            # Look for product/lot links (not categories, not other pages)
            if href and not href.startswith('/categorias'):
                if not any(skip in href for skip in ['javascript', 'mailto', 'tel:', '#']):
                    # Check if it looks like a product/lot link
                    if text and len(text) > 5:  # Has meaningful text
                        full_url = urljoin(base_url, href)
                        lot_links.append({
                            'text': text,
                            'href': full_url,
                            'html': str(link)[:200]  # Sample HTML for structure analysis
                        })

        # Remove duplicates
        seen = set()
        unique_lots = []
        for lot in lot_links:
            if lot['href'] not in seen:
                seen.add(lot['href'])
                unique_lots.append(lot)

        print(f"\n  Found {len(unique_lots)} potential lot/product links:")
        for lot in unique_lots[:20]:
            print(f"    {lot['text'][:60]}")
            print(f"    → {lot['href'][:70]}")
            print()

        # =========================================================================
        # SECTION 2: Analyze link patterns
        # =========================================================================
        print("=" * 80)
        print("SECTION 2: URL PATTERN ANALYSIS")
        print("=" * 80)

        # Group URLs by pattern
        patterns = {}
        for lot in unique_lots:
            href = lot['href']
            # Extract URL pattern
            match = re.match(r'(https://www\.kwara\.com\.br/[^/]+)/[^/]*', href)
            if match:
                pattern = match.group(1)
                if pattern not in patterns:
                    patterns[pattern] = []
                patterns[pattern].append(lot)

        print(f"\n  Found {len(patterns)} URL patterns:")
        for pattern, lots in sorted(patterns.items(), key=lambda x: -len(x[1]))[:5]:
            print(f"\n    Pattern: {pattern}")
            print(f"    Count: {len(lots)} lots")
            if lots:
                print(f"    Sample: {lots[0]['text'][:50]}")

        # =========================================================================
        # SECTION 3: Find parent container structure
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 3: CONTAINER STRUCTURE ANALYSIS")
        print("=" * 80)

        # Look for common container patterns
        if unique_lots:
            # Get the first link and inspect its parent hierarchy
            first_lot = unique_lots[0]
            print(f"\n  Analyzing structure of first lot link...")
            print(f"  Text: {first_lot['text'][:60]}")

            # Find the link element in soup
            for link in soup.find_all('a', href=True):
                if urljoin(base_url, link.get('href')) == first_lot['href']:
                    # Walk up the DOM tree to find container
                    current = link
                    depth = 0
                    print(f"\n  DOM Hierarchy (bottom-up):")
                    while current and depth < 6:
                        classes = current.get('class', [])
                        tag = current.name
                        class_str = f" class='{' '.join(classes)}'" if classes else ''
                        print(f"    L{depth}: <{tag}{class_str}>")

                        # Look for specific patterns
                        if any(keyword in ' '.join(classes).lower() for keyword in ['card', 'product', 'item', 'lot']):
                            print(f"        ↑ LIKELY CONTAINER!")

                        current = current.parent
                        depth += 1
                    break

        # =========================================================================
        # SECTION 4: Look for price elements
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 4: PRICE ELEMENT DETECTION")
        print("=" * 80)

        # Find elements with price patterns
        price_patterns = [r'R?\$\s*\d+', r'\d+,\d{2}', r'reais', r'brl']

        price_elements = []
        for elem in soup.find_all(['span', 'div', 'p', 'strong']):
            text = elem.get_text(strip=True)
            if any(re.search(pattern, text, re.IGNORECASE) for pattern in price_patterns):
                if len(text) < 50:  # Reasonable price length
                    price_elements.append({
                        'tag': elem.name,
                        'classes': elem.get('class', []),
                        'text': text,
                        'html': str(elem)[:100]
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
        # SECTION 5: Look for image elements
        # =========================================================================
        print("=" * 80)
        print("SECTION 5: IMAGE ELEMENT DETECTION")
        print("=" * 80)

        images = soup.find_all('img', src=True)
        print(f"\n  Found {len(images)} images")

        # Sample first 5 images
        for img in images[:5]:
            src = img.get('src')
            alt = img.get('alt', '')
            full_url = urljoin(base_url, src)
            print(f"    {alt[:40]}")
            print(f"    → {full_url[:70]}")
            print()

        # =========================================================================
        # SUMMARY & RECOMMENDATIONS
        # =========================================================================
        print("\n" + "=" * 80)
        print("SUMMARY & RECOMMENDATIONS")
        print("=" * 80)

        if unique_lots:
            print(f"\n  ✓ Found {len(unique_lots)} lot/product links on this page")

            # Determine main URL pattern
            if patterns:
                main_pattern = max(patterns.keys(), key=lambda k: len(patterns[k]))
                print(f"\n  🔍 Main URL Pattern: {main_pattern}")

                # Extract the path pattern
                path_pattern = main_pattern.replace(base_url, '')
                print(f"     Path Pattern: {path_pattern}")

        if unique_prices:
            print(f"\n  ✓ Found {len(unique_prices)} price elements")

        print(f"\n  ✓ Found {len(images)} images")

        print("\n" + "=" * 80)
        print("RECOMMENDED SCRAPER APPROACH:")
        print("=" * 80)

        if unique_lots:
            print("\n  1. Scrape category page: /categorias/casa-e-construcao")
            print("  2. Extract all lot links using pattern analysis")
            print("  3. Visit each lot page to extract:")
            print("     - Title")
            print("     - Description")
            print("     - Price")
            print("     - Images")
            print("     - Auction details")

        if patterns:
            print(f"\n  URL Pattern to match: {main_pattern}")

        print("\n" + "=" * 80)
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    inspect_category_page()
