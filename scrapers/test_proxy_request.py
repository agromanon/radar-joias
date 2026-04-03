"""
Test Proxy by making actual HTTP requests
"""

import os
import requests
from dotenv import load_dotenv
from utils.proxy_manager import create_proxy_manager

load_dotenv()

def test_proxy_request():
    """Test making a request through WebShare proxy"""
    print("Testing HTTP request through WebShare proxy...")
    print("=" * 60)

    # Create proxy manager
    manager = create_proxy_manager(
        use_free=False,
        use_paid=True,
        paid_service='webshare',
        paid_config={'api_key': os.getenv('WEBSHARE_API_KEY')}
    )

    # Load proxies
    manager.load_proxies()
    print(f"✓ Loaded {len(manager.proxies)} proxies")

    # Get a proxy
    proxy = manager.get_next_proxy()
    if not proxy:
        print("❌ No proxy available")
        return False

    print(f"✓ Using proxy: {proxy.host}:{proxy.port}")

    # Test request
    test_urls = [
        'http://httpbin.org/ip',
        'http://httpbin.org/headers',
        'https://www.google.com/'
    ]

    for url in test_urls:
        try:
            print(f"\n📡 Requesting: {url}")
            response = requests.get(
                url,
                proxies=proxy.to_dict(),
                timeout=15
            )

            if response.status_code == 200:
                print(f"✓ Success! Status: {response.status_code}")
                if 'httpbin' in url:
                    print(f"  Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed with status: {response.status_code}")
                manager.mark_proxy_failed(proxy)
                proxy = manager.get_next_proxy()
                if not proxy:
                    print("❌ No more proxies available")
                    return False

        except Exception as e:
            print(f"❌ Error: {e}")
            manager.mark_proxy_failed(proxy)
            proxy = manager.get_next_proxy()
            if not proxy:
                print("❌ No more proxies available")
                return False

    print("\n" + "=" * 60)
    print("✓ Proxy test completed successfully!")
    return True

if __name__ == '__main__':
    test_proxy_request()
