"""
Test if AUTHENTICATED browser can access extended lot fields
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

async def test_authenticated_lot():
    """Test lot page WITH authentication"""

    # Use current lot from API
    slug = "sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"
    url = f"https://www.kwara.com.br/lote/{slug}"

    print("=" * 80)
    print(f"Testing AUTHENTICATED access to lot: {slug}")
    print(f"URL: {url}")
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

        # Fill email
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
                    print("  ✓ Clicked password option")
                    break
            except:
                continue

        await asyncio.sleep(3)

        # Fill password
        await page.fill('input[type="password"]', password)
        await asyncio.sleep(1)

        # Click submit button via JavaScript
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
        print("  ✓ Submitted login form")

        await asyncio.sleep(8)  # Wait for login to complete

        # Now navigate to lot page
        print(f"\n2. Navigating to lot page (authenticated)...")
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(5)

        # Dismiss any lingering modal
        print("\n3. Dismissal of any modal...")
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

        # Scroll to load content
        print("\n4. Scrolling to load dynamic content...")
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await asyncio.sleep(2)
        await page.evaluate('window.scrollTo(0, 0)')
        await asyncio.sleep(2)

        # Take screenshot
        await page.screenshot(path='/tmp/authenticated_lot.png', full_page=True)
        print("  ✓ Saved: /tmp/authenticated_lot.png")

        # Get HTML and analyze
        html = await page.content()

        print(f"\n{'=' * 80}")
        print(f"SEARCHING FOR FIELDS (AUTHENTICATED)")
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

        # Show sample text content
        print(f"\n{'=' * 80}")
        print(f"TEXT CONTENT SAMPLE (first 50 lines)")
        print(f"{'=' * 80}")

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        all_text = soup.get_text(separator='\n')
        lines = [line.strip() for line in all_text.split('\n') if line.strip() and len(line.strip()) > 3]

        for i, line in enumerate(lines[:50], 1):
            print(f"{i:3d}. {line}")

        # Save HTML
        with open(f'/tmp/authenticated_lot_{slug}.html', 'w') as f:
            f.write(html)
        print(f"\n✓ Saved HTML to /tmp/authenticated_lot_{slug}.html")

        await browser.close()

    print(f"\n{'=' * 80}")
    print(f"SUMMARY")
    print(f"{'=' * 80}")
    print(f"Fields found: {len(found_fields)}/7")
    if found_fields:
        print(f"✓ EXTENDED FIELDS AVAILABLE WITH AUTH: {', '.join(found_fields)}")
        print(f"\nNEXT STEP: Update scraper to use authenticated browser sessions")
    else:
        print(f"✗ Even with authentication, extended fields not found")
        print(f"\nPOSSIBLE ISSUE: Site may have different structure or API endpoints")
    print(f"{'=' * 80}")

if __name__ == '__main__':
    asyncio.run(test_authenticated_lot())
