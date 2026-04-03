"""
Test Kwara construction materials category
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

def test_kwara_construction():
    """Test Kwara construction category page"""
    print("Testing Kwara construction materials...")
    print("=" * 60)

    base_url = 'https://www.kwara.com.br'

    # Try the construction category
    url = urljoin(base_url, '/categorias/casa-e-construcao')

    try:
        print(f"📡 Fetching: {url}")
        response = requests.get(url, timeout=15, allow_redirects=True)
        print(f"✓ Status: {response.status_code}")
        print(f"  Final URL: {response.url}")

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')

            print(f"\n  Page title: {soup.title.string if soup.title else 'No title'}")

            # Look for auction listings
            print("\n  Analyzing page structure...")

            # Find product/lot cards
            potential_containers = soup.find_all(['div', 'article'], class_=lambda x: x and any(
                word in str(x.get('class', [])).lower() for word in ['card', 'product', 'item', 'lot', 'oferta']
            ))

            print(f"  Found {len(potential_containers)} potential product containers")

            # Look for links
            links = soup.find_all('a', href=True)
            auction_links = [link for link in links if any(
                word in link.get_text().lower() for word in ['lance', 'leilao', 'material']
            )]

            print(f"  Found {len(auction_links)} auction-related links")

            # Sample some links
            if auction_links:
                print("\n  Sample auction links:")
                for link in auction_links[:5]:
                    href = link.get('href')
                    text = link.get_text(strip=True)[:80]
                    if href:
                        full_url = urljoin(base_url, href)
                        print(f"    {full_url}")
                        print(f"    Text: {text}")

            # Check for pagination
            print(f"\n  Total links on page: {len(links)}")

            # Look for price elements
            prices = soup.find_all(['span', 'div'], class_=lambda x: x and 'r$' in x.get_text())
            print(f"  Found {len(prices)} price elements")

            return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    return False

if __name__ == '__main__':
    test_kwara_construction()
