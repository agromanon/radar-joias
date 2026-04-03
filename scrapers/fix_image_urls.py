"""
Fix image URLs in database
Extract plain URLs from JSON strings in image_url field
"""

import sys
import json
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))
from supabase_manager import SupabaseManager


def extract_url_from_json(image_data: any) -> Optional[str]:
    """Extract URL from various possible formats"""
    if image_data is None:
        return None

    # If it's already a string URL
    if isinstance(image_data, str):
        # Try to parse as JSON first
        try:
            parsed = json.loads(image_data)
            if isinstance(parsed, dict) and 'url' in parsed:
                return parsed['url']
        except:
            # If it's not JSON, check if it looks like a URL
            if image_data.startswith('http'):
                return image_data
        return None

    # If it's a dict with url field
    if isinstance(image_data, dict) and 'url' in image_data:
        return image_data['url']

    return None


def fix_image_urls():
    """Fix all image URLs in the lots table"""
    db = SupabaseManager()

    print("🔧 Fixing image URLs in database...")
    print("=" * 80)

    # Get all lots with image_url
    lots = db.query("""
        SELECT id, slug, image_url
        FROM lots
        WHERE image_url IS NOT NULL
    """)

    if not lots:
        print("✓ No lots with image_url found")
        return

    print(f"Found {len(lots)} lots with image_url")

    fixed_count = 0
    skipped_count = 0

    for lot in lots:
        lot_id = lot['id']
        slug = lot['slug']
        image_url = lot['image_url']

        # Extract plain URL
        clean_url = extract_url_from_json(image_url)

        if clean_url and clean_url != image_url:
            # Update the database
            db.execute(
                "UPDATE lots SET image_url = ? WHERE id = ?",
                (clean_url, lot_id)
            )
            print(f"✓ Fixed {slug}: {clean_url[:60]}...")
            fixed_count += 1
        elif clean_url:
            print(f"- Skipped {slug}: already correct format")
            skipped_count += 1
        else:
            print(f"⚠️  Could not parse {slug}")
            skipped_count += 1

    print("=" * 80)
    print(f"✓ Fixed {fixed_count} lots, skipped {skipped_count}")


if __name__ == '__main__':
    fix_image_urls()
