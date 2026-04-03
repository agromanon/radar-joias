"""
Kwara Authenticated Scraper
Combines API scraping with authenticated web scraping to get full descriptions
"""

import requests
import json
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime
import time
import sys
from pathlib import Path
import random

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from bs4 import BeautifulSoup
from utils.auth_manager import get_auth_manager
from utils.database_http import DatabaseManagerHTTP
from kwara_scraper_final import AuctionLot, KwaraAPIScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KwaraAuthenticatedScraper(KwaraAPIScraper):
    """
    Enhanced scraper that adds authenticated web scraping to fetch full descriptions
    Inherits from KwaraAPIScraper and adds detail page fetching
    """

    def __init__(self, save_to_db: bool = True):
        super().__init__(save_to_db=save_to_db)
        self.auth_manager = get_auth_manager()
        self.base_url = "https://www.kwara.com.br"
        self.detail_fetch_count = 0
        self.detail_success_count = 0

    def _scrape_lot_detail_page(self, source_url: str, slug: str) -> Optional[Dict]:
        """
        Scrape lot detail page with authentication to get full description

        Args:
            source_url: Full URL to the lot detail page
            slug: Lot slug for fallback URL construction

        Returns:
            Dictionary with enhanced data or None if failed
        """
        self.detail_fetch_count += 1

        # Ensure we have a valid URL
        if not source_url:
            source_url = f"{self.base_url}/lote/{slug}"

        logger.info(f"Fetching detail page: {source_url}")

        # Make authenticated request
        response = self.auth_manager.get_authenticated(
            source_url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        )

        if not response or response.status_code != 200:
            logger.warning(f"Failed to fetch detail page: {response.status_code if response else 'No response'}")
            return None

        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')

        enhanced_data = {}

        # Extract full description from multiple sources
        enhanced_data['description'] = self._extract_full_description(soup)

        # Extract additional images
        enhanced_data['images'] = self._extract_images(soup)

        # Extract detailed location info
        enhanced_data['location'] = self._extract_location(soup)

        # Extract additional metadata
        enhanced_data['metadata'] = self._extract_metadata(soup)

        self.detail_success_count += 1
        return enhanced_data

    def _extract_full_description(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract full description from multiple possible locations"""
        # Strategy 1: Meta description tag
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            desc = meta_desc['content'].strip()
            if len(desc) > 100:  # Only use if substantial
                return desc

        # Strategy 2: JSON-LD structured data
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    # Check for description in various JSON-LD fields
                    desc = data.get('description') or data.get('headline')
                    if desc and len(desc) > 100:
                        return desc
            except:
                continue

        # Strategy 3: Main content area
        # Look for common description containers
        desc_selectors = [
            'div.description',
            'div.lot-description',
            'section.description',
            'div[class*="description"]',
            'div[class*="descricao"]',
            'p.description',
            'article p'
        ]

        for selector in desc_selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 50:
                    return text

        # Strategy 4: First substantial paragraph
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text(strip=True)
            if text and len(text) > 100:
                return text

        return None

    def _extract_images(self, soup: BeautifulSoup) -> List[str]:
        """Extract all images from the lot page"""
        images = []

        # Look for image gallery
        img_selectors = [
            'img.lot-image',
            'img.gallery-image',
            'div.gallery img',
            'figure img',
            'img[src*="kwara"]'
        ]

        for selector in img_selectors:
            for img in soup.select(selector):
                src = img.get('src') or img.get('data-src')
                if src:
                    # Convert relative URLs to absolute
                    if src.startswith('/'):
                        src = f"{self.base_url}{src}"
                    elif not src.startswith('http'):
                        src = f"{self.base_url}/{src}"

                    if src not in images:
                        images.append(src)

        return images

    def _extract_location(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract detailed location information"""
        # Look for location in structured data
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    # Check for location in various fields
                    location = data.get('location') or data.get('address')
                    if location:
                        if isinstance(location, dict):
                            return location.get('name') or location.get('streetAddress')
                        return str(location)
            except:
                continue

        # Look for location in page content
        loc_selectors = [
            'span.location',
            'div.location',
            'p.location',
            '[class*="localizacao"]'
        ]

        for selector in loc_selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text(strip=True)

        return None

    def _extract_metadata(self, soup: BeautifulSoup) -> Dict:
        """Extract additional metadata from the page"""
        metadata = {}

        # Extract all JSON-LD data
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    metadata.update(data)
            except:
                continue

        return metadata

    def scrape_lots_with_details(
        self,
        category_ids: Optional[List[str]] = None,
        max_pages: int = 1,
        fetch_details: bool = True,
        delay_between_details: float = 1.0
    ) -> List[AuctionLot]:
        """
        Scrape lots with optional full detail fetching

        Args:
            category_ids: List of category IDs to scrape
            max_pages: Maximum number of pages to scrape per category
            fetch_details: Whether to fetch authenticated detail pages
            delay_between_details: Delay between detail page requests (seconds)

        Returns:
            List of AuctionLot objects
        """
        logger.info("Starting authenticated scraping...")

        # First, scrape lots from API (parent class method)
        lots = super().scrape_lots(category_ids=category_ids, max_pages=max_pages)

        if not lots:
            logger.warning("No lots found from API")
            return []

        # Then, enhance with authenticated detail page data
        if fetch_details:
            logger.info(f"Fetching details for {len(lots)} lots...")

            enhanced_lots = []
            for i, lot in enumerate(lots, 1):
                logger.info(f"Processing lot {i}/{len(lots)}: {lot.title[:50]}...")

                # Fetch detail page data
                detail_data = self._scrape_lot_detail_page(
                    source_url=lot.source_url,
                    slug=lot.source_url.split('/')[-1] if lot.source_url else ''
                )

                if detail_data:
                    # Merge detail data into lot
                    if detail_data.get('description'):
                        lot.description = detail_data['description']
                        logger.info(f"  ✓ Updated description ({len(detail_data['description'])} chars)")

                    if detail_data.get('images'):
                        lot.images = detail_data['images']
                        logger.info(f"  ✓ Found {len(detail_data['images'])} images")

                    if detail_data.get('location'):
                        lot.location = detail_data['location']
                        logger.info(f"  ✓ Location: {detail_data['location']}")

                    if detail_data.get('metadata'):
                        if not lot.metadata:
                            lot.metadata = {}
                        lot.metadata.update(detail_data['metadata'])

                # Add to results
                enhanced_lots.append(lot)

                # Delay to avoid rate limiting
                if i < len(lots):  # Don't delay after last lot
                    sleep_time = delay_between_details + random.uniform(0, 0.5)  # Add jitter
                    time.sleep(sleep_time)

            logger.info(f"Detail fetching complete: {self.detail_success_count}/{self.detail_fetch_count} successful")
            return enhanced_lots

        return lots

    def get_stats(self) -> Dict:
        """Get scraping statistics"""
        stats = super().get_stats() if hasattr(super(), 'get_stats') else {}
        stats.update({
            'detail_fetch_count': self.detail_fetch_count,
            'detail_success_count': self.detail_success_count,
            'auth_stats': self.auth_manager.get_stats()
        })
        return stats


def main():
    """Test the authenticated scraper"""
    print("Testing Kwara Authenticated Scraper")
    print("=" * 80)

    # Create scraper
    scraper = KwaraAuthenticatedScraper(save_to_db=True)

    # Check if auth is available
    auth_stats = scraper.auth_manager.get_stats()
    print(f"\nAuth Status:")
    print(f"  Total Accounts: {auth_stats['total_accounts']}")
    print(f"  Active Accounts: {auth_stats['active_accounts']}")

    if auth_stats['total_accounts'] == 0:
        print("\n⚠️  No authenticated accounts configured.")
        print("   Add accounts to .env:")
        print("   KWARA_ACCOUNT_1_EMAIL=your@email.com")
        print("   KWARA_ACCOUNT_1_PASSWORD=yourpassword")
        print("\n   Scraping will use API-only mode (brief descriptions).")
    else:
        print(f"\n✓ Authenticated scraping enabled!")

    # Scrape with details
    print("\n" + "=" * 80)
    print("Scraping lots with full details...")

    lots = scraper.scrape_lots_with_details(
        category_ids=['1335572015838398043'],  # metais
        max_pages=1,
        fetch_details=True,
        delay_between_details=2.0
    )

    print(f"\n{'=' * 80}")
    print(f"Results:")
    print(f"  Total lots scraped: {len(lots)}")

    if lots:
        lot = lots[0]
        print(f"\nSample lot:")
        print(f"  Title: {lot.title[:80]}...")
        print(f"  Description length: {len(lot.description) if lot.description else 0} chars")
        print(f"  Source URL: {lot.source_url}")
        print(f"  Images: {len(lot.images) if lot.images else 0}")
        print(f"  Location: {lot.location}")

        # Show stats
        stats = scraper.get_stats()
        print(f"\nStats:")
        print(f"  Detail fetch success: {stats['detail_success_count']}/{stats['detail_fetch_count']}")

        # Save to database
        if scraper.db_manager:
            print(f"\nSaving to database...")
            saved = scraper.db_manager.insert_lots([lot.to_dict()])
            print(f"  ✓ Saved {saved} lot")

    print("\n" + "=" * 80)
    print("✓ Authenticated scraper test completed!")


if __name__ == '__main__':
    main()
