"""
Use Playwright to intercept API calls when loading lot page
"""

import asyncio
import json
from playwright.async_api import async_playwright

async def intercept_api_calls():
    """Load lot page and intercept API calls"""

    url = "https://www.kwara.com.br/lote/sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"

    print(f"Loading page and intercepting API calls...")
    print("=" * 80)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # List to store API calls
        api_calls = []

        async def log_request(route, request):
            """Log all API requests"""
            if request.resource_type == "xhr" or request.resource_type == "fetch":
                url = request.url
                method = request.method
                api_calls.append({
                    'url': url,
                    'method': method,
                    'type': request.resource_type
                })
                print(f"API Call: {method} {url}")

            await route.continue_()

        # Set up request interception
        await page.route("**/*", log_request)

        # Load the page
        await page.goto(url, wait_until='networkidle', timeout=30000)

        # Wait a bit for all API calls to complete
        await page.wait_for_timeout(3000)

        print(f"\nTotal API calls intercepted: {len(api_calls)}")

        # Now try to fetch each API endpoint
        print("\n" + "=" * 80)
        print("FETCHING API ENDPOINTS")
        print("=" * 80)

        for call in api_calls:
            if 'json' in call['url'] or call['type'] == 'fetch':
                print(f"\nFetching: {call['url']}")
                try:
                    response = await context.request.get(call['url'])
                    if response.status == 200:
                        try:
                            data = await response.json()
                            print(f"✓ Status: {response.status}")
                            print(f"  Keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")

                            # Pretty print if it's not too large
                            json_str = json.dumps(data, indent=2, ensure_ascii=False)
                            if len(json_str) < 5000:
                                print(f"  Data: {json_str[:500]}")
                            else:
                                print(f"  Data: {json_str[:500]}...")
                        except:
                            print(f"  Content-Type: {response.headers.get('content-type')}")
                            text = await response.text()
                            print(f"  Text preview: {text[:200]}...")
                    else:
                        print(f"✗ Status: {response.status}")
                except Exception as e:
                    print(f"✗ Error: {e}")

        await browser.close()

    print("\n" + "=" * 80)
    print("✓ API interception complete")

if __name__ == '__main__':
    asyncio.run(intercept_api_calls())
