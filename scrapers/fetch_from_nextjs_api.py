"""
Fetch lot data directly from Next.js Data API
"""

import asyncio
import json
from playwright.async_api import async_playwright

slug = "sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"
url = f"https://www.kwara.com.br/lote/{slug}"

async def fetch_nextjs_data():
    """Fetch lot data from Next.js Data API"""

    print(f"Fetching data for: {slug}")
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
        print(f"\nLoading page: {url}")
        await page.goto(url, wait_until='networkidle', timeout=30000)

        # Wait a bit for all API calls to complete
        await page.wait_for_timeout(5000)

        print(f"\nTotal API calls intercepted: {len(api_calls)}")

        # Look for the lot data endpoint
        print("\n" + "=" * 80)
        print("LOOKING FOR LOT DATA ENDPOINT")
        print("=" * 80)

        for call in api_calls:
            if f'/{slug}' in call['url'] and call['url'].endswith('.json'):
                print(f"\n✓ Found lot data endpoint: {call['url']}")

                # Fetch the data
                try:
                    response = await context.request.get(call['url'])
                    if response.status == 200:
                        data = await response.json()
                        print(f"✓ Status: {response.status}")
                        print(f"  Keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")

                        # Pretty print the data
                        json_str = json.dumps(data, indent=2, ensure_ascii=False)
                        if len(json_str) < 10000:
                            print(f"\n  Full Data:\n{json_str}")
                        else:
                            print(f"\n  Data Preview (first 1000 chars):\n{json_str[:1000]}...")
                            print(f"  ... ({len(json_str)} total chars)")

                        # Save to file for inspection
                        with open(f'/tmp/lot_data_{slug}.json', 'w') as f:
                            f.write(json_str)
                        print(f"\n  ✓ Saved to /tmp/lot_data_{slug}.json")
                    else:
                        print(f"✗ Status: {response.status}")
                except Exception as e:
                    print(f"✗ Error: {e}")
                break
        else:
            print("\n✗ No lot data endpoint found")
            print("\nAll endpoints intercepted:")
            for i, call in enumerate(api_calls, 1):
                print(f"{i}. {call['method']} {call['url']}")

        await browser.close()

    print("\n" + "=" * 80)
    print("✓ Complete!")

if __name__ == '__main__':
    asyncio.run(fetch_nextjs_data())
