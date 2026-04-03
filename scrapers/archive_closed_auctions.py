"""
Archive Closed Auctions - Move closed lots to archive table

Strategy:
1. Move lots closed > 30 days ago to 'lots_archived' table
2. Keep recent closed lots (0-30 days) in main table for price intel
3. Update closed auctions with final bid status
4. Run weekly via cron

Benefits:
- Main table stays lean (fast queries)
- Historical data preserved (market intel)
- Cost-efficient (archive storage cheaper)
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict
import os
import sys
from pathlib import Path

# Add scrapers to path
sys.path.insert(0, str(Path(__file__).parent))
from supabase_manager import SupabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AuctionArchiver:
    """Archive closed auctions and update final prices"""

    def __init__(self):
        self.db = SupabaseManager()

    def archive_old_closed_auctions(self, days_threshold: int = 30):
        """
        Archive auctions closed > N days ago

        Args:
            days_threshold: Age in days (default: 30)
        """
        logger.info(f"📦 ARCHIVING AUCTIONS CLOSED > {days_threshold} DAYS AGO")
        logger.info("="*80)

        cutoff_date = datetime.now() - timedelta(days=days_threshold)

        # Find lots to archive
        lots_to_archive = self.db.query(
            """
            SELECT slug, title, current_bid, closing_at, last_scraped_at
            FROM lots
            WHERE closing_at < ?
              AND scrape_stage = 'detailed'
            ORDER BY closing_at ASC
            """,
            (cutoff_date,)
        )

        if not lots_to_archive:
            logger.info("✓ No lots to archive")
            return

        logger.info(f"Found {len(lots_to_archive)} lots to archive")

        # Create archive table if not exists
        self._create_archive_table()

        # Copy to archive
        archived_count = 0
        for lot in lots_to_archive:
            try:
                self.db.execute(
                    """
                    INSERT INTO lots_archived
                    (slug, title, current_bid, closing_at, last_scraped_at, archived_at, lot_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (slug) DO UPDATE SET
                        lot_data = EXCLUDED.lot_data,
                        archived_at = EXCLUDED.archived_at
                    """,
                    (lot['slug'], lot['title'], lot['current_bid'],
                     lot['closing_at'], lot['last_scraped_at'], datetime.now(),
                     str(lot))  # Store full lot data as JSON
                )
                archived_count += 1

                if archived_count % 100 == 0:
                    logger.info(f"  Progress: {archived_count}/{len(lots_to_archive)}")

            except Exception as e:
                logger.error(f"Failed to archive {lot['slug']}: {e}")
                continue

        logger.info(f"✓ Archived {archived_count} lots")

        # Delete from main table
        logger.info("🗑️  Deleting archived lots from main table...")
        deleted = self.db.execute(
            """
            DELETE FROM lots
            WHERE closing_at < ?
              AND scrape_stage = 'detailed'
            """,
            (cutoff_date,)
        )

        logger.info(f"✓ Deleted {deleted} lots from main table")

    def update_closed_auctions_final_price(self):
        """
        Update closed auctions with final/winning bid

        Strategy: Check lots that closed in last 24 hours
        Fetch their final status and update database
        """
        logger.info("💰 UPDATING FINAL PRICES FOR CLOSED AUCTIONS")
        logger.info("="*80)

        # Find recently closed lots (last 24 hours)
        recently_closed = self.db.query(
            """
            SELECT slug, title, current_bid, closing_at
            FROM lots
            WHERE closing_at >= NOW() - INTERVAL '24 hours'
              AND closing_at < NOW()
              AND current_bid IS NOT NULL
            ORDER BY closing_at DESC
            """
        )

        if not recently_closed:
            logger.info("✓ No recently closed lots to update")
            return

        logger.info(f"Found {len(recently_closed)} recently closed lots")

        # For each lot, fetch final status from Kwara
        updated_count = 0
        for lot in recently_closed:
            try:
                # TODO: Implement fetch from Kwara API to get final bid
                # This would check if auction is closed and get final price
                logger.info(f"Checking final price for {lot['title'][:50]}...")

                # For now, mark as "closed_awaiting_final_price"
                self.db.execute(
                    """
                    UPDATE lots
                    SET status = 'closed_awaiting_final_price',
                        last_scraped_at = NOW()
                    WHERE slug = ?
                    """,
                    (lot['slug'],)
                )
                updated_count += 1

            except Exception as e:
                logger.error(f"Failed to update {lot['slug']}: {e}")
                continue

        logger.info(f"✓ Updated {updated_count} lots")

    def get_market_intel(self, category: str = None, limit: int = 100):
        """
        Get market intelligence from archived auctions

        Args:
            category: Filter by category (optional)
            limit: Max results (default: 100)

        Returns:
            List of closed auctions with final prices
        """
        logger.info(f"📊 FETCHING MARKET INTEL (category: {category or 'all'})")

        if category:
            results = self.db.query(
                """
                SELECT title, current_bid as final_price, closing_at, category
                FROM lots_archived
                WHERE category = ?
                ORDER BY closing_at DESC
                LIMIT ?
                """,
                (category, limit)
            )
        else:
            results = self.db.query(
                """
                SELECT title, current_bid as final_price, closing_at, category
                FROM lots_archived
                ORDER BY closing_at DESC
                LIMIT ?
                """,
                (limit,)
            )

        logger.info(f"✓ Found {len(results)} historical auctions")
        return results

    def _create_archive_table(self):
        """Create archive table if not exists"""
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS lots_archived (
                id BIGSERIAL PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                title TEXT,
                current_bid NUMERIC(15,2),
                final_bid NUMERIC(15,2),
                closing_at TIMESTAMP WITH TIME ZONE,
                category TEXT,
                location_city TEXT,
                location_state TEXT,
                archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                lot_data JSONB,

                INDEX idx_closing_at (closing_at),
                INDEX idx_category (category),
                INDEX idx_archived_at (archived_at)
            );
        """)


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Archive Closed Auctions')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Archive command
    archive_parser = subparsers.add_parser('archive', help='Archive old closed auctions')
    archive_parser.add_argument('--days', type=int, default=30,
                          help='Archive threshold in days (default: 30)')

    # Update final prices command
    subparsers.add_parser('update-final-prices', help='Update final prices for closed auctions')

    # Market intel command
    intel_parser = subparsers.add_parser('market-intel', help='Get market intelligence')
    intel_parser.add_argument('--category', type=str,
                        help='Filter by category')
    intel_parser.add_argument('--limit', type=int, default=100,
                        help='Max results (default: 100)')

    args = parser.parse_args()

    archiver = AuctionArchiver()

    if args.command == 'archive':
        archiver.archive_old_closed_auctions(days_threshold=args.days)
    elif args.command == 'update-final-prices':
        archiver.update_closed_auctions_final_price()
    elif args.command == 'market-intel':
        intel = archiver.get_market_intel(
            category=args.category,
            limit=args.limit
        )
        for item in intel:
            print(f"{item['title'][:50]}... R$ {item['final_price']:,.2f}")
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
