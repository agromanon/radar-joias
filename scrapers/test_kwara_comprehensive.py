"""
Comprehensive test to find lots on Kwara - check for dynamic content, hidden elements, data attributes
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re
import json

def comprehensive_kwara_test():
    """Comprehensive search for lots on Kwara"""
    print("Comprehensive Kwara Lot Search...")
    print("=" * 80)

    base_url = 'https://www.kwara.com.br'

    # Test multiple URL patterns
    test_urls = [
        f'{base_url}/',
        f'{base_url}/categorias',
        f'{base_url}/busca?assetCategoryIds[]=1335572015838398',
        f'{base_url}/oportunidades/bens-de-apartamentos-decorados',
        f'{base_url}/evento/leilao-de-cadeiras-herman-miller-padro',
    ]

    for url in test_urls:
        print(f"\n{'=' * 80}")
        print(f"Testing: {url}")
        print("=" * 80)

        try:
            response = requests.get(url, timeout=15, allow_redirects=True)
            print(f"Status: {response.status_code}")

            if response.status_code != 200:
                continue

            soup = BeautifulSoup(response.text, 'html.parser')

            # 1. Check for any elements with prices or values
            print("\n  [Price Elements]")
            price_elems = soup.find_all(['span', 'div', 'p', 'strong'],
                                      string=re.compile(r'R?\$\s*\d+'))
            if price_elems:
                print(f"    Found {len(price_elems)} price elements")
                for elem in price_elems[:5]:
                    print(f"    - {elem.get_text(strip=True)[:50]}")
            else:
                print("    No price elements found")

            # 2. Check for data attributes (common in React apps)
            print("\n  [Data Attributes]")
            elements_with_data = soup.find_all(attrs={'data-lot': True})
            elements_with_data.extend(soup.find_all(attrs={'data-product': True}))
            elements_with_data.extend(soup.find_all(attrs={'data-item': True}))
            elements_with_data.extend(soup.find_all(attrs={'data-id': True}))

            if elements_with_data:
                print(f"    Found {len(elements_with_data)} elements with data attributes")
                for elem in elements_with_data[:3]:
                    print(f"    - {elem.name}: {dict(elem.attrs)}")
            else:
                print("    No data attributes found")

            # 3. Check for JSON-LD or structured data
            print("\n  [Structured Data]")
            json_ld_scripts = soup.find_all('script', type='application/ld+json')
            if json_ld_scripts:
                print(f"    Found {len(json_ld_scripts)} JSON-LD scripts")
                for script in json_ld_scripts[:2]:
                    try:
                        data = json.loads(script.string)
                        print(f"    - Type: {data.get('@type', 'unknown')}")
                    except:
                        pass
            else:
                print("    No JSON-LD found")

            # 4. Check for any elements that look like lots
            print("\n  [Potential Lot Cards]")
            # Look for elements with images, titles, and links
            all_divs = soup.find_all('div')
            potential_lots = []

            for div in all_divs:
                # Check if div has an image
                img = div.find('img')
                if not img:
                    continue

                # Check if div has a link
                link = div.find('a', href=True)
                if not link:
                    continue

                # Check if div has text content (title)
                text = div.get_text(strip=True)
                if len(text) < 20:
                    continue

                # Skip navigation
                if any(skip in text.lower() for skip in ['menu', 'nav', 'footer', 'header']):
                    continue

                potential_lots.append({
                    'elem': div,
                    'classes': div.get('class', []),
                    'img': img.get('src', ''),
                    'link': urljoin(base_url, link.get('href')),
                    'text': text[:100]
                })

            if potential_lots:
                print(f"    Found {len(potential_lots)} potential lot cards")
                for lot in potential_lots[:3]:
                    print(f"    - Classes: {' '.join(lot['classes'][:3])}")
                    print(f"      Image: {lot['img'][:60]}")
                    print(f"      Link: {lot['link'][:60]}")
                    print(f"      Text: {lot['text'][:60]}")
            else:
                print("    No potential lot cards found")

            # 5. Check for Next.js data
            print("\n  [Next.js Data]")
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and '__NEXT_DATA__' in script.string:
                    print("    Found __NEXT_DATA__")
                    try:
                        match = re.search(r'__NEXT_DATA__\s*=\s*({.+?})\s*</script>',
                                        script.string, re.DOTALL)
                        if match:
                            data = json.loads(match.group(1))
                            props = data.get('props', {})
                            page_props = props.get('pageProps', {})
                            print(f"    Keys: {list(page_props.keys())[:5]}")
                    except:
                        pass
                    break
            else:
                print("    No __NEXT_DATA__ found")

            # 6. Look for any auction/leilão specific text
            print("\n  [Auction Keywords]")
            page_text = soup.get_text().lower()
            auction_terms = ['leilão', 'lance', 'lote', 'arremate', 'edital']
            found_terms = [term for term in auction_terms if term in page_text]
            if found_terms:
                print(f"    Found auction terms: {found_terms}")
            else:
                print("    No auction terms found")

            # Stop if we found actual lots on this page
            if potential_lots and len(potential_lots) > 3:
                print(f"\n    *** Found {len(potential_lots)} potential lots on this page! ***")
                break

        except Exception as e:
            print(f"    Error: {e}")
            continue

    print("\n" + "=" * 80)
    print("CONCLUSION")
    print("=" * 80)
    print("""
    If lots were found above: Great! Extract the pattern and build scraper.

    If NO lots found: Kwara likely uses:
    1. Server-side rendering with no static HTML (requires browser automation)
    2. API endpoints that fetch lots asynchronously (need to reverse-engineer API)
    3. JavaScript-based lazy loading (needs Selenium/Playwright)

    Next steps:
    1. Try browser automation (Selenium/Playwright) to render JavaScript
    2. Check browser Network tab for API endpoints
    3. Look for _next/data endpoints (Next.js API routes)
    """)

if __name__ == '__main__':
    comprehensive_kwara_test()
