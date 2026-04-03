"""
Debug authenticated lot page structure
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

url = "https://www.kwara.com.br/lote/sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"

async def debug_authenticated_page():
    """Load page with authentication and show structure"""

    print(f"Loading page with authentication...")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
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
        await page.click('span:has-text("Acesso com senha")')
        await asyncio.sleep(2)

        # Fill password
        await page.fill('input[type="password"]', password)
        await asyncio.sleep(1)

        # Click login using JavaScript (bypasses overlay)
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
        await asyncio.sleep(5)  # Wait for login to complete

        print("✓ Logged in")

        # Now navigate to the lot page
        print(f"\n2. Navigating to lot page...")
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(3)

        # Dismiss any login modal
        print("\n3. Dismissing login modal...")
        for _ in range(3):
            await page.keyboard.press('Escape')
            await asyncio.sleep(0.5)

        # Remove modal via JavaScript
        await page.evaluate('''() => {
            const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
            dialogs.forEach(d => d.remove());
            const overlays = document.querySelectorAll('[class*="overlay"], [class*="backdrop"]');
            overlays.forEach(o => o.remove());
        }''')
        await asyncio.sleep(2)

        # Scroll to load dynamic content
        print("\n4. Scrolling to load content...")
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await asyncio.sleep(2)
        await page.evaluate('window.scrollTo(0, 0)')
        await asyncio.sleep(1)

        # Get page HTML
        html = await page.content()

        # Look for field labels
        print("\n" + "=" * 80)
        print("SEARCHING FOR FIELD LABELS")
        print("=" * 80)

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
            if pattern.lower() in html.lower():
                print(f"✓ Found '{pattern}' in HTML")
                # Try to find the context
                start_idx = html.lower().find(pattern.lower())
                context_start = max(0, start_idx - 100)
                context_end = min(len(html), start_idx + 300)
                context = html[context_start:context_end]
                # Show a snippet
                clean_context = context.replace('<', ' <').replace('>', '> ')
                print(f"  Context: ...{clean_context[:200]}...")
            else:
                print(f"✗ '{pattern}' NOT found in HTML")

        # Check for text content
        print("\n" + "=" * 80)
        print("TEXT CONTENT (first 50 lines)")
        print("=" * 80)

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        all_text = soup.get_text(separator='\n')
        lines = [line.strip() for line in all_text.split('\n') if line.strip() and len(line.strip()) > 3]

        for i, line in enumerate(lines[:50], 1):
            print(f"{i:3d}. {line}")

        await browser.close()

    print("\n" + "=" * 80)
    print("✓ Debug complete")

if __name__ == '__main__':
    asyncio.run(debug_authenticated_page())
