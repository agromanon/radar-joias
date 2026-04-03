"""
Inspect Kwara opportunity page to find individual lots
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

def inspect_opportunity_page():
    """Inspect opportunity page to find individual lot listings"""
    print("Inspecting Kwara Opportunity Page...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    opportunity_url = f'{base_url}/oportunidades/bens-de-apartamentos-decorados'

    try:
        print(f"\n📡 Fetching: {opportunity_url}")
        response = requests.get(opportunity_url, timeout=15, allow_redirects=True)
        print(f"✓ Status: {response.status_code}")
        print(f"  Final URL: {response.url}")

        if response.status_code != 200:
            print(f"❌ Failed to fetch opportunity page")
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Get page title
        print(f"\n  Page Title: {soup.title.string if soup.title else 'No title'}")

        # =========================================================================
        # SECTION 1: Look for lot/product cards
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 1: LOT/PRODUCT CARD DETECTION")
        print("=" * 80)

        # Find all potential lot cards
        potential_cards = []

        # Look for common card patterns
        card_selectors = [
            'div[class*="card"]',
            'div[class*="lot"]',
            'div[class*="product"]',
            'div[class*="item"]',
            'article',
            '[class*="auction"]'
        ]

        for selector in card_selectors:
            try:
                elements = soup.select(selector)
                if elements:
                    print(f"\n  Selector '{selector}' found {len(elements)} elements")

                    # Sample first few
                    for elem in elements[:5]:
                        classes = elem.get('class', [])
                        print(f"    Classes: {' '.join(classes)}")

                        # Try to find title
                        title = elem.find(['h1', 'h2', 'h3', 'h4'])
                        if title:
                            print(f"    Title: {title.get_text(strip=True)[:60]}")

                        # Try to find price
                        price = elem.find(['span', 'div', 'p'], string=re.compile(r'R?\$\s*\d+'))
                        if price:
                            print(f"    Price: {price.get_text(strip=True)}")

                        # Try to find link
                        link = elem.find('a', href=True)
                        if link:
                            href = urljoin(base_url, link.get('href'))
                            print(f"    Link: {href[:70]}")

                        print()
                    break
            except Exception as e:
                print(f"    Error with {selector}: {e}")
                continue

        # =========================================================================
        # SECTION 2: Find all links (excluding navigation)
        # =========================================================================
        print("=" * 80)
        print("SECTION 2: INDIVIDUAL LOT LINKS")
        print("=" * 80)

        all_links = soup.find_all('a', href=True)
        lot_links = []

        skip_patterns = [
            'javascript', 'mailto', 'tel:', '#',
            '/oportunidades', '/categorias', '/busca',
            'como-funciona', 'indique-ganhe', 'privacidade', 'termos'
        ]

        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True)

            if href and not any(skip in href for skip in skip_patterns):
                # Look for individual lot pages
                if text and len(text) > 15 and text[0].isupper():
                    full_url = urljoin(base_url, href)
                    lot_links.append({
                        'text': text,
                        'href': full_url
                    })

        # Remove duplicates
        seen = set()
        unique_lots = []
        for lot in lot_links:
            if lot['href'] not in seen:
                seen.add(lot['href'])
                unique_lots.append(lot)

        print(f"\n  Found {len(unique_lots)} potential individual lot links:")
        for lot in unique_lots[:20]:
            print(f"    {lot['text'][:70]}")
            print(f"    → {lot['href'][:70]}")
            print()

        # =========================================================================
        # SECTION 3: URL Pattern Analysis
        # =========================================================================
        print("=" * 80)
        print("SECTION 3: URL PATTERN ANALYSIS")
        print("=" * 80)

        # Group by URL pattern
        patterns = {}
        for lot in unique_lots:
            href = lot['href']
            # Extract pattern
            match = re.match(r'(https://www\.kwara\.com\.br/[^/]+/[^/]+)', href)
            if not match:
                match = re.match(r'(https://www\.kwara\.com.br/[^/]+)', href)

            if match:
                pattern = match.group(1)
                if pattern not in patterns:
                    patterns[pattern] = []
                patterns[pattern].append(lot)

        print(f"\n  URL Patterns:")
        for pattern, lots in sorted(patterns.items(), key=lambda x: -len(x[1]))[:5]:
            print(f"\n    {pattern}")
            print(f"    Count: {len(lots)}")
            if lots:
                print(f"    Sample: {lots[0]['text'][:50]}")

        # =========================================================================
        # SECTION 4: Look for prices
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 4: PRICE ELEMENTS")
        print("=" * 80)

        price_elements = []
        for elem in soup.find_all(['span', 'div', 'p', 'strong']):
            text = elem.get_text(strip=True)
            if re.search(r'R?\$\s*\d+[\d.,]*', text):
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
        # SECTION 5: Look for images
        # =========================================================================
        print("=" * 80)
        print("SECTION 5: IMAGES")
        print("=" * 80)

        images = soup.find_all('img', src=True)
        product_images = []

        for img in images:
            src = img.get('src')
            if not any(skip in src.lower() for skip in ['icon', 'logo', 'svg', 'emoji']):
                alt = img.get('alt', '')
                full_url = urljoin(base_url, src)
                product_images.append({
                    'alt': alt,
                    'src': full_url
                })

        print(f"\n  Found {len(product_images)} product images:")
        for img in product_images[:10]:
            print(f"    {img['alt'][:40]}")
            print(f"    → {img['src'][:70]}")
            print()

        # =========================================================================
        # SUMMARY
        # =========================================================================
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)

        print(f"\n  ✓ Found {len(unique_lots)} individual lot links")

        if patterns:
            main_pattern = max(patterns.keys(), key=lambda k: len(patterns[k]))
            print(f"\n  ✓ Main URL Pattern: {main_pattern}")

        if unique_prices:
            print(f"\n  ✓ Found {len(unique_prices)} price elements")

        print(f"\n  ✓ Found {len(product_images)} product images")

        print("\n" + "=" * 80)
        print("SCRAPER STRATEGY:")
        print("=" * 80)
        print("\n  1. Navigate to /oportunidades pages")
        print("  2. Extract individual lot links")
        print("  3. Visit each lot page for details")

        print("\n" + "=" * 80)
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    inspect_opportunity_page()
