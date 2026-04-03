"""
Debug test - check what we're actually getting from Kwara
"""

import requests
from bs4 import BeautifulSoup

def debug_fetch():
    """Debug fetch to see actual HTML content"""
    print("Debug: Fetching Kwara homepage...")
    print("=" * 80)

    url = 'https://www.kwara.com.br'

    try:
        response = requests.get(url, timeout=15)
        print(f"Status: {response.status_code}")
        print(f"Content length: {len(response.text)} bytes")

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')

            # Count elements
            divs = soup.find_all('div')
            links = soup.find_all('a')
            images = soup.find_all('img')

            print(f"\nElement counts:")
            print(f"  Divs: {len(divs)}")
            print(f"  Links: {len(links)}")
            print(f"  Images: {len(images)}")

            # Sample some divs
            print(f"\nSample divs (first 5):")
            for i, div in enumerate(divs[:5], 1):
                classes = div.get('class', [])
                print(f"  {i}. <div class='{' '.join(classes)}'>")

                # Check for img
                img = div.find('img')
                if img:
                    print(f"     Has image: {img.get('src', 'no-src')[:60]}")

                # Check for link
                link = div.find('a', href=True)
                if link:
                    print(f"     Has link: {link.get('href')[:60]}")

                # Sample text
                text = div.get_text(strip=True)[:60]
                if text:
                    print(f"     Text: {text}")

            # Check if page is actually loaded
            page_text = soup.get_text()
            if len(page_text) < 500:
                print(f"\n⚠️  WARNING: Page content seems too short ({len(page_text)} chars)")
                print(f"  Page might be dynamically loaded or blocked")
            else:
                print(f"\n✓ Page has content ({len(page_text)} chars)")

        print("\n" + "=" * 80)
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    debug_fetch()
