"""
Test direct access to Kwara website (no proxy)
Check if the site is accessible and what structure it has
"""

import requests
from bs4 import BeautifulSoup

def test_site_access():
    """Test if we can access kwara.com.br directly"""
    print("Testing direct access to Kwara website...")
    print("=" * 60)

    urls = [
        'https://www.leiloeskwara.com.br',
        'https://leiloeskwara.com.br',
        'http://www.leiloeskwara.com.br',
    ]

    for url in urls:
        try:
            print(f"\n📡 Trying: {url}")
            response = requests.get(url, timeout=15, allow_redirects=True)
            print(f"✓ Status: {response.status_code}")
            print(f"  Final URL: {response.url}")
            print(f"  Content length: {len(response.text)} bytes")

            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')

                # Look for common patterns
                print("\n  Analyzing page structure...")

                # Find links
                links = soup.find_all('a', href=True)
                print(f"  Found {len(links)} links")

                # Sample some link hrefs
                unique_hrefs = set([link.get('href') for link in links[:20]])
                for href in list(unique_hrefs)[:5]:
                    if href:
                        print(f"    - {href[:80]}")

                # Find forms
                forms = soup.find_all('form')
                print(f"  Found {len(forms)} forms")

                # Find common auction-related elements
                lot_items = soup.find_all(['div', 'article', 'li'], class_=lambda x: x and any(
                    word in str(x.get('class', [])) for word in ['lote', 'leilao', 'item', 'card', 'produto']
                ))
                print(f"  Found {len(lot_items)} potential lot containers")

                # Find all divs with class containing specific keywords
                divs_with_class = soup.find_all('div', class_=True)
                print(f"  Found {len(divs_with_class)} divs with classes")

                # Sample some class names
                class_names = set()
                for div in divs_with_class[:10]:
                    classes = div.get('class', [])
                    class_names.update(classes)
                print(f"  Sample classes: {list(class_names)[:10]}")

                return True

        except Exception as e:
            print(f"❌ Error: {e}")

    print("\n" + "=" * 60)
    print("✓ Site access test completed")
    return False

if __name__ == '__main__':
    test_site_access()
