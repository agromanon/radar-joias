"""
Check what data exists in the database
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from utils.database import DatabaseManager

    db = DatabaseManager()

    # Get a few recent lots
    result = db.supabase.table('lots').select('*').order('created_at', desc=True).limit(3).execute()

    print("Recent lots in database:")
    print("=" * 80)

    for lot in result.data:
        print(f"\nLot ID: {lot['id']}")
        print(f"Title: {lot['title'][:80]}...")
        print(f"Description ({len(lot.get('description', '') or '')} chars): {lot.get('description', '')[:100]}...")
        print(f"Auctioneer: {lot['auctioneer']}")
        print(f"Current Bid: R$ {lot.get('current_bid', 0):,.2f}")
        print(f"Has metadata: {bool(lot.get('metadata'))}")
        if lot.get('metadata'):
            print(f"  - source_url: {lot['metadata'].get('source_url', 'NOT FOUND')}")
            print(f"  - images: {len(lot['metadata'].get('images', []))} images")
            print(f"  - platform: {lot['metadata'].get('platform', 'NOT FOUND')}")
        print("-" * 80)

except ImportError as e:
    print(f"Database module not found: {e}")
    print("Make sure supabase credentials are configured")
except Exception as e:
    print(f"Error: {e}")
