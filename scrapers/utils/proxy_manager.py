"""
Proxy Manager for Web Scraping
Handles free proxy rotation and fallback to paid proxy APIs
"""

import requests
import logging
from typing import List, Optional, Dict
from dataclasses import dataclass
from abc import ABC, abstractmethod
import time
import random

logger = logging.getLogger(__name__)


@dataclass
class Proxy:
    """Represents a proxy server"""
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: str = 'http'  # http, https, socks5

    @property
    def url(self) -> str:
        """Get proxy URL for requests"""
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.host}:{self.port}"
        return f"{self.protocol}://{self.host}:{self.port}"

    def to_dict(self) -> Dict[str, str]:
        """Convert to requests proxy dict format"""
        return {
            'http': self.url,
            'https': self.url
        }


class ProxySource(ABC):
    """Abstract base for proxy sources"""

    @abstractmethod
    def get_proxies(self) -> List[Proxy]:
        """Fetch list of available proxies"""
        pass


class FreeProxyListSource(ProxySource):
    """
    Fetch free proxies from public APIs
    Note: Free proxies are unreliable - use for testing only
    """

    def __init__(self):
        self.api_url = "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all"

    def get_proxies(self) -> List[Proxy]:
        """Fetch free proxies from ProxyScrape API"""
        try:
            logger.info("Fetching free proxies from ProxyScrape...")
            response = requests.get(self.api_url, timeout=10)
            response.raise_for_status()

            proxies = []
            for line in response.text.strip().split('\n'):
                if ':' in line:
                    parts = line.strip().split(':')
                    if len(parts) >= 2:
                        host = parts[0]
                        port = int(parts[1])
                        proxies.append(Proxy(host=host, port=port, protocol='http'))

            logger.info(f"Fetched {len(proxies)} free proxies")
            return proxies[:20]  # Limit to 20 for testing

        except Exception as e:
            logger.error(f"Failed to fetch free proxies: {e}")
            return []


class ManualProxySource(ProxySource):
    """
    Use manually configured proxies from environment variables
    Format: PROXY_LIST=host1:port1,host2:port2,...
    """

    def __init__(self):
        import os
        proxy_list = os.getenv('PROXY_LIST', '')
        self.proxies = []

        if proxy_list:
            for proxy_str in proxy_list.split(','):
                proxy_str = proxy_str.strip()
                if ':' in proxy_str:
                    parts = proxy_str.split(':')
                    host = parts[0]
                    port = int(parts[1])
                    self.proxies.append(Proxy(host=host, port=port))

    def get_proxies(self) -> List[Proxy]:
        return self.proxies


