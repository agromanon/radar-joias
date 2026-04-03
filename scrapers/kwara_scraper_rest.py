"""
Kwara API Scraper with REST API Integration
Scrapes all lots from Kwara API and saves to Supabase via REST API
"""

import requests
import json
import logging
import os
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Kwara API endpoint (Next.js data API)
KWARA_API_URL = "https://www.kwara.com.br/_next/data/icEnlyKUxVs3w2HsvxZ12/busca.json"

def fetch_all_categories() -> List[str]:
    """Fetch all category IDs from Kwara"""
    url = "https://www.kwara.com.br/_next/data/icEnlyKUxVs3w2HsvxZ12/categorias.json"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()

        # Extract category IDs from response
        page_props = data.get('pageProps', {})
        initial_data = page_props.get('initialData', {})
        categories_data = initial_data.get('allCategories', [])

        category_ids = []
        if isinstance(categories_data, list):
            for category in categories_data:
                if isinstance(category, dict):
                    category_id = category.get('id')
                    if category_id:
                        category_ids.append(category_id)

        logger.info(f"Fetched {len(category_ids)} categories from Kwara")
        return category_ids

    except Exception as e:
        logger.error(f"Error fetching categories: {e}")
        # Fallback to hardcoded categories
        return [
            "1335572015838398043",  # Casa & Construção (Moveis)
            "1335572023151306",     # Industrial
            "1335572026939174",     # Veículos
        ]


@dataclass
class AuctionLot:
    """Represents an auction lot"""
    id: str
    title: str
    description: str = ""
    auctioneer: str = "Kwara"
    current_bid: float = 0.0
    opening_bid: float = 0.0
    image_url: Optional[str] = None
    images: List[str] = None
    category: str = ""
    location_city: str = ""
    location_state: str = ""
    edict_url: Optional[str] = None
    closing_at: Optional[str] = None
    risk_score: str = "MÉDIO"
    status: str = "active"
    platform: str = "kwara"
    created_at: str = None
    updated_at: str = None

    def __post_init__(self):
        if self.images is None:
            self.images = []
        if self.image_url and self.image_url not in self.images:
            self.images.insert(0, self.image_url)

        # Enhanced categorization
        self.category = enhance_category(self.category, self.title)

        # Calculate risk score
        self.risk_score = calculate_risk_score(self)

        # Metadata for flexible storage
        self.metadata = {
            "platform": self.platform,
            "images": self.images,
            "original_category": self.category,
            "enhanced_category": enhance_category(self.category, self.title)
        }


def enhance_category(base_category: str, title: str) -> str:
    """Enhance category based on title content"""
    title_lower = title.lower()

    # Mapping rules
    if any(word in title_lower for word in ['sofá', 'poltrona', 'cadeira', 'mesa', 'estofado']):
        return 'estofados'
    if any(word in title_lower for word in ['armário', 'guarda-roupa', 'módulo', 'estante']):
        return 'armarios'
    if any(word in title_lower for word in ['cama', 'colchão', 'criado']):
        return 'dormitorio'
    if any(word in title_lower for word in ['geladeira', 'fogão', 'microondas']):
        return 'eletrodomesticos'
    if any(word in title_lower for word in ['tv', 'televisor', 'som']):
        return 'eletronicos'
    if any(word in title_lower for word in ['carro', 'moto', 'veículo']):
        return 'veiculos'

    return base_category


def calculate_risk_score(lot: AuctionLot) -> str:
    """Calculate risk score based on available data"""
    title_lower = lot.title.lower()

    # High risk indicators
    if any(word in title_lower for word in ['sem documentação', 'não funciona', 'quebrado', 'defeito']):
        return 'ALTO'

    # Low risk indicators
    if lot.current_bid > 5000:
        return 'BAIXO'
    if any(word in title_lower for word in ['novo', 'lacrado', 'garantia']):
        return 'BAIXO'

    return 'MÉDIO'


class KwaraScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.lots = []

    def fetch_page(self, category_id: str, page: int = 1, page_size: int = 48) -> Dict:
        """Fetch a single page from Kwara API"""
        # Kwara uses GET with query parameters
        params = {
            'assetCategoryIds[]': category_id,
            'page': page,
            'pageSize': page_size
        }

        try:
            response = self.session.get(KWARA_API_URL, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Error fetching page {page}: {e}")
            return {}

    def scrape_category(self, category_id: str, max_pages: Optional[int] = None) -> List[Dict]:
        """Scrape all pages from a category"""
        logger.info(f"Fetching category {category_id}, page 1...")

        # First page to get total count
        data = self.fetch_page(category_id, page=1)

        if not data or 'pageProps' not in data:
            logger.warning(f"Invalid response for category {category_id}")
            return []

        page_props = data.get('pageProps', {})
        search_result = page_props.get('searchResult', {})

        total_items = search_result.get('totalItems', 0)
        total_pages = search_result.get('totalPages', 1)

        logger.info(f"  → Category contains {total_items} lots across {total_pages} pages")

        if max_pages:
            total_pages = min(total_pages, max_pages)
            logger.info(f"  → Limited to {max_pages} pages")

        all_auctions = []

        # Process first page
        items = search_result.get('items', [])

        if not items:
            logger.info(f"No items found in category {category_id}")
            return []

        all_auctions.extend(items)
        logger.info(f"  → Page 1/{total_pages}: {len(items)} lots (total: {len(all_auctions)})")

        # Fetch remaining pages
        last_page = 1
        for page in range(2, total_pages + 1):
            logger.info(f"Fetching category {category_id}, page {page}...")

            page_data = self.fetch_page(category_id, page=page)

            if not page_data or 'pageProps' not in page_data:
                logger.warning(f"Failed to fetch page {page}")
                continue

            page_props = page_data.get('pageProps', {})
            search_result = page_props.get('searchResult', {})
            items = search_result.get('items', [])

            if not items:
                logger.info(f"No more items on page {page}, pagination complete")
                break

            all_auctions.extend(items)
            logger.info(f"  → Page {page}/{total_pages}: {len(items)} lots (total: {len(all_auctions)})")
            last_page = page

            if page >= total_pages:
                logger.info(f"Reached last page ({page}/{total_pages})")
                break

        logger.info(f"Category {category_id} complete: {len(all_auctions)} lots from {last_page} pages")
        return all_auctions

    def parse_lot(self, raw_lot: Dict) -> Dict:
        """Parse raw API data into AuctionLot format"""
        try:
            listing = raw_lot.get('listing', {})

            # Extract title (combine listing title and item title)
            item_title = raw_lot.get('title', '')
            auction_title = listing.get('title', '')
            title = f"{auction_title} - {item_title}" if item_title else auction_title

            # Extract images
            images_data = raw_lot.get('images', [])
            images = [img.get('url', '') for img in images_data if img.get('url')]
            primary_image = images[0] if images else None

            # Extract location
            location_raw = listing.get('location', '')
            location_city, location_state = self._parse_location(location_raw)

            # Parse closing date
            closing_at_str = listing.get('scheduledEndAt') or raw_lot.get('scheduledEndAt')
            closing_at = None
            if closing_at_str:
                try:
                    closing_at = datetime.fromisoformat(closing_at_str.replace('Z', '+00:00')).isoformat()
                except:
                    pass

            # Extract current/highest bid (in cents)
            cached_price_cents = raw_lot.get('cachedPriceAmountCents')
            current_bid = 0.0
            if cached_price_cents:
                current_bid = cached_price_cents / 100.0

            # Extract starting bid from fee structure
            opening_bid = 0.0
            fee_structure = raw_lot.get('feeStructureValues', [])
            if fee_structure:
                lowest_tier = min(fee_structure, key=lambda x: x.get('fromValueCents', float('inf')))
                starting_bid_cents = lowest_tier.get('fromValueCents')
                if starting_bid_cents:
                    opening_bid = starting_bid_cents / 100.0
                    # Use starting bid as current bid if no bids yet
                    if not current_bid:
                        current_bid = opening_bid

            # Edict URL
            edict_url = listing.get('termsUrl', '')

            # Status
            status = 'active' if listing.get('status') == 'OPEN' else 'closed'

            # Create lot
            lot = AuctionLot(
                id=raw_lot['id'],
                title=title[:200],
                description=listing.get('description', '')[:500],
                current_bid=current_bid,
                opening_bid=opening_bid,
                image_url=primary_image,
                images=images,
                category='',  # Will be enhanced
                location_city=location_city,
                location_state=location_state,
                edict_url=edict_url,
                closing_at=closing_at,
                status=status,
                platform='kwara',
                created_at=datetime.utcnow().isoformat(),
                updated_at=datetime.utcnow().isoformat()
            )

            # Convert to dict with metadata
            lot_dict = asdict(lot)
            lot_dict['metadata'] = lot.metadata
            lot_dict.pop('__post_init__', None)

            # Remove fields that are stored in metadata only or don't exist in schema
            lot_dict.pop('id', None)  # Let database auto-generate UUID
            lot_dict.pop('images', None)
            lot_dict.pop('platform', None)  # Store in metadata
            lot_dict.pop('status', None)  # Store in metadata
            lot_dict.pop('opening_bid', None)  # Not in schema

            # Ensure platform and status are in metadata
            lot_dict['metadata']['platform'] = 'kwara'
            lot_dict['metadata']['status'] = status

            return lot_dict

        except Exception as e:
            logger.error(f"Error parsing lot {raw_lot.get('id', 'Unknown')}: {e}")
            return None

    def _parse_location(self, location_str: str):
        """Parse location string like 'Rio de Janeiro/RJ' into city and state"""
        if not location_str:
            return '', ''

        parts = location_str.split('/')
        if len(parts) == 2:
            city = parts[0].strip()
            state = parts[1].strip()
            return city, state
        elif len(parts) == 1 and len(parts[0]) == 2:
            return '', parts[0]  # Only state abbreviation
        else:
            return location_str, ''

    def scrape_lots(self, category_ids: List[str] = None, max_pages: int = None) -> List[Dict]:
        """Main scraping method"""
        if category_ids is None:
            category_ids = CATEGORY_IDS

        logger.info(f"Starting Kwara API scraper for {len(category_ids)} categories")

        all_auctions = []

        for category_id in category_ids:
            category_auctions = self.scrape_category(category_id, max_pages)
            all_auctions.extend(category_auctions)

        logger.info(f"Total lots found: {len(all_auctions)}")
        return all_auctions

    def save_to_database(self, lots: List[Dict]) -> int:
        """Save lots to Supabase via REST API"""
        if not lots:
            return 0

        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates'
        }

        saved_count = 0
        batch_size = 100

        for i in range(0, len(lots), batch_size):
            batch = lots[i:i + batch_size]

            try:
                response = requests.post(
                    f'{SUPABASE_URL}/rest/v1/lots',
                    headers=headers,
                    json=batch,
                    timeout=60
                )

                if response.status_code in [200, 201]:
                    saved_count += len(batch)
                    logger.info(f"Saved batch {i//batch_size + 1}: {len(batch)} lots (total: {saved_count})")
                else:
                    logger.error(f"Error saving batch: {response.status_code} - {response.text}")

            except Exception as e:
                logger.error(f"Error saving batch: {e}")

        logger.info(f"Total lots saved to database: {saved_count}")
        return saved_count


