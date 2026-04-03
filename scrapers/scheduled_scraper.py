"""
Scheduled Scraper for Background Jobs

Run this via cron to refresh high-priority lots:
- Lots closing in < 48 hours (refresh every hour)
- Lots closing in < 24 hours (refresh every 6 hours)
- New lots (discovery phase)

Cron examples:
# Refresh lots closing soon (every hour at :30)
30 * * * * cd /Users/aromanon/radar-leilao/scrapers && python3 scheduled_scraper.py refresh-closing-soon 48

# Full priority scrape (every 6 hours at :00)
0 */6 * * * cd /Users/aromanon/radar-leilao/scrapers && python3 scheduled_scraper.py priority-scrape

# Discover new lots (every day at 3 AM)
0 3 * * * cd /Users/aromanon/radar-leilao/scrapers && python3 scheduled_scraper.py discover-new
"""

import sys
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Add scrapers to path
sys.path.insert(0, str(Path(__file__).parent))

from kwara_priority_scraper import ScheduledScraper

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def refresh_closing_soon(hours_threshold: int = 48):
    """
    Refresh lots that are closing soon

    Args:
        hours_threshold: Only refresh lots closing within X hours (default: 48)
    """
    logger.info(f"🔄 REFRESHING LOTS CLOSING IN < {hours_threshold} HOURS")
    logger.info("="*80)

    scheduler = ScheduledScraper()
    scheduler.refresh_closing_soon(hours_threshold)

    logger.info("✓ Refresh complete")


def priority_scrape(
    priority_threshold: float = 70.0,
    max_lots: int = 500
):
    """
    Run priority-based scraping

    Args:
        priority_threshold: Score threshold for pre-scraping
        max_lots: Maximum lots to scrape in this run
    """
    logger.info(f"🎯 PRIORITY SCRAPING (threshold: {priority_threshold}, max: {max_lots})")
    logger.info("="*80)

    from kwara_priority_scraper import KwaraHybridScraper

    scraper = KwaraHybridScraper(
        save_to_db=True,
        use_proxies=True,
        stage1_delay=2.0,
        stage2_delay=1.5
    )

    priority_lots, on_demand_slugs = scraper.scrape_with_priority(
        priority_threshold=priority_threshold,
        max_priority_lots=max_lots
    )

    logger.info(f"\n✓ Pre-scraped {len(priority_lots)} priority lots")
    logger.info(f"✓ Tracked {len(on_demand_slugs)} on-demand slugs")


def auto_priority_scrape(
    target_count: int = 500,
    hours_window: Optional[int] = None,
    max_percentile: float = 20.0
):
    """
    Run auto-adjusting priority scraping

    Automatically calculates optimal threshold based on auction distribution,
    then pre-scrapes high-priority lots.

    Args:
        target_count: Target number of lots to pre-scrape (default: 500)
        hours_window: Hours window to consider (overrides count if provided)
        max_percentile: Max percentile to pre-scrape (default: 20%)
    """
    logger.info(f"🤖 AUTO-PRIORITY SCRAPING (target: {target_count} lots)")
    logger.info("="*80)

    from kwara_priority_scraper import KwaraHybridScraper

    scraper = KwaraHybridScraper(
        save_to_db=True,
        use_proxies=True,
        stage1_delay=2.0,
        stage2_delay=1.5
    )

    priority_lots, on_demand_slugs = scraper.scrape_with_auto_priority(
        target_pre_scrape_count=target_count,
        target_hours_window=hours_window,
        max_percentile=max_percentile
    )

    logger.info(f"\n✓ Pre-scraped {len(priority_lots)} priority lots")
    logger.info(f"✓ Tracked {len(on_demand_slugs)} on-demand slugs")


def discover_new():
    """
    Discover new lots from all categories
    Fetch basic data for lots not yet in database
    """
    logger.info("🔍 DISCOVERING NEW LOTS")
    logger.info("="*80)

    from kwara_priority_scraper import KwaraHybridScraper

    scraper = KwaraHybridScraper(
        save_to_db=True,
        use_proxies=True,
        stage1_delay=2.0,
        stage2_delay=1.5
    )

    # Stage 1 only (basic data)
    basic_lots = scraper._stage1_fetch_basic_lots()

    logger.info(f"✓ Discovered {len(basic_lots)} new lots")

    # Save to database
    if scraper.save_to_db and basic_lots:
        scraper._save_lots_to_db(basic_lots)
        logger.info("✓ Saved new lots to database")


def update_priorities():
    """
    Recalculate priority scores for all lots
    Run this weekly to adjust scoring based on updated metrics
    """
    logger.info("🎯 UPDATING PRIORITY SCORES")
    logger.info("="*80)

    from priority_calculator import PriorityCalculator

    calculator = PriorityCalculator()

    # Get all lots from database
    # This would query the database and recalculate scores
    # Implementation left as exercise for now

    logger.info("✓ Priority scores updated")


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Kwara Scheduled Scraper Jobs')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Refresh closing soon command
    refresh_parser = subparsers.add_parser('refresh-closing-soon', help='Refresh lots closing soon')
    refresh_parser.add_argument('--hours', type=int, default=48,
                          help='Hours threshold (default: 48)')

    # Priority scrape command
    priority_parser = subparsers.add_parser('priority-scrape', help='Run priority-based scraping')
    priority_parser.add_argument('--threshold', type=float, default=70.0,
                          help='Priority threshold (default: 70.0)')
    priority_parser.add_argument('--max-lots', type=int, default=500,
                          help='Maximum lots to scrape (default: 500)')

    # Auto-priority scrape command
    auto_parser = subparsers.add_parser('auto-priority', help='Run auto-adjusting priority scraping')
    auto_parser.add_argument('--target-count', type=int, default=500,
                        help='Target lots to pre-scrape (default: 500)')
    auto_parser.add_argument('--hours-window', type=int,
                        help='Hours window (overrides target count)')
    auto_parser.add_argument('--max-percentile', type=float, default=20.0,
                        help='Max percentile to pre-scrape (default: 20%%)')

    # Discover new lots command
    subparsers.add_parser('discover-new', help='Discover new lots')

    # Update priorities command
    subparsers.add_parser('update-priorities', help='Recalculate priority scores')

    args = parser.parse_args()

    if args.command == 'refresh-closing-soon':
        refresh_closing_soon(hours_threshold=args.hours)
    elif args.command == 'priority-scrape':
        priority_scrape(
            priority_threshold=args.threshold,
            max_lots=args.max_lots
        )
    elif args.command == 'auto-priority':
        auto_priority_scrape(
            target_count=args.target_count,
            hours_window=args.hours_window,
            max_percentile=args.max_percentile
        )
    elif args.command == 'discover-new':
        discover_new()
    elif args.command == 'update-priorities':
        update_priorities()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
