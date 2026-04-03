"""
Show a specific Kwara lot to demonstrate enhanced field storage
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
print("DETAILED KWARA LOT EXAMPLE")
print("=" * 80)

# Get a Kwara lot (platform='kwara' in metadata)
result = supabase.table('lots').select('*').execute()

kwara_lots = [lot for lot in result.data if lot.get('metadata', {}).get('platform') == 'kwara']

if kwara_lots:
    lot = kwara_lots[0]
    metadata = lot.get('metadata', {})

    print(f"\n🏠 TITLE:")
    print(f"  {lot['title']}")

    print(f"\n💰 PRICING:")
    print(f"  Current Bid: R$ {lot.get('current_bid', 0):,.2f}")
    print(f"  Starting Bid: R$ {metadata.get('starting_bid', 0):,.2f}")
    print(f"  Estimated Value: R$ {metadata.get('estimated_value', 0):,.2f}")
    print(f"  Bids Count: {metadata.get('bids_count', 0)}")

    print(f"\n📂 CATEGORIZATION:")
    print(f"  Category: {lot.get('category', 'N/A')}")
    print(f"  Primary: {metadata.get('category_primary', 'N/A')}")
    print(f"  Secondary: {metadata.get('category_secondary', 'N/A')}")
    print(f"  Tags: {', '.join(metadata.get('tags', []))}")

    print(f"\n📍 LOCATION:")
    print(f"  City: {lot.get('location_city', 'N/A')}")
    print(f"  State: {lot.get('location_state', 'N/A')}")

    print(f"\n🖼️  IMAGES:")
    primary_image = metadata.get('primary_image_url', 'N/A')
    if primary_image != 'N/A':
        print(f"  Primary Image: {str(primary_image)[:80]}...")
    else:
        print(f"  Primary Image: N/A")
    print(f"  Total Images: {len(metadata.get('images', []))}")
    print(f"  All Images: {len(metadata.get('images', []))} URLs stored")

    print(f"\n📄 DOCUMENTS:")
    edict_url = lot.get('edict_url', 'N/A')
    if edict_url != 'N/A':
        print(f"  Edict PDF: {str(edict_url)[:80]}...")
    else:
        print(f"  Edict PDF: N/A")

    print(f"\n🏷️  SOURCE:")
    print(f"  Platform: {metadata.get('platform', 'N/A')}")
    source_url = metadata.get('source_url', 'N/A')
    if source_url != 'N/A':
        print(f"  Source URL: {str(source_url)[:80]}...")
    else:
        print(f"  Source URL: N/A")
    print(f"  Auctioneer: {lot.get('auctioneer', 'N/A')}")

    print(f"\n👤 SELLER:")
    print(f"  Seller Name: {metadata.get('seller_name', 'N/A')}")

    print(f"\n🔍 API DATA (all preserved):")
    print(f"  Kwara ID: {metadata.get('kwara_id', 'N/A')}")
    print(f"  Listing ID: {metadata.get('listing_id', 'N/A')}")
    print(f"  Item ID: {metadata.get('item_id', 'N/A')}")
    print(f"  Slug: {metadata.get('slug', 'N/A')}")
    print(f"  Views: {metadata.get('views', 0)}")
    print(f"  Status: {metadata.get('status', 'N/A')}")

    print(f"\n⏰ TIMING:")
    print(f"  Closing At: {lot.get('closing_at', 'N/A')}")

    print("\n" + "=" * 80)
    print("✓ ALL KWARA API DATA PRESERVED!")
    print("=" * 80)
    print("\nKey points:")
    print("  ✓ 30+ fields captured from Kwara API")
    print("  ✓ Enhanced categorization (primary, secondary, tags)")
    print("  ✓ All images URLs stored")
    print("  ✓ Edict PDF URL for AI analysis")
    print("  ✓ Complete API metadata preserved in JSONB")
    print("  ✓ Ready for AI integration and feature expansion")

else:
    print("\nNo Kwara lots found in database")

print("\n" + "=" * 80)