class WebShareProxySource(ProxySource):
    """
    Fetch proxies from WebShare.io API
    Free plan: 10 proxies, Paid plan: 100+ proxies starting at $2.99/month
    API docs: https://apidocs.webshare.io/
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct"

    def get_proxies(self) -> List[Proxy]:
        """Fetch proxy list from WebShare API"""
        try:
            logger.info("Fetching proxies from WebShare.io...")

            headers = {
                'Authorization': f'Token {self.api_key}'
            }

            response = requests.get(
                self.api_url,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()
            proxies = []

            # Parse response - WebShare returns { "results": [...] }
            if 'results' in data:
                for proxy_data in data['results']:
                    # WebShare proxy format: proxy_address, port, username, password
                    host = proxy_data.get('proxy_address')
                    port = proxy_data.get('port')
                    username = proxy_data.get('username')
                    password = proxy_data.get('password')

                    if host and port:
                        proxies.append(Proxy(
                            host=host,
                            port=int(port),
                            username=username,
                            password=password,
                            protocol='http'
                        ))

            logger.info(f"Fetched {len(proxies)} proxies from WebShare.io")
            return proxies

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                logger.error("WebShare API key is invalid or unauthorized")
            elif e.response.status_code == 403:
                logger.error("WebShare API access forbidden - check plan limits")
            else:
                logger.error(f"WebShare API HTTP error: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to fetch WebShare proxies: {e}")
            return []


class PaidProxySource(ProxySource):
    """
    Integration with paid proxy services
    Supported: WebShare, BrightData, SmartProxy, ScraperAPI, ProxyMesh
    """

    def __init__(self, service: str, config: Dict):
        self.service = service.lower()
        self.config = config

    def get_proxies(self) -> List[Proxy]:
        """Get proxy endpoint from paid service"""
        if self.service == 'webshare':
            # WebShare.io integration
            api_key = self.config.get('api_key')
            if api_key:
                return WebShareProxySource(api_key).get_proxies()

        elif self.service == 'scraperapi':
            # ScraperAPI format: http://scraperapi:{API_KEY}@proxy-server.scraperapi.com:8001
            api_key = self.config.get('api_key')
            if api_key:
                return [Proxy(
                    host='proxy-server.scraperapi.com',
                    port=8001,
                    username='scraperapi',
                    password=api_key,
                    protocol='http'
                )]

        elif self.service == 'smartproxy':
            # SmartProxy format: http://user:pass@gateway.smartproxy.com:10000
            username = self.config.get('username')
            password = self.config.get('password')
            if username and password:
                return [Proxy(
                    host='gateway.smartproxy.com',
                    port=10000,
                    username=username,
                    password=password,
                    protocol='http'
                )]

        elif self.service == 'brightdata':
            # BrightData format: http://user:pass@zproxy.lum-superproxy.io:22225
            username = self.config.get('username')
            password = self.config.get('password')
            if username and password:
                return [Proxy(
                    host='zproxy.lum-superproxy.io',
                    port=22225,
                    username=username,
                    password=password,
                    protocol='http'
                )]

        logger.warning(f"Unknown or misconfigured proxy service: {self.service}")
        return []


class ProxyManager:
    """
    Manages proxy rotation and testing
    """

    def __init__(self, sources: List[ProxySource], test_url: str = 'http://httpbin.org/ip'):
        self.sources = sources
        self.test_url = test_url
        self.proxies: List[Proxy] = []
        self.working_proxies: List[Proxy] = []
        self.current_index = 0
        self.last_rotation = time.time()
        self.rotation_interval = 300  # Rotate every 5 minutes

    def load_proxies(self):
        """Load proxies from all sources"""
        all_proxies = []
        for source in self.sources:
            try:
                proxies = source.get_proxies()
                all_proxies.extend(proxies)
            except Exception as e:
                logger.error(f"Failed to load proxies from source: {e}")

        self.proxies = all_proxies
        logger.info(f"Loaded {len(self.proxies)} proxies from all sources")

    def test_proxy(self, proxy: Proxy, timeout: int = 10) -> bool:
        """Test if a proxy is working"""
        try:
            response = requests.get(
                self.test_url,
                proxies=proxy.to_dict(),
                timeout=timeout
            )
            return response.status_code == 200
        except Exception as e:
            logger.debug(f"Proxy {proxy.host}:{proxy.port} failed test: {e}")
            return False

    def test_all_proxies(self):
        """Test all proxies and keep working ones"""
        logger.info("Testing all proxies...")
        self.working_proxies = []

        for proxy in self.proxies:
            if self.test_proxy(proxy):
                self.working_proxies.append(proxy)
                logger.info(f"✓ Working proxy: {proxy.host}:{proxy.port}")
            else:
                logger.warning(f"✗ Failed proxy: {proxy.host}:{proxy.port}")

        logger.info(f"Found {len(self.working_proxies)} working proxies out of {len(self.proxies)}")

    def get_next_proxy(self) -> Optional[Proxy]:
        """Get next working proxy with rotation"""
        # Reload proxies if list is empty
        if not self.working_proxies:
            logger.warning("No working proxies. Reloading and testing...")
            self.load_proxies()
            self.test_all_proxies()

        # If still no proxies, return None (direct connection)
        if not self.working_proxies:
            logger.warning("No working proxies available. Using direct connection.")
            return None

        # Rotate proxy if interval passed
        if time.time() - self.last_rotation > self.rotation_interval:
            self.current_index = (self.current_index + 1) % len(self.working_proxies)
            self.last_rotation = time.time()
            logger.info(f"Rotated to proxy {self.current_index + 1}/{len(self.working_proxies)}")

        proxy = self.working_proxies[self.current_index]
        logger.debug(f"Using proxy: {proxy.host}:{proxy.port}")
        return proxy

    def mark_proxy_failed(self, proxy: Proxy):
        """Remove failed proxy from working list"""
        if proxy in self.working_proxies:
            self.working_proxies.remove(proxy)
            logger.warning(f"Removed failed proxy: {proxy.host}:{proxy.port}")

            # Reset index if needed
            if self.current_index >= len(self.working_proxies):
                self.current_index = 0


def create_proxy_manager(use_free: bool = True, use_paid: bool = False, paid_service: str = None, paid_config: Dict = None) -> ProxyManager:
    """
    Factory function to create ProxyManager with desired sources

    Args:
        use_free: Whether to use free proxies (testing only)
        use_paid: Whether to use paid proxy service
        paid_service: Name of paid service ('scraperapi', 'smartproxy', 'brightdata')
        paid_config: Config dict for paid service (api_key, username, password, etc.)

    Returns:
        Configured ProxyManager instance
    """
    sources = []

    # Add manual proxies from environment (always checked first)
    sources.append(ManualProxySource())

    # Add free proxies if requested
    if use_free:
        sources.append(FreeProxyListSource())

    # Add paid service if configured
    if use_paid and paid_service and paid_config:
        sources.append(PaidProxySource(paid_service, paid_config))

    manager = ProxyManager(sources)
    manager.load_proxies()

    return manager


# Example usage:
if __name__ == '__main__':
    import os

    # Test with free proxies
    print("Testing free proxy manager...")
    manager = create_proxy_manager(use_free=True)
    manager.test_all_proxies()

    # Test with paid service (configure environment variables)
    # PAID_PROXY_SERVICE=scraperapi
    # SCRAPERAPI_KEY=your_key_here
    paid_service = os.getenv('PAID_PROXY_SERVICE')
    if paid_service:
        paid_config = {}
        if paid_service == 'scraperapi':
            paid_config['api_key'] = os.getenv('SCRAPERAPI_KEY')
        elif paid_service == 'smartproxy':
            paid_config['username'] = os.getenv('SMARTPROXY_USER')
            paid_config['password'] = os.getenv('SMARTPROXY_PASS')

        manager = create_proxy_manager(use_paid=True, paid_service=paid_service, paid_config=paid_config)
        proxy = manager.get_next_proxy()
        print(f"Using paid proxy: {proxy.url if proxy else 'None'}")
