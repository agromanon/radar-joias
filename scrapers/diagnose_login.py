"""
Diagnostic script to explore Kwara login dialog
Shows all buttons, links, and interactive elements
"""

import asyncio
from playwright.async_api import async_playwright
from utils.auth_browser import get_browser_auth_manager
import os
from dotenv import load_dotenv
from pathlib import Path

# Load env
try:
    project_root = Path(__file__).parent.parent.parent
    env_file = project_root / '.env.local'
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
except:
    pass

if not os.getenv('KWARA_ACCOUNT_1_EMAIL'):
    load_dotenv()


async def diagnose_login():
    """Diagnose the login dialog structure"""
    email = os.getenv('KWARA_ACCOUNT_1_EMAIL')
    password = os.getenv('KWARA_ACCOUNT_1_PASSWORD')

    if not email or not password:
        print("❌ No credentials found in .env.local")
        return

    print(f"📧 Email: {email}")
    print()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Show browser for debugging
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        # Navigate to login
        login_url = "https://www.kwara.com.br/?isLoginDialogOpenOption=sign-in"
        print(f"🌐 Navigating to: {login_url}")
        await page.goto(login_url, wait_until='networkidle')
        await page.wait_for_timeout(2000)

        print("\n" + "=" * 80)
        print("Step 1: Finding email field")
        print("=" * 80)

        # Find email field
        email_field = await page.query_selector('input[type="email"]')
        if email_field:
            print("✓ Found email field")
            await email_field.fill(email)
            print(f"✓ Entered email: {email}")
            await page.wait_for_timeout(1000)
        else:
            print("✗ Email field not found")

        print("\n" + "=" * 80)
        print("Step 2: Looking for ALL buttons and links")
        print("=" * 80)

        # Get all buttons
        buttons = await page.query_selector_all('button')
        print(f"\nFound {len(buttons)} buttons:")
        for i, button in enumerate(buttons, 1):
            try:
                text = await button.text_content()
                if text and text.strip():
                    print(f"  {i}. Button: '{text.strip()[:50]}'")
                else:
                    # Check for aria-label
                    aria_label = await button.get_attribute('aria-label')
                    if aria_label:
                        print(f"  {i}. Button (aria-label): '{aria_label[:50]}'")
            except:
                pass

        # Get all links
        print(f"\n" + "-" * 80)
        links = await page.query_selector_all('a')
        print(f"Found {len(links)} links:")
        for i, link in enumerate(links[:20], 1):  # First 20 links
            try:
                text = await link.text_content()
                href = await link.get_attribute('href')
                if text and text.strip():
                    print(f"  {i}. Link: '{text.strip()[:50]}' → {href[:50] if href else 'N/A'}")
            except:
                pass

        print("\n" + "=" * 80)
        print("Step 3: Looking for div/menu items")
        print("=" * 80)

        # Look for clickable divs with specific text
        div_texts = [
            "senha",
            "password",
            "Entrar",
            "entrar"
        ]

        for text in div_texts:
            elements = await page.query_selector_all(f'div:has-text("{text}")')
            if elements:
                print(f"Found {len(elements)} divs with '{text}':")
                for i, elem in enumerate(elements[:5], 1):
                    try:
                        elem_text = await elem.text_content()
                        print(f"  {i}. {elem_text.strip()[:80]}")
                    except:
                        pass

        print("\n" + "=" * 80)
        print("Step 4: Taking screenshots")
        print("=" * 80)

        # Screenshot before clicking anything
        await page.screenshot(path="/tmp/login_step1_email_entered.png")
        print("✓ Screenshot saved: /tmp/login_step1_email_entered.png")
        print("   (Keeping browser open for 10 seconds for inspection...)")

        # Keep browser open for manual inspection
        await page.wait_for_timeout(10000)

        print("\n" + "=" * 80)
        print("✓ Diagnostic complete!")
        print("=" * 80)

        await browser.close()


if __name__ == '__main__':
    asyncio.run(diagnose_login())
