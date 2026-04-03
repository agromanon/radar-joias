"""
Kwara Browser Scraper
Uses headless browser (Playwright) for authenticated scraping
"""

import asyncio
import sys
from pathlib import Path
import logging
from typing import List, Optional

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from bs4 import BeautifulSoup
from utils.auth_browser import get_browser_auth_manager, BrowserAuthManager
from utils.database_http import DatabaseManagerHTTP
from kwara_scraper_final import AuctionLot, KwaraAPIScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KwaraBrowserScraper:
    """
    Scraper that uses headless browser for authenticated access
    Combines API scraping for lot list with browser scraping for details
    """

    def __init__(self, save_to_db: bool = True):
        self.api_scraper = KwaraAPIScraper(save_to_db=save_to_db)
        self.auth_manager = get_browser_auth_manager()
        self.detail_fetch_count = 0
        self.detail_success_count = 0

    def scrape_lots_with_browser_details(
        self,
        category_ids: Optional[List[str]] = None,
        max_pages: int = 1,
        fetch_details: bool = True
    ) -> List[AuctionLot]:
        """
        Scrape lots using browser for detailed information

        Args:
            category_ids: List of category IDs to scrape
            max_pages: Maximum number of pages to scrape per category
            fetch_details: Whether to fetch browser-rendered detail pages

        Returns:
            List of AuctionLot objects
        """
        logger.info("Starting browser-based scraping...")

        # First, scrape lots from API
        lots = self.api_scraper.scrape_lots(
            category_ids=category_ids,
            max_pages=max_pages
        )

        if not lots:
            logger.warning("No lots found from API")
            return []

        # Then, enhance with browser detail page data
        if fetch_details:
            logger.info(f"Fetching details for {len(lots)} lots with browser...")

            # Run async browser scraping
            lots = asyncio.run(self._fetch_details_async(lots))

            logger.info(f"Detail fetching complete: {self.detail_success_count}/{self.detail_fetch_count} successful")

        return lots

    async def _fetch_details_async(self, lots: List[AuctionLot]) -> List[AuctionLot]:
        """Fetch details using async browser operations"""
        enhanced_lots = []

        try:
            for i, lot in enumerate(lots, 1):
                logger.info(f"Processing lot {i}/{len(lots)}: {lot.title[:50]}...")

                # Fetch detail page HTML using browser
                html = await self.auth_manager.make_authenticated_request(lot.source_url)

                if html:
                    # Parse HTML and extract additional data
                    detail_data = self._parse_detail_page(html)

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

                        self.detail_success_count += 1
                else:
                    logger.warning(f"  ✗ Failed to fetch detail page")

                self.detail_fetch_count += 1
                enhanced_lots.append(lot)

                # Small delay between requests to be polite
                if i < len(lots):
                    await asyncio.sleep(1.0)

        finally:
            # Cleanup browser resources
            await self.auth_manager.cleanup()

        return enhanced_lots

    def _parse_detail_page(self, html: str) -> Optional[dict]:
        """Parse HTML from detail page to extract additional data"""
        try:
            soup = BeautifulSoup(html, 'html.parser')

            data = {}

            # Extract full description
            data['description'] = self._extract_description(soup)

            # Extract images
            data['images'] = self._extract_images(soup)

            # Extract location
            data['location'] = self._extract_location(soup)

            return data

        except Exception as e:
            logger.error(f"Error parsing detail page: {e}")
            return None

    def _extract_description(self, soup) -> Optional[str]:
        """Extract full description from HTML"""
        # Try multiple strategies
        strategies = [
            # Meta description
            lambda s: s.find('meta', attrs={'name': 'description'}).get('content') if s.find('meta', attrs={'name': 'description'}) else None,
            # JSON-LD
            lambda s: self._extract_from_json_ld(s, 'description'),
            # Main content
            lambda s: self._extract_from_content(s),
        ]

        for strategy in strategies:
            try:
                result = strategy(soup)
                if result and len(result) > 50:
                    return result.strip()
            except:
                continue

        return None

    def _extract_from_json_ld(self, soup, field: str) -> Optional[str]:
        """Extract data from JSON-LD structured data"""
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    value = data.get(field)
                    if value and len(str(value)) > 50:
                        return str(value)
            except:
                continue
        return None

    def _extract_from_content(self, soup) -> Optional[str]:
        """Extract description from main content area"""
        selectors = [
            'div.description',
            'div.lot-description',
            'section.description',
            'div[class*="description"]',
            'div[class*="descricao"]',
            'article p',
        ]

        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and len(text) > 50:
                    return text

        return None

    def _extract_images(self, soup) -> List[str]:
        """Extract all images from the page"""
        images = []

        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src and 'kwara' in src:
                if src.startswith('/'):
                    src = f"https://www.kwara.com.br{src}"
                if src not in images:
                    images.append(src)

        return images

    def _extract_location(self, soup) -> Optional[str]:
        """Extract location information"""
        # Try JSON-LD first
        location = self._extract_from_json_ld(soup, 'location')
        if location:
            return str(location)

        # Try page content
        selectors = [
            'span.location',
            'div.location',
            'p.location',
            '[class*="localizacao"]',
        ]

        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text(strip=True)

        return None

    def get_stats(self) -> dict:
        """Get scraping statistics"""
        stats = self.auth_manager.get_stats()
        stats.update({
            'detail_fetch_count': self.detail_fetch_count,
            'detail_success_count': self.detail_success_count,
        })
        return stats


async def main_async():
    """Async main function for browser scraper"""
    print("=" * 80)
    print("Kwara Browser Scraper - Test Run")
    print("=" * 80)

    # Check authentication
    auth_manager = get_browser_auth_manager()
    stats = auth_manager.get_stats()

    print(f"\n📊 Authentication Status:")
    print(f"   Total accounts: {stats['total_accounts']}")
    print(f"   Active accounts: {stats['active_accounts']}")

    if stats['total_accounts'] == 0:
        print("\n⚠️  No accounts configured!")
        print("   Add KWARA_ACCOUNT_1_EMAIL and KWARA_ACCOUNT_1_PASSWORD to .env.local")
        return

    # Create scraper
    scraper = KwaraBrowserScraper(save_to_db=False)  # Don't save to DB for test

    # Test login
    print(f"\n🔐 Testing browser login...")
    account = auth_manager.get_next_account()

    if account:
        success = await auth_manager.login_account(account)
        if success:
            print(f"   ✓ Login successful for {account.email}")

            # Test scraping a detail page
            print(f"\n📄 Testing detail page fetch...")
            test_url = "https://www.kwara.com.br/lote/sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"
            html = await auth_manager.make_authenticated_request(test_url)

            if html:
                print(f"   ✓ Fetched page: {len(html)} characters")

                # Parse and show description
                soup = BeautifulSoup(html, 'html.parser')
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                if meta_desc:
                    desc = meta_desc.get('content', '')
                    print(f"   ✓ Description found: {desc[:100]}...")
            else:
                print(f"   ✗ Failed to fetch page")

            # Cleanup
            await auth_manager.cleanup()
        else:
            print(f"   ✗ Login failed")
    else:
        print("   ✗ No accounts available")

    print("\n" + "=" * 80)
    print("✓ Test completed!")
    print("=" * 80)


def main():
    """Main entry point"""
    asyncio.run(main_async())


if __name__ == '__main__':
    main()
