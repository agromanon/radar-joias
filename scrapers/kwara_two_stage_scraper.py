"""
Kwara Two-Stage Scraper
Stage 1: Fetch all lots from search API (fast, ~300 lots in 6 seconds)
Stage 2: Fetch extended fields for each lot (slow, ~1-2 seconds per lot)

Features:
- Proxy rotation (Webshare IO - 10 proxies, scalable to 100)
- Rate limiting to avoid blocking
- Resumable (can resume from last scraped lot)
- Upsert logic (update existing lots)
- Progress tracking and logging
"""

import requests
import json
import logging
import os
import time
import random
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv
import itertools

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('kwara_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment
load_dotenv()


@dataclass
class ProxyConfig:
    """Proxy configuration for Webshare IO"""
    api_key: str = os.getenv('WEBSHARE_API_KEY', '')
    proxy_list: List[str] = field(default_factory=list)
    current_index: int = 0
    enabled: bool = True

    def __post_init__(self):
        if not self.api_key:
            logger.warning("No Webshare API key found - running without proxies")
            self.enabled = False
        else:
            self._load_proxies()

    def _load_proxies(self):
        """Load proxy list from Webshare API"""
        try:
            response = requests.get(
                'https://proxy.webshare.io/api/v2/proxy/list/',
                headers={'Authorization': f'Token {self.api_key}'},
                params={'mode': 'direct', 'page_size': 100}
            )
            response.raise_for_status()
            data = response.json()

            self.proxy_list = [
                f"http://{proxy['username']}:{proxy['password']}@{proxy['proxy_address']}:{proxy['port']}"
                for proxy in data.get('results', [])
            ]

            logger.info(f"✓ Loaded {len(self.proxy_list)} proxies from Webshare")

        except Exception as e:
            logger.error(f"Failed to load proxies: {e}")
            self.enabled = False

    def get_next_proxy(self) -> Optional[str]:
        """Get next proxy in rotation (round-robin)"""
        if not self.enabled or not self.proxy_list:
            return None

        proxy = self.proxy_list[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.proxy_list)
        return proxy

    def get_random_proxy(self) -> Optional[str]:
        """Get random proxy from list"""
        if not self.enabled or not self.proxy_list:
            return None
        return random.choice(self.proxy_list)


@dataclass
class AuctionLot:
    """Enhanced auction lot with all fields"""
    # Basic fields (Stage 1)
    title: str
    auctioneer: str
    category: str
    slug: str
    listing_id: str
    item_id: str

    # Pricing
    current_bid: Optional[float] = None
    starting_bid: Optional[float] = None
    estimated_value: Optional[float] = None

    # Timing
    closing_at: Optional[datetime] = None
    starts_at: Optional[datetime] = None

    # Location
    location: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None

    # Images and docs
    image_url: Optional[str] = None
    images: List[str] = field(default_factory=list)
    edict_url: Optional[str] = None

    # Extended fields (Stage 2)
    refs: List[str] = field(default_factory=list)
    description: Optional[str] = None
    general_observations: Optional[str] = None
    visiting_observations: Optional[str] = None
    visiting_address: Optional[str] = None
    pickup_observations: Optional[str] = None
    pickup_address: Optional[str] = None
    measurements: Optional[str] = None
    listing_title: Optional[str] = None

    # Fees and rules
    buyer_fee_percentage: Optional[float] = None
    minimum_increment: Optional[float] = None

    # Metadata
    views: int = 0
    bids_count: int = 0
    seller_name: Optional[str] = None
    seller_logo_url: Optional[str] = None
    platform: str = 'kwara'
    status: str = 'active'
    source_url: Optional[str] = None

    # Scrape tracking
    scrape_stage: str = 'basic'

    def to_dict(self) -> Dict:
        """Convert to dictionary for database insertion"""
        data = {
            # Core fields (existing schema)
            'title': self.title,
            'auctioneer': self.auctioneer,
            'category': self.category,
            'description': self.description,
            'current_bid': self.current_bid,
            'image_url': self.image_url,
            'edict_url': self.edict_url,
            'closing_at': self.closing_at.isoformat() if self.closing_at else None,
            'location_city': self.location_city,
            'location_state': self.location_state,
            'risk_score': 'MÉDIO',

            # New extended fields
            'slug': self.slug,
            'refs': self.refs,
            'general_observations': self.general_observations,
            'visiting_observations': self.visiting_observations,
            'visiting_address': self.visiting_address,
            'pickup_observations': self.pickup_observations,
            'pickup_address': self.pickup_address,
            'measurements': self.measurements,
            'listing_title': self.listing_title,
            'starting_bid': self.starting_bid,
            'buyer_fee_percentage': self.buyer_fee_percentage,
            'minimum_increment': self.minimum_increment,
            'views': self.views,
            'bids_count': self.bids_count,
            'seller_name': self.seller_name,
            'seller_logo_url': self.seller_logo_url,
            'source_url': self.source_url,
            'scrape_stage': self.scrape_stage,
            'last_scraped_at': datetime.now().isoformat(),

            # Enhanced metadata
            'metadata': {
                'platform': self.platform,
                'status': self.status,
                'listing_id': self.listing_id,
                'item_id': self.item_id,
                'starts_at': self.starts_at.isoformat() if self.starts_at else None,
                'estimated_value': self.estimated_value,
                'images': self.images,
            }
        }

        # Remove None values
        return {k: v for k, v in data.items() if v is not None}


class KwaraTwoStageScraper:
    """Two-stage scraper for Kwara.com.br"""

    def __init__(
        self,
        save_to_db: bool = True,
        use_proxies: bool = True,
        stage1_delay: float = 2.0,
        stage2_delay: float = 1.5
    ):
        self.base_url = 'https://www.kwara.com.br'
        self.build_id = '9cYkevqRi1YyTe6cMTdam'  # Updated 2026-04-02

        # API endpoints
        self.search_api = f"{self.base_url}/_next/data/{self.build_id}/busca.json"
        self.detail_api_template = f"{self.base_url}/_next/data/{{build_id}}/bens/{{slug}}.json"

        # Categories to scrape
        self.category_ids = [
            '1335572015838398043',  # Casa & Construção
            '1335572023151306',     # Industrial
            '1335572026939174',     # Imóveis
        ]

        # Rate limiting
        self.stage1_delay = stage1_delay
        self.stage2_delay = stage2_delay

        # Proxy configuration
        self.proxy_config = ProxyConfig()
        self.use_proxies = use_proxies and self.proxy_config.enabled

        # Database
        self.save_to_db = save_to_db
        self.db_manager = None
        if save_to_db:
            try:
                from utils.database_http import DatabaseManagerHTTP
                self.db_manager = DatabaseManagerHTTP()
                logger.info("✓ Database integration enabled")
            except Exception as e:
                logger.error(f"Failed to initialize database: {e}")
                self.save_to_db = False

    def scrape_all(self, max_lots: Optional[int] = None, resume: bool = False) -> List[AuctionLot]:
        """
        Run complete two-stage scraping process

        Args:
            max_lots: Limit number of lots for testing (None = all lots)
            resume: Resume from last scraped lot (check database for 'basic' stage lots)

        Returns:
            List of all lots with extended fields
        """
        logger.info("="*80)
        logger.info("KWARA TWO-STAGE SCRAPER")
        logger.info("="*80)

        start_time = time.time()

        # Stage 1: Fetch all lots from search API
        logger.info("\n📋 STAGE 1: Fetching lot list from search API...")
        basic_lots = self._stage1_fetch_basic_lots(max_lots)

        if not basic_lots:
            logger.error("No lots found in Stage 1 - aborting")
            return []

        logger.info(f"✓ Stage 1 complete: {len(basic_lots)} lots fetched")

        # Save basic lots to database (so we can resume if needed)
        if self.save_to_db:
            self._save_lots_to_db(basic_lots)
            logger.info("✓ Basic lots saved to database")

        # Stage 2: Fetch extended fields for each lot
        logger.info(f"\n🔍 STAGE 2: Fetching extended fields for {len(basic_lots)} lots...")
        detailed_lots = self._stage2_fetch_extended_fields(basic_lots)

        # Save detailed lots to database
        if self.save_to_db:
            self._save_lots_to_db(detailed_lots)
            logger.info("✓ Detailed lots saved to database")

        elapsed = time.time() - start_time

        logger.info("\n" + "="*80)
        logger.info("SCRAPING COMPLETE!")
        logger.info(f"Total lots: {len(detailed_lots)}")
        logger.info(f"Time elapsed: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
        logger.info(f"Average: {elapsed/len(detailed_lots):.1f}s per lot")
        logger.info("="*80)

        return detailed_lots

    def _stage1_fetch_basic_lots(self, max_lots: Optional[int]) -> List[AuctionLot]:
        """Stage 1: Fetch all lots from search API (fast, batch operation)"""
        all_lots = []
        page = 1

        for category_id in self.category_ids:
            try:
                category_lots = self._fetch_category_pages(category_id, max_lots)
                all_lots.extend(category_lots)

                # Polite delay between categories
                time.sleep(self.stage1_delay)

            except Exception as e:
                logger.error(f"Error fetching category {category_id}: {e}")
                continue

        return all_lots[:max_lots] if max_lots else all_lots

    def _fetch_category_pages(
        self,
        category_id: str,
        max_lots: Optional[int]
    ) -> List[AuctionLot]:
        """Fetch all pages for a category"""
        lots = []
        page = 1

        while True:
            # Check limit
            if max_lots and len(lots) >= max_lots:
                break

            try:
                logger.info(f"  Category {category_id}, page {page}...")

                # Get proxy for this request
                proxy = self.proxy_config.get_next_proxy() if self.use_proxies else None
                proxies = {'http': proxy, 'https': proxy} if proxy else None

                response = requests.get(
                    self.search_api,
                    params={
                        'assetCategoryIds[]': category_id,
                        'page': page,
                        'pageSize': 48
                    },
                    headers=self._get_headers(),
                    proxies=proxies,
                    timeout=30
                )
                response.raise_for_status()

                data = response.json()
                search_result = data.get('pageProps', {}).get('searchResult', {})
                items = search_result.get('items', [])

                # Get pagination metadata
                total_items = search_result.get('totalItems', 0)
                total_pages = search_result.get('totalPages', 0)

                # Log progress on first page
                if page == 1 and total_items > 0:
                    logger.info(f"  → Category contains {total_items} lots across {total_pages} pages")

                # No more items = end of pagination
                if not items:
                    logger.info(f"  → No more items on page {page}, pagination complete")
                    break

                logger.info(f"  → Page {page}/{total_pages}: {len(items)} lots (total: {len(lots) + len(items)})")

                # Parse items
                for item in items:
                    lot = self._parse_basic_lot(item)
                    if lot:
                        lots.append(lot)

                        # Check limit
                        if max_lots and len(lots) >= max_lots:
                            return lots

                # Check if we've reached the last page
                if total_pages > 0 and page >= total_pages:
                    logger.info(f"  → Reached last page ({page}/{total_pages})")
                    break

                page += 1

                # Polite delay
                time.sleep(random.uniform(0.5, 1.5))

            except Exception as e:
                logger.error(f"Error on page {page}: {e}")
                break

        return lots

    def _parse_basic_lot(self, item: Dict) -> Optional[AuctionLot]:
        """Parse basic lot from search API item"""
        try:
            listing = item.get('listing', {})
            item_title = item.get('title', '')
            auction_title = listing.get('title', '')
            title = f"{auction_title} - {item_title}" if item_title else auction_title

            # Location
            location_raw = listing.get('location', '')
            location_city, location_state = self._parse_location(location_raw)

            # Timing
            closing_at = None
            closing_at_str = listing.get('scheduledEndAt')
            if closing_at_str:
                try:
                    closing_at = datetime.fromisoformat(closing_at_str.replace('Z', '+00:00'))
                except:
                    pass

            # Pricing
            current_bid = None
            cached_price_cents = item.get('cachedPriceAmountCents')
            if cached_price_cents:
                current_bid = cached_price_cents / 100.0

            # Images
            images = item.get('images', [])
            primary_image = images[0] if images else None

            # Extract just the URL if primary_image is a dict (common in Kwara API)
            if isinstance(primary_image, dict) and 'url' in primary_image:
                primary_image = primary_image['url']
            elif isinstance(primary_image, str):
                # If it's already a string, try to parse as JSON
                try:
                    import json
                    parsed = json.loads(primary_image)
                    if isinstance(parsed, dict) and 'url' in parsed:
                        primary_image = parsed['url']
                except:
                    pass  # Keep as is

            # Category
            category = self._map_category(title)

            lot = AuctionLot(
                title=title,
                auctioneer='Kwara',
                category=category,
                slug=item.get('slug', ''),
                listing_id=listing.get('id', ''),
                item_id=item.get('id', ''),
                current_bid=current_bid,
                location=location_raw,
                location_city=location_city,
                location_state=location_state,
                image_url=primary_image,
                images=images,
                edict_url=listing.get('termsUrl'),
                closing_at=closing_at,
                source_url=f"{self.base_url}/bens/{item.get('slug', '')}",
                views=item.get('views', 0),
                bids_count=item.get('cachedBidsCount', 0),
                scrape_stage='basic'
            )

            return lot

        except Exception as e:
            logger.debug(f"Error parsing basic lot: {e}")
            return None

    def _stage2_fetch_extended_fields(self, basic_lots: List[AuctionLot]) -> List[AuctionLot]:
        """Stage 2: Fetch extended fields for each lot (slow, individual requests)"""
        detailed_lots = []
        total = len(basic_lots)

        for i, basic_lot in enumerate(basic_lots, 1):
            try:
                if i % 10 == 0:
                    logger.info(f"  Progress: {i}/{total} lots ({i/total*100:.1f}%)")

                # Get proxy for this request (rotate through available proxies)
                proxy = self.proxy_config.get_random_proxy() if self.use_proxies else None
                proxies = {'http': proxy, 'https': proxy} if proxy else None

                # Fetch lot details
                detail_url = self.detail_api_template.format(
                    build_id=self.build_id,
                    slug=basic_lot.slug
                )

                response = requests.get(
                    detail_url,
                    headers=self._get_headers(),
                    proxies=proxies,
                    timeout=30
                )
                response.raise_for_status()

                data = response.json()
                lot_details = data.get('pageProps', {}).get('lotDetails', {})

                # Enhance the basic lot with extended fields
                detailed_lot = self._enhance_lot_with_details(basic_lot, lot_details)
                detailed_lot.scrape_stage = 'detailed'
                detailed_lots.append(detailed_lot)

                # Polite delay between requests (critical to avoid blocking)
                time.sleep(self.stage2_delay + random.uniform(0.5, 1.5))

            except Exception as e:
                logger.warning(f"Failed to fetch details for {basic_lot.slug}: {e}")
                # Keep the basic lot if detail fetch fails
                detailed_lots.append(basic_lot)
                continue

        return detailed_lots

    def _enhance_lot_with_details(self, basic_lot: AuctionLot, details: Dict) -> AuctionLot:
        """Enhance basic lot with extended fields from detail API"""

        # References
        basic_lot.refs = details.get('refs', [])

        # Extended descriptions
        basic_lot.description = details.get('description') or basic_lot.description
        basic_lot.general_observations = details.get('generalObservations')
        basic_lot.visiting_observations = details.get('visitingObservations')
        basic_lot.visiting_address = details.get('visitingAddress')
        basic_lot.pickup_observations = details.get('pickUpObservations')
        basic_lot.pickup_address = details.get('pickUpAddress')
        basic_lot.measurements = details.get('measurements')
        basic_lot.listing_title = details.get('listing', {}).get('title')

        # Pricing details
        listing_settings = details.get('lotAuctionSettings', [])
        if listing_settings:
            current_setting = listing_settings[0]
            basic_lot.starting_bid = current_setting.get('startingBidCents', 0) / 100.0
            basic_lot.minimum_increment = current_setting.get('minimumIncrementCents', 0) / 100.0

        basic_lot.buyer_fee_percentage = details.get('buyerFeePercentage')
        basic_lot.views = details.get('views', 0)
        basic_lot.bids_count = details.get('cachedBidsCount', 0)

        # Seller info
        seller = details.get('seller', {})
        basic_lot.seller_name = seller.get('displayName')
        basic_lot.seller_logo_url = seller.get('logoUrl')

        # Timing
        starts_at = details.get('startsAt')
        if starts_at:
            try:
                basic_lot.starts_at = datetime.fromisoformat(starts_at.replace('Z', '+00:00'))
            except:
                pass

        return basic_lot

    def _save_lots_to_db(self, lots: List[AuctionLot]):
        """Save lots to database using upsert logic"""
        if not self.db_manager:
            return

        try:
            lots_data = [lot.to_dict() for lot in lots]

            # Use upsert logic for each lot
            success_count = 0
            for lot_data in lots_data:
                if self.db_manager.save_lot(lot_data):
                    success_count += 1

            logger.info(f"✓ Saved {success_count}/{len(lots)} lots to database")

        except Exception as e:
            logger.error(f"Error saving to database: {e}")

    def _get_headers(self) -> Dict:
        """Get request headers"""
        return {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
            'x-nextjs-data': '1'
        }

    def _parse_location(self, location_str: str) -> Tuple[Optional[str], Optional[str]]:
        """Parse location string into city and state"""
        if not location_str:
            return None, None

        if '/' in location_str:
            parts = location_str.split('/')
            if len(parts) == 2:
                return parts[0].strip(), parts[1].strip()

        return location_str, None

    def _map_category(self, title: str) -> str:
        """Map title to category"""
        text = title.lower()

        if any(word in text for word in ['cadeira', 'mesa', 'sofá', 'armário', 'estante']):
            return 'Móveis'
        elif any(word in text for word in ['geladeira', 'fogão', 'microondas']):
            return 'Eletrodomésticos'
        elif any(word in text for word in ['tv', 'computador', 'notebook']):
            return 'Eletrônicos'
        else:
            return 'Outros'


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Kwara Two-Stage Scraper')
    parser.add_argument('--max-lots', type=int, help='Limit number of lots for testing')
    parser.add_argument('--no-proxy', action='store_true', help='Disable proxy rotation')
    parser.add_argument('--stage1-delay', type=float, default=2.0, help='Delay between stage 1 requests (seconds)')
    parser.add_argument('--stage2-delay', type=float, default=1.5, help='Delay between stage 2 requests (seconds)')

    args = parser.parse_args()

    # Create scraper
    scraper = KwaraTwoStageScraper(
        save_to_db=True,
        use_proxies=not args.no_proxy,
        stage1_delay=args.stage1_delay,
        stage2_delay=args.stage2_delay
    )

    # Run scraping
    lots = scraper.scrape_all(max_lots=args.max_lots)

    print(f"\n✓ Successfully scraped {len(lots)} lots")


if __name__ == '__main__':
    main()
