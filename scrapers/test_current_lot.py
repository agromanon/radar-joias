"""
Test with a CURRENT lot from the API to see if fields exist
"""

import asyncio
import json
from playwright.async_api import async_playwright
from utils.database_http import DatabaseManagerHTTP

async def test_current_lot():
    """Test with a real current lot from the API"""

    print("=" * 80)
    print("Fetching current lots from API...")
    print("=" * 80)

    # Get current lots from Kwara Next.js Data API
    import requests

    build_id = 'ziWczoweSgRNOjgvfT9eZ'  # Current build ID
    category_id = '1335572015838398043'  # metais
    kwara_api_url = f"https://www.kwara.com.br/_next/data/{build_id}/busca.json"

    response = requests.get(kwara_api_url, params={
        'assetCategoryIds[]': category_id,
        'page': 1,
        'pageSize': 5
    })

    if response.status_code != 200:
        print(f"✗ API Error: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        return

    data = response.json()
    # The API returns data in pageProps.searchResult.items
    lots = data.get('pageProps', {}).get('searchResult', {}).get('items', [])
    print(f"\n✓ Found {len(lots)} lots")

    if not lots:
        print("No lots found!")
        return

    # Use the first lot
    test_lot = lots[0]
    slug = test_lot.get('slug', '')
    url = f"https://www.kwara.com.br/lote/{slug}"

    print(f"\n{'=' * 80}")
    print(f"Testing with CURRENT lot:")
    print(f"  Title: {test_lot.get('title', 'N/A')}")
    print(f"  Slug: {slug}")
    print(f"  URL: {url}")
    print(f"{'=' * 80}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )

        page = await context.new_page()

        # Navigate to lot page
        print(f"\n1. Navigating to lot page...")
        await page.goto(url, wait_until='networkidle', timeout=30000)

        # Wait for JavaScript
        print(f"2. Waiting for JavaScript (5 seconds)...")
        await asyncio.sleep(5)

        # Take screenshot
        await page.screenshot(path='/tmp/current_lot_01.png')
        print(f"  ✓ Saved: /tmp/current_lot_01.png")

        # Dismiss modal
        print(f"\n3. Dismissing modal...")
        for _ in range(3):
            await page.keyboard.press('Escape')
            await asyncio.sleep(0.5)

        await page.evaluate('''() => {
            const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
            dialogs.forEach(d => d.remove());
            const overlays = document.querySelectorAll('[class*="overlay"], [class*="backdrop"]');
            overlays.forEach(o => o.remove());
        }''')
        await asyncio.sleep(2)

        # Scroll
        print(f"\n4. Scrolling...")
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await asyncio.sleep(2)
        await page.evaluate('window.scrollTo(0, 0)')
        await asyncio.sleep(2)

        await page.screenshot(path='/tmp/current_lot_02.png', full_page=True)
        print(f"  ✓ Saved: /tmp/current_lot_02.png (full page)")

        # Get HTML and analyze
        html = await page.content()

        print(f"\n{'=' * 80}")
        print(f"SEARCHING FOR FIELDS")
        print(f"{'=' * 80}")

        field_patterns = [
            "Informações",
            "Referência",
            "Descrição",
            "Observações",
            "Visitação",
            "Retirada",
            "Evento"
        ]

        found_fields = []
        for pattern in field_patterns:
            if pattern.lower() in html.lower():
                found_fields.append(pattern)
                print(f"✓ Found '{pattern}' in HTML")

                # Find context
                start_idx = html.lower().find(pattern.lower())
                context_start = max(0, start_idx - 150)
                context_end = min(len(html), start_idx + 400)
                context = html[context_start:context_end]

                # Clean and show snippet
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(context, 'html.parser')
                text = soup.get_text(separator=' ', strip=True)
                print(f"  Context: {text[:200]}...")
            else:
                print(f"✗ '{pattern}' NOT found")

        # Show all text content
        print(f"\n{'=' * 80}")
        print(f"TEXT CONTENT (first 100 lines)")
        print(f"{'=' * 80}")

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        all_text = soup.get_text(separator='\n')
        lines = [line.strip() for line in all_text.split('\n') if line.strip() and len(line.strip()) > 3]

        for i, line in enumerate(lines[:100], 1):
            print(f"{i:3d}. {line}")

        # Save HTML
        with open(f'/tmp/current_lot_{slug}.html', 'w') as f:
            f.write(html)
        print(f"\n✓ Saved HTML to /tmp/current_lot_{slug}.html")

        await browser.close()

    print(f"\n{'=' * 80}")
    print(f"SUMMARY")
    print(f"{'=' * 80}")
    print(f"Fields found: {len(found_fields)}/7")
    if found_fields:
        print(f"Found: {', '.join(found_fields)}")
    else:
        print(f"NO extended fields found in HTML")
    print(f"{'=' * 80}")

if __name__ == '__main__':
    asyncio.run(test_current_lot())
