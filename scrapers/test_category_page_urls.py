"""
Navigate to category page and extract actual lot URLs
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

async def test_category_page():
    """Navigate to category page and extract lot URLs"""

    category_id = '1335572015838398043'  # metais
    category_url = f"https://www.kwara.com.br/busca?assetCategoryIds[]={category_id}"

    print("=" * 80)
    print(f"Testing category page: {category_url}")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )

        page = await context.new_page()

        # First, login
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

        await asyncio.sleep(8)  # Wait for login

        # Navigate to category page
        print(f"\n2. Navigating to category page...")
        await page.goto(category_url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(5)

        # Extract lot links
        print(f"\n3. Extracting lot links...")
        lot_links = await page.evaluate('''() => {
            const links = Array.from(document.querySelectorAll('a[href*="/lote/"]'));
            return links.map(a => ({
                href: a.href,
                text: a.textContent?.trim() || ''
            })).slice(0, 5);  // First 5 lots
        }''')

        print(f"\nFound {len(lot_links)} lot links:")
        for i, link in enumerate(lot_links, 1):
            print(f"\n{i}. {link['text'][:60]}...")
            print(f"   URL: {link['href']}")

            # Extract slug
            slug = link['href'].split('/lote/')[-1]
            print(f"   Slug: {slug}")

        # Test first lot link
        if lot_links:
            first_lot_url = lot_links[0]['href']
            print(f"\n{'=' * 80}")
            print(f"Testing first lot link...")
            print(f"{'=' * 80}")

            await page.goto(first_lot_url, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(5)

            # Check for fields
            html = await page.content()

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

            print(f"\nFields found: {len(found_fields)}/7")
            if found_fields:
                print(f"✓✓✓ SUCCESS! Found: {', '.join(found_fields)}")
            else:
                print(f"✗ Fields not found")

            # Save HTML
            slug = first_lot_url.split('/lote/')[-1]
            with open(f'/tmp/category_lot_{slug}.html', 'w') as f:
                f.write(html)
            print(f"Saved HTML to /tmp/category_lot_{slug}.html")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(test_category_page())
