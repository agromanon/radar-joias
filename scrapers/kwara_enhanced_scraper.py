"""
Enhanced Kwara Web Scraper - Extracts full data from lot detail pages
Uses BeautifulSoup to scrape individual lot pages when API is unavailable
"""

import requests
from bs4 import BeautifulSoup
import json
import logging
import re
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
import time
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class EnhancedAuctionLot:
    """Enhanced lot with full description and source URL"""
    id: str
    title: str
    description: str
    auctioneer: str
    category: str
    current_bid: float
    starting_bid: Optional[float] = None
    image_url: Optional[str] = None
    images: List[str] = None
    edict_url: Optional[str] = None
    source_url: Optional[str] = None  # Direct link to lot page
    closing_at: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    seller_name: Optional[str] = None
    status: str = 'active'
    platform: str = 'kwara'
    bids_count: int = 0
    metadata: Optional[Dict] = None

    def __post_init__(self):
        if self.images is None:
            self.images = []

    def to_dict(self) -> Dict:
        """Convert to database format"""
        data = {
            'title': self.title,
            'auctioneer': self.auctioneer,
            'category': self.category,
            'description': self.description,
            'current_bid': self.current_bid,
            'image_url': self.image_url,
            'edict_url': self.edict_url,
            'source_url': self.source_url,  # NEW: Direct lot page link
            'closing_at': self.closing_at,
            'risk_score': 'MÉDIO',  # Can be calculated later
            'location_city': self.location_city,
            'location_state': self.location_state,
        }

        # Store enhanced data in metadata
        enhanced_metadata = {
            'platform': self.platform,
            'images': self.images,
            'status': self.status,
            'bids_count': self.bids_count,
            'seller_name': self.seller_name,
        }

        if self.starting_bid:
            enhanced_metadata['starting_bid'] = self.starting_bid

        # Merge with existing metadata
        if self.metadata:
            enhanced_metadata.update(self.metadata)

        data['metadata'] = enhanced_metadata

        # Remove None values
        return {k: v for k, v in data.items() if v is not None}


