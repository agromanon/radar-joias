"""
Price Refresh Strategy - Keep bidding data fresh

Challenge: Can't poll 13,000+ lots continuously
Solution: Tiered refresh strategy based on urgency

Strategy:
1. HOT (closing <6h): Refresh every 15 minutes
2. WARM (closing 6-48h): Refresh every 2 hours
3. COLD (closing >48h): On-demand only
4. CLOSED: Fetch final price once

Benefits:
- Always fresh data for urgent auctions
- Minimal server load for cold auctions
- Cost-effective
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from supabase_manager import SupabaseManager
from kwara_two_stage_scraper import KwaraTwoStageScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PriceRefreshScheduler:
    """Intelligent price refresh scheduler"""

    def __init__(self):
        self.db = SupabaseManager()
        self.scraper = KwaraTwoStageScraper(save_to_db=True, use_proxies=False)

    def refresh_hot_lots(self, hours_threshold: int = 6):
        """
        Refresh lots closing soon (highest priority)

        Args:
            hours_threshold: Hours threshold (default: 6)
        """
        logger.info(f"🔥 REFRESHING HOT LOTS (closing < {hours_threshold}h)")
        logger.info("="*80)

        cutoff = datetime.now() + timedelta(hours=hours_threshold)

        # Get hot lots
        hot_lots = self.db.query(
            """
            SELECT slug, title, current_bid, closing_at
            FROM lots
            WHERE closing_at < ?
              AND closing_at > NOW()
              AND scrape_stage = 'detailed'
            ORDER BY closing_at ASC
            LIMIT 100
            """,
            (cutoff,)
        )

        if not hot_lots:
            logger.info("✓ No hot lots to refresh")
            return

        logger.info(f"Found {len(hot_lots)} hot lots")

        # Refresh each lot
        refreshed = 0
        for lot in hot_lots:
            try:
                logger.info(f"Refreshing: {lot['title'][:50]}...")

                # Fetch updated data from Kwara
                updated_lot = self._fetch_lot_details(lot['slug'])

                if updated_lot and updated_lot.get('bids_count') != lot.get('bids_count'):
                    # Bid count changed - update database
                    self.db.execute(
                        """
                        UPDATE lots
                        SET current_bid = ?,
                            bids_count = ?,
                            views = ?,
                            last_scraped_at = NOW()
                        WHERE slug = ?
                        """,
                        (updated_lot.get('current_bid'),
                         updated_lot.get('bids_count'),
                         updated_lot.get('views'),
                         lot['slug'])
                    )
                    logger.info(f"  ✓ Updated: {lot['current_bid']} → {updated_lot.get('current_bid')}")
                    refreshed += 1
                else:
                    logger.info(f"  - No change")

            except Exception as e:
                logger.error(f"Failed to refresh {lot['slug']}: {e}")
                continue

        logger.info(f"✓ Refreshed {refreshed}/{len(hot_lots)} lots")

    def refresh_warm_lots(self, min_hours: int = 6, max_hours: int = 48):
        """
        Refresh moderately urgent lots

        Args:
            min_hours: Minimum hours until closing
            max_hours: Maximum hours until closing
        """
        logger.info(f"♨️  REFRESHING WARM LOTS ({min_hours}-{max_hours}h window)")
        logger.info("="*80)

        min_cutoff = datetime.now() + timedelta(hours=min_hours)
        max_cutoff = datetime.now() + timedelta(hours=max_hours)

        # Get warm lots
        warm_lots = self.db.query(
            """
            SELECT slug, title, current_bid, closing_at
            FROM lots
            WHERE closing_at >= ? AND closing_at < ?
              AND closing_at > NOW()
              AND scrape_stage = 'detailed'
            ORDER BY closing_at ASC
            LIMIT 500
            """,
            (min_cutoff, max_cutoff)
        )

        if not warm_lots:
            logger.info("✓ No warm lots to refresh")
            return

        logger.info(f"Found {len(warm_lots)} warm lots")

        # Refresh with longer delay (less urgent)
        refreshed = 0
        for lot in warm_lots[:100]:  # Limit to 100 per run
            try:
                logger.info(f"Refreshing: {lot['title'][:50]}...")

                updated_lot = self._fetch_lot_details(lot['slug'])

                if updated_lot:
                    self.db.execute(
                        """
                        UPDATE lots
                        SET current_bid = ?,
                            bids_count = ?,
                            last_scraped_at = NOW()
                        WHERE slug = ?
                        """,
                        (updated_lot.get('current_bid'),
                         updated_lot.get('bids_count'),
                         lot['slug'])
                    )
                    refreshed += 1

            except Exception as e:
                logger.error(f"Failed to refresh {lot['slug']}: {e}")
                continue

        logger.info(f"✓ Refreshed {refreshed}/{len(warm_lots)} lots")

    def capture_final_prices(self):
        """
        Capture final/winning bids for recently closed auctions

        Strategy: Check lots that closed recently OR should have closed
        Handles dynamic auction extensions (hot disputes extend time)
        """
        logger.info("💰 CAPTURING FINAL PRICES FOR CLOSED AUCTIONS")
        logger.info("="*80)

        # Find lots that "should have closed" but we haven't confirmed yet
        # Window: 2-12 hours after scheduled closing (handles extensions)
        start_window = datetime.now() - timedelta(hours=12)
        end_window = datetime.now() - timedelta(hours=2)

        potentially_closed = self.db.query(
            """
            SELECT slug, title, current_bid, closing_at
            FROM lots
            WHERE closing_at >= ? AND closing_at < ?
              AND status IS NULL
              AND scrape_stage = 'detailed'
            ORDER BY closing_at DESC
            """,
            (start_window, end_window)
        )

        if not potentially_closed:
            logger.info("✓ No potentially closed lots found")
            return

        logger.info(f"Found {len(potentially_closed)} lots to check for closure")

        captured = 0
        still_active = 0
        for lot in potentially_closed:
            try:
                logger.info(f"Checking: {lot['title'][:50]}...")

                # Fetch from Kwara to see ACTUAL status
                updated_lot = self._fetch_lot_details(lot['slug'])

                if updated_lot:
                    # Check if auction has a status field from Kwara
                    auction_status = updated_lot.get('status')

                    if auction_status == 'closed':
                        # Auction is definitely closed
                        final_price = updated_lot.get('current_bid') or lot['current_bid']

                        self.db.execute(
                            """
                            UPDATE lots
                            SET status = 'closed',
                                final_bid = ?,
                                last_scraped_at = NOW()
                            WHERE slug = ?
                            """,
                            (final_price, lot['slug'])
                        )

                        logger.info(f"  ✓ CLOSED - Final price: R$ {final_price:,.2f}")
                        captured += 1

                    elif auction_status == 'active':
                        # Auction still running (was extended!)
                        new_closing_at = updated_lot.get('closing_at')
                        new_bid = updated_lot.get('current_bid')

                        self.db.execute(
                            """
                            UPDATE lots
                            SET closing_at = ?,
                                current_bid = ?,
                                last_scraped_at = NOW()
                            WHERE slug = ?
                            """,
                            (new_closing_at, new_bid, lot['slug'])
                        )

                        logger.info(f"  ⏳ STILL ACTIVE - Extended to {new_closing_at}")
                        still_active += 1

                    else:
                        # No status field - check if bids increased recently
                        # If current bid > stored bid significantly, auction is active
                        current_bid = updated_lot.get('current_bid', 0)
                        stored_bid = lot.get('current_bid', 0)

                        if current_bid > stored_bid:
                            # Auction still active with higher bid
                            self.db.execute(
                                """
                                UPDATE lots
                                SET current_bid = ?,
                                    last_scraped_at = NOW()
                                WHERE slug = ?
                                """,
                                (current_bid, lot['slug'])
                            )

                            logger.info(f"  ⏳ STILL ACTIVE - New bid: R$ {current_bid:,.2f}")
                            still_active += 1
                        else:
                            # Assume closed (no status field, no new bids)
                            self.db.execute(
                                """
                                UPDATE lots
                                SET status = 'closed',
                                    final_bid = ?,
                                    last_scraped_at = NOW()
                                WHERE slug = ?
                                """,
                                (current_bid, lot['slug'])
                            )

                            logger.info(f"  ✓ ASSUMED CLOSED - Final price: R$ {current_bid:,.2f}")
                            captured += 1

            except Exception as e:
                logger.error(f"Failed to check {lot['slug']}: {e}")
                continue

        logger.info(f"✓ Captured: {captured} closed, {still_active} still active (extended)")

    def refresh_hot_disputes(self, minutes_threshold: int = 30):
        """
        Aggressively refresh lots in the "hot dispute" window (last 30 minutes)

        This handles dynamic auction extensions - when there are last-minute bids,
        Kwara extends the auction time. We need to poll frequently here.

        Args:
            minutes_threshold: Minutes until closing (default: 30)
        """
        logger.info(f"🔥🔥 MONITORING HOT DISPUTES (closing < {minutes_threshold} min)")
        logger.info("="*80)

        cutoff = datetime.now() + timedelta(minutes=minutes_threshold)

        # Get lots in hot dispute window
        hot_dispute_lots = self.db.query(
            """
            SELECT slug, title, current_bid, closing_at
            FROM lots
            WHERE closing_at < ?
              AND closing_at > NOW()
              AND scrape_stage = 'detailed'
            ORDER BY closing_at ASC
            LIMIT 50
            """,
            (cutoff,)
        )

        if not hot_dispute_lots:
            logger.info("✓ No lots in hot dispute window")
            return

        logger.info(f"Found {len(hot_dispute_lots)} lots in hot dispute")

        refreshed = 0
        extended = 0
        for lot in hot_dispute_lots:
            try:
                logger.info(f"Checking: {lot['title'][:50]}...")

                updated_lot = self._fetch_lot_details(lot['slug'])

                if updated_lot:
                    old_closing = lot['closing_at']
                    new_closing = updated_lot.get('closing_at')

                    # Check if auction was extended
                    if new_closing and new_closing > old_closing:
                        logger.info(f"  ⚠️ AUCTION EXTENDED! {old_closing} → {new_closing}")
                        extended += 1

                    # Update with latest data
                    self.db.execute(
                        """
                        UPDATE lots
                        SET current_bid = ?,
                            bids_count = ?,
                            views = ?,
                            closing_at = ?,
                            last_scraped_at = NOW()
                        WHERE slug = ?
                        """,
                        (updated_lot.get('current_bid'),
                         updated_lot.get('bids_count'),
                         updated_lot.get('views'),
                         new_closing or lot['closing_at'],
                         lot['slug'])
                    )

                    logger.info(f"  ✓ Updated: R$ {updated_lot.get('current_bid'):,.2f}")
                    refreshed += 1

                # Minimal delay for hot auctions (every 30 seconds)
                import time
                time.sleep(0.5)

            except Exception as e:
                logger.error(f"Failed to refresh {lot['slug']}: {e}")
                continue

        logger.info(f"✓ Refreshed {refreshed} lots, {extended} were extended")

    def _fetch_lot_details(self, slug: str) -> Dict:
        """Fetch lot details from Kwara API"""
        try:
            import requests

            build_id = '9cYkevqRi1YyTe6cMTdam'
            url = f"https://www.kwara.com.br/_next/data/{build_id}/bens/{slug}.json"

            response = requests.get(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (compatible; RadarLeilao-Bot/1.0)',
                    'Accept': '*/*',
                    'x-nextjs-data': '1'
                },
                timeout=30
            )
            response.raise_for_status()

            data = response.json()
            lot_details = data.get('pageProps', {}).get('lotDetails', {})

            # Extract auction settings
            auction_settings = lot_details.get('lotAuctionSettings', [{}])[0] if lot_details.get('lotAuctionSettings') else {}

            # Map to database schema
            return {
                'current_bid': auction_settings.get('currentBidCents', 0) / 100 if auction_settings.get('currentBidCents') else None,
                'bids_count': lot_details.get('cachedBidsCount', 0),
                'views': lot_details.get('views', 0),
                'status': auction_settings.get('status') or lot_details.get('status'),  # Try both locations
                'closing_at': auction_settings.get('auctionEndsAt') or lot_details.get('closingAt')  # Get dynamic closing time
            }

        except Exception as e:
            logger.error(f"Failed to fetch {slug}: {e}")
            return None


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Price Refresh Scheduler')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Hot lots refresh
    hot_parser = subparsers.add_parser('refresh-hot', help='Refresh hot lots')
    hot_parser.add_argument('--hours', type=int, default=6,
                      help='Hours threshold (default: 6)')

    # Warm lots refresh
    warm_parser = subparsers.add_parser('refresh-warm', help='Refresh warm lots')
    warm_parser.add_argument('--min', type=int, default=6,
                      help='Min hours (default: 6)')
    warm_parser.add_argument('--max', type=int, default=48,
                      help='Max hours (default: 48)')

    # Hot disputes monitoring (NEW - aggressive refresh for last 30 min)
    disputes_parser = subparsers.add_parser('monitor-disputes', help='Monitor hot disputes (last 30 min)')
    disputes_parser.add_argument('--minutes', type=int, default=30,
                          help='Minutes threshold (default: 30)')

    # Capture final prices
    subparsers.add_parser('capture-final', help='Capture final prices for closed auctions')

    args = parser.parse_args()

    scheduler = PriceRefreshScheduler()

    if args.command == 'refresh-hot':
        scheduler.refresh_hot_lots(hours_threshold=args.hours)
    elif args.command == 'refresh-warm':
        scheduler.refresh_warm_lots(min_hours=args.min, max_hours=args.max)
    elif args.command == 'monitor-disputes':
        scheduler.refresh_hot_disputes(minutes_threshold=args.minutes)
    elif args.command == 'capture-final':
        scheduler.capture_final_prices()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
