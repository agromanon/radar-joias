"""
Simple test to debug Kwara authentication
"""

import asyncio
import os
from playwright.async_api import async_playwright
from dotenv import load_dotenv

# Load credentials
from pathlib import Path

# Try to load from .env.local in project root
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

email = os.getenv('KWARA_ACCOUNT_1_EMAIL')
password = os.getenv('KWARA_ACCOUNT_1_PASSWORD')

print(f"Loaded credentials from: {env_path}")
print(f"Email: {email}")
print(f"Password: {'*' * len(password) if password else 'None'}")

print(f"Testing authentication for: {email}")
print("=" * 80)

async def test_login():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)  # Run in background
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )

        page = await context.new_page()

        # Navigate to login page
        print("Navigating to login page...")
        await page.goto('https://www.kwara.com.br/?isLoginDialogOpenOption=sign-in', wait_until='networkidle', timeout=30000)

        # Wait for page to load
        await asyncio.sleep(3)

        # Take screenshot of initial state
        await page.screenshot(path='/tmp/01_initial_state.png')
        print("✓ Saved screenshot: /tmp/01_initial_state.png")

        # Try to find and fill email field
        print("\nLooking for email field...")
        email_selectors = [
            'input[type="email"]',
            'input[name="email"]',
            'input[placeholder*="email" i]',
        ]

        email_filled = False
        for selector in email_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    print(f"✓ Found email field: {selector}")
                    await element.fill(email)
                    email_filled = True
                    await asyncio.sleep(1)
                    await page.screenshot(path='/tmp/02_email_filled.png')
                    print("✓ Saved screenshot: /tmp/02_email_filled.png")
                    break
            except Exception as e:
                print(f"✗ Selector {selector} failed: {e}")

        if not email_filled:
            print("✗ Could not find email field")
            await browser.close()
            return

        # Try to click password option
        print("\nLooking for 'Acesso com senha' option...")

        # First, let's check what form elements are available
        print("Checking all form elements before clicking...")
        all_inputs = await page.query_selector_all('input')
        print(f"Found {len(all_inputs)} input fields")
        all_labels = await page.query_selector_all('label')
        print(f"Found {len(all_labels)} labels")

        # Look for radio buttons or checkboxes
        all_radios = await page.query_selector_all('input[type="radio"]')
        print(f"Found {len(all_radios)} radio buttons")
        for i, radio in enumerate(all_radios[:5], 1):
            radio_value = await radio.get_attribute('value')
            radio_name = await radio.get_attribute('name')
            print(f"  Radio {i}: name={radio_name}, value={radio_value}")

        password_option_selectors = [
            'label:has-text("Acesso com senha")',  # Try label FIRST
            'input[type="radio"][value*="senha"]',
            'input[type="radio"][value*="password"]',
            'span:has-text("Acesso com senha")',
            'button:has-text("Acesso com senha")',
            # Don't try div - it closes the form!
        ]

        option_clicked = False
        for selector in password_option_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    print(f"✓ Found password option: {selector}")
                    await element.click()
                    option_clicked = True
                    await asyncio.sleep(2)  # Wait for field to appear
                    await page.screenshot(path='/tmp/03_password_option_clicked.png')
                    print("✓ Saved screenshot: /tmp/03_password_option_clicked.png")
                    break
            except Exception as e:
                print(f"✗ Selector {selector} failed: {e}")

        if not option_clicked:
            print("✗ Could not click password option")
            # Try to continue anyway
            await asyncio.sleep(2)
        else:
            # Try to click multiple times to make sure it registers
            print("Trying to click password option multiple times...")
            for i in range(3):
                for selector in password_option_selectors[:2]:
                    try:
                        element = await page.query_selector(selector)
                        if element:
                            await element.click()
                            print(f"✓ Clicked iteration {i+1}")
                            await asyncio.sleep(1)
                            break
                    except:
                        continue

            # Wait longer for password field to appear
            print("Waiting 5 seconds for password field to appear...")
            await asyncio.sleep(5)

        # Look for password field
        print("\nLooking for password field...")

        # First, let's see what inputs are available
        print("Checking all input fields on page...")
        all_inputs = await page.query_selector_all('input')
        print(f"Found {len(all_inputs)} input fields total")
        for i, inp in enumerate(all_inputs[:10], 1):
            input_type = await inp.get_attribute('type')
            input_name = await inp.get_attribute('name')
            input_placeholder = await inp.get_attribute('placeholder')
            print(f"  Input {i}: type={input_type}, name={input_name}, placeholder={input_placeholder}")

        password_selectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input[placeholder*="senha" i]',
        ]

        password_filled = False
        for selector in password_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    print(f"✓ Found password field: {selector}")
                    await element.fill(password)
                    password_filled = True
                    await asyncio.sleep(1)
                    await page.screenshot(path='/tmp/04_password_filled.png')
                    print("✓ Saved screenshot: /tmp/04_password_filled.png")
                    break
            except Exception as e:
                print(f"✗ Selector {selector} failed: {e}")

        if not password_filled:
            print("✗ Could not find password field")
            await page.screenshot(path='/tmp/error_no_password_field.png')
            print("✓ Saved error screenshot: /tmp/error_no_password_field.png")
            await browser.close()
            return

        # Try to click login button
        print("\nLooking for login button...")
        login_selectors = [
            'button[type="submit"]',
            'button:has-text("Entrar")',
            'button:has-text("Entrar com Email")',
        ]

        login_clicked = False
        for selector in login_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    print(f"✓ Found login button: {selector}")
                    await element.click()
                    login_clicked = True
                    await asyncio.sleep(3)
                    await page.screenshot(path='/tmp/05_after_login.png')
                    print("✓ Saved screenshot: /tmp/05_after_login.png")
                    break
            except Exception as e:
                print(f"✗ Selector {selector} failed: {e}")

        if not login_clicked:
            print("✗ Could not click login button")
        else:
            print(f"\nCurrent URL: {page.url}")
            print("✓ Login process completed - check screenshots to see what happened")

        # Wait a bit to see final state
        await asyncio.sleep(5)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(test_login())