class KwaraEnhancedScraper:
    """Enhanced scraper that extracts full data from Kwara lot pages"""

    def __init__(self, save_to_db: bool = False):
        self.base_url = 'https://www.kwara.com.br'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        })

        self.save_to_db = save_to_db
        self.db_manager = None

        if save_to_db:
            try:
                from utils.database import DatabaseManager
                self.db_manager = DatabaseManager()
                logger.info("Database integration enabled")
            except ImportError:
                logger.warning("Database module not found")
                self.save_to_db = False

    def scrape_lot_by_id(self, lot_id: str) -> Optional[EnhancedAuctionLot]:
        """Scrape a single lot by its ID from the detail page"""
        try:
            # Construct lot detail page URL
            lot_url = f"{self.base_url}/lote/{lot_id}"
            logger.info(f"Fetching lot page: {lot_url}")

            response = self.session.get(lot_url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract data from the page
            lot = self._parse_lot_page(soup, lot_id, lot_url)

            if lot and self.save_to_db and self.db_manager:
                self._save_to_database([lot])

            return lot

        except Exception as e:
            logger.error(f"Error scraping lot {lot_id}: {e}")
            return None

    def scrape_from_existing_lots(self, max_lots: int = None) -> List[EnhancedAuctionLot]:
        """Enhance existing lots in database by scraping their detail pages

        This assumes we already have lot IDs from previous API scrapes
        """
        try:
            # Connect to database to get existing lot IDs
            if not self.db_manager:
                logger.error("Database manager not available")
                return []

            # Get lot IDs from database (lots that need enhancement)
            lot_ids = self._get_lots_needing_enhancement(limit=max_lots)

            logger.info(f"Found {len(lot_ids)} lots to enhance")

            enhanced_lots = []
            for i, lot_id in enumerate(lot_ids, 1):
                logger.info(f"[{i}/{len(lot_ids)}] Enhancing lot {lot_id}...")

                lot = self.scrape_lot_by_id(lot_id)
                if lot:
                    enhanced_lots.append(lot)

                # Polite delay between requests
                delay = random.uniform(2, 4)
                time.sleep(delay)

                if max_lots and i >= max_lots:
                    break

            logger.info(f"Enhanced {len(enhanced_lots)} lots successfully")

            if self.save_to_db and enhanced_lots:
                self._save_to_database(enhanced_lots)

            return enhanced_lots

        except Exception as e:
            logger.error(f"Error enhancing existing lots: {e}")
            return []

    def _parse_lot_page(self, soup: BeautifulSoup, lot_id: str, lot_url: str) -> Optional[EnhancedAuctionLot]:
        """Parse lot detail page to extract all available information"""
        try:
            # Extract title from meta tags or page content
            title = self._extract_title(soup)

            # Extract description from meta tags or page content
            description = self._extract_description(soup)

            # Extract images
            images, primary_image = self._extract_images(soup)

            # Extract price information
            current_bid, starting_bid = self._extract_prices(soup)

            # Extract location
            location_city, location_state = self._extract_location(soup)

            # Extract auction end time
            closing_at = self._extract_closing_time(soup)

            # Extract edict URL
            edict_url = self._extract_edict_url(soup)

            # Extract seller/auctioneer info
            seller_name = self._extract_seller(soup)

            # Extract category
            category = self._extract_category(soup)

            # Create enhanced lot
            lot = EnhancedAuctionLot(
                id=lot_id,
                title=title,
                description=description,  # Full description, not just brief
                auctioneer='Kwara',
                category=category,
                current_bid=current_bid or 0,
                starting_bid=starting_bid,
                image_url=primary_image,
                images=images,
                edict_url=edict_url,
                source_url=lot_url,  # NEW: Direct link to lot page
                closing_at=closing_at,
                location_city=location_city,
                location_state=location_state,
                seller_name=seller_name,
                platform='kwara',
                status='active',
                bids_count=0,
            )

            return lot

        except Exception as e:
            logger.error(f"Error parsing lot page: {e}")
            return None

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract title from meta tags or page content"""
        # Try meta tags first
        title_meta = soup.find('meta', {'property': 'og:title'})
        if title_meta:
            return title_meta.get('content', '').strip()

        title_meta = soup.find('meta', {'name': 'twitter:title'})
        if title_meta:
            return title_meta.get('content', '').strip()

        # Try page title
        title_tag = soup.find('title')
        if title_tag:
            return title_tag.get_text().strip()

        # Try h1 tag
        h1 = soup.find('h1')
        if h1:
            return h1.get_text().strip()

        return "Lote sem título"

    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract full description from the lot page"""
        # Try meta description
        desc_meta = soup.find('meta', {'property': 'og:description'})
        if desc_meta:
            return desc_meta.get('content', '').strip()

        desc_meta = soup.find('meta', {'name': 'description'})
        if desc_meta:
            return desc_meta.get('content', '').strip()

        # Look for description section in the page
        # Common patterns: article, section with class="description", div with lot details
        desc_div = soup.find('div', class_=re.compile(r'description|detalhes|about', re.I))
        if desc_div:
            text = desc_div.get_text(separator=' ', strip=True)
            if len(text) > 50:  # Only use if substantial content
                return text

        # Try to find any article or main content section
        article = soup.find('article')
        if article:
            text = article.get_text(separator=' ', strip=True)
            if len(text) > 50:
                return text[:2000]  # Limit to reasonable length

        # Try to find paragraphs with substantial text
        paragraphs = soup.find_all('p')
        if paragraphs:
            # Concatenate multiple paragraphs
            description_parts = []
            for p in paragraphs[:5]:  # Max 5 paragraphs
                text = p.get_text(strip=True)
                if len(text) > 20:
                    description_parts.append(text)

            if description_parts:
                return ' | '.join(description_parts)[:2000]

        return ""  # Return empty string if no description found

    def _extract_images(self, soup: BeautifulSoup) -> tuple:
        """Extract all images from the page"""
        images = []

        # Try OpenGraph images
        og_images = soup.find_all('meta', {'property': 'og:image'})
        for meta in og_images:
            img_url = meta.get('content')
            if img_url:
                images.append(img_url)

        # Try Twitter images
        twitter_images = soup.find_all('meta', {'name': 'twitter:image'})
        for meta in twitter_images:
            img_url = meta.get('content')
            if img_url and img_url not in images:
                images.append(img_url)

        # Try to find image tags in the page
        img_tags = soup.find_all('img')
        for img in img_tags:
            src = img.get('src') or img.get('data-src')
            if src and 'kwara' in src.lower():
                # Filter to Kwara CDN images
                if src not in images:
                    images.append(src)

        # Remove duplicates while preserving order
        seen = set()
        unique_images = []
        for img in images:
            if img and img not in seen:
                seen.add(img)
                unique_images.append(img)

        primary_image = unique_images[0] if unique_images else None
        return unique_images, primary_image

    def _extract_prices(self, soup: BeautifulSoup) -> tuple:
        """Extract current and starting bid from page"""
        current_bid = None
        starting_bid = None

        # Try to find price in JSON-LD data
        scripts = soup.find_all('script', {'type': 'application/ld+json'})
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    # Look for price information
                    if 'offers' in data:
                        offers = data['offers']
                        if isinstance(offers, list) and offers:
                            offer = offers[0]
                            if isinstance(offer, dict):
                                price = offer.get('price')
                                if price:
                                    current_bid = float(price)
                                    if isinstance(price, str) and price.startswith('$'):
                                        current_bid = float(price.replace('$', '').replace(',', ''))

                    # Look for Product data
                    if '@type' in data and data['@type'] == 'Product':
                        current_bid = data.get('price')
                        if isinstance(current_bid, str):
                            current_bid = float(current_bid.replace('$', '').replace(',', ''))

            except (json.JSONDecodeError, KeyError, ValueError):
                continue

        # Try to find price in page content using regex
        page_text = soup.get_text()
        price_patterns = [
            r'Lance\s+Atual[:\s]*R?\s*([\d.,]+)',
            r'Valor\s+Atual[:\s]*R?\s*([\d.,]+)',
            r'Current\s+Bid[:\s]*R?\s*([\d.,]+)',
            r'R?\s*([\d.,]+)\s*lance',
        ]

        for pattern in price_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                try:
                    current_bid = float(match.group(1).replace('.', '').replace(',', ''))
                    break
                except ValueError:
                    continue

        return current_bid or 0, starting_bid

    def _extract_location(self, soup: BeautifulSoup) -> tuple:
        """Extract location from page"""
        # Try JSON-LD data
        scripts = soup.find_all('script', {'type': 'application/ld+json'})
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    # Look for address
                    if 'address' in data:
                        address = data['address']
                        if isinstance(address, dict):
                            address_loc = address.get('addressLocality')
                            if address_loc:
                                city = address_loc.get('addressRegion')
                                state = address_loc.get('addressCountry')
                                if city and state:
                                    return city, state

                    # Look for location
                    location = data.get('location')
                    if location and isinstance(location, dict):
                        city = location.get('addressCity') or location.get('city')
                        state = location.get('addressState') or location.get('state')
                        return city, state

            except (json.JSONDecodeError, KeyError):
                continue

        # Try meta tags
        meta_location = soup.find('meta', {'property': 'og:location'})
        if meta_location:
            loc = meta_location.get('content', '')
            if '/' in loc:
                parts = loc.split('/')
                if len(parts) >= 2:
                    return parts[0].strip(), parts[1].strip()

        return None, None

    def _extract_closing_time(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract auction closing time from page"""
        # Try JSON-LD data
        scripts = soup.find_all('script', {'type': 'application/ld+json'})
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    # Look for Auction schema
                    if data.get('@type') == 'Auction':
                        # Look for endDate or auctionEndDate
                        for key in ['endDate', 'auctionEndDate', 'endDate']:
                            if key in data:
                                try:
                                    dt = datetime.fromisoformat(data[key].replace('Z', '+00:00'))
                                    return dt.isoformat()
                                except:
                                    pass

                    # Look in ItemList
                    if 'itemList' in data:
                        items = data['itemList']
                        if isinstance(items, list) and items:
                            item = items[0]
                            if isinstance(item, dict):
                                end_date = item.get('endDate')
                                if end_date:
                                    try:
                                        dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                                        return dt.isoformat()
                                    except:
                                        pass

            except (json.JSONDecodeError, KeyError, ValueError):
                continue

        # Try meta tags
        meta_time = soup.find('meta', {'property': 'auction:end'})
        if meta_time:
            time_str = meta_time.get('content', '')
            if time_str:
                try:
                    dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    return dt.isoformat()
                except:
                    pass

        return None

    def _extract_edict_url(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract edict URL from page"""
        # Try meta tags
        edict_meta = soup.find('meta', {'property': 'edict:url'})
        if edict_meta:
            return edict_meta.get('content', '')

        # Try to find PDF links
        pdf_links = soup.find_all('a', href=re.compile(r'\.pdf', re.I))
        if pdf_links:
            for link in pdf_links:
                href = link.get('href', '')
                if href and ('edital' in href.lower() or 'termo' in href.lower()):
                    return href

        # Look for terms/edict section
        terms_section = soup.find('div', class_=re.compile(r'termos?|edital?', re.I))
        if terms_section:
            link = terms_section.find('a')
            if link:
                return link.get('href', '')

        return None

    def _extract_seller(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract seller/auctioneer name"""
        # Try JSON-LD data
        scripts = soup.find_all('script', {'type': 'application/ld+json'})
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    # Look for seller
                    seller = data.get('seller') or data.get('auctioneer')
                    if seller and isinstance(seller, dict):
                        return seller.get('name')
                    elif seller and isinstance(seller, str):
                        return seller
            except (json.JSONDecodeError, KeyError):
                continue

        # Try to find in page content
        seller_div = soup.find('div', class_=re.compile(r'seller|auctioneer|vendedor', re.I))
        if seller_div:
            return seller_div.get_text().strip()

        return None

    def _extract_category(self, soup: BeautifulSoup) -> str:
        """Extract category from page"""
        # Try meta tags
        category_meta = soup.find('meta', {'property': 'product:category'})
        if category_meta:
            return category_meta.get('content', '')

        # Try to find category in page
        category_div = soup.find('div', class_=re.compile(r'categoria|category', re.I))
        if category_div:
            return category_div.get_text().strip()

        # Analyze title and description
        title = self._extract_title(soup)
        desc = self._extract_description(soup)

        text = f"{title} {desc}".lower()

        # Categorize based on content
        if 'sofá' in text or 'poltrona' in text or 'cadeira' in text:
            return 'estofados'
        elif 'geladeira' in text or 'fogão' in text:
            return 'eletrodomesticos'
        elif 'tv' in text or 'televisor' in text or 'som' in text:
            return 'eletronicos'
        elif 'armário' in text or 'estante' in text:
            return 'moveis'
        else:
            return 'outros'

    def _get_lots_needing_enhancement(self, limit: Optional[int] = None) -> List[str]:
        """Get lot IDs from database that need enhancement (missing source_url or short descriptions)"""
        try:
            if not self.db_manager:
                return []

            # This would query the database for lots that need enhancement
            # For now, return empty list - implement based on your database structure
            # TODO: Query lots table for lots with:
            # - source_url IS NULL
            # - OR LENGTH(description) < 100

            logger.info("Querying database for lots needing enhancement...")
            # Implementation depends on your database query method

            return []  # Return list of lot IDs

        except Exception as e:
            logger.error(f"Error getting lots needing enhancement: {e}")
            return []

    def _save_to_database(self, lots: List[EnhancedAuctionLot]):
        """Save enhanced lots to database"""
        try:
            lots_data = [lot.to_dict() for lot in lots]

            if self.db_manager.insert_lots(lots_data):
                logger.info(f"✓ Successfully saved {len(lots)} enhanced lots to database")
            else:
                logger.error("✗ Failed to save enhanced lots to database")

        except Exception as e:
            logger.error(f"Error saving to database: {e}")


def test_enhanced_scraper(lot_id: str):
    """Test the enhanced scraper on a specific lot"""
    print(f"Testing enhanced scraper on lot {lot_id}...")
    print("=" * 80)

    scraper = KwaraEnhancedScraper(save_to_db=False)

    lot = scraper.scrape_lot_by_id(lot_id)

    if lot:
        print(f"✓ Successfully scraped lot {lot_id}")
        print(f"\nTitle: {lot.title[:100]}...")
        print(f"Description ({len(lot.description)} chars): {lot.description[:200]}...")
        print(f"Source URL: {lot.source_url}")
        print(f"Images: {len(lot.images)} images found")
        print(f"Category: {lot.category}")
        if lot.current_bid:
            print(f"Current Bid: R$ {lot.current_bid:,.2f}")
        if lot.location_city:
            print(f"Location: {lot.location_city}/{lot.location_state}")
        if lot.closing_at:
            print(f"Closing: {lot.closing_at}")
    else:
        print(f"✗ Failed to scrape lot {lot_id}")

    return lot


if __name__ == '__main__':
    # Test with the lot we've been looking at
    test_lot_id = '8c837a71-4340-4e41-90e7-811ff990db1a'
    test_enhanced_scraper(test_lot_id)
