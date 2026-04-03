"""
Supabase Database Integration using HTTP REST API
Fallback when the Python supabase library has compatibility issues
"""

import os
import json
import requests
import logging
from typing import List, Dict
from dotenv import load_dotenv

# Setup logging
logger = logging.getLogger(__name__)

# Load environment variables from both possible locations
load_dotenv()  # scrapers/.env
try:
    from pathlib import Path
    # Also try to load from project root
    project_root = Path(__file__).parent.parent.parent
    env_file = project_root / '.env.local'
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
except:
    pass

class DatabaseManagerHTTP:
    """Manages database operations using Supabase REST API"""

    def __init__(self):
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        # Prefer service role key for scraper operations (bypasses RLS)
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing Supabase credentials. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env")

        # Remove trailing slash from URL
        self.supabase_url = self.supabase_url.rstrip('/')

        self.headers = {
            'apikey': self.supabase_key,
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

    def insert_lots(self, lots: List[Dict]) -> int:
        """
        Insert lots into database using REST API
        """
        if not lots:
            return 0

        try:
            # Insert lots one by one (REST API doesn't support batch insert easily)
            success_count = 0
            for lot_data in lots:
                try:
                    response = requests.post(
                        f"{self.supabase_url}/rest/v1/lots",
                        headers=self.headers,
                        json=lot_data,
                        timeout=30
                    )

                    if response.status_code in [200, 201]:
                        success_count += 1
                    else:
                        logger.warning(f"Failed to insert lot: {response.status_code} - {response.text}")

                except Exception as e:
                    logger.error(f"Error inserting lot {lot_data.get('title', 'Unknown')}: {e}")

            logger.info(f"Inserted {success_count}/{len(lots)} lots")
            return success_count

        except Exception as e:
            logger.error(f"Error inserting lots: {e}")
            raise

    def save_lot(self, lot_data: Dict) -> bool:
        """
        Save or update a single lot in the database
        Uses upsert logic based on title + auctioneer + source_url
        """
        try:
            # Check if lot already exists based on source_url or title + auctioneer
            if lot_data.get('source_url'):
                # Try to find by source_url first
                existing = self._find_lot_by_source_url(lot_data['source_url'])
            else:
                existing = self._find_lot_by_title_and_auctioneer(
                    lot_data['title'],
                    lot_data['auctioneer']
                )

            if existing:
                # Update existing lot
                logger.debug(f"Updating existing lot: {lot_data['title']}")
                response = requests.patch(
                    f"{self.supabase_url}/rest/v1/lots?id=eq.{existing['id']}",
                    headers=self.headers,
                    json=lot_data,
                    timeout=30
                )
                return response.status_code in [200, 204]
            else:
                # Insert new lot
                logger.debug(f"Inserting new lot: {lot_data['title']}")
                response = requests.post(
                    f"{self.supabase_url}/rest/v1/lots",
                    headers=self.headers,
                    json=lot_data,
                    timeout=30
                )
                return response.status_code in [200, 201]

        except Exception as e:
            logger.error(f"Error saving lot {lot_data.get('title', 'Unknown')}: {e}")
            return False

    def _find_lot_by_source_url(self, source_url: str) -> Dict:
        """Find a lot by its source_url"""
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/lots?source_url=eq.{source_url}&select=*",
                headers=self.headers,
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    return data[0]
            return None

        except Exception as e:
            logger.error(f"Error finding lot by source_url: {e}")
            return None

    def _find_lot_by_title_and_auctioneer(self, title: str, auctioneer: str) -> Dict:
        """Find a lot by title and auctioneer"""
        try:
            # URL encode the title for the query
            import urllib.parse
            encoded_title = urllib.parse.quote(title)

            response = requests.get(
                f"{self.supabase_url}/rest/v1/lots?title=eq.{encoded_title}&auctioneer=eq.{auctioneer}&select=*",
                headers=self.headers,
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    return data[0]
            return None

        except Exception as e:
            logger.error(f"Error finding lot by title and auctioneer: {e}")
            return None

    def get_recent_lots(self, limit: int = 5) -> List[Dict]:
        """Get recent lots from database"""
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/lots?select=*&order=created_at.desc&limit={limit}",
                headers=self.headers,
                timeout=30
            )

            if response.status_code == 200:
                return response.json()
            return []

        except Exception as e:
            logger.error(f"Error getting recent lots: {e}")
            return []
