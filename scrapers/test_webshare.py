"""
Test WebShare.io Proxy Integration
Run this to verify your WebShare API key and fetch proxy list
"""

import os
from dotenv import load_dotenv
from utils.proxy_manager import WebShareProxySource, create_proxy_manager

# Load environment variables
load_dotenv()

def test_webshare():
    """Test WebShare proxy fetch"""
    api_key = os.getenv('WEBSHARE_API_KEY')

    if not api_key:
        print("❌ WEBSHARE_API_KEY not found in .env file")
        return False

    print(f"✓ Found WebShare API key: {api_key[:10]}...")

    # Create WebShare source
    source = WebShareProxySource(api_key)

    # Fetch proxies
    print("\n📡 Fetching proxies from WebShare.io...")
    proxies = source.get_proxies()

    if proxies:
        print(f"✓ Successfully fetched {len(proxies)} proxies:")
        for i, proxy in enumerate(proxies[:5], 1):  # Show first 5
            print(f"  {i}. {proxy.host}:{proxy.port} (username: {proxy.username})")
        if len(proxies) > 5:
            print(f"  ... and {len(proxies) - 5} more")
        return True
    else:
        print("❌ No proxies fetched. Check API key and account status.")
        return False

def test_proxy_manager():
    """Test full proxy manager integration"""
    print("\n🔧 Testing ProxyManager integration...")

    # Create manager with WebShare
    manager = create_proxy_manager(
        use_free=False,
        use_paid=True,
        paid_service='webshare',
        paid_config={'api_key': os.getenv('WEBSHARE_API_KEY')}
    )

    # Load proxies
    manager.load_proxies()
    print(f"✓ Loaded {len(manager.proxies)} proxies")

    # Get next proxy
    proxy = manager.get_next_proxy()
    if proxy:
        print(f"✓ Got proxy: {proxy.url if proxy else 'None'}")
        return True
    else:
        print("❌ No proxy available")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("WebShare.io Integration Test")
    print("=" * 60)

    # Test 1: Direct WebShare source
    success1 = test_webshare()

    # Test 2: Full proxy manager
    success2 = test_proxy_manager() if success1 else False

    print("\n" + "=" * 60)
    if success1 and success2:
        print("✓ All tests passed! WebShare integration is working.")
    else:
        print("❌ Some tests failed. Check configuration.")
    print("=" * 60)
