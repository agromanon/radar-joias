"""
Inspect Kwara website structure to find auction listings
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

def inspect_kwara_structure():
    """Deep inspection of Kwara website to find auction listing structure"""
    print("Inspecting Kwara website structure...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'

    try:
        print(f"\n📡 Fetching homepage: {base_url}")
        response = requests.get(base_url, timeout=15, allow_redirects=True)
        print(f"✓ Status: {response.status_code}")
        print(f"  Final URL: {response.url}")

        if response.status_code != 200:
            print(f"❌ Failed to fetch homepage")
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Get page title
        print(f"\n  Page Title: {soup.title.string if soup.title else 'No title'}")

        # =========================================================================
        # SECTION 1: Find all navigation links and menu items
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 1: NAVIGATION & MENU LINKS")
        print("=" * 80)

        # Look for common navigation patterns
        nav_links = []

        # Try different nav selectors
        nav_selectors = [
            'nav a',
            '.menu a',
            '.navigation a',
            '[role="navigation"] a',
            'header a',
            '.navbar a'
        ]

        for selector in nav_selectors:
            links = soup.select(selector)
            if links:
                print(f"\n  Found {len(links)} links with selector: {selector}")
                for link in links[:15]:  # Sample first 15
                    href = link.get('href')
                    text = link.get_text(strip=True)
                    if href and text:
                        full_url = urljoin(base_url, href)
                        nav_links.append({'text': text, 'href': full_url})
                        print(f"    {text[:50]} → {full_url[:70]}")
                break

        # =========================================================================
        # SECTION 2: Look for auction/leilão specific links
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 2: AUCTION-SPECIFIC LINKS")
        print("=" * 80)

        all_links = soup.find_all('a', href=True)
        auction_keywords = ['leilão', 'leilao', 'lote', 'lances', 'categorias', 'produtos']

        auction_links = []
        for link in all_links:
            href = link.get('href')
            text = link.get_text(strip=True).lower()

            # Check if link contains auction keywords
            if any(keyword in text or (href and keyword in href.lower()) for keyword in auction_keywords):
                if href:
                    full_url = urljoin(base_url, href)
                    auction_links.append({
                        'text': link.get_text(strip=True),
                        'href': full_url
                    })

        # Remove duplicates
        seen = set()
        unique_auction_links = []
        for link in auction_links:
            if link['href'] not in seen:
                seen.add(link['href'])
                unique_auction_links.append(link)

        print(f"\n  Found {len(unique_auction_links)} unique auction-related links:")
        for link in unique_auction_links[:20]:
            print(f"    {link['text'][:50]}")
            print(f"    → {link['href'][:70]}")
            print()

        # =========================================================================
        # SECTION 3: Look for category/section URLs
        # =========================================================================
        print("=" * 80)
        print("SECTION 3: CATEGORY & SECTION DISCOVERY")
        print("=" * 80)

        # Look for URLs with common patterns
        category_patterns = [
            r'/categoria',
            r'/categorias',
            r'/category',
            r'/c/',
            r'/leiloes',
            r'/leilão',
            r'/lotes',
            r'/produtos'
        ]

        category_links = []
        for link in all_links:
            href = link.get('href')
            if href:
                for pattern in category_patterns:
                    if re.search(pattern, href, re.IGNORECASE):
                        full_url = urljoin(base_url, href)
                        text = link.get_text(strip=True)
                        category_links.append({'text': text, 'href': full_url})
                        break

        # Remove duplicates
        seen = set()
        unique_categories = []
        for cat in category_links:
            if cat['href'] not in seen:
                seen.add(cat['href'])
                unique_categories.append(cat)

        print(f"\n  Found {len(unique_categories)} category/section links:")
        for cat in unique_categories[:10]:
            print(f"    {cat['text'][:50]}")
            print(f"    → {cat['href'][:70]}")
            print()

        # =========================================================================
        # SECTION 4: Sample main content area
        # =========================================================================
        print("=" * 80)
        print("SECTION 4: MAIN CONTENT ANALYSIS")
        print("=" * 80)

        # Look for main content areas
        main_content = soup.find('main') or soup.find('div', class_=re.compile(r'main|content', re.I))

        if main_content:
            # Find all divs with classes in main content
            content_divs = main_content.find_all('div', class_=True)

            # Get unique class names
            class_names = set()
            for div in content_divs[:20]:
                classes = div.get('class', [])
                class_names.update(classes)

            print(f"\n  Sample class names from main content ({len(class_names)} total):")
            for cls in sorted(list(class_names))[:30]:
                print(f"    .{cls}")

        # =========================================================================
        # SECTION 5: Look for product/lot cards
        # =========================================================================
        print("\n" + "=" * 80)
        print("SECTION 5: PRODUCT/LOT CARD DETECTION")
        print("=" * 80)

        # Common patterns for product cards
        card_patterns = [
            'div[class*="card"]',
            'div[class*="product"]',
            'div[class*="lot"]',
            'div[class*="item"]',
            'div[class*="auction"]',
            'article',
            '[class*="listing"]'
        ]

        for pattern in card_patterns:
            try:
                elements = soup.select(pattern)
                if elements:
                    print(f"\n  Found {len(elements)} elements with: {pattern}")

                    # Sample first 3 elements
                    for elem in elements[:3]:
                        # Get class names
                        classes = elem.get('class', [])
                        print(f"    Classes: {' '.join(classes)}")

                        # Try to find title
                        title = elem.find(['h1', 'h2', 'h3', 'h4'])
                        if title:
                            print(f"    Title: {title.get_text(strip=True)[:60]}")

                        # Try to find link
                        link = elem.find('a', href=True)
                        if link:
                            href = urljoin(base_url, link.get('href'))
                            print(f"    Link: {href[:70]}")

                        print()
                    break
            except Exception as e:
                print(f"    Error with pattern {pattern}: {e}")
                continue

        # =========================================================================
        # SECTION 6: JavaScript/API endpoints
        # =========================================================================
        print("=" * 80)
        print("SECTION 6: JAVASCRIPT & API ENDPOINTS")
        print("=" * 80)

        # Look for script tags that might contain API endpoints
        scripts = soup.find_all('script')
        api_patterns = [
            r'/api/',
            r'/v1/',
            r'/v2/',
            r'graphql',
            r'ajax',
            r'fetch'
        ]

        for script in scripts:
            if script.string:
                for pattern in api_patterns:
                    if re.search(pattern, script.string, re.IGNORECASE):
                        # Extract lines containing API patterns
                        lines = script.string.split('\n')
                        for line in lines:
                            if re.search(pattern, line, re.IGNORECASE):
                                print(f"  {line.strip()[:100]}")
                        break

        # =========================================================================
        # SUMMARY & RECOMMENDATIONS
        # =========================================================================
        print("\n" + "=" * 80)
        print("SUMMARY & RECOMMENDATIONS")
        print("=" * 80)

        print(f"\n  ✓ Total auction-related links found: {len(unique_auction_links)}")
        print(f"  ✓ Total category links found: {len(unique_categories)}")

        if unique_auction_links:
            print("\n  🔍 Top auction links to investigate:")
            for link in unique_auction_links[:5]:
                print(f"    {link['text'][:40]} → {link['href'][:70]}")

        if unique_categories:
            print("\n  🔍 Top category links to investigate:")
            for cat in unique_categories[:5]:
                print(f"    {cat['text'][:40]} → {cat['href'][:70]}")

        print("\n" + "=" * 80)
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    inspect_kwara_structure()
