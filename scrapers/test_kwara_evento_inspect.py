"""
Inspect Kwara evento (auction event) page for individual lots
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re
import json

def inspect_evento_page():
    """Inspect evento page to find individual lots"""
    print("Inspecting Kwara Evento Page...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'
    # Try one of the evento URLs from homepage
    evento_url = f'{base_url}/evento/leilao-de-cadeiras-herman-miller-padro'

    try:
        print(f"\n📡 Fetching: {evento_url}")
        response = requests.get(evento_url, timeout=15, allow_redirects=True)
        print(f"✓ Status: {response.status_code}")
        print(f"  Final URL: {response.url}")

        if response.status_code != 200:
            print(f"❌ Failed to fetch evento page")
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Get page title
        print(f"\n  Page Title: {soup.title.string if soup.title else 'No title'}")

        # =========================================================================
        # SECTION 1: Look for lot cards/containers
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 1: LOT CARD DETECTION")
        print("=" * 80)

        # Look for various container patterns
        container_patterns = [
            'div[class*="card"]',
            'div[class*="lot"]',
            'div[class*="lote"]',
            'div[class*="product"]',
            'div[class*="item"]',
            'article',
            '[class*="auction"]'
        ]

        for pattern in container_patterns:
            try:
                elements = soup.select(pattern)
                if elements:
                    print(f"\n  Pattern '{pattern}': {len(elements)} elements")

                    # Sample first 3
                    for elem in elements[:3]:
                        classes = elem.get('class', [])
                        print(f"    Classes: {' '.join(classes)}")

                        # Try to find title
                        title = elem.find(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
                        if title:
                            print(f"    Title: {title.get_text(strip=True)[:60]}")

                        # Try to find price/bid
                        price = elem.find(['span', 'div', 'p', 'strong'], string=re.compile(r'R?\$'))
                        if price:
                            print(f"    Price: {price.get_text(strip=True)[:40]}")

                        # Try to find link
                        link = elem.find('a', href=True)
                        if link:
                            href = urljoin(base_url, link.get('href'))
                            text = link.get_text(strip=True)
                            print(f"    Link: {href[:70]}")
                            if text:
                                print(f"    Text: {text[:40]}")

                        print()

                    if len(elements) > 0:
                        break
            except Exception as e:
                continue

        # =========================================================================
        # SECTION 2: Look for data embedded in JavaScript (React/Next.js)
        # =========================================================================
        print("=" * 80)
        print("SECTION 2: EMBEDDED DATA (React/Next.js)")
        print("=" * 80)

        scripts = soup.find_all('script')
        data_found = False

        for script in scripts:
            if script.string:
                # Look for JSON data patterns
                if '__NEXT_DATA__' in script.string or '__INITIAL_STATE__' in script.string:
                    print(f"\n  Found Next.js data!")
                    try:
                        # Try to extract JSON
                        match = re.search(r'__NEXT_DATA__\s*=\s*({.+?})\s*</script>', script.string, re.DOTALL)
                        if match:
                            data = json.loads(match.group(1))
                            print(f"  Keys: {list(data.keys())}")
                            data_found = True
                    except:
                        pass

                # Look for auction/lot data
                if 'lance' in script.string.lower() or 'leilao' in script.string.lower():
                    lines = script.string.split('\n')
                    for line in lines[:10]:  # Sample first 10 lines
                        if any(word in line.lower() for word in ['lance', 'lote', 'leilao', 'valor', 'preco']):
                            print(f"  {line.strip()[:100]}")
                            data_found = True

        if not data_found:
            print("  No embedded data found")

        # =========================================================================
        # SECTION 3: Find all links (excluding navigation)
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 3: LOT LINKS")
        print("=" * 80)

        all_links = soup.find_all('a', href=True)
        lot_links = []

        skip_patterns = [
            'javascript', 'mailto', 'tel:', '#',
            '/categorias', '/busca', 'como-funciona',
            'privacidade', 'termos', 'typeform', 'whatsapp.com'
        ]

        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True)

            # Skip obvious non-lot links
            if href and not any(skip in href for skip in skip_patterns):
                # Look for potential lot links
                if text and len(text) > 5:
                    # Check if it's not a navigation link
                    parent = link.parent
                    if parent and 'nav' not in str(parent.get('class', '')).lower():
                        full_url = urljoin(base_url, href)
                        lot_links.append({
                            'text': text,
                            'href': full_url,
                            'parent_classes': parent.get('class', []) if parent else []
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
            print(f"    {lot['text'][:60]}")
            print(f"    → {lot['href'][:70]}")
            if lot['parent_classes']:
                print(f"    Parent: {' '.join(lot['parent_classes'])}")
            print()

        # =========================================================================
        # SECTION 4: URL Pattern Analysis
        # =========================================================================
        print("=" * 80)
        print("SECTION 4: URL PATTERN ANALYSIS")
        print("=" * 80)

        # Group by URL pattern
        patterns = {}
        for lot in unique_lots:
            href = lot['href']
            match = re.match(r'(https://www\.kwara\.com\.br/[^/]+)', href)
            if match:
                pattern = match.group(1)
                if pattern not in patterns:
                    patterns[pattern] = []
                patterns[pattern].append(lot)

        if patterns:
            print(f"\n  URL Patterns:")
            for pattern, lots in sorted(patterns.items(), key=lambda x: -len(x[1]))[:5]:
                print(f"\n    {pattern}")
                print(f"    Count: {len(lots)}")
                if lots:
                    print(f"    Sample: {lots[0]['text'][:50]}")

        # =========================================================================
        # SECTION 5: Check for API endpoints
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 5: API ENDPOINTS")
        print("=" * 80)

        api_patterns = [r'/api/', r'_next/data', r'graphql']

        for script in scripts:
            if script.string:
                for pattern in api_patterns:
                    if re.search(pattern, script.string, re.IGNORECASE):
                        lines = script.string.split('\n')
                        for line in lines[:5]:
                            if re.search(pattern, line, re.IGNORECASE):
                                print(f"  {line.strip()[:100]}")
                        break

        # =========================================================================
        # SUMMARY
        # =========================================================================
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)

        print(f"\n  ✓ Found {len(unique_lots)} potential lot links")

        if unique_lots:
            print(f"\n  ✓ This page has lot links - can scrape!")

        print("\n" + "=" * 80)
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    inspect_evento_page()
