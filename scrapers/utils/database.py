"""
Supabase Database Integration
Handles inserting scraped lots into the database
"""

import os
from typing import List, Dict
from dataclasses import asdict
from datetime import datetime
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database operations for scraped lots"""

    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        )

    def insert_lots(self, lots: List[Dict]) -> int:
        """
        Insert or update lots in the database
        Returns the number of lots inserted/updated
        """
        if not lots:
            return 0

        try:
            # For now, use simple insert (upsert requires unique constraint)
            # TODO: Add unique constraint on (title, auctioneer, closing_at) and use upsert
            result = self.supabase.table('lots').insert(lots).execute()

            logger.info(f"Inserted {len(lots)} lots")

            return len(lots)
        except Exception as e:
            logger.error(f"Error inserting lots: {e}")
            raise

    def save_lot(self, lot_data: Dict) -> bool:
        """
        Save or update a single lot in the database
        Uses upsert based on title + auctioneer + closing_at to avoid duplicates
        """
        try:
            # Prepare data with timestamps
            now = datetime.utcnow().isoformat()
            lot_data['updated_at'] = now

            # Check if lot already exists
            existing = self.supabase.table('lots').select('id').eq('title', lot_data['title']).eq('auctioneer', lot_data['auctioneer']).execute()

            if existing.data and len(existing.data) > 0:
                # Update existing lot
                logger.debug(f"Updating existing lot: {lot_data['title']}")
                result = self.supabase.table('lots').update(lot_data).eq('id', existing.data[0]['id']).execute()
            else:
                # Insert new lot
                logger.debug(f"Inserting new lot: {lot_data['title']}")
                lot_data['created_at'] = now
                result = self.supabase.table('lots').insert(lot_data).execute()

            return True

        except Exception as e:
            logger.error(f"Error saving lot {lot_data.get('title', 'Unknown')}: {e}")
            return False

    def mark_auctioneer_inactive(self, auctioneer: str):
        """
        Mark lots from an auctioneer as inactive if they've closed
        """
        try:
            result = self.supabase.table('lots').update({
                'status': 'closed'
            }).eq('auctioneer', auctioneer).lt('closing_at', datetime.now().isoformat()).execute()

            logger.info(f"Marked inactive lots for {auctioneer}")
        except Exception as e:
            logger.error(f"Error marking inactive lots: {e}")

    def get_scraped_count(self, auctioneer: str, days: int = 1) -> int:
        """Get count of lots scraped in the last N days"""
        try:
            since = datetime.now().timestamp() - (days * 24 * 60 * 60)
            since_iso = datetime.fromtimestamp(since).isoformat()

            result = self.supabase.table('lots').select('*', count='exact').eq(
                'auctioneer', auctioneer
            ).gte('created_at', since_iso).execute()

            return result.count if result.count else 0
        except Exception as e:
            logger.error(f"Error getting scraped count: {e}")
            return 0

    def log_scraper_run(self, auctioneer: str, lots_count: int, status: str, error: str = None):
        """Log scraper execution for monitoring"""
        try:
            self.supabase.table('scraper_logs').insert({
                'auctioneer': auctioneer,
                'lots_count': lots_count,
                'status': status,
                'error': error,
                'ran_at': datetime.now().isoformat(),
            }).execute()
        except Exception as e:
            logger.error(f"Error logging scraper run: {e}")
