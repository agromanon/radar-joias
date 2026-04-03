"""
Base Scraper Class
Provides common functionality for all auction scrapers
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import logging
from bs4 import BeautifulSoup
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AuctionLot:
    """Represents an auction lot scraped from an auctioneer"""
    title: str
    auctioneer: str
    category: str
    description: Optional[str] = None
    current_bid: Optional[float] = None
    estimated_value: Optional[float] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    edict_url: Optional[str] = None
    closing_at: Optional[datetime] = None
    risk_score: Optional[str] = 'medium'  # low, medium, high
    metadata: Optional[Dict] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for database insertion"""
        # Base fields - always present
        data = {
            'title': self.title,
            'auctioneer': self.auctioneer,
            'category': self.category,
            'description': self.description,
            'current_bid': self.current_bid,
            'estimated_value': self.estimated_value,
            'location': self.location,
            'image_url': self.image_url,
            'edict_url': self.edict_url,
            'closing_at': self.closing_at.isoformat() if self.closing_at else None,
            'risk_score': self.risk_score,
            'metadata': self.metadata or {},
        }

        # Enhanced fields - add if present (using getattr with defaults)
        optional_fields = [
            'auction_event_id', 'platform', 'category_primary', 'category_secondary',
            'tags', 'status', 'starting_bid', 'bids_count', 'seller_name',
            'images', 'primary_image_url', 'location_city', 'location_state',
            'location_address', 'source_url'
        ]

        for field in optional_fields:
            value = getattr(self, field, None)
            if value is not None:
                data[field] = value

        return data


class BaseScraper(ABC):
    """Abstract base class for auction scrapers"""

    def __init__(self, base_url: str, proxy_manager=None, delay_range=(2, 5)):
        self.base_url = base_url
        self.session = requests.Session()
        self.proxy_manager = proxy_manager
        self.delay_range = delay_range  # Random delay between requests in seconds
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })

    @abstractmethod
    def scrape_lots(self) -> List[AuctionLot]:
        """Scrape lots from the auctioneer website"""
        pass

    def fetch_page(self, url: str, use_proxy: bool = True) -> str:
        """Fetch a page and return its HTML content"""
        # Add random delay to avoid rate limiting
        import time
        import random
        delay = random.uniform(*self.delay_range)
        time.sleep(delay)

        proxies = None
        if use_proxy and self.proxy_manager:
            proxy = self.proxy_manager.get_next_proxy()
            if proxy:
                proxies = proxy.to_dict()
                logger.debug(f"Using proxy: {proxy.host}:{proxy.port}")

        try:
            response = self.session.get(url, timeout=30, proxies=proxies)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            logger.error(f"Error fetching {url}: {e}")

            # If proxy failed, mark it as failed and retry without proxy
            if use_proxy and proxies:
                logger.warning(f"Proxy failed, retrying with direct connection...")
                if self.proxy_manager:
                    # Extract proxy from proxies dict
                    proxy_url = proxies.get('http') or proxies.get('https')
                    if proxy_url:
                        # Parse proxy URL to get host and port
                        from urllib.parse import urlparse
                        parsed = urlparse(proxy_url)
                        if parsed.hostname and parsed.port:
                            from scrapers.utils.proxy_manager import Proxy
                            failed_proxy = Proxy(
                                host=parsed.hostname,
                                port=parsed.port,
                                username=parsed.username,
                                password=parsed.password
                            )
                            self.proxy_manager.mark_proxy_failed(failed_proxy)

                # Retry without proxy
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                return response.text

            raise

    def parse_html(self, html: str) -> BeautifulSoup:
        """Parse HTML content with BeautifulSoup"""
        return BeautifulSoup(html, 'html.parser')

    def extract_price(self, price_str: str) -> Optional[float]:
        """Extract numeric price from string (e.g., 'R$ 10.000,00' -> 10000.00)"""
        if not price_str:
            return None

        import re
        # Remove currency symbols and extract numbers
        price_clean = re.sub(r'[^\d.,]', '', price_str)
        price_clean = price_clean.replace('.', '').replace(',', '.')

        try:
            return float(price_clean) if price_clean else None
        except ValueError:
            logger.warning(f"Could not parse price: {price_str}")
            return None

    def calculate_risk_score(self, lot: AuctionLot) -> str:
        """Calculate risk score based on lot attributes"""
        score = 0

        # Higher estimated value = higher risk
        if lot.estimated_value:
            if lot.estimated_value > 100000:
                score += 3
            elif lot.estimated_value > 50000:
                score += 2
            elif lot.estimated_value > 10000:
                score += 1

        # No description = higher risk
        if not lot.description or len(lot.description) < 50:
            score += 1

        # No image = higher risk
        if not lot.image_url:
            score += 1

        # Determine risk tier
        if score >= 4:
            return 'high'
        elif score >= 2:
            return 'medium'
        else:
            return 'low'
