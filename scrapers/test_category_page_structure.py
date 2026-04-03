"""
Check what's actually on the category page
"""

import asyncio
import os
from playwright.async_api import async_playwright
from dotenv import load_dotenv
from pathlib import Path

# Load credentials
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

email = os.getenv('KWARA_ACCOUNT_1_EMAIL')
password = os.getenv('KWARA_ACCOUNT_1_PASSWORD')

async def check_category_page():
    """Check category page structure"""

    category_id = '1335572015838398043'
    category_url = f"https://www.kwara.com.br/busca?assetCategoryIds[]={category_id}"

    print("=" * 80)
    print(f"Checking category page structure")
    print(f"URL: {category_url}")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )

        page = await context.new_page()

        # Login first
        print("\n1. Logging in...")
        await page.goto('https://www.kwara.com.br/?isLoginDialogOpenOption=sign-in', wait_until='networkidle', timeout=30000)
        await asyncio.sleep(3)

        await page.fill('input[type="email"]', email)
        await asyncio.sleep(1)

        # Click password option
        password_option_selectors = [
            'span:has-text("Acesso com senha")',
            'label:has-text("Acesso com senha")',
        ]

        for selector in password_option_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    await element.click()
                    break
            except:
                continue

        await asyncio.sleep(3)

        await page.fill('input[type="password"]', password)
        await asyncio.sleep(1)

        await page.evaluate('''() => {
            const buttons = document.querySelectorAll('button[type="submit"]');
            for (const btn of buttons) {
                const text = btn.textContent || '';
                if (text.includes('Entrar') || text.includes('Email')) {
                    btn.click();
                    return true;
                }
            }
            return false;
        }''')

        await asyncio.sleep(8)

        # Navigate to category page
        print(f"\n2. Navigating to category page...")
        await page.goto(category_url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(5)

        # Take screenshot
        await page.screenshot(path='/tmp/category_page.png', full_page=True)
        print("  ✓ Saved screenshot: /tmp/category_page.png")

        # Get page text
        print(f"\n3. Checking page content...")
        html = await page.content()

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        all_text = soup.get_text(separator='\n')
        lines = [line.strip() for line in all_text.split('\n') if line.strip() and len(line.strip()) > 3]

        print(f"\nPage has {len(lines)} text lines")
        print(f"\nFirst 30 lines:")
        for i, line in enumerate(lines[:30], 1):
            print(f"{i:3d}. {line}")

        # Check for lot cards
        print(f"\n4. Looking for lot cards...")
        lot_cards = await page.evaluate('''() => {
            // Look for any elements that might be lot cards
            const allElements = document.querySelectorAll('*');
            const lotElements = [];

            allElements.forEach(el => {
                const text = el.textContent?.trim() || '';
                const href = el.getAttribute('href') || '';

                // Look for links with lot-like content
                if (href && (href.includes('/lote/') || href.includes('/lot/')) && text.length > 10 && text.length < 200) {
                    lotElements.push({
                        tag: el.tagName,
                        href: href,
                        text: text.substring(0, 100)
                    });
                }
            });

            return lotElements.slice(0, 10);
        }''')

        print(f"Found {len(lot_cards)} potential lot elements:")
        for i, card in enumerate(lot_cards, 1):
            print(f"{i}. <{card['tag']}> {card['href']}")
            print(f"   {card['text']}")
            print()

        # Check current URL
        current_url = page.url
        print(f"Current URL after navigation: {current_url}")

        # Check if redirected
        if current_url != category_url:
            print(f"⚠️  Redirected from original URL")

        # Check page route
        page_route = await page.evaluate('''() => {
            const nextData = document.getElementById('__NEXT_DATA__');
            if (nextData) {
                try {
                    const data = JSON.parse(nextData.textContent);
                    return data.page || 'unknown';
                } catch (e) {
                    return 'parse error';
                }
            }
            return 'no __NEXT_DATA__';
        }''')

        print(f"Next.js page route: {page_route}")

        # Save HTML
        with open('/tmp/category_page.html', 'w') as f:
            f.write(html)
        print(f"\n✓ Saved HTML to /tmp/category_page.html")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(check_category_page())
