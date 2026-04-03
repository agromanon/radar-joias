"""
Kwara Scraper - Full Field Extraction
Uses headless browser to extract ALL fields from lot detail pages
"""

import asyncio
import sys
from pathlib import Path
import logging
import json
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌ Playwright not installed. Run:")
    print("   pip install playwright")
    print("   playwright install chromium")
    sys.exit(1)

from bs4 import BeautifulSoup
from kwara_scraper_final import AuctionLot, KwaraAPIScraper
from utils.database_http import DatabaseManagerHTTP
from utils.auth_browser import BrowserAuthManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class CompleteLot:
    """Complete lot data with all fields"""
    # Basic info (from API)
    id: str
    title: str
    slug: str
    auctioneer: str
    category: str

    # Extended fields (from detail page)
    reference: Optional[str] = None  # Referência
    information: Optional[str] = None  # Informações
    description: Optional[str] = None  # Descrição (brief)
    general_observations: Optional[str] = None  # Observações gerais (detailed)
    event: Optional[str] = None  # Evento
    visitation: Optional[str] = None  # Visitação
    withdrawal: Optional[str] = None  # Retirada

    # Additional fields
    current_bid: Optional[float] = None
    images: List[str] = None
    source_url: Optional[str] = None
    closing_at: Optional[str] = None
    risk_score: str = 'MÉDIO'

    def __post_init__(self):
        if self.images is None:
            self.images = []

    def to_dict(self) -> Dict:
        """Convert to dictionary for database storage"""
        data = {
            'title': self.title,
            'auctioneer': self.auctioneer,
            'category': self.category,
            'description': self.description,
            'current_bid': self.current_bid,
            'image_url': self.images[0] if self.images else None,
            'source_url': self.source_url,
            'risk_score': self.risk_score,
            'closing_at': self.closing_at,
        }

        # Store all extended fields in metadata
        metadata = {
            'slug': self.slug,
            'reference': self.reference,
            'information': self.information,
            'general_observations': self.general_observations,
            'event': self.event,
            'visitation': self.visitation,
            'withdrawal': self.withdrawal,
            'images': self.images,
        }

        # Only add non-null fields to metadata
        data['metadata'] = {k: v for k, v in metadata.items() if v}

        return data


