"""
Image storage manager for auction lots
"""

import os
import requests
from typing import Optional
from datetime import datetime
import logging
from supabase import create_client

logger = logging.getLogger(__name__)


class ImageStorageManager:
    """Manage image storage in Supabase Storage"""

    def __init__(self):
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        )
        self.bucket_name = 'auction-images'

    def sync_lot_images(self, lot_id: str, lot_data: dict) -> dict:
        """
        Sync lot images to Supabase Storage
        Strategy: Store primary image, keep others as links

        Returns: Updated lot data with storage URLs
        """
        try:
            primary_url = lot_data.get('primary_image_url')
            images = lot_data.get('images', [])

            if not primary_url and images:
                primary_url = images[0]

            if not primary_url:
                return lot_data

            # Download and store primary image
            stored_url = self._store_image(lot_id, primary_url)

            if stored_url:
                lot_data['primary_image_stored_url'] = stored_url
                lot_data['images_storage_count'] = 1
                lot_data['images_synced_at'] = datetime.now().isoformat()

                # Update database
                self.supabase.table('lots').update({
                    'primary_image_stored_url': stored_url,
                    'images_storage_count': 1,
                    'images_synced_at': datetime.now().isoformat()
                }).eq('id', lot_id).execute()

                logger.info(f"✓ Synced primary image for lot {lot_id[:8]}")
            else:
                logger.warning(f"✗ Failed to sync image for lot {lot_id[:8]}")

            return lot_data

        except Exception as e:
            logger.error(f"Error syncing images for lot {lot_id[:8]}: {e}")
            return lot_data

    def _store_image(self, lot_id: str, image_url: str) -> Optional[str]:
        """
        Download image and store in Supabase Storage

        Returns: Storage URL or None if failed
        """
        try:
            # Download image
            logger.debug(f"Downloading image from {image_url}")
            response = requests.get(image_url, timeout=30, stream=True)
            response.raise_for_status()

            # Get file extension
            import urllib.parse
            path = urllib.parse.urlparse(image_url).path
            ext = os.path.splitext(path)[1] or '.jpg'

            # Generate filename
            filename = f"lots/{lot_id[:8]}/primary{ext}"

            # Upload to Supabase Storage
            logger.debug(f"Uploading to {self.bucket_name}/{filename}")

            # Read image data in chunks
            image_data = response.content

            # Create storage path with signed URL upload
            # Note: This requires Supabase Storage to be configured
            # For now, we'll use the Supabase client

            result = self.supabase.storage.from_(
                bucket=self.bucket_name,
                file=image_data,
                file_name=filename
            )

            # Get public URL
            storage_url = f"{os.getenv('SUPABASE_URL').replace('/rest/v1/', '/storage/v1/object/')}/{self.bucket_name}/{filename}"

            logger.info(f"✓ Image stored: {storage_url}")
            return storage_url

        except requests.RequestException as e:
            logger.error(f"Failed to download image: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to store image: {e}")
            return None

    def sync_batch_images(self, lots: list, limit: int = None) -> dict:
        """
        Sync primary images for multiple lots

        Args:
            lots: List of lot dictionaries
            limit: Max number of lots to sync (None = all)

        Returns:
            Statistics dict with success/failure counts
        """
        stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'skipped': 0
        }

        lots_to_sync = lots[:limit] if limit else lots

        logger.info(f"Starting image sync for {len(lots_to_sync)} lots...")

        for lot in lots_to_sync:
            stats['total'] += 1

            # Skip if already synced
            if lot.get('primary_image_stored_url'):
                stats['skipped'] += 1
                continue

            # Try to sync
            lot_id = lot.get('id')
            if not lot_id:
                stats['failed'] += 1
                continue

            updated_lot = self.sync_lot_images(lot_id, lot)

            if updated_lot.get('primary_image_stored_url'):
                stats['success'] += 1
            else:
                stats['failed'] += 1

        logger.info(f"Image sync complete: {stats}")
        return stats


def test_image_sync():
    """Test image syncing functionality"""
    print("=" * 80)
    print("Testing Image Storage Sync")
    print("=" * 80)

    # Load environment
    from dotenv import load_dotenv
    load_dotenv()

    # Check credentials
    if not os.getenv('SUPABASE_URL'):
        print("\n❌ SUPABASE_URL not found")
        print("\nPlease set up your .env file first")
        return

    # Test with a single lot from database
    try:
        import json
        from supabase import create_client

        supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        )

        # Get one lot with images
        result = supabase.table('lots').select('*').not_('images', 'eq').limit(1).execute()

        if not result.data:
            print("\n✗ No lots with images found in database")
            print("\nRun the scraper first to populate some lots:")
            print("  python3 run_kwara_with_db.py")
            return

        lot = result.data[0]
        lot_id = lot['id']

        print(f"\nTesting with lot: {lot['title'][:50]}...")
        print(f"  Primary URL: {lot.get('primary_image_url', 'N/A')}")
        print(f"  Images count: {len(lot.get('images', []))}")

        # Sync image
        manager = ImageStorageManager()
        updated_lot = manager.sync_lot_images(lot_id, lot)

        if updated_lot.get('primary_image_stored_url'):
            print(f"\n✓ Image synced successfully!")
            print(f"  Stored URL: {updated_lot['primary_image_stored_url']}")
        else:
            print(f"\n✗ Image sync failed")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    test_image_sync()
