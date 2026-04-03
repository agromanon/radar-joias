"""
Monitor API calls when accessing lot page to find the correct endpoint
This is the definitive test to find how extended lot data is loaded
"""

import asyncio
import os
from playwright.async_api import async_playwright
from dotenv import load_dotenv
from pathlib import Path
import json

# Load credentials
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

email = os.getenv('KWARA_ACCOUNT_1_EMAIL')
password = os.getenv('KWARA_ACCOUNT_1_PASSWORD')

async def monitor_api_calls():
    """Monitor all API calls when accessing lot page"""

    # Use a lot from the search API
    slug = "banheira-na-o-inclui-ducha-ref-ab-35550-83024"
    url = f"https://www.kwara.com.br/lote/{slug}"

    print("=" * 100)
    print(f"API CALL MONITOR - Accessing Lot Page")
    print(f"Lot: {slug}")
    print(f"URL: {url}")
    print("=" * 100)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )

        page = await context.new_page()

        # Store all API calls
        api_calls = []

        async def log_request(route):
            """Log all API requests"""
            request = route.request
            url = request.url
            method = request.method
            resource_type = request.resource_type

            # Log XHR and fetch requests
            if resource_type in ["xhr", "fetch"]:
                api_calls.append({
                    'url': url,
                    'method': method,
                    'type': resource_type
                })
                print(f"📡 API Call: {method} {url}")

            await route.continue_()

        # Set up request interception
        await page.route("**/*", log_request)

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

        await asyncio.sleep(10)  # Wait for login to complete

        # Clear API calls from login phase
        api_calls.clear()

        # Now navigate to lot page
        print(f"\n2. Navigating to lot page...")
        print(f"   Monitoring all API calls...")
        api_calls.clear()

        await page.goto(url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(10)  # Wait for all API calls to complete

        print(f"\n3. Analyzing API calls...")

        # Look for lot data endpoints
        print(f"\n{'=' * 100}")
        print(f"POTENTIAL LOT DATA ENDPOINTS")
        print(f"{'=' * 100}")

        lot_data_endpoints = []
        for call in api_calls:
            url = call['url']
            method = call['method']

            # Look for patterns that might be lot data
            if any(pattern in url for pattern in [
                f'/{slug}',
                '/lote/',
                '/lot/',
                'slug=',
                'lotId',
                'detail',
                'auction'
            ]):
                lot_data_endpoints.append(call)
                print(f"\n✓ Found potential lot data endpoint:")
                print(f"  Method: {method}")
                print(f"  URL: {url}")

                # Try to fetch this endpoint
                try:
                    print(f"  Testing endpoint...")
                    response = await context.request.get(url)
                    print(f"  Status: {response.status}")

                    if response.status == 200:
                        try:
                            data = await response.json()
                            print(f"  ✓ JSON response received")

                            # Check if it has lot data
                            json_str = json.dumps(data, indent=2, ensure_ascii=False)
                            if len(json_str) < 2000:
                                print(f"  Response preview:")
                                print(f"    {json_str[:1000]}...")
                            else:
                                print(f"  Response size: {len(json_str)} chars")
                                print(f"  Top-level keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")

                                # Save full response
                                with open(f'/tmp/lot_api_response_{slug}.json', 'w') as f:
                                    f.write(json_str)
                                print(f"  ✓ Saved to /tmp/lot_api_response_{slug}.json")

                        except:
                            print(f"  ✗ Response is not JSON")
                            text = await response.text()
                            print(f"  Text preview: {text[:200]}...")
                    else:
                        print(f"  ✗ Endpoint not accessible (status {response.status})")

                except Exception as e:
                    print(f"  ✗ Error: {e}")

        # Summary
        print(f"\n{'=' * 100}")
        print(f"SUMMARY")
        print(f"{'=' * 100}")
        print(f"Total API calls intercepted: {len(api_calls)}")
        print(f"Potential lot data endpoints: {len(lot_data_endpoints)}")

        if lot_data_endpoints:
            print(f"\n✓ SUCCESS! Found {len(lot_data_endpoints)} potential lot data endpoints")
            print(f"Next steps:")
            print(f"  1. Review saved JSON responses")
            print(f"  2. Identify the endpoint with extended field data")
            print(f"  3. Update scraper to use that endpoint")
        else:
            print(f"\n✗ No lot data endpoints found")
            print(f"All API calls captured:")
            for i, call in enumerate(api_calls[:20], 1):
                print(f"{i:2d}. {call['method']:6s} {call['url']}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(monitor_api_calls())
