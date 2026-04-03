"""
Updated Kwara scraper based on actual site structure
Kwara is an e-commerce platform, not a traditional auction site
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, parse_qs, urlparse
import re
import time
from typing import List, Dict, Optional
import logging

from base import BaseScraper, AuctionLot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KwaraScraper(BaseScraper):
    """Scraper for Kwara (e-commerce platform for discounted goods)"""

    # Category IDs discovered from site inspection
    CATEGORIES = {
        'casa_construcao': '1335572015838398',  # Casa & Construção
        'eletrodomesticos': '1335572017063134',   # Eletrodomésticos & Eletrônicos
        'escritorio_negocios': '1335572018279482', # Escritório & Negócios
        'informatica': '1335572021920138',        # Informática & Telefonia
        'industrial': '1335572023151306',         # Industrial (likely has materials)
        'restaurantes': '1335572024344446',       # Restaurantes & Cozinhas Industriais
        'veiculos': '1335572025728918',           # Veículos
        'imoveis': '1335572026939174',            # Imóveis
    }

    def __init__(self, proxy_manager=None):
        super().__init__(
            base_url='https://www.kwara.com.br',
            proxy_manager=proxy_manager,
            delay_range=(3, 7)
        )

    def scrape_lots(self, category: str = 'casa_construcao') -> List[AuctionLot]:
        """
        Scrape lots from a specific category

        Args:
            category: Category key from CATEGORIES dict
        """
        logger.info(f"Starting Kwara scraper for category: {category}")

        if category not in self.CATEGORIES:
            logger.error(f"Unknown category: {category}")
            return []

        category_id = self.CATEGORIES[category]
        lots = []

        try:
            # Build search URL
            search_url = f"{self.base_url}/busca?assetCategoryIds[]={category_id}"
            logger.info(f"Fetching: {search_url}")

            html = self.fetch_page(search_url)
            if not html:
                logger.error("Failed to fetch search page")
                return []

            soup = self.parse_html(html)

            # Extract product/lot data from search results
            lots = self._extract_lots_from_search(soup, category)

            logger.info(f"Found {len(lots)} lots in {category}")
            return lots

        except Exception as e:
            logger.error(f"Error scraping Kwara: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _extract_lots_from_search(self, soup: BeautifulSoup, category: str) -> List[AuctionLot]:
        """Extract lots from search results page"""
        lots = []

        try:
            # Look for product cards/containers
            # Based on inspection, lots are in divs with links and images
            all_links = soup.find_all('a', href=True)

            # Filter for product/lot links
            product_links = []
            for link in all_links:
                href = link.get('href')
                text = link.get_text(strip=True)

                # Skip navigation and category links
                skip = ['/categorias', '/busca', 'javascript', '#', 'como-funciona',
                       'indique-ganhe', 'privacidade', 'termos', 'typeform', 'whatsapp.com']

                if href and not any(s in href for s in skip):
                    # Look for meaningful product names
                    if text and len(text) > 15:
                        # Check if parent has image (product card indicator)
                        parent = link.parent
                        if parent:
                            img = parent.find('img')
                            if img:
                                product_links.append({
                                    'title': text,
                                    'url': urljoin(self.base_url, href),
                                    'parent': parent
                                })

            logger.info(f"Found {len(product_links)} potential product links")

            # Remove duplicates
            seen = set()
            unique_products = []
            for prod in product_links:
                if prod['url'] not in seen:
                    seen.add(prod['url'])
                    unique_products.append(prod)

            # Extract details from each product card
            for prod in unique_products[:50]:  # Limit to 50 for now
                try:
                    lot = self._parse_product_card(prod, category)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.debug(f"Error parsing product: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error extracting lots from search: {e}")

        return lots

    def _parse_product_card(self, product: Dict, category: str) -> Optional[AuctionLot]:
        """Parse a product card into an AuctionLot"""
        try:
            parent = product['parent']
            title = product['title']

            # Extract image
            img_elem = parent.find('img')
            image_url = None
            if img_elem:
                image_url = img_elem.get('src') or img_elem.get('data-src')
                if image_url and not image_url.startswith('http'):
                    image_url = urljoin(self.base_url, image_url)

            # Try to find price in the card
            price_elem = parent.find(['span', 'div', 'p'], string=re.compile(r'R?\$'))
            current_bid = None
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                current_bid = self.extract_price(price_text)

            # Try to find description
            desc_elem = parent.find(['p', 'div', 'span'],
                                   class_=re.compile(r'desc|detail|description', re.I))
            description = desc_elem.get_text(strip=True) if desc_elem else None

            # Map category
            category_map = {
                'casa_construcao': 'materiais',
                'industrial': 'materiais',
                'eletrodomesticos': 'eletronicos',
                'informatica': 'informatica',
                'veiculos': 'veiculos',
                'imoveis': 'imoveis',
            }
            mapped_category = category_map.get(category, 'outros')

            # Create lot
            lot = AuctionLot(
                title=title,
                auctioneer='Kwara',
                category=mapped_category,
                description=description or f"Produto da categoria {category}",
                current_bid=current_bid,
                image_url=image_url,
                edict_url=product['url'],  # Use product URL as edict URL
                risk_score='medium'
            )

            # Calculate actual risk score
            lot.risk_score = self.calculate_risk_score(lot)

            return lot

        except Exception as e:
            logger.debug(f"Error parsing product card: {e}")
            return None


def test_kwara_scraper():
    """Test the Kwara scraper"""
    print("Testing Kwara Scraper...")
    print("=" * 80)

    scraper = KwaraScraper()

    # Test Casa & Construção category
    print("\nScraping Casa & Construção category...")
    lots = scraper.scrape_lots('casa_construcao')

    print(f"\nFound {len(lots)} lots:")
    for i, lot in enumerate(lots[:10], 1):
        print(f"\n{i}. {lot.title[:60]}")
        print(f"   Category: {lot.category}")
        print(f"   Price: {lot.current_bid}")
        print(f"   Image: {lot.image_url[:60] if lot.image_url else 'N/A'}")
        print(f"   URL: {lot.edict_url[:60]}")
        print(f"   Risk Score: {lot.risk_score}")

    if len(lots) > 10:
        print(f"\n... and {len(lots) - 10} more lots")

    print("\n" + "=" * 80)
    return len(lots)


if __name__ == '__main__':
    test_kwara_scraper()