def main():
    print("=" * 80)
    print("Kwara API Scraper with REST Integration")
    print("=" * 80)
    print()
    print(f"Supabase URL: {SUPABASE_URL}")

    # Fetch all categories dynamically
    print("\nFetching all categories from Kwara...")
    category_ids = fetch_all_categories()
    print(f"Found {len(category_ids)} categories to scrape")
    print()

    scraper = KwaraScraper()

    # Scrape all lots
    start_time = datetime.now()
    raw_lots = scraper.scrape_lots(category_ids=category_ids, max_pages=None)  # No page limit
    scrape_time = (datetime.now() - start_time).total_seconds()

    print()
    print("=" * 80)
    print(f"SCRAPING COMPLETE!")
    print("=" * 80)
    print(f"Total lots scraped: {len(raw_lots)}")
    print(f"Time elapsed: {scrape_time:.1f} seconds ({scrape_time/60:.1f} minutes)")
    print(f"Average rate: {len(raw_lots)/scrape_time:.1f} lots/second")

    # Parse lots
    parsed_lots = []
    for raw_lot in raw_lots:
        lot_dict = scraper.parse_lot(raw_lot)
        if lot_dict:
            parsed_lots.append(lot_dict)

    print()
    print(f"Successfully parsed: {len(parsed_lots)} lots")

    # Save to database
    if parsed_lots:
        print()
        print("=" * 80)
        print("Clearing existing Kwara lots from database...")
        print("=" * 80)

        # Delete existing Kwara lots
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }

        try:
            # Delete all lots first (simpler approach)
            delete_response = requests.delete(
                f'{SUPABASE_URL}/rest/v1/lots',
                headers=headers,
                timeout=60
            )
            print(f"Cleared existing lots: {delete_response.status_code == 204}")
        except Exception as e:
            print(f"Warning: Could not delete existing lots: {e}")

        print()
        print("Saving new lots to database via REST API...")
        print("=" * 80)
        saved_count = scraper.save_to_database(parsed_lots)

        print()
        print("=" * 80)
        print(f"✓ Successfully saved {saved_count} lots to database!")
        print("=" * 80)

    # Preview first 10 lots
    if parsed_lots:
        print()
        print("=" * 80)
        print("PREVIEW: First 10 lots")
        print("=" * 80)
        print()

        for i, lot in enumerate(parsed_lots[:10], 1):
            print(f"{i}. {lot['title']}")
            print(f"   Category: {lot['category']}")
            print(f"   Location: {lot['location_city']}/{lot['location_state']}")
            print(f"   Current Bid: R$ {lot['current_bid']:,.2f}")
            print(f"   Closing: {lot['closing_at']}")
            print(f"   Platform: {lot['metadata'].get('platform', 'unknown')}")
            print(f"   Status: {lot['metadata'].get('status', 'unknown')}")
            print(f"   Images: {len(lot['metadata'].get('images', []))}")
            print()

    # Category breakdown
    if parsed_lots:
        print("=" * 80)
        print("CATEGORY BREAKDOWN")
        print("=" * 80)
        categories = {}
        for lot in parsed_lots:
            cat = lot['category']
            categories[cat] = categories.get(cat, 0) + 1

        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f"  {cat}: {count}")
        print()

    # Value summary
    if parsed_lots:
        total_value = sum(lot['current_bid'] for lot in parsed_lots)
        avg_value = total_value / len(parsed_lots) if parsed_lots else 0

        print("=" * 80)
        print("VALUE SUMMARY")
        print("=" * 80)
        print(f"Total value of all lots: R$ {total_value:,.2f}")
        print(f"Average lot value: R$ {avg_value:,.2f}")
        print()


if __name__ == '__main__':
    main()
