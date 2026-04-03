"""
Kwara API Scraper - Standalone Version
Uses Kwara's Next.js data API endpoints to fetch auction lots
Integrates with Supabase database via HTTP REST API
"""

import requests
import json
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime
import time
import random
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Simple dataclass for lots
from dataclasses import dataclass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AuctionLot:
    """Represents an auction lot"""
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
    risk_score: Optional[str] = 'MÉDIO'
    metadata: Optional[Dict] = None

    # Enhanced fields for Radar Leilão features
    auction_event_id: Optional[str] = None
    platform: str = 'kwara'
    category_primary: Optional[str] = None
    category_secondary: Optional[str] = None
    tags: List[str] = None
    status: str = 'active'
    starting_bid: Optional[float] = None
    bids_count: int = 0
    seller_name: Optional[str] = None
    images: List[str] = None
    primary_image_url: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_address: Optional[str] = None
    source_url: Optional[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.images is None:
            self.images = []

    def to_dict(self) -> Dict:
        """Convert auction lot to dictionary for database insertion

        Maps enhanced scraper fields to existing database schema.
        When the full migration is applied, this can be updated to use all fields.
        """
        # Base data that exists in current schema
        data = {
            'title': self.title,
            'auctioneer': self.auctioneer,
            'category': self.category,
            'description': self.description,
            'current_bid': self.current_bid,
            'image_url': self.image_url,
            'edict_url': self.edict_url,
            'closing_at': self.closing_at.isoformat() if self.closing_at else None,
            'risk_score': self.risk_score,
            'source_url': self.source_url,  # NEW: Top-level field for direct lot link
        }

        # Add location fields if available
        if self.location_city:
            data['location_city'] = self.location_city
        if self.location_state:
            data['location_state'] = self.location_state

        # Store enhanced data in metadata JSONB field (flexible!)
        # This preserves all the enhanced fields for future use
        enhanced_metadata = {
            # Platform info
            'platform': self.platform,

            # Enhanced categorization
            'category_primary': self.category_primary,
            'category_secondary': self.category_secondary,
            'tags': self.tags,

            # Bidding details
            'starting_bid': self.starting_bid,
            'bids_count': self.bids_count,
            'estimated_value': self.estimated_value,

            # Seller info
            'seller_name': self.seller_name,

            # Images
            'images': self.images,
            'primary_image_url': self.primary_image_url,

            # Status
            'status': self.status,

            # Additional location
            'location_address': self.location_address,

            # Original metadata
            **(self.metadata or {})
        }

        # Merge with existing metadata if present
        if self.metadata:
            enhanced_metadata.update(self.metadata)

        data['metadata'] = enhanced_metadata

        # Remove None values
        return {k: v for k, v in data.items() if v is not None}


class KwaraAPIScraper:
    """Scraper for Kwara using their API endpoints"""

    def __init__(self, save_to_db: bool = False):
        self.base_url = 'https://www.kwara.com.br'
        self.build_id = 'ziWczoweSgRNOjgvfT9eZ'  # Updated 2026-04-02
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': '*/*'
        })

        # All category IDs to scrape
        self.category_ids = [
            '1335572015838398043',  # Casa & Construção
            '1335572023151306',     # Industrial
            '1335572026939174',     # Imóveis
        ]

        # Database integration
        self.save_to_db = save_to_db
        self.db_manager = None

        if save_to_db:
            try:
                from utils.database_http import DatabaseManagerHTTP
                self.db_manager = DatabaseManagerHTTP()
                logger.info("Database integration enabled")
            except ImportError:
                logger.warning("Database module not found, saving disabled")
                self.save_to_db = False
            except Exception as e:
                logger.warning(f"Database initialization failed: {e}")
                self.save_to_db = False

    def scrape_lots(self, category_ids: List[str] = None, max_pages: int = None) -> List[AuctionLot]:
        """Scrape lots from Kwara API

        Args:
            category_ids: List of category IDs to scrape (default: all configured categories)
            max_pages: Maximum pages per category (None = unlimited)

        Returns:
            List of all auction lots found
        """
        if category_ids is None:
            category_ids = self.category_ids

        logger.info(f"Starting Kwara API scraper for {len(category_ids)} categories")
        if max_pages:
            logger.info(f"Page limit: {max_pages} pages per category")

        all_lots = []

        for category_id in category_ids:
            try:
                lots = self._fetch_category_lots(category_id, max_pages=max_pages)
                all_lots.extend(lots)

                # Small delay between categories
                delay = random.uniform(1, 2)
                time.sleep(delay)

            except Exception as e:
                logger.error(f"Error fetching category {category_id}: {e}")
                continue

        logger.info(f"Total lots found: {len(all_lots)}")

        # Save to database if enabled
        if self.save_to_db and self.db_manager and all_lots:
            self._save_to_database(all_lots)

        return all_lots

    def _save_to_database(self, lots: List[AuctionLot]):
        """Save lots to Supabase database"""
        try:
            lots_data = [lot.to_dict() for lot in lots]

            if self.db_manager.insert_lots(lots_data):
                logger.info(f"✓ Successfully saved {len(lots)} lots to database")
            else:
                logger.error("✗ Failed to save lots to database")

        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            import traceback
            traceback.print_exc()

    def _fetch_category_lots(self, category_id: str, max_pages: int = None) -> List[AuctionLot]:
        """Fetch lots for a specific category with recursive pagination

        Args:
            category_id: The category ID to scrape
            max_pages: Maximum pages to scrape (None = unlimited)

        Returns:
            List of all lots found across all pages
        """
        all_lots = []
        page = 1

        api_url = f"{self.base_url}/_next/data/{self.build_id}/busca.json"

        while True:
            # Check page limit
            if max_pages and page > max_pages:
                logger.info(f"Reached max pages limit: {max_pages}")
                break

            try:
                logger.info(f"Fetching category {category_id}, page {page}...")

                response = self.session.get(
                    api_url,
                    params={
                        'assetCategoryIds[]': category_id,
                        'page': page,      # Add page parameter
                        'pageSize': 48     # Maximize lots per page (NOT 'limit'!)
                    },
                    timeout=30
                )

                response.raise_for_status()

                # Check response has content
                if not response.content:
                    logger.warning(f"Empty response on page {page}, stopping pagination")
                    break

                # Parse JSON
                data = json.loads(response.text)

                # Extract items and pagination metadata
                page_props = data.get('pageProps', {})
                search_result = page_props.get('searchResult', {})
                items = search_result.get('items', [])

                # Get pagination metadata
                total_items = search_result.get('totalItems', 0)
                total_pages = search_result.get('totalPages', 0)

                # Log progress on first page
                if page == 1 and total_items > 0:
                    logger.info(f"  → Category contains {total_items} lots across {total_pages} pages")

                # No more items = end of pagination
                if not items:
                    logger.info(f"No more items on page {page}, pagination complete")
                    break

                logger.info(f"  → Page {page}/{total_pages}: {len(items)} lots (total: {len(all_lots) + len(items)})")

                # Parse each item
                page_lots = []
                for item in items:
                    try:
                        # Get listing title from page_props if available
                        listing_title = None
                        if 'pageProps' in data:
                            page_props_data = data.get('pageProps', {})
                            if 'auction' in page_props_data:
                                listing_title = page_props_data['auction'].get('title')
                            elif 'listing' in page_props_data:
                                listing_title = page_props_data['listing'].get('title')

                        lot = self._parse_api_item(item, listing_title)
                        if lot:
                            page_lots.append(lot)
                    except Exception as e:
                        logger.debug(f"Error parsing item: {e}")
                        continue

                all_lots.extend(page_lots)

                # Check if we've reached the last page
                if total_pages > 0 and page >= total_pages:
                    logger.info(f"Reached last page ({page}/{total_pages})")
                    break

                # Safety: Stop after 200 pages (something wrong)
                if page >= 200:
                    logger.error("Reached 200 pages - stopping to prevent infinite loop")
                    break

                page += 1

                # Polite delay between pages to avoid blocking
                delay = random.uniform(2, 5)
                logger.debug(f"Waiting {delay:.1f}s before next page...")
                time.sleep(delay)

            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error on page {page}: {e}")
                logger.error(f"Response text preview: {response.text[:200]}")
                break
            except Exception as e:
                logger.error(f"Error fetching page {page}: {e}")
                import traceback
                traceback.print_exc()
                # Continue to next page instead of failing completely
                page += 1
                continue

        logger.info(f"Category {category_id} complete: {len(all_lots)} lots from {page} pages")
        return all_lots

    def _parse_api_item(self, item: Dict, listing_title: str = None) -> Optional[AuctionLot]:
        """Parse an item from the API response"""
        try:
            listing = item.get('listing', {})

            # Title
            item_title = item.get('title', '')
            auction_title = listing_title or listing.get('title', '')
            title = f"{auction_title} - {item_title}" if item_title else auction_title

            # Description
            description = listing.get('description', '')

            # Location parsing
            location_raw = listing.get('location', '')
            location_city, location_state = self._parse_location(location_raw)

            # Auction end time
            closing_at_str = listing.get('scheduledEndAt')
            closing_at = None
            if closing_at_str:
                try:
                    closing_at = datetime.fromisoformat(closing_at_str.replace('Z', '+00:00'))
                except:
                    pass

            # Terms PDF (edict)
            edict_url = listing.get('termsUrl', '')

            # Extract current/highest bid
            cached_price_cents = item.get('cachedPriceAmountCents')
            current_bid = None
            if cached_price_cents:
                current_bid = cached_price_cents / 100.0

            # Extract starting bid from fee structure
            starting_bid = None
            fee_structure = item.get('feeStructureValues', [])
            if fee_structure:
                lowest_tier = min(fee_structure, key=lambda x: x.get('fromValueCents', float('inf')))
                starting_bid_cents = lowest_tier.get('fromValueCents')
                if starting_bid_cents:
                    starting_bid = starting_bid_cents / 100.0
                    # Use starting bid as current bid if no bids yet
                    if not current_bid:
                        current_bid = starting_bid

            # Images
            images = item.get('images', [])
            primary_image_url = None
            if images and len(images) > 0:
                primary_image_url = images[0]

            # Category mapping
            category = self._map_category(title, description)
            category_primary, category_secondary, tags = self._map_enhanced_category(title, description)

            # Seller information
            seller_name = listing.get('sellerName') or listing.get('auctioneerName') or 'Kwara'

            # Bids count
            bids_count = item.get('cachedBidsCount', 0)

            # Create lot with all enhanced fields
            lot = AuctionLot(
                title=title,
                auctioneer='Kwara',
                category=category,
                category_primary=category_primary,
                category_secondary=category_secondary,
                tags=tags,
                description=description or title,
                current_bid=current_bid,
                estimated_value=current_bid,  # For now, same as current bid
                starting_bid=starting_bid,
                location=location_raw,
                location_city=location_city,
                location_state=location_state,
                image_url=primary_image_url,
                primary_image_url=primary_image_url,
                images=images,
                edict_url=edict_url,
                closing_at=closing_at,
                risk_score='MÉDIO',
                bids_count=bids_count,
                seller_name=seller_name,
                platform='kwara',
                status='active',
                source_url=f"https://www.kwara.com.br/lote/{item.get('slug', '')}" if item.get('slug') else None
            )

            # Enhanced metadata
            lot.metadata = {
                'listing_id': listing.get('id', ''),
                'item_id': item.get('id', ''),
                'status': listing.get('status', ''),
                'type': listing.get('type', ''),
                'kwara_id': listing.get('kwaraId', ''),
                'slug': item.get('slug', ''),
                'views': item.get('views', 0),
                'is_public': listing.get('isPublic', True),
                'asset_category_id': item.get('assetCategoryId', ''),
                'check_out_type': listing.get('checkOutType', ''),
                'created_at': listing.get('createdAt', ''),
                'cached_price_cents': cached_price_cents,
            }

            return lot

        except Exception as e:
            logger.debug(f"Error parsing API item: {e}")
            return None

    def _map_category(self, title: str, description: str) -> str:
        """
        Map to category based on title/description
        Optimized for Kwara's inventory: furniture, appliances, household items
        """
        text = f"{title} {description}".lower()

        # FURNITURE (Móveis) - Kwara's main category
        furniture_keywords = [
            'armário', 'estante', 'mesa', 'cadeira', 'sofá', 'poltrona',
            'cama', 'colchão', 'guarda', 'gaveta', 'niche', 'gabinete',
            'criado', 'cabeceira', 'buffet', 'rack', 'painel', 'porta'
        ]
        if any(word in text for word in furniture_keywords):
            return 'moveis'

        # APPLIANCES (Eletrodomésticos)
        appliance_keywords = [
            'geladeira', 'refrigerador', 'fogão', 'microondas', 'lavadora',
            'secadora', 'freezer', 'cooktop', 'forno', 'aire',
            'condicionador', 'climatizador', 'ventilador', 'purificador'
        ]
        if any(word in text for word in appliance_keywords):
            return 'eletrodomesticos'

        # ELECTRONICS
        electronics_keywords = [
            'tv', 'televisor', 'som', 'home theater', 'bluetooth',
            'celular', 'smartphone', 'tablet', 'notebook', 'computador',
            'monitor', 'impressora'
        ]
        if any(word in text for word in electronics_keywords):
            return 'eletronicos'

        # KITCHEN UTENSILS/ITEMS
        kitchen_keywords = [
            'panela', 'forma', 'talheres', 'prato', 'copo', 'xícara',
            'liqüidificador', 'batedeira', 'processador', 'centrífuga'
        ]
        if any(word in text for word in kitchen_keywords):
            return 'utensilios'

        # GENERAL HOUSEHOLD
        household_keywords = [
            'tapete', 'cortina', 'espelho', 'decoração', 'vaso', 'quadro',
            'luminária', 'abajur', ' Persianas'
        ]
        if any(word in text for word in household_keywords):
            return 'casa'

        return 'outros'

    def _parse_location(self, location_str: str) -> tuple:
        """
        Parse location string into city and state
        Examples:
        - "São Paulo/SP" -> ("São Paulo", "SP")
        - "Diadema/SP" -> ("Diadema", "SP")
        - "Rio de Janeiro/RJ" -> ("Rio de Janeiro", "RJ")
        """
        if not location_str:
            return None, None

        # Try to split by /
        if '/' in location_str:
            parts = location_str.split('/')
            if len(parts) == 2:
                city = parts[0].strip()
                state = parts[1].strip()
                return city, state

        # Try to extract state pattern (2 uppercase letters)
        import re
        state_match = re.search(r'/([A-Z]{2})$', location_str)
        if state_match:
            state = state_match.group(1)
            city = location_str[:state_match.start()].strip()
            return city, state

        return location_str, None

    def _map_enhanced_category(self, title: str, description: str) -> tuple:
        """
        Map to enhanced category system (primary, secondary, tags)
        Returns: (category_primary, category_secondary, tags_list)
        """
        text = f"{title} {description}".lower()

        # Primary category mapping
        category_map = {
            'Móveis': ['armário', 'estante', 'mesa', 'cadeira', 'sofá', 'poltrona', 'cama', 'colchão', 'guarda'],
            'Eletrodomésticos': ['geladeira', 'refrigerador', 'fogão', 'microondas', 'lavadora', 'freezer', 'cooktop', 'forno', 'aire', 'condicionador'],
            'Eletrônicos': ['tv', 'televisor', 'computador', 'notebook', 'celular', 'tablet', 'monitor'],
            'Veículos': ['carro', 'moto', 'caminhão', 'ônibus', 'veículo'],
            'Máquinas e Equipamentos': ['bomba', 'compressor', 'motor', 'gerador', 'betoneira', 'usina', 'máquina'],
            'Metais': ['ferro', 'aço', 'metal', 'cobre', 'alumínio', 'chapa', 'tubo', 'barra', 'perfil'],
            'Casa e Decoração': ['tapete', 'cortina', 'espelho', 'quadro', 'vaso', 'decoração', 'luminária'],
            'Ferramentas': ['martelo', 'serra', 'furadeira', 'parafusadeira', 'chave', 'ferramenta'],
        }

        # Find primary category
        category_primary = None
        for primary, keywords in category_map.items():
            if any(keyword in text for keyword in keywords):
                category_primary = primary
                break

        if not category_primary:
            category_primary = 'Outros'

        # Secondary category (more specific)
        category_secondary = None

        if category_primary == 'Móveis':
            if 'sofá' in text or 'poltrona' in text:
                category_secondary = 'Sofás e Poltronas'
            elif 'cama' in text or 'colchão' in text:
                category_secondary = 'Camas e Colchões'
            elif 'armário' in text or 'estante' in text:
                category_secondary = 'Armários e Estantes'
            elif 'mesa' in text or 'cadeira' in text:
                category_secondary = 'Mesas e Cadeiras'

        elif category_primary == 'Eletrodomésticos':
            if 'geladeira' in text or 'refrigerador' in text:
                category_secondary = 'Refrigeração'
            elif 'fogão' in text or 'cooktop' in text or 'forno' in text:
                category_secondary = 'Cozinha'
            elif 'ar_condicionado' in text or 'condicionador' in text:
                category_secondary = 'Climatização'

        # Extract tags
        tags = []

        # Material tags
        material_keywords = {
            'madeira': ['madeira', 'mdf', 'compensado'],
            'metal': ['metal', 'aço', 'ferro', 'alumínio'],
            'vidro': ['vidro', 'espelho'],
            'pedra': ['pedra', 'granito', 'mármore'],
            'tecido': ['tecido', 'couro', 'courino'],
        }

        for material, keywords in material_keywords.items():
            if any(keyword in text for keyword in keywords):
                tags.append(material)

        # Condition tags
        if 'novo' in text or 'nunca usado' in text:
            tags.append('novo')
        elif 'usado' in text:
            tags.append('usado')
        elif 'reformado' in text or 'restaurado' in text:
            tags.append('reformado')

        # Feature tags
        if 'pano' in text:
            tags.append('com_pano')
        if 'elétrico' in text or 'eletrônico' in text:
            tags.append('eletrificado')
        if 'montado' in text:
            tags.append('montado')

        return category_primary, category_secondary, list(set(tags))


def test_kwara_scraper(save_to_db: bool = False, max_pages: int = None):
    """Test the Kwara API scraper

    Args:
        save_to_db: Save lots to Supabase database
        max_pages: Limit number of pages to scrape (None = all pages)
    """
    print("Testing Kwara API Scraper with Recursive Pagination...")
    print("=" * 80)

    if max_pages:
        print(f"LIMIT: Scraping maximum {max_pages} pages per category")
    else:
        print("FULL SCRAPE: Will scrape all pages (this may take ~6 minutes)")

    print("=" * 80)

    import time
    start_time = time.time()

    scraper = KwaraAPIScraper(save_to_db=save_to_db)

    # Scrape all categories
    lots = scraper.scrape_lots()

    elapsed = time.time() - start_time

    print(f"\n{'='*80}")
    print(f"SCRAPING COMPLETE!")
    print(f"{'='*80}")
    print(f"Total lots scraped: {len(lots)}")
    print(f"Time elapsed: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"Average rate: {len(lots)/elapsed:.1f} lots/second")

    # Show first 10 lots as preview
    print(f"\n{'='*80}")
    print(f"PREVIEW: First 10 lots")
    print(f"{'='*80}")

    for i, lot in enumerate(lots[:10], 1):
        print(f"\n{i}. {lot.title[:70]}...")
        print(f"   Category: {lot.category}")
        print(f"   Location: {lot.location}")
        if lot.current_bid:
            print(f"   Current Bid: R$ {lot.current_bid:,.2f}")
        else:
            print("   Current Bid: N/A")
        print(f"   Closing: {lot.closing_at}")
        print(f"   Platform: {lot.platform}")
        print(f"   Status: {lot.status}")

    if len(lots) > 10:
        print(f"\n... and {len(lots) - 10} more lots")

    # Category breakdown
    category_counts = {}
    for lot in lots:
        category_counts[lot.category] = category_counts.get(lot.category, 0) + 1

    print(f"\n{'='*80}")
    print(f"CATEGORY BREAKDOWN")
    print(f"{'='*80}")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    # Value summary
    total_value = sum(lot.current_bid for lot in lots if lot.current_bid)
    if total_value > 0:
        print(f"\n{'='*80}")
        print(f"VALUE SUMMARY")
        print(f"{'='*80}")
        print(f"Total value of all lots: R$ {total_value:,.2f}")
        print(f"Average lot value: R$ {total_value/len(lots):,.2f}")

    print(f"\n{'='*80}")
    print(f"✓ Successfully scraped {len(lots)} lots from Kwara!")
    print(f"{'='*80}")

    return len(lots)


if __name__ == '__main__':
    # Quick test: Scrape first 2 pages only
    # test_kwara_scraper(save_to_db=True, max_pages=2)

    # Full production scrape: All pages (takes ~6 minutes)
    test_kwara_scraper(save_to_db=True)
