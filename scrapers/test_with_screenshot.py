"""
Test scraper with screenshots to see what's actually on the page
"""

import asyncio
from playwright.async_api import async_playwright

slug = "sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"
url = f"https://www.kwara.com.br/lote/{slug}"

async def test_with_screenshots():
    """Test with screenshots to see page state"""

    print(f"Testing page: {url}")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Not headless to see what's happening
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )

        page = await context.new_page()

        # Load the page
        print("\n1. Loading page...")
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await page.screenshot(path='/tmp/01_initial_load.png')
        print("  ✓ Saved: /tmp/01_initial_load.png")

        # Wait for JavaScript
        print("\n2. Waiting for JavaScript (5 seconds)...")
        await asyncio.sleep(5)
        await page.screenshot(path='/tmp/02_after_js_wait.png')
        print("  ✓ Saved: /tmp/02_after_js_wait.png")

        # Dismiss modal
        print("\n3. Dismissing modal...")
        for _ in range(3):
            await page.keyboard.press('Escape')
            await asyncio.sleep(0.5)
        await page.screenshot(path='/tmp/03_after_dismiss.png')
        print("  ✓ Saved: /tmp/03_after_dismiss.png")

        # Remove modal via JavaScript
        await page.evaluate('''() => {
            const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
            dialogs.forEach(d => d.remove());
            const overlays = document.querySelectorAll('[class*="overlay"], [class*="backdrop"]');
            overlays.forEach(o => o.remove());
        }''')
        await asyncio.sleep(2)
        await page.screenshot(path='/tmp/04_after_remove_modal.png')
        print("  ✓ Saved: /tmp/04_after_remove_modal.png")

        # Scroll to load content
        print("\n4. Scrolling...")
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await asyncio.sleep(2)
        await page.evaluate('window.scrollTo(0, 0)')
        await asyncio.sleep(2)
        await page.screenshot(path='/tmp/05_after_scroll.png', full_page=True)
        print("  ✓ Saved: /tmp/05_after_scroll.png")

        # Get page text
        print("\n5. Extracting text content...")
        html = await page.content()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')

        # Look for the fields
        field_patterns = ["Informações", "Referência", "Descrição", "Observações", "Visitação", "Retirada"]
        found_fields = []
        for pattern in field_patterns:
            if pattern.lower() in html.lower():
                found_fields.append(pattern)

        if found_fields:
            print(f"  ✓ Found fields in HTML: {', '.join(found_fields)}")
        else:
            print(f"  ✗ Fields NOT found in HTML")

        # Show some text content
        all_text = soup.get_text(separator='\n')
        lines = [line.strip() for line in all_text.split('\n') if line.strip() and len(line.strip()) > 10]

        print(f"\n  Page has {len(lines)} text lines")
        print(f"  First 10 lines:")
        for i, line in enumerate(lines[:10], 1):
            print(f"    {i:3d}. {line[:100]}")

        # Save HTML for inspection
        with open(f'/tmp/page_content_{slug}.html', 'w') as f:
            f.write(html)
        print(f"\n  ✓ Saved HTML to /tmp/page_content_{slug}.html")

        await browser.close()

    print("\n" + "=" * 80)
    print("✓ Complete! Check the screenshots to see what's on the page.")
    print("=" * 80)

if __name__ == '__main__':
    asyncio.run(test_with_screenshots())
