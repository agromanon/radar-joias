"""
Main Scraper Entry Point
Runs all scrapers and saves results to database
"""

import os
import logging
from datetime import datetime
from dotenv import load_dotenv

from scrapers.kwara_scraper import run_kwara_scraper
from scrapers.utils.database import DatabaseManager
from scrapers.utils.proxy_manager import create_proxy_manager

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_proxy_manager():
    """
    Setup proxy manager based on environment configuration
    Falls back to direct connection if no proxies configured
    """
    import os

    # Check for paid proxy service
    paid_service = os.getenv('PAID_PROXY_SERVICE')
    if paid_service:
        logger.info(f"Using paid proxy service: {paid_service}")

        paid_config = {}
        if paid_service == 'webshare':
            paid_config['api_key'] = os.getenv('WEBSHARE_API_KEY')
        elif paid_service == 'scraperapi':
            paid_config['api_key'] = os.getenv('SCRAPERAPI_KEY')
        elif paid_service == 'smartproxy':
            paid_config['username'] = os.getenv('SMARTPROXY_USER')
            paid_config['password'] = os.getenv('SMARTPROXY_PASS')
        elif paid_service == 'brightdata':
            paid_config['username'] = os.getenv('BRIGHTDATA_USER')
            paid_config['password'] = os.getenv('BRIGHTDATA_PASS')

        return create_proxy_manager(
            use_free=False,
            use_paid=True,
            paid_service=paid_service,
            paid_config=paid_config
        )

    # Check for manual proxies from PROXY_LIST env var
    if os.getenv('PROXY_LIST'):
        logger.info("Using manual proxies from PROXY_LIST")
        return create_proxy_manager(use_free=True)

    # Use free proxies (not recommended for production)
    use_free = os.getenv('USE_FREE_PROXIES', 'false').lower() == 'true'
    if use_free:
        logger.info("Using free proxies (testing only - unreliable)")
        return create_proxy_manager(use_free=True)

    # No proxy configured
    logger.warning("No proxy configuration found - using direct connections")
    return None


# Available scrapers - starting with Kwara
SCRAPERS = [
    ('Kwara', run_kwara_scraper),
    # Add more auctioneers here:
    # ('Sodré', run_sodre_scraper),
    # ('Freitas', run_freitas_scraper),
    # ('BRADESCO', run_bradesco_scraper),
    # ('CAIXA', run_caixa_scraper),
    # ('Matheus Leilões', run_matheus_scraper),
    # ('GML', run_gml_scraper),
]


def main():
    """Run all scrapers"""
    logger.info("=" * 60)
    logger.info("Starting Radar Leilão scrapers")
    logger.info("=" * 60)

    # Setup proxy manager
    proxy_manager = setup_proxy_manager()
    if proxy_manager:
        proxy_manager.load_proxies()
        # Optional: test proxies (commented out to save time)
        # proxy_manager.test_all_proxies()

    total_lots = 0
    results = {}

    for auctioneer_name, scraper_func in SCRAPERS:
        logger.info(f"\n{'=' * 40}")
        logger.info(f"Running scraper for {auctioneer_name}")
        logger.info(f"{'=' * 40}")

        try:
            # Pass proxy_manager to scraper function
            count = scraper_func(proxy_manager=proxy_manager)
            results[auctioneer_name] = {
                'status': 'success',
                'lots_count': count
            }
            total_lots += count
            logger.info(f"✓ {auctioneer_name}: {count} lots scraped")

        except Exception as e:
            logger.error(f"✗ {auctioneer_name}: Failed with error - {e}")
            results[auctioneer_name] = {
                'status': 'error',
                'error': str(e),
                'lots_count': 0
            }

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("SCRAPER SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total lots scraped: {total_lots}")
    logger.info(f"Successful scrapers: {sum(1 for r in results.values() if r['status'] == 'success')}/{len(results)}")
    logger.info(f"Failed scrapers: {sum(1 for r in results.values() if r['status'] == 'error')}/{len(results)}")

    for auctioneer, result in results.items():
        status_symbol = "✓" if result['status'] == 'success' else "✗"
        lots_info = f"{result['lots_count']} lots" if result['status'] == 'success' else f"Error: {result.get('error', 'Unknown')}"
        logger.info(f"  {status_symbol} {auctioneer}: {lots_info}")

    logger.info("=" * 60)
    logger.info("Scrapers completed")
    logger.info("=" * 60)


if __name__ == '__main__':
    main()
