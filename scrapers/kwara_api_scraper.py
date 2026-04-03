"""
Kwara API Scraper
Uses Kwara's Next.js data API endpoints to fetch auction lots
"""

import requests
import logging
from typing import List, Dict, Optional
from datetime import datetime
import time
import random

from base import BaseScraper, AuctionLot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KwaraAPIScraper(BaseScraper):
    """Scraper for Kwara using their API endpoints"""

    def __init__(self, proxy_manager=None):
        super().__init__(
            base_url='https://www.kwara.com.br',
            proxy_manager=proxy_manager,
            delay_range=(2, 5)
        )
        # Build ID from Next.js (might change, need to make dynamic)
        self.build_id = 'icEnlyKUxVs3w2HsvxZ12'

        # Category IDs for materials/construction
        self.category_ids = [
            '1335572015838398043',  # Casa & Construção
            '1335572023151306',     # Industrial
            '1335572026939174',     # Imóveis
        ]

    def scrape_lots(self, category_ids: List[str] = None) -> List[AuctionLot]:
        """
        Scrape lots from Kwara API

        Args:
            category_ids: List of category IDs to fetch. If None, uses defaults.
        """
        if category_ids is None:
            category_ids = self.category_ids

        logger.info(f"Starting Kwara API scraper for {len(category_ids)} categories")

        all_lots = []

        for category_id in category_ids:
            try:
                lots = self._fetch_category_lots(category_id)
                all_lots.extend(lots)

                # Random delay between categories
                delay = random.uniform(*self.delay_range)
                time.sleep(delay)

            except Exception as e:
                logger.error(f"Error fetching category {category_id}: {e}")
                continue

        logger.info(f"Total lots found: {len(all_lots)}")
        return all_lots

    def _fetch_category_lots(self, category_id: str) -> List[AuctionLot]:
        """Fetch lots for a specific category"""
        lots = []

        # Build API URL
        api_url = f"{self.base_url}/_next/data/{self.build_id}/busca.json"

        try:
            logger.info(f"Fetching category {category_id}")

            # Direct request without going through fetch_page (to avoid JSON parsing issues)
            import json
            response = self.session.get(
                api_url,
                params={'assetCategoryIds[]': category_id},
                headers={
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                timeout=30
            )

            response.raise_for_status()

            # Parse JSON directly
            data = json.loads(response.text)

            # Extract items from search result
            page_props = data.get('pageProps', {})
            search_result = page_props.get('searchResult', {})
            items = search_result.get('items', [])

            logger.info(f"Found {len(items)} items in category {category_id}")

            # Parse each item
            for item in items:
                try:
                    lot = self._parse_api_item(item)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.debug(f"Error parsing item: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error fetching category lots: {e}")

        return lots

    def _parse_api_item(self, item: Dict) -> Optional[AuctionLot]:
        """Parse an item from the API response"""
        try:
            # Extract listing info
            listing = item.get('listing', {})

            # Title
            item_title = item.get('title', '')
            listing_title = listing.get('title', '')

            # Use item title (specific lot) if available
            title = f"{listing_title} - {item_title}" if item_title else listing_title

            # Description
            description = listing.get('description', '')

            # Location
            location = listing.get('location', '')

            # Auction end time
            closing_at_str = listing.get('scheduledEndAt')
            closing_at = None
            if closing_at_str:
                try:
                    closing_at = datetime.fromisoformat(closing_at_str.replace('Z', '+00:00'))
                except Exception as e:
                    logger.debug(f"Error parsing date: {e}")

            # Status
            status = listing.get('status', 'UNKNOWN')

            # Terms PDF (edict)
            edict_url = listing.get('termsUrl', '')

            # Extract current/highest bid from cached data
            cached_price_cents = item.get('cachedPriceAmountCents')
            current_bid = None
            if cached_price_cents:
                current_bid = cached_price_cents / 100.0  # Convert from cents

            # If no current bid, use lowest fee tier as estimate
            if not current_bid:
                fee_structure = item.get('feeStructureValues', [])
                if fee_structure:
                    lowest_tier = min(fee_structure, key=lambda x: x.get('fromValueCents', float('inf')))
                    starting_bid_cents = lowest_tier.get('fromValueCents')
                    if starting_bid_cents:
                        current_bid = starting_bid_cents / 100.0

            # Images
            images = item.get('images', [])
            image_url = None
            if images and len(images) > 0:
                image_url = images[0]  # Use first image

            # Determine category
            asset_category_id = item.get('assetCategoryId', '')
            category = self._map_category(asset_category_id, title, description)

            # Create lot
            lot = AuctionLot(
                title=title,
                auctioneer='Kwara',
                category=category,
                description=description or title,
                current_bid=current_bid,
                estimated_value=current_bid,
                location=location,
                image_url=image_url,
                edict_url=edict_url,
                closing_at=closing_at,
                risk_score='medium'
            )

            # Add metadata
            lot.metadata = {
                'listing_id': listing.get('id', ''),
                'item_id': item.get('id', ''),
                'status': status,
                'type': listing.get('type', ''),
                'asset_category_id': asset_category_id,
                'is_public': listing.get('isPublic', True),
                'kwara_id': listing.get('kwaraId', ''),
                'slug': item.get('slug', ''),
                'bids_count': item.get('cachedBidsCount', 0),
                'views': item.get('views', 0)
            }

            # Calculate risk score
            lot.risk_score = self.calculate_risk_score(lot)

            return lot

        except Exception as e:
            logger.debug(f"Error parsing API item: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _map_category(self, asset_category_id: str, title: str, description: str) -> str:
        """Map asset category ID to our category system"""
        # Can be expanded based on category mappings from API
        text = f"{title} {description}".lower()

        # Construction materials
        if any(word in text for word in ['sofá', 'cadeira', 'mesa', 'armário',
                                          'estante', 'cama', 'guarda', 'colchão']):
            return 'moveis'

        if any(word in text for word in ['cimento', 'tijolo', 'telha', 'piso',
                                          'construção', 'parede', 'porta', 'janela',
                                          'tinta', 'areia', 'brita', 'argamassa']):
            return 'materiais'

        if any(word in text for word in ['bomba', 'compressor', 'motor', 'gerador',
                                          'betoneira', 'usina', 'máquina', 'equipamento']):
            return 'materiais'

        # Metals
        if any(word in text for word in ['ferro', 'aço', 'metal', 'cobre',
                                          'alumínio', 'chapa', 'tubo', 'perfil']):
            return 'metais'

        # Electronics
        if any(word in text for word in ['celular', 'computador', 'notebook',
                                          'televisão', 'telefone', 'tablet']):
            return 'eletronicos'

        # Vehicles
        if any(word in text for word in ['carro', 'moto', 'caminhão', 'veículo',
                                          'ônibus', 'trator', 'caminhonete']):
            return 'veiculos'

        # Default
        return 'outros'


def test_kwara_api_scraper():
    """Test the Kwara API scraper"""
    print("Testing Kwara API Scraper...")
    print("=" * 80)

    scraper = KwaraAPIScraper()

    # Test with Casa & Construção category
    print("\nFetching Casa & Constrção lots...")
    lots = scraper.scrape_lots(['1335572015838398043'])

    print(f"\nFound {len(lots)} lots:")
    for i, lot in enumerate(lots[:10], 1):
        print(f"\n{i}. {lot.title}")
        print(f"   Category: {lot.category}")
        print(f"   Location: {lot.location}")
        print(f"   Starting Bid: R$ {lot.current_bid or 'N/A'}")
        print(f"   Closing: {lot.closing_at}")
        print(f"   Status: {lot.metadata.get('status', 'N/A')}")
        print(f"   Edict: {lot.edict_url[:60] if lot.edict_url else 'N/A'}...")
        print(f"   Risk: {lot.risk_score}")

    if len(lots) > 10:
        print(f"\n... and {len(lots) - 10} more lots")

    # Count by category
    category_counts = {}
    for lot in lots:
        category_counts[lot.category] = category_counts.get(lot.category, 0) + 1

    print(f"\nCategory breakdown:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    print("\n" + "=" * 80)
    print("✓ API scraper working!")
    return len(lots)


if __name__ == '__main__':
    test_kwara_api_scraper()