class KwaraFullFieldScraper:
    """
    Scraper that extracts ALL fields from Kwara lot pages
    Combines API scraping for lot list with browser scraping for complete details
    """

    def __init__(self, save_to_db: bool = True, authenticate: bool = True):
        self.api_scraper = KwaraAPIScraper(save_to_db=False)
        self.db_manager = DatabaseManagerHTTP() if save_to_db else None
        self.authenticate = authenticate
        self.auth_manager = BrowserAuthManager() if authenticate else None

    async def scrape_lots_complete(
        self,
        category_ids: Optional[List[str]] = None,
        max_pages: int = 1,
        max_lots: int = 5
    ) -> List[CompleteLot]:
        """
        Scrape lots with ALL fields from both API and detail pages

        Args:
            category_ids: List of category IDs to scrape
            max_pages: Maximum pages to scrape per category
            max_lots: Maximum lots to process (for testing)
        """
        logger.info("Starting full field scraping...")

        # First, get lot list from API
        api_lots = self.api_scraper.scrape_lots(
            category_ids=category_ids,
            max_pages=max_pages
        )

        if not api_lots:
            logger.warning("No lots found from API")
            return []

        logger.info(f"Found {len(api_lots)} lots from API, processing {min(len(api_lots), max_lots)} lots...")

        # Then scrape complete details using browser
        complete_lots = []
        playwright_context = None

        # Setup browser (with or without authentication)
        try:
            if self.authenticate and self.auth_manager:
                logger.info("Using authenticated browser...")
                await self.auth_manager.start_browser()

                # Get an authenticated account
                account = self.auth_manager.get_next_account()
                if not account:
                    logger.error("No authenticated accounts available")
                    return []

                # Login and get context
                if not await self.auth_manager.login_account(account):
                    logger.error("Failed to authenticate")
                    return []

                context = self.auth_manager.contexts.get(account.email)
                if not context:
                    logger.error("Failed to get authenticated context")
                    return []

                browser = self.auth_manager.browser

                logger.info(f"Got authenticated context, ready to scrape {len(api_lots[:max_lots])} lots...")

            else:
                logger.info("Using anonymous browser...")
                playwright_context = async_playwright()
                playwright = await playwright_context.__aenter__()

                browser = await playwright.chromium.launch(headless=True)
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                )

            # Now scrape the lots
            logger.info(f"Starting to process {len(api_lots[:max_lots])} lots...")
            for i, api_lot in enumerate(api_lots[:max_lots], 1):
                logger.info(f"Processing lot {i}/{min(len(api_lots), max_lots)}: {api_lot.title[:50]}...")

                # Check if lot has source_url
                if not api_lot.source_url:
                    logger.warning(f"  Lot {i} has no source_url, skipping")
                    continue

                # Extract all fields from detail page
                try:
                    complete_lot = await self.scrape_lot_complete(api_lot, context)
                except Exception as e:
                    logger.error(f"  Error processing lot {i}: {e}")
                    continue

                if complete_lot:
                    complete_lots.append(complete_lot)
                    logger.info(f"  ✓ Extracted {len(complete_lot.images)} images, {len(complete_lot.general_observations or '')} chars of observations")

                    # Save to database if enabled
                    if self.db_manager:
                        saved = self.db_manager.insert_lots([complete_lot.to_dict()])
                        if saved > 0:
                            logger.info(f"  ✓ Saved to database")

        except Exception as e:
            logger.error(f"Error during scraping: {e}")
            import traceback
            traceback.print_exc()

        finally:
            # Cleanup browser
            if self.authenticate and self.auth_manager:
                await self.auth_manager.stop_browser()
            elif playwright_context:
                await playwright_context.__aexit__(None, None, None)
            else:
                await browser.close()

        logger.info(f"✓ Complete! Scraped {len(complete_lots)} lots with full fields")
        return complete_lots

    async def scrape_lot_complete(self, api_lot, context) -> Optional[CompleteLot]:
        """Scrape all fields from a lot detail page"""
        try:
            url = api_lot.source_url
            if not url:
                logger.warning(f"No source_url for lot {api_lot.title[:50]}")
                return None

            # Extract slug from URL
            slug = url.split('/')[-1] if url else ''
            logger.info(f"  Navigating to: {url}")

            page = await context.new_page()

            # Navigate to the page
            await page.goto(url, wait_until='networkidle', timeout=30000)

            # Dismiss login modal if present (even when authenticated)
            try:
                logger.info(f"  Checking for login modal to dismiss...")

                # First, try to find and close any dialog/overlay
                modal_closed = False

                # Strategy 1: Look for close buttons
                close_selectors = [
                    'button[aria-label="Close"]',
                    'button:has-text("Fechar")',
                    'button:has-text("✕")',
                    'button:has-text("×")',
                    'div[role="dialog"] button[aria-label="close"]',
                    '[data-testid="close-button"]',
                    'button[class*="close"]',
                ]

                for selector in close_selectors:
                    try:
                        element = await page.query_selector(selector)
                        if element:
                            await element.click(timeout=2000)
                            logger.info(f"  ✓ Dismissed login modal via close button")
                            modal_closed = True
                            await page.wait_for_timeout(1500)
                            break
                    except:
                        continue

                # Strategy 2: If no close button, try pressing Escape multiple times
                if not modal_closed:
                    try:
                        for _ in range(3):
                            await page.keyboard.press('Escape')
                            await page.wait_for_timeout(500)
                        logger.info(f"  ✓ Pressed Escape to dismiss modal")
                        modal_closed = True
                        await page.wait_for_timeout(1000)
                    except:
                        pass

                # Strategy 3: Try clicking outside the modal (on the overlay)
                if not modal_closed:
                    try:
                        # Click on the overlay background
                        overlay = await page.query_selector('[data-state="open"]')
                        if overlay:
                            # Click at coordinates (0, 0) to click outside
                            await page.mouse.click(100, 100)
                            logger.info(f"  ✓ Clicked outside modal to dismiss")
                            modal_closed = True
                            await page.wait_for_timeout(1000)
                    except:
                        pass

                # Strategy 4: Remove the modal via JavaScript (most aggressive)
                try:
                    await page.evaluate('''() => {
                        // Remove any dialogs or overlays
                        const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
                        dialogs.forEach(d => d.remove());
                        // Remove any overlays
                        const overlays = document.querySelectorAll('[class*="overlay"], [class*="backdrop"]');
                        overlays.forEach(o => o.remove());
                    }''')
                    logger.info(f"  ✓ Removed modal elements via JavaScript")
                    await page.wait_for_timeout(1000)
                except:
                    pass

            except Exception as e:
                logger.debug(f"  No modal to dismiss or error: {e}")

            # Wait for JavaScript to load the content
            logger.info(f"  Waiting for JavaScript content to load...")
            try:
                # Wait for either the content to appear or a timeout
                await page.wait_for_selector('text:is("Informações")', timeout=10000)
                logger.info(f"  ✓ Content loaded")
            except:
                # If content doesn't appear, wait a fixed time anyway
                logger.info(f"  Content not found, waiting anyway...")
                await page.wait_for_timeout(5000)

            # Scroll to load dynamic content and wait for page to stabilize
            try:
                logger.info(f"  Scrolling to load dynamic content...")
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                await page.wait_for_timeout(2000)

                # Scroll back up
                await page.evaluate('window.scrollTo(0, 0)')
                await page.wait_for_timeout(1000)
            except:
                pass

            # Dismiss login modal if it appears
            try:
                # Look for close button or dismiss the login dialog
                close_selectors = [
                    'button[aria-label="Close"]',
                    'button:has-text("Fechar")',
                    'button:has-text("✕")',
                    'div[role="dialog"] button[aria-label="close"]',
                ]

                for selector in close_selectors:
                    try:
                        await page.click(selector, timeout=2000)
                        logger.info(f"  ✓ Dismissed login modal")
                        await page.wait_for_timeout(1000)
                        break
                    except:
                        continue

                # If no close button, try pressing Escape
                await page.keyboard.press('Escape')
                await page.wait_for_timeout(1000)

            except Exception as e:
                logger.debug(f"  No modal to dismiss or error dismissing: {e}")

            # Try scrolling to load dynamic content
            try:
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                await page.wait_for_timeout(2000)

                # Scroll back up
                await page.evaluate('window.scrollTo(0, 0)')
                await page.wait_for_timeout(1000)
            except:
                pass

            # Get page HTML
            html = await page.content()

            # Parse with BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')

            # Extract all fields
            complete_lot = CompleteLot(
                id=slug or '',
                title=api_lot.title,
                slug=slug,
                auctioneer='Kwara',
                category=api_lot.category,
                current_bid=api_lot.current_bid,
                source_url=url,
                images=[]  # Will populate from both sources
            )

            # Extract extended fields
            complete_lot.reference = self._extract_field_by_label(soup, 'Referência')
            complete_lot.information = self._extract_field_by_label(soup, 'Informações')
            complete_lot.description = api_lot.description  # Keep brief description
            complete_lot.general_observations = self._extract_observations_gerais(soup)
            complete_lot.event = self._extract_field_by_label(soup, 'Evento')
            complete_lot.visitation = self._extract_visitation(soup)
            complete_lot.withdrawal = self._extract_withdrawal(soup)

            # Collect images from both API and page
            # Start with images from API (handle both dict and string formats)
            api_images = []
            if api_lot.images:
                for img in api_lot.images:
                    if isinstance(img, dict):
                        # Extract URL from dict
                        url = img.get('url') or img.get('src') or img.get('image_url')
                        if url:
                            api_images.append(url)
                    elif isinstance(img, str):
                        api_images.append(img)

            complete_lot.images = api_images

            # Additional images from page
            page_images = self._extract_images(soup)
            if page_images:
                # Combine without duplicates
                all_images = complete_lot.images + page_images
                complete_lot.images = list(dict.fromkeys(all_images))  # Preserve order, remove duplicates

            await page.close()
            return complete_lot

        except Exception as e:
            logger.error(f"Error scraping lot {api_lot.title[:30]}: {e}")
            return None

    def _extract_field_by_label(self, soup, label_text: str) -> Optional[str]:
        """Extract field content by finding its label"""
        # Modal text patterns to exclude
        modal_patterns = [
            'Que bom te ver de novo',
            'Escolha uma das opções abaixo',
            'Entrar com e-mail',
            'Continuar',
            'Acesso com senha',
            'Criar conta',
        ]

        def is_modal_text(text: str) -> bool:
            """Check if text contains login modal content"""
            return any(pattern.lower() in text.lower() for pattern in modal_patterns)

        # Try multiple strategies to find the field content

        # Strategy 1: Find the label and look for content in the same container
        for tag in ['h1', 'h2', 'h3', 'h4', 'strong', 'b', 'label', 'span']:
            elements = soup.find_all(tag, string=lambda text: text and label_text.lower() in text.lower())
            for label_el in elements:
                # Get parent or next sibling
                parent = label_el.find_parent()
                if parent:
                    # Try to get content after the label
                    content = parent.get_text(separator=' ', strip=True)
                    if content and len(content) > len(label_text):
                        # Return everything after the label
                        parts = content.split(label_text, 1)
                        if len(parts) > 1:
                            extracted = parts[1].strip()
                            if extracted and len(extracted) > 3:
                                # Skip if this is modal text
                                if is_modal_text(extracted):
                                    continue
                                return extracted[:500]  # First 500 chars

        # Strategy 2: Look for div/p/span with specific class patterns
        for selector in [
            f'div[class*="{label_text.lower()}"]',
            f'div[id*="{label_text.lower()}"]',
            f'p[class*="{label_text.lower()}"]',
        ]:
            try:
                element = soup.select_one(selector)
                if element:
                    content = element.get_text(separator=' ', strip=True)
                    if content and len(content) > 10:
                        return content[:500]
            except:
                continue

        # Strategy 3: Search all text and extract context around the label
        all_text = soup.get_text(separator='\n')
        if label_text.lower() in all_text.lower():
            lines = all_text.split('\n')
            for i, line in enumerate(lines):
                if label_text.lower() in line.lower():
                    # Get next few lines as content
                    content_lines = []
                    for j in range(i+1, min(i+10, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and len(next_line) > 3:
                            content_lines.append(next_line)
                        elif content_lines:  # Stop at empty line after getting some content
                            break

                    if content_lines:
                        return ' '.join(content_lines)[:500]

        return None

    def _extract_observations_gerais(self, soup) -> Optional[str]:
        """Extract Observações gerais field (most important)"""
        # Modal text patterns to exclude
        modal_patterns = [
            'Que bom te ver de novo',
            'Escolha uma das opções abaixo',
            'Entrar com e-mail',
            'Continuar',
            'Acesso com senha',
            'Criar conta',
        ]

        def is_modal_text(text: str) -> bool:
            """Check if text contains login modal content"""
            return any(pattern.lower() in text.lower() for pattern in modal_patterns)

        # This is usually the largest text block
        # Try multiple strategies

        # Strategy 1: Look for headers containing "Observações"
        for tag in ['h1', 'h2', 'h3', 'strong']:
            headers = soup.find_all(tag, string=lambda text: text and 'observações' in text.lower())
            for header in headers:
                # Get siblings and parent content
                parent = header.find_parent()
                if parent:
                    # Get all text after this header
                    content = parent.get_text(separator='\n', strip=True)
                    lines = content.split('\n')

                    # Find the header line and get everything after it
                    found_header = False
                    content_lines = []
                    for line in lines:
                        line_stripped = line.strip()
                        if not found_header:
                            if 'observações' in line_stripped.lower():
                                found_header = True
                        else:
                            if line_stripped and len(line_stripped) > 3:
                                content_lines.append(line_stripped)

                    if content_lines:
                        extracted = '\n'.join(content_lines)[:2000]  # First 2000 chars
                        # Skip if this is modal text
                        if not is_modal_text(extracted):
                            return extracted

        # Strategy 2: Look for the largest text block (likely to be observations)
        all_text_blocks = []
        for div in soup.find_all('div'):
            text = div.get_text(strip=True)
            if text and len(text) > 200:  # Only substantial text blocks
                # Skip modal text
                if not is_modal_text(text):
                    all_text_blocks.append((len(text), text))

        if all_text_blocks:
            # Return the largest text block
            largest = max(all_text_blocks, key=lambda x: x[0])
            return largest[1][:2000]

        # Strategy 3: Fallback to general field extraction
        return self._extract_field_by_label(soup, 'Observações')

    def _extract_visitation(self, soup) -> Optional[str]:
        """Extract visitation information"""
        # Look for visitation section
        visit_keywords = ['Visitação', 'visitação', 'agendamento', 'retirada']
        all_text = soup.get_text(separator='\n')

        for keyword in visit_keywords:
            if keyword.lower() in all_text.lower():
                # Try to find the section
                selectors = [
                    f'text:is("{keyword}")',
                    f'div:has-text("{keyword}")',
                ]

                for selector in selectors:
                    try:
                        element = soup.select_one(selector)
                        if element:
                            parent = element.find_parent() or element
                            content = parent.get_text(strip=True)
                            if content and len(content) > 20:
                                return content[:500]  # First 500 chars
                    except:
                        continue
                break

        return None

    def _extract_withdrawal(self, soup) -> Optional[str]:
        """Extract withdrawal/retirada information"""
        # Similar to visitation but looking for withdrawal section
        selectors = [
            'text:is("Retirada")',
            'div:has-text("Retirada")',
            'p:has-text("Retirada")',
        ]

        for selector in selectors:
            try:
                element = soup.select_one(selector)
                if element:
                    parent = element.find_parent() or element
                    content = parent.get_text(strip=True)
                    if content and len(content) > 20:
                        return content[:500]
            except:
                continue

        return None

    def _extract_images(self, soup) -> List[str]:
        """Extract all images from the page"""
        images = []

        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src and 'kwara' in src:
                if src.startswith('/'):
                    src = f"https://www.kwara.com.br{src}"
                images.append(src)

        return images


async def main():
    """Main test function"""
    print("=" * 80)
    print("Kwara Full Field Scraper - Test")
    print("=" * 80)

    scraper = KwaraFullFieldScraper(save_to_db=True, authenticate=True)

    # Scrape a few lots with all fields
    lots = await scraper.scrape_lots_complete(
        category_ids=['1335572015838398043'],  # metais
        max_pages=1,
        max_lots=3  # Test with just 3 lots
    )

    print(f"\n{'=' * 80}")
    print(f"RESULTS:")
    print(f"{'=' * 80}")

    if lots:
        for i, lot in enumerate(lots, 1):
            print(f"\n{i}. {lot.title}")
            print(f"   Reference: {lot.reference}")
            print(f"   Description: {lot.description}")
            print(f"   Observations: {(lot.general_observations or '')[:100]}...")
            print(f"   Event: {lot.event}")
            print(f"   Visitation: {(lot.visitation or '')[:100]}...")
            print(f"   Withdrawal: {(lot.withdrawal or '')[:100]}...")
            print(f"   Images: {len(lot.images)}")
            print(f"   Source: {lot.source_url}")

            # Show the saved dict structure
            print(f"\n   Database structure:")
            dict_data = lot.to_dict()
            print(f"   - metadata.information: {dict_data.get('metadata', {}).get('information', 'N/A')[:80]}")
            print(f"   - metadata.general_observations: {dict_data.get('metadata', {}).get('general_observations', 'N/A')[:80]}")

    print(f"\n{'=' * 80}")
    print(f"✓ Test complete!")


if __name__ == '__main__':
    asyncio.run(main())
