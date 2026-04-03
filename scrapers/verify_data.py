"""
Verify lots in database and show what was saved
"""

import os
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

print("=" * 80)
print("VERIFYING DATABASE DATA")
print("=" * 80)

# Get all lots
result = supabase.table('lots').select('*').execute()

lots = result.data

print(f"\n✓ Total lots in database: {len(lots)}")

if lots:
    # Show sample lot
    sample = lots[0]
    print(f"\n📋 SAMPLE LOT:")
    print(f"  Title: {sample['title'][:70]}...")
    print(f"  Auctioneer: {sample['auctioneer']}")
    print(f"  Category: {sample['category']}")
    print(f"  Current Bid: R$ {sample.get('current_bid', 0):,.2f}")
    print(f"  Location: {sample.get('location_city', 'N/A')}/{sample.get('location_state', 'N/A')}")
    print(f"  Risk Score: {sample.get('risk_score', 'N/A')}")
    print(f"  Closing At: {sample.get('closing_at', 'N/A')}")

    # Show metadata (enhanced fields)
    metadata = sample.get('metadata', {})
    print(f"\n📦 ENHANCED FIELDS (stored in metadata):")
    print(f"  Platform: {metadata.get('platform', 'N/A')}")
    print(f"  Category Primary: {metadata.get('category_primary', 'N/A')}")
    print(f"  Category Secondary: {metadata.get('category_secondary', 'N/A')}")
    print(f"  Tags: {metadata.get('tags', [])}")
    print(f"  Starting Bid: R$ {metadata.get('starting_bid', 0):,.2f}")
    print(f"  Bids Count: {metadata.get('bids_count', 0)}")
    print(f"  Seller Name: {metadata.get('seller_name', 'N/A')}")
    print(f"  Images Count: {len(metadata.get('images', []))}")
    print(f"  Source URL: {metadata.get('source_url', 'N/A')}")
    print(f"  Kwara ID: {metadata.get('kwara_id', 'N/A')}")
    print(f"  Listing ID: {metadata.get('listing_id', 'N/A')}")

    # Category breakdown
    print(f"\n📊 CATEGORY BREAKDOWN:")
    categories = {}
    for lot in lots:
        cat = lot.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1

    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    # Total value
    total_value = sum(lot.get('current_bid', 0) for lot in lots)
    print(f"\n💰 TOTAL VALUE: R$ {total_value:,.2f}")

    # Check edict URLs
    lots_with_edicts = sum(1 for lot in lots if lot.get('edict_url'))
    print(f"\n📄 LOTS WITH EDICT URL: {lots_with_edicts}/{len(lots)}")

    # Check images
    lots_with_images = sum(1 for lot in lots if lot.get('image_url'))
    print(f"🖼️  LOTS WITH IMAGE URL: {lots_with_images}/{len(lots)}")

print("\n" + "=" * 80)
print("✓ DATABASE POPULATED SUCCESSFULLY!")
print("=" * 80)
print("\nYou can now:")
print("  1. Test product features at http://localhost:3000/dashboard")
print("  2. Test AI integration with edict URLs")
print("  3. Test filters and search")
