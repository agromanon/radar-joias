"""
Sodré Leilões Scraper
Scrapes auction lots from Sodré leiloeiro
Focus: Construction materials, industrial equipment, metals
"""

from typing import List
from datetime import datetime
import re
from ..base import BaseScraper, AuctionLot
from ..utils.database import DatabaseManager


class SodreScraper(BaseScraper):
    """Scraper for Sodré Leilões"""

    def __init__(self):
        super().__init__("https://www.leiloessodre.com.br")

    def scrape_lots(self) -> List[AuctionLot]:
        """Scrape active auction lots"""
        logger.info("Starting Sodré scraper")

        lots = []

        try:
            # Fetch auctions listing page
            html = self.fetch_page(f"{self.base_url}/leiloes")
            soup = self.parse_html(html)

            # Find auction cards
            auction_cards = soup.find_all('div', class_='auction-card')

            for card in auction_cards:
                try:
                    lot = self._parse_auction_card(card)
                    if lot:
                        lots.append(lot)
                except Exception as e:
                    logger.error(f"Error parsing auction card: {e}")
                    continue

            logger.info(f"Scraped {len(lots)} lots from Sodré")
            return lots

        except Exception as e:
            logger.error(f"Error scraping Sodré: {e}")
            return []

    def _parse_auction_card(self, card) -> AuctionLot:
        """Parse individual auction card"""

        # Extract title
        title_elem = card.find('h3', class_='auction-title')
        title = title_elem.get_text(strip=True) if title_elem else "Sem título"

        # Extract category from badges
        category_elem = card.find('span', class_='category-badge')
        category = category_elem.get_text(strip=True) if category_elem else "materiais"

        # Normalize category to focus on materials
        category = self._normalize_category(category, title)

        # Extract description
        desc_elem = card.find('p', class_='description')
        description = desc_elem.get_text(strip=True) if desc_elem else None

        # Extract prices
        price_elem = card.find('span', class_='current-bid')
        current_bid = self.extract_price(price_elem.get_text(strip=True)) if price_elem else None

        estimated_elem = card.find('span', class_='estimated-value')
        estimated_value = self.extract_price(estimated_elem.get_text(strip=True)) if estimated_elem else None

        # Extract location
        location_elem = card.find('span', class_='location')
        location = location_elem.get_text(strip=True) if location_elem else None

        # Extract image
        img_elem = card.find('img')
        image_url = img_elem.get('src') or img_elem.get('data-src') if img_elem else None

        # Extract closing date
        date_elem = card.find('span', class_='closing-date')
        closing_at = None
        if date_elem:
            date_str = date_elem.get_text(strip=True)
            closing_at = self._parse_date(date_str)

        # Extract edict URL
        link_elem = card.find('a', class_='auction-link')
        edict_url = link_elem.get('href') if link_elem else None
        if edict_url and not edict_url.startswith('http'):
            edict_url = f"{self.base_url}{edict_url}"

        # Create lot object
        lot = AuctionLot(
            title=title,
            auctioneer="Sodré",
            category=category,
            description=description,
            current_bid=current_bid,
            estimated_value=estimated_value,
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
        skip_keywords = ['imovel', 'veiculo', 'carro', 'apartamento', 'casa', 'terreno']
        if any(keyword in category_lower or keyword in title_lower for keyword in skip_keywords):
            return None

        # Categorize materials
        materials_keywords = {
            'construcao civil': ['cimento', 'areia', 'brita', 'tijolo', 'telha', 'aço', 'ferro'],
            'metais': ['cobre', 'alumínio', 'chapa', 'tubo', 'perfil', 'estrutura'],
            'maquinas': ['maquina', 'equipamento', 'trator', 'caminhao', 'britador', 'moinho'],
            'siderurgico': ['bobina', 'chapa', 'vergalhao', 'barra', 'fio', 'cabo'],
        }

        for material_type, keywords in materials_keywords.items():
            if any(keyword in title_lower for keyword in keywords):
                return material_type

        # Default category if no specific match
        return 'materiais'

    def _parse_date(self, date_str: str) -> datetime:
        """Parse date string to datetime object"""
        # Handle various date formats
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


def run_sodre_scraper():
    """Run the Sodré scraper and save to database"""
    scraper = SodreScraper()
    db = DatabaseManager()

    try:
        lots = scraper.scrape_lots()
        lots_data = [lot.to_dict() for lot in lots if lot.category is not None]

        if lots_data:
            count = db.insert_lots(lots_data)
            db.log_scraper_run('Sodré', count, 'success')
            return count
        else:
            db.log_scraper_run('Sodré', 0, 'success', 'No lots found')
            return 0
    except Exception as e:
        db.log_scraper_run('Sodré', 0, 'error', str(e))
        raise


if __name__ == '__main__':
    run_sodre_scraper()
