"""
Test if authentication is actually working
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

async def test_if_auth_works():
    """Test if authentication is actually successful"""

    print("=" * 80)
    print("Testing if authentication actually works...")
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

        # Check if we're logged in by going to home page
        print("\n2. Checking authentication status...")
        await page.goto('https://www.kwara.com.br/', wait_until='networkidle', timeout=30000)
        await asyncio.sleep(3)

        html = await page.content()

        # Look for signs of being logged in
        logged_in_indicators = [
            'Minha conta',
            'Meus lotes',
            'Sair',
            'Logout',
            email.split('@')[0],  # Part of email
        ]

        found_indicators = []
        for indicator in logged_in_indicators:
            if indicator.lower() in html.lower():
                found_indicators.append(indicator)

        print(f"\nLogged in indicators found: {len(found_indicators)}/{len(logged_in_indicators)}")
        if found_indicators:
            print(f"  ✓ Signs of login: {', '.join(found_indicators)}")
        else:
            print(f"  ✗ No signs of being logged in")

        # Check for login modal
        login_modal_indicators = [
            'Que bom te ver de novo',
            'Escolha uma das opções abaixo',
            'Entrar com e-mail',
        ]

        modal_found = False
        for indicator in login_modal_indicators:
            if indicator.lower() in html.lower():
                modal_found = True
                break

        if modal_found:
            print(f"  ✗ Login modal still present - authentication may have failed")
        else:
            print(f"  ✓ No login modal - appears to be logged in")

        # Try to access a user-only page
        print(f"\n3. Testing access to user-only pages...")
        await page.goto('https://www.kwara.com.br/minha-conta', wait_until='networkidle', timeout=30000)
        await asyncio.sleep(3)

        current_url = page.url
        print(f"  Current URL: {current_url}")

        if '/minha-conta' in current_url or '/meus-lotes' in current_url:
            print(f"  ✓ Successfully accessed user-only page")
        elif 'auth' in current_url or 'login' in current_url:
            print(f"  ✗ Redirected to auth page - not logged in")
        else:
            print(f"  ? Unclear - check current URL")

        await browser.close()

    print(f"\n{'=' * 80}")
    print(f"CONCLUSION")
    print(f"{'=' * 80}")
    if found_indicators and not modal_found:
        print(f"✓ Authentication IS working")
        print(f"The 404 errors on lot pages must be due to:")
        print(f"  1. Incorrect lot slug format")
        print(f"  2. Lots being in different categories")
        print(f"  3. Site structure changes")
    else:
        print(f"✗ Authentication is NOT working properly")
        print(f"Need to fix login flow before testing lot pages")
    print(f"{'=' * 80}")

if __name__ == '__main__':
    asyncio.run(test_if_auth_works())
