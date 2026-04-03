"""
Kwara scraper - Homepage approach
Based on comprehensive test, homepage has 80+ potential product cards
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re
import logging
from typing import List, Optional

from base import BaseScraper, AuctionLot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KwaraScraper(BaseScraper):
    """Scraper for Kwara - scraping from homepage"""

    def __init__(self, proxy_manager=None):
        super().__init__(
            base_url='https://www.kwara.com.br',
            proxy_manager=proxy_manager,
            delay_range=(3, 7)
        )

    def scrape_lots(self) -> List[AuctionLot]:
        """Scrape lots from Kwara homepage"""
        logger.info("Starting Kwara scraper (homepage approach)")

        lots = []

        try:
            # Fetch homepage
            logger.info(f"Fetching homepage: {self.base_url}")
            html = self.fetch_page(self.base_url)

            if not html:
                logger.error("Failed to fetch homepage")
                return []

            soup = self.parse_html(html)

            # Extract all divs with images and links (potential product cards)
            all_divs = soup.find_all('div')
            potential_lots = []

            logger.info(f"Analyzing {len(all_divs)} div elements...")

            for div in all_divs:
                try:
                    # Must have an image
                    img = div.find('img')
                    if not img:
                        continue

                    # Must have a link
                    link = div.find('a', href=True)
                    if not link:
                        continue

                    # Get link URL
                    href = link.get('href')

                    # Skip navigation and non-product links
                    skip_patterns = [
                        '/categorias', '/busca', 'javascript', '#',
                        'como-funciona', 'indique-ganhe', 'privacidade',
                        'termos', 'typeform', 'whatsapp.com', 'facebook.com',
                        'instagram.com', 'linkedin.com', 'tiktok.com'
                    ]

                    if any(skip in href.lower() for skip in skip_patterns):
                        continue

                    # Get text content
                    text = div.get_text(strip=True)

                    # Filter for meaningful product content
                    if len(text) < 20:
                        continue

                    # Skip if it's just navigation
                    nav_keywords = ['menu', 'nav', 'footer', 'header', 'logo', 'icone']
                    if any(kw in text.lower() for kw in nav_keywords):
                        continue

                    # Skip if it's banner text
                    if 'desconto de até 90%' in text.lower():
                        continue

                    # Extract title from link or text
                    title = link.get_text(strip=True) or text.split('\n')[0]
                    title = title[:100]  # Limit length

                    if len(title) < 10:
                        continue

                    # Extract image URL
                    img_src = img.get('src') or img.get('data-src')
                    if img_src and not img_src.startswith('http'):
                        img_src = urljoin(self.base_url, img_src)

                    # Skip logo images
                    if img_src and 'logo' in img_src.lower():
                        continue

                    # Try to find price in the div
                    price_elem = div.find(['span', 'div', 'p', 'strong'],
                                       string=re.compile(r'R?\$\s*\d+'))
                    price = None
                    if price_elem:
                        price_text = price_elem.get_text(strip=True)
                        price = self.extract_price(price_text)

                    # Create lot object
                    lot = AuctionLot(
                        title=title,
                        auctioneer='Kwara',
                        category=self._guess_category(title),
                        description=text[:200] if len(text) > 100 else None,
                        current_bid=price,
                        image_url=img_src,
                        edict_url=urljoin(self.base_url, href),
                        risk_score='medium'
                    )

                    # Calculate risk score
                    lot.risk_score = self.calculate_risk_score(lot)

                    potential_lots.append(lot)

                except Exception as e:
                    logger.debug(f"Error processing div: {e}")
                    continue

            # Remove duplicates
            seen = set()
            unique_lots = []
            for lot in potential_lots:
                # Use title + URL as unique key
                key = f"{lot.title}_{lot.edict_url}"
                if key not in seen:
                    seen.add(key)
                    unique_lots.append(lot)

            logger.info(f"Found {len(unique_lots)} unique lots")
            return unique_lots

        except Exception as e:
            logger.error(f"Error scraping Kwara: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _guess_category(self, title: str) -> str:
        """Guess category from title"""
        text = title.lower()

        # Construction materials
        if any(word in text for word in ['cimento', 'tijolo', 'telha', 'piso',
                                          'construção', 'parede', 'porta', 'janela',
                                          'tinta', 'argamassa', 'areia', 'brita']):
            return 'materiais'

        # Industrial/equipment
        if any(word in text for word in ['máquina', 'equipamento', 'ferramenta',
                                          'gerador', 'compressor', 'betoneira',
                                          'usina', 'rolo', 'vibrador']):
            return 'materiais'

        # Metals
        if any(word in text for word in ['ferro', 'aço', 'metal', 'cobre',
                                          'alumínio', 'chapa', 'tubo', 'perfil']):
            return 'metais'

        # Electronics
        if any(word in text for word in ['celular', 'computador', 'notebook',
                                          'televisão', 'eletrônico', 'tablet']):
            return 'eletronicos'

        # Vehicles
        if any(word in text for word in ['carro', 'moto', 'caminhão', 'veículo',
                                          'ônibus', 'trator']):
            return 'veiculos'

        # Furniture
        if any(word in text for word in ['mesa', 'cadeira', 'sofá', 'estante',
                                          'armário', 'cama', 'guarda-roupa']):
            return 'moveis'

        return 'outros'


def test_kwara_scraper():
    """Test the Kwara scraper"""
    print("Testing Kwara Scraper (Homepage Approach)...")
    print("=" * 80)

    scraper = KwaraScraper()
    lots = scraper.scrape_lots()

    print(f"\nFound {len(lots)} lots:")
    for i, lot in enumerate(lots[:15], 1):
        print(f"\n{i}. {lot.title}")
        print(f"   Category: {lot.category}")
        print(f"   Price: {lot.current_bid}")
        print(f"   Risk: {lot.risk_score}")
        if lot.image_url:
            print(f"   Image: {lot.image_url[:70]}")
        if lot.edict_url:
            print(f"   URL: {lot.edict_url[:70]}")

    if len(lots) > 15:
        print(f"\n... and {len(lots) - 15} more lots")

    # Count by category
    category_counts = {}
    for lot in lots:
        category_counts[lot.category] = category_counts.get(lot.category, 0) + 1

    print(f"\nCategory breakdown:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    print("\n" + "=" * 80)
    return len(lots)


if __name__ == '__main__':
    test_kwara_scraper()
