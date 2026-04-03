"""
Test HTTP-based database manager
"""

import sys
from pathlib import Path
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from utils.database_http import DatabaseManagerHTTP

    print("Testing HTTP-based database manager...")
    print("=" * 80)

    # Create database manager
    db = DatabaseManagerHTTP()

    # Test: Get recent lots
    print("\n1. Testing: Get recent lots...")
    lots = db.get_recent_lots(limit=3)

    if lots:
        print(f"   ✓ Found {len(lots)} lots in database")

        for lot in lots:
            print(f"\n   Lot: {lot['title'][:60]}...")
            print(f"   - Auctioneer: {lot['auctioneer']}")
            print(f"   - Has source_url: {bool(lot.get('source_url'))}")
            print(f"   - Has metadata: {bool(lot.get('metadata'))}")
            if lot.get('metadata'):
                print(f"   - metadata.source_url: {lot['metadata'].get('source_url', 'NOT FOUND')}")
    else:
        print("   ✓ No lots found in database (expected for new database)")

    print("\n" + "=" * 80)
    print("✓ Database connection test completed successfully!")

except Exception as e:
    print(f"\n✗ Database connection test failed: {e}")
    import traceback
    traceback.print_exc()
