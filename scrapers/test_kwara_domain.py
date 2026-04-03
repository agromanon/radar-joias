"""
Test access to actual Kwara domain
"""

import requests
from bs4 import BeautifulSoup

def test_kwara_domain():
    """Test if we can access the actual kwara.com.br domain"""
    print("Testing access to Kwara domains...")
    print("=" * 60)

    urls = [
        'https://www.kwara.com.br',
        'https://kwara.com.br',
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

                print(f"\n  Page title: {soup.title.string if soup.title else 'No title'}")

                # Look for auction-related content
                text = soup.get_text().lower()
                auction_keywords = ['leilão', 'lance', 'leiloes', 'lote']
                found_keywords = [word for word in auction_keywords if word in text]

                print(f"  Auction-related keywords found: {found_keywords}")

                # Check if this is an auction site
                if any(word in text for word in ['material', 'construção', 'equipamento']):
                    print("  ✓ Appears to be construction/industrial auction site")

                # Sample page structure
                print(f"\n  Page structure sample:")
                links = soup.find_all('a', href=True)[:5]
                for link in links:
                    href = link.get('href', 'no href')
                    text = link.get_text(strip=True)[:50]
                    print(f"    Link: {href[:60]}")
                    print(f"    Text: {text}")

                return True

        except Exception as e:
            print(f"❌ Error: {e}")

    print("\n" + "=" * 60)
    print("✓ Domain test completed")
    return False

if __name__ == '__main__':
    test_kwara_domain()
