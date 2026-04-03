"""
Kwara Leilões Scraper
Scrapes construction and industrial materials from kwara.com.br
"""

import logging
from typing import List
from datetime import datetime
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin

from base import BaseScraper, AuctionLot

logger = logging.getLogger(__name__)


class KwaraScraper(BaseScraper):
    """Scraper for Kwara Leilões"""

    def __init__(self, proxy_manager=None):
        # Kwara doesn't have a simple listings page - we'll need to navigate their site
        super().__init__(
            base_url='https://www.kwara.com.br',
            proxy_manager=proxy_manager,
            delay_range=(3, 7)  # Conservative delays
        )

    def scrape_lots(self) -> List[AuctionLot]:
        """Scrape all available lots from Kwara"""
        logger.info("Starting Kwara scraper...")

        lots = []

        try:
            # Kwara uses a different approach - they have auction pages
            # We'll need to find their auctions and then scrape lots from each
            auction_urls = self._get_auction_urls()

            for auction_url in auction_urls:
                logger.info(f"Scraping auction: {auction_url}")
                auction_lots = self._scrape_auction_lots(auction_url)
                lots.extend(auction_lots)

            logger.info(f"Found {len(lots)} lots from Kwara")
            return lots

        except Exception as e:
            logger.error(f"Error scraping Kwara: {e}")
            raise

    def _get_auction_urls(self) -> List[str]:
        """Get URLs of active auctions"""
        # This is a placeholder - you'll need to inspect Kwara's actual website
        # to find where they list their auctions
        logger.info("Fetching auction list...")

        # Common patterns for Brazilian auction sites:
        # - /leiloes (auctions list)
        # - /leilao (current auction)
        # - /lotes (lots list)

        auction_urls = []

        try:
            # Try common auction listing pages
            possible_paths = [
                '/leiloes',
                '/leiloes-em-andamento',
                '/leilao',
                '/lotes',
                '/produtos'
            ]

            for path in possible_paths:
                url = urljoin(self.base_url, path)
                try:
                    html = self.fetch_page(url)
                    soup = self.parse_html(html)

                    # Look for auction links or lot cards
                    # This will need customization based on actual HTML structure
                    links = soup.find_all('a', href=re.compile(r'leilao|lote|produto'))

                    if links:
                        logger.info(f"Found {len(links)} potential links on {path}")
                        auction_urls.extend([urljoin(self.base_url, link.get('href')) for link in links[:10]])  # Limit for testing
                        break  # Use first successful page

                except Exception as e:
                    logger.debug(f"Path {path} not found: {e}")
                    continue

            # Remove duplicates
            auction_urls = list(set(auction_urls))
            logger.info(f"Found {len(auction_urls)} unique auction URLs")

            # If no auctions found, return a sample URL for testing
            if not auction_urls:
                logger.warning("No auction URLs found, using sample URL")
                auction_urls = [self.base_url]

        except Exception as e:
            logger.error(f"Error getting auction URLs: {e}")

        return auction_urls

    def _scrape_auction_lots(self, auction_url: str) -> List[AuctionLot]:
        """Scrape lots from a single auction page"""
        lots = []

        try:
            html = self.fetch_page(auction_url)
            soup = self.parse_html(html)

            # Look for lot cards or list items
            # This is a generic implementation - customize based on actual HTML
            lot_containers = soup.find_all(['div', 'article', 'li'], class_=re.compile(r'lot|item|card|produto', re.I))

            if not lot_containers:
                # Try finding by common patterns
                lot_containers = soup.find_all('div', class_=re.compile(r'col-|span|box', re.I))

            logger.info(f"Found {len(lot_containers)} potential lot containers")

            for container in lot_containers[:20]:  # Limit to 20 lots per auction for testing
                try:
                    lot = self._parse_lot_container(container, auction_url)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.debug(f"Error parsing lot: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error scraping auction {auction_url}: {e}")

        return lots

    def _parse_lot_container(self, container, auction_url: str) -> AuctionLot:
        """Parse a lot container HTML into an AuctionLot object"""

        # Extract title (try multiple selectors)
        title_elem = (
            container.find(['h2', 'h3', 'h4']) or
            container.find('span', class_=re.compile(r'title|name', re.I)) or
            container.find('a', class_=re.compile(r'title|name', re.I))
        )
        title = title_elem.get_text(strip=True) if title_elem else None

        if not title or len(title) < 5:  # Filter out invalid titles
            return None

        # Extract price
        price_elem = (
            container.find(['span', 'div', 'p'], class_=re.compile(r'price|valor|bid|lance', re.I)) or
            container.find(['strong', 'b'])
        )
        price_text = price_elem.get_text(strip=True) if price_elem else None
        current_bid = self.extract_price(price_text) if price_text else None

        # Extract image
        img_elem = container.find('img')
        image_url = None
        if img_elem:
            image_url = img_elem.get('src') or img_elem.get('data-src')
            if image_url and not image_url.startswith('http'):
                image_url = urljoin(self.base_url, image_url)

        # Extract description
        desc_elem = (
            container.find(['p', 'div'], class_=re.compile(r'desc|detail', re.I)) or
            container.find('span', class_=re.compile(r'descricao', re.I))
        )
        description = desc_elem.get_text(strip=True) if desc_elem else None

        # Extract category (guess from title or description)
        category = self._guess_category(title, description)

        # Create lot object
        lot = AuctionLot(
            title=title,
            auctioneer='Kwara',
            category=category,
            description=description,
            current_bid=current_bid,
            image_url=image_url,
            edict_url=auction_url,  # Use auction URL as edict URL
            risk_score='medium'  # Will be calculated by BaseScraper
        )

        # Calculate actual risk score
        lot.risk_score = self.calculate_risk_score(lot)

        return lot

    def _guess_category(self, title: str, description: str) -> str:
        """Guess category from title and description text"""
        text = f"{title} {description or ''}".lower()

        # Industrial and construction materials
        if any(word in text for word in ['máquina', 'equipamento', 'caminhão', 'trator', 'escavadeira',
                                            'empilhadeira', 'gerador', 'compressor', 'rolo',
                                            'betoneira', 'misturador', 'usina', 'sistema']):
            return 'materiais'

        # Metals
        if any(word in text for word in ['ferro', 'aço', 'metal', 'cobre', 'alumínio', 'chapa']):
            return 'metais'

        # Construction
        if any(word in text for word in ['construção', 'cimento', 'tijolo', 'bloco', 'telha',
                                          'piso', 'revestimento']):
            return 'construção'

        # Default
        return 'outros'


def run_kwara_scraper(proxy_manager=None) -> int:
    """Entry point for Kwara scraper"""
    scraper = KwaraScraper(proxy_manager=proxy_manager)
    lots = scraper.scrape_lots()

    # Save to database
    if lots:
        from utils.database import DatabaseManager
        db = DatabaseManager()

        saved_count = 0
        for lot in lots:
            try:
                db.save_lot(lot.to_dict())
                saved_count += 1
            except Exception as e:
                logger.error(f"Error saving lot {lot.title}: {e}")

        logger.info(f"Saved {saved_count}/{len(lots)} lots to database")
        return saved_count

    return 0


if __name__ == '__main__':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Test without proxy
    count = run_kwara_scraper()
    print(f"Scraped {count} lots from Kwara")
