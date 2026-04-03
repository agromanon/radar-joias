"""
Debug script to see actual rendered page structure
"""

import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def debug_page_structure():
    """Load page with JavaScript and show structure"""

    url = "https://www.kwara.com.br/lote/sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"

    print(f"Loading page with JavaScript...")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )

        page = await context.new_page()
        await page.goto(url, wait_until='networkidle', timeout=30000)

        # Get rendered HTML
        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        print("\n" + "=" * 80)
        print("LOOKING FOR FIELD LABELS")
        print("=" * 80)

        # Look for specific field labels
        field_patterns = [
            "Informações",
            "Referência",
            "Descrição",
            "Observações",
            "Visitação",
            "Retirada",
            "Evento"
        ]

        for pattern in field_patterns:
            print(f"\nSearching for: {pattern}")
            print("-" * 40)

            # Search for this pattern in the page
            found_elements = []

            # Try different selectors
            selectors = [
                f'*:contains("{pattern}")',
                f'h1:contains("{pattern}")',
                f'h2:contains("{pattern}")',
                f'h3:contains("{pattern}")',
                f'div:contains("{pattern}")',
                f'span:contains("{pattern}")',
                f'p:contains("{pattern}")',
                f'strong:contains("{pattern}")',
                f'label:contains("{pattern}")',
            ]

            for selector in selectors:
                try:
                    elements = soup.select(selector)
                    for el in elements[:3]:  # First 3 matches
                        text = el.get_text(strip=True)
                        if pattern.lower() in text.lower():
                            found_elements.append({
                                'tag': el.name,
                                'text': text[:100],
                                'class': el.get('class', []),
                                'id': el.get('id', '')
                            })
                except:
                    continue

            if found_elements:
                print(f"✓ Found {len(found_elements)} elements")
                for i, el in enumerate(found_elements[:3], 1):
                    print(f"  {i}. <{el['tag']}> class={el['class']} id={el['id']}")
                    print(f"     Text: {el['text']}")
            else:
                print("✗ Not found")

        print("\n" + "=" * 80)
        print("TEXT CONTENT (first 100 lines)")
        print("=" * 80)

        # Get all text content
        all_text = soup.get_text(separator='\n')
        lines = [line.strip() for line in all_text.split('\n') if line.strip() and len(line.strip()) > 3]

        for i, line in enumerate(lines[:100], 1):
            print(f"{i:3d}. {line}")

        await browser.close()

    print("\n" + "=" * 80)
    print("✓ Debug complete")

if __name__ == '__main__':
    asyncio.run(debug_page_structure())
