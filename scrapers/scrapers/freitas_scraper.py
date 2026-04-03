"""
Freitas Leilões Scraper
Scrapes auction lots from Freitas leiloeiro
Focus: Industrial equipment, construction materials
"""

from typing import List
from datetime import datetime
import re
from ..base import BaseScraper, AuctionLot
from ..utils.database import DatabaseManager


class FreitasScraper(BaseScraper):
    """Scraper for Freitas Leilões"""

    def __init__(self):
        super().__init__("https://www.leiloesfreitas.com.br")

    def scrape_lots(self) -> List[AuctionLot]:
        """Scrape active auction lots"""
        logger.info("Starting Freitas scraper")

        lots = []

        try:
            # Fetch auctions listing page
            html = self.fetch_page(f"{self.base_url}/leiloes")
            soup = self.parse_html(html)

            # Find auction items
            auction_items = soup.find_all('div', class_='item-leilao')

            for item in auction_items:
                try:
                    lot = self._parse_auction_item(item)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.error(f"Error parsing auction item: {e}")
                    continue

            logger.info(f"Scraped {len(lots)} lots from Freitas")
            return lots

        except Exception as e:
            logger.error(f"Error scraping Freitas: {e}")
            return []

    def _parse_auction_item(self, item) -> AuctionLot:
        """Parse individual auction item"""

        # Extract title
        title_elem = item.find('h4', class_='titulo-lote')
        title = title_elem.get_text(strip=True) if title_elem else "Sem título"

        # Extract category
        category_elem = item.find('span', class_='categoria')
        category = category_elem.get_text(strip=True) if category_elem else "materiais"

        # Normalize category
        category = self._normalize_category(category, title)

        # Extract description
        desc_elem = item.find('div', class_='descricao')
        description = desc_elem.get_text(strip=True) if desc_elem else None

        # Extract prices
        price_elem = item.find('span', class_='valor-atual')
        current_bid = self.extract_price(price_elem.get_text(strip=True)) if price_elem else None

        # Extract location
        location_elem = item.find('span', class_='localizacao')
        location = location_elem.get_text(strip=True) if location_elem else None

        # Extract image
        img_elem = item.find('img')
        image_url = img_elem.get('src') or img_elem.get('data-src') if img_elem else None

        # Extract closing date
        date_elem = item.find('div', class_='data-encerramento')
        closing_at = None
        if date_elem:
            date_str = date_elem.get_text(strip=True)
            closing_at = self._parse_date(date_str)

        # Extract edict URL
        link_elem = item.find('a', class_='btn-detalhes')
        edict_url = link_elem.get('href') if link_elem else None
        if edict_url and not edict_url.startswith('http'):
            edict_url = f"{self.base_url}{edict_url}"

        # Create lot object
        lot = AuctionLot(
            title=title,
            auctioneer="Freitas",
            category=category,
            description=description,
            current_bid=current_bid,
            location=location,
            image_url=image_url,
            edict_url=edict_url,
            closing_at=closing_at,
        )

        # Calculate risk score
        lot.risk_score = self.calculate_risk_score(lot)

        return lot

    def _normalize_category(self, category: str, title: str) -> str:
        """Normalize category to focus on materials/equipment"""
        category_lower = category.lower()
        title_lower = title.lower()

        # Skip if it's real estate or vehicles
        skip_keywords = ['imovel', 'veiculo', 'carro', 'apartamento', 'casa', 'terreno', 'moto']
        if any(keyword in category_lower or keyword in title_lower for keyword in skip_keywords):
            return None

        # Categorize materials
        materials_keywords = {
            'construcao civil': ['cimento', 'areia', 'brita', 'vara', 'coluna', 'viga'],
            'metais': ['aço', 'ferro', 'cobre', 'aluminio', 'chapa', 'tubo', 'barra'],
            'equipamentos': ['maquina', 'equipamento', 'gerador', 'compressor', 'betoneira'],
            'usinas': ['moinho', 'britador', 'peneira', 'triturador', 'misturador'],
        }

        for material_type, keywords in materials_keywords.items():
            if any(keyword in title_lower for keyword in keywords):
                return material_type

        return 'materiais'

    def _parse_date(self, date_str: str) -> datetime:
        """Parse date string to datetime object"""
        formats = [
            '%d/%m/%Y %H:%M',
            '%d/%m/%Y',
            '%Y-%m-%d %H:%M:%S',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        logger.warning(f"Could not parse date: {date_str}")
        return None


def run_freitas_scraper():
    """Run the Freitas scraper and save to database"""
    scraper = FreitasScraper()
    db = DatabaseManager()

    try:
        lots = scraper.scrape_lots()
        lots_data = [lot.to_dict() for lot in lots if lot.category is not None]

        if lots_data:
            count = db.insert_lots(lots_data)
            db.log_scraper_run('Freitas', count, 'success')
            return count
        else:
            db.log_scraper_run('Freitas', 0, 'success', 'No lots found')
            return 0
    except Exception as e:
        db.log_scraper_run('Freitas', 0, 'error', str(e))
        raise


if __name__ == '__main__':
    run_freitas_scraper()
