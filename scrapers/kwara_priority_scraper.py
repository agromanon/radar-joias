"""
Kwara Priority-Based Scraper with Hybrid Architecture
- Priority lots: Pre-scraped based on closing time + popularity
- Long-tail lots: On-demand fetch when user views
- Smart scheduling: Background jobs prioritize high-value lots
"""

import requests
import json
import logging
import os
import time
import random
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from dotenv import load_dotenv
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('kwara_priority_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()

# Import base classes
try:
    from kwara_two_stage_scraper import AuctionLot, KwaraTwoStageScraper, ProxyConfig
except ImportError:
    logger.warning("Could not import base classes, using standalone definitions")
    # Define AuctionLot here if needed
    pass


@dataclass
class ScrapingPriority:
    """Priority score for scraping a lot"""
    lot: AuctionLot
    score: float
    reason: str  # Why this priority was assigned

    def __post_init__(self):
        if not self.reason:
            self.reason = "Unknown"


class PriorityCalculator:
    """Calculate priority scores for lots"""

    def __init__(self):
        # Priority weights (sum = 100)
        self.weight_closing_soon = 50  # Most important
        self.weight_popular = 25
        self.weight_recent = 15
        self.weight_high_value = 10

    def calculate_auto_threshold(
        self,
        lots: List[AuctionLot],
        target_pre_scrape_count: int = 500,
        target_hours_window: Optional[int] = None,
        max_percentile: float = 20.0
    ) -> float:
        """
        Automatically calculate optimal priority threshold based on auction distribution

        Strategy: Analyze the lots and choose threshold to capture:
        1. Top X lots by urgency (target_pre_scrape_count), OR
        2. Lots closing within X hours (target_hours_window), OR
        3. Top Y percentile by urgency (max_percentile)

        Args:
            lots: List of lots to analyze
            target_pre_scrape_count: Target number of lots to pre-scrape (default: 500)
            target_hours_window: Hours window to consider (overrides count if provided)
            max_percentile: Max percentile to pre-scrape (default: 20% = top 20%)

        Returns:
            Optimal priority threshold (0-100)
        """
        logger.info("\n🔍 AUTO-ADJUSTING THRESHOLD...")
        logger.info("="*80)

        # Filter lots with closing dates
        lots_with_closing = [lot for lot in lots if lot.closing_at]

        if not lots_with_closing:
            logger.warning("  ⚠ No lots with closing dates - using default threshold 70.0")
            return 70.0

        # Sort by closing time (soonest first)
        lots_with_closing.sort(key=lambda lot: lot.closing_at)

        # Use timezone-aware datetime (same as closing_at)
        from datetime import timezone
        now = datetime.now(timezone.utc)

        # Strategy 1: Hours window (if provided)
        if target_hours_window:
            cutoff = now + timedelta(hours=target_hours_window)
            lots_in_window = [lot for lot in lots_with_closing if lot.closing_at <= cutoff]

            if lots_in_window:
                # Calculate priority scores for lots in window
                scores_in_window = []
                for lot in lots_in_window:
                    priority = self.calculate_priority(lot)
                    scores_in_window.append(priority.score)

                # Set threshold to minimum score in window
                auto_threshold = min(scores_in_window) if scores_in_window else 70.0

                logger.info(f"  📅 Time Window Strategy:")
                logger.info(f"     → Target: {target_hours_window}h window")
                logger.info(f"     → Lots in window: {len(lots_in_window)}")
                logger.info(f"     → Auto threshold: {auto_threshold:.1f}")

                return auto_threshold

        # Strategy 2: Target count (default)
        if len(lots_with_closing) > target_pre_scrape_count:
            # Get closing time of the target_count-th lot
            target_lot = lots_with_closing[target_pre_scrape_count - 1]
            hours_to_target = (target_lot.closing_at - now).total_seconds() / 3600

            # Calculate priority score for this target lot
            target_priority = self.calculate_priority(target_lot)

            logger.info(f"  🎯 Target Count Strategy:")
            logger.info(f"     → Target: {target_pre_scrape_count} lots")
            logger.info(f"     → {target_pre_scrape_count}th lot closes in: {hours_to_target:.1f}h")
            logger.info(f"     → Auto threshold: {target_priority.score:.1f}")

            return target_priority.score

        # Strategy 3: Percentile (fallback)
        percentile_index = int(len(lots_with_closing) * (max_percentile / 100))
        if percentile_index > 0:
            target_lot = lots_with_closing[percentile_index]
            target_priority = self.calculate_priority(target_lot)

            logger.info(f"  📊 Percentile Strategy:")
            logger.info(f"     → Target: Top {max_percentile}%")
            logger.info(f"     → Index: {percentile_index}/{len(lots_with_closing)}")
            logger.info(f"     → Auto threshold: {target_priority.score:.1f}")

            return target_priority.score

        # Fallback: Default threshold
        logger.info(f"  📋 Using default threshold: 70.0")
        return 70.0

    def calculate_priority(self, lot: AuctionLot) -> ScrapingPriority:
        """
        Calculate priority score (0-100)

        Higher score = should be scraped first
        """
        score = 0.0
        reasons = []

        # 1. Closing Soon (MOST IMPORTANT)
        if lot.closing_at:
            from datetime import timezone
            now = datetime.now(timezone.utc)
            hours_until_closing = (lot.closing_at - now).total_seconds() / 3600

            if hours_until_closing < 24:  # Closes in 24 hours
                urgency = max(0, (24 - hours_until_closing) / 24)  # 0-1
                score += urgency * self.weight_closing_soon
                reasons.append(f"Closes in {hours_until_closing:.1f}h")

            elif hours_until_closing < 48:  # Closes in 48 hours
                urgency = max(0, (48 - hours_until_closing) / 48)  # 0-1
                score += urgency * self.weight_closing_soon * 0.5
                reasons.append(f"Closes in {hours_until_closing:.1f}h")

            elif hours_until_closing < 72:  # Closes in 3 days
                score += self.weight_closing_soon * 0.2
                reasons.append(f"Closes in {hours_until_closing:.1f}h")

        # 2. Popular (high view count)
        if lot.views > 100:
            popularity = min(lot.views / 1000, 1.0)  # Cap at 1000 views
            score += popularity * self.weight_popular
            reasons.append(f"{lot.views} views")

        # 3. Recent (created in last 7 days)
        # Note: This would require lot.created_at field
        # Skipping for now as not in current schema

        # 4. High Value (expensive items)
        if lot.current_bid and lot.current_bid > 10000:  # > R$ 10k
            score += self.weight_high_value
            reasons.append(f"High value: R$ {lot.current_bid:,.0f}")

        return ScrapingPriority(
            lot=lot,
            score=score,
            reason="; ".join(reasons) if reasons else "Low priority"
        )


class KwaraHybridScraper(KwaraTwoStageScraper):
    """
    Hybrid scraper with priority-based scraping

    Strategy:
    1. Stage 1: Fetch all lots (basic data)
    2. Calculate priority scores
    3. Stage 2a: Pre-scrape high-priority lots (>70 score)
    4. Stage 2b: On-demand for remaining lots
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.priority_calculator = PriorityCalculator()

    def scrape_with_priority(
        self,
        priority_threshold: float = 70.0,
        max_priority_lots: Optional[int] = None,
        on_demand_remaining: bool = False
    ) -> Tuple[List[AuctionLot], List[str]]:
        """
        Scrape lots with priority-based approach

        Args:
            priority_threshold: Score above which to pre-scrape (default: 70)
            max_priority_lots: Max number of high-priority lots to scrape
            on_demand_remaining: Fetch extended fields for remaining lots too

        Returns:
            (priority_lots, on_demand_slugs)
        """
        logger.info("="*80)
        logger.info("KWARA HYBRID SCRAPER - PRIORITY BASED")
        logger.info("="*80)

        start_time = time.time()

        # Stage 1: Fetch all basic lots
        logger.info("\n📋 STAGE 1: Fetching all lots (basic data)...")
        basic_lots = self._stage1_fetch_basic_lots(max_lots=None)

        if not basic_lots:
            logger.error("No lots found - aborting")
            return [], []

        logger.info(f"✓ Stage 1 complete: {len(basic_lots)} lots fetched")

        # Save basic lots to database
        if self.save_to_db:
            self._save_lots_to_db(basic_lots)
            logger.info("✓ Basic lots saved to database")

        # Calculate priorities
        logger.info(f"\n🎯 CALCULATING PRIORITIES for {len(basic_lots)} lots...")
        priority_lots = []

        for lot in basic_lots:
            try:
                priority = self.priority_calculator.calculate_priority(lot)
                if priority.score >= priority_threshold:
                    priority.lot.scrape_stage = 'detailed'  # Will be after fetch
                    priority_lots.append(priority)
            except Exception as e:
                logger.debug(f"Error calculating priority: {e}")
                continue

        # Sort by priority (highest first)
        priority_lots.sort(key=lambda p: p.score, reverse=True)

        logger.info(f"✓ Found {len(priority_lots)} high-priority lots (score >= {priority_threshold})")

        # Log priority distribution
        self._log_priority_distribution(priority_lots)

        # Stage 2a: Pre-scrape high-priority lots
        if max_priority_lots:
            priority_lots = priority_lots[:max_priority_lots]
            logger.info(f"\n🚀 STAGE 2a: Pre-scraping top {len(priority_lots)} priority lots...")
        else:
            logger.info(f"\n🚀 STAGE 2a: Pre-scraping all {len(priority_lots)} priority lots...")

        detailed_priority_lots = []
        on_demand_slugs = []

        for i, priority in enumerate(priority_lots, 1):
            try:
                if i % 20 == 0:
                    logger.info(f"  Progress: {i}/{len(priority_lots)} lots ({i/len(priority_lots)*100:.1f}%)")

                # Fetch extended fields
                detailed_lot = self._stage2_fetch_single_lot(priority.lot)

                if detailed_lot:
                    detailed_lot.scrape_stage = 'detailed'
                    detailed_priority_lots.append(detailed_lot)

                # Polite delay
                time.sleep(self.stage2_delay + random.uniform(0.5, 1.5))

            except Exception as e:
                logger.warning(f"Failed to fetch {priority.lot.slug}: {e}")
                # Add to on-demand list
                on_demand_slugs.append(priority.lot.slug)
                continue

        # Save priority lots to database
        if self.save_to_db and detailed_priority_lots:
            self._save_lots_to_db(detailed_priority_lots)
            logger.info(f"✓ Saved {len(detailed_priority_lots)} priority lots to database")

        # Remaining lots (low priority) - just track slugs for on-demand
        for lot in basic_lots:
            if lot.scrape_stage == 'basic':
                on_demand_slugs.append(lot.slug)

        elapsed = time.time() - start_time

        logger.info("\n" + "="*80)
        logger.info("HYBRID SCRAPING COMPLETE!")
        logger.info(f"{'='*80}")
        logger.info(f"Priority lots pre-scraped: {len(detailed_priority_lots)}")
        logger.info(f"On-demand slugs available: {len(on_demand_slugs)}")
        logger.info(f"Time elapsed: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
        logger.info("="*80)

        return detailed_priority_lots, on_demand_slugs

    def scrape_with_auto_priority(
        self,
        target_pre_scrape_count: int = 500,
        target_hours_window: Optional[int] = None,
        max_percentile: float = 20.0,
        on_demand_remaining: bool = False
    ) -> Tuple[List[AuctionLot], List[str]]:
        """
        Scrape lots with auto-adjusting priority threshold

        Automatically calculates optimal threshold based on auction distribution,
        then pre-scrapes high-priority lots.

        Args:
            target_pre_scrape_count: Target number of lots to pre-scrape (default: 500)
            target_hours_window: Hours window to consider (overrides count if provided)
            max_percentile: Max percentile to pre-scrape (default: 20%)
            on_demand_remaining: Fetch extended fields for remaining lots too

        Returns:
            (priority_lots, on_demand_slugs)
        """
        logger.info("="*80)
        logger.info("KWARA HYBRID SCRAPER - AUTO-ADJUSTING PRIORITY")
        logger.info("="*80)

        start_time = time.time()

        # Stage 1: Fetch all basic lots
        logger.info("\n📋 STAGE 1: Fetching all lots (basic data)...")
        basic_lots = self._stage1_fetch_basic_lots(max_lots=None)

        if not basic_lots:
            logger.error("No lots found - aborting")
            return [], []

        logger.info(f"✓ Stage 1 complete: {len(basic_lots)} lots fetched")

        # Save basic lots to database
        if self.save_to_db:
            self._save_lots_to_db(basic_lots)
            logger.info("✓ Basic lots saved to database")

        # Auto-calculate optimal threshold
        auto_threshold = self.priority_calculator.calculate_auto_threshold(
            lots=basic_lots,
            target_pre_scrape_count=target_pre_scrape_count,
            target_hours_window=target_hours_window,
            max_percentile=max_percentile
        )

        logger.info(f"\n🎯 AUTO-ADJUSTED THRESHOLD: {auto_threshold:.1f}")
        logger.info("="*80)

        # Now use this threshold for priority scraping
        return self.scrape_with_priority(
            priority_threshold=auto_threshold,
            max_priority_lots=target_pre_scrape_count,
            on_demand_remaining=on_demand_remaining
        )

    def _stage2_fetch_single_lot(self, lot: AuctionLot) -> Optional[AuctionLot]:
        """Fetch extended fields for a single lot"""
        try:
            # Get proxy
            proxy = self.proxy_config.get_random_proxy() if self.use_proxies else None
            proxies = {'http': proxy, 'https': proxy} if proxy else None

            detail_url = self.detail_api_template.format(
                build_id=self.build_id,
                slug=lot.slug
            )

            response = requests.get(
                detail_url,
                headers=self._get_headers(),
                proxies=proxies,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()
            lot_details = data.get('pageProps', {}).get('lotDetails', {})

            # Enhance lot with extended fields
            detailed_lot = self._enhance_lot_with_details(lot, lot_details)
            return detailed_lot

        except Exception as e:
            logger.warning(f"Failed to fetch details for {lot.slug}: {e}")
            return None

    def _log_priority_distribution(self, priority_lots: List[ScrapingPriority]):
        """Log distribution of priority scores"""
        if not priority_lots:
            return

        # Count by score ranges
        ranges = {
            '90-100': 0,
            '80-89': 0,
            '70-79': 0,
            '60-69': 0,
            '50-59': 0,
            'Below 50': 0
        }

        for priority in priority_lots:
            score = priority.score
            if score >= 90:
                ranges['90-100'] += 1
            elif score >= 80:
                ranges['80-89'] += 1
            elif score >= 70:
                ranges['70-79'] += 1
            elif score >= 60:
                ranges['60-69'] += 1
            elif score >= 50:
                ranges['50-59'] += 1
            else:
                ranges['Below 50'] += 1

        logger.info("Priority Score Distribution:")
        for range_name, count in ranges.items():
            if count > 0:
                logger.info(f"  {range_name}: {count} lots")


class ScheduledScraper:
    """
    Scheduled scraper for background jobs

    Runs periodically to:
    1. Refresh high-priority lots (closing soon)
    2. Pre-scrape new lots
    3. Update stale data
    """

    def __init__(self):
        self.scraper = KwaraHybridScraper(save_to_db=True)

    def refresh_closing_soon(self, hours_threshold: int = 6):
        """
        Refresh lots that are closing soon

        Args:
            hours_threshold: Only refresh lots closing within X hours
        """
        logger.info(f"🔄 Refreshing lots closing in {hours_threshold} hours...")

        # Get lots closing soon from database
        closing_soon = self._get_closing_soon_lots(hours_threshold)

        logger.info(f"Found {len(closing_soon)} lots closing soon")

        # Re-scrape them with priority
        for lot in closing_soon:
            try:
                logger.info(f"Refreshing: {lot.title[:50]}...")
                detailed_lot = self.scraper._stage2_fetch_single_lot(lot)
                if detailed_lot:
                    detailed_lot.scrape_stage = 'detailed'
                    self.scraper.db_manager.save_lot(detailed_lot.to_dict())

                time.sleep(2)  # Polite delay

            except Exception as e:
                logger.error(f"Failed to refresh {lot.slug}: {e}")

        logger.info(f"✓ Refreshed {len(closing_soon)} lots")

    def _get_closing_soon_lots(self, hours: int) -> List[Dict]:
        """Get lots closing soon from database"""
        try:
            cutoff = datetime.now() + timedelta(hours=hours)

            # Query database for lots closing soon
            # This would need to use the database manager
            # For now, return empty list
            logger.warning("Database query not implemented - returning empty list")
            return []

        except Exception as e:
            logger.error(f"Error querying closing soon lots: {e}")
            return []


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Kwara Priority-Based Hybrid Scraper')
    parser.add_argument('--priority-threshold', type=float, default=70.0,
                       help='Priority score threshold for pre-scraping (default: 70)')
    parser.add_argument('--max-priority-lots', type=int,
                       help='Maximum number of priority lots to scrape')
    parser.add_argument('--on-demand', action='store_true',
                       help='Fetch extended fields for all lots (not just priority)')
    parser.add_argument('--test-mode', action='store_true',
                       help='Test mode: scrape 100 lots with priority')
    parser.add_argument('--auto-priority', action='store_true',
                       help='Auto-adjust threshold based on auction distribution')
    parser.add_argument('--target-count', type=int, default=500,
                       help='Target lots to pre-scrape in auto mode (default: 500)')
    parser.add_argument('--hours-window', type=int,
                       help='Hours window for auto mode (overrides count)')
    parser.add_argument('--max-percentile', type=float, default=20.0,
                       help='Max percentile for auto mode (default: 20%%)')

    args = parser.parse_args()

    scraper = KwaraHybridScraper(
        save_to_db=True,
        use_proxies=True,
        stage1_delay=2.0,
        stage2_delay=1.5
    )

    if args.auto_priority:
        logger.info("AUTO-PRIORITY MODE: Adjusting threshold based on auction distribution...")
        priority_lots, on_demand_slugs = scraper.scrape_with_auto_priority(
            target_pre_scrape_count=args.target_count,
            target_hours_window=args.hours_window,
            max_percentile=args.max_percentile,
            on_demand_remaining=args.on_demand
        )
    elif args.test_mode:
        logger.info("TEST MODE: Scraping 100 lots with priority...")
        priority_lots, on_demand_slugs = scraper.scrape_with_priority(
            priority_threshold=args.priority_threshold,
            max_priority_lots=100
        )
    else:
        priority_lots, on_demand_slugs = scraper.scrape_with_priority(
            priority_threshold=args.priority_threshold,
            max_priority_lots=args.max_priority_lots,
            on_demand_remaining=args.on_demand
        )

    print(f"\n{'='*80}")
    print(f"Priority lots pre-scraped: {len(priority_lots)}")
    print(f"On-demand slugs: {len(on_demand_slugs)}")
    print(f"{'='*80}")


if __name__ == '__main__':
    main()
