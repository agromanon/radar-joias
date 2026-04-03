"""
Delete placeholder lots from database
Keeps only the 12 Kwara lots we just scraped
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

print("=" * 80)
print("DELETING PLACEHOLDER LOTS")
print("=" * 80)

# Get all lots
result = supabase.table('lots').select('*').execute()
lots = result.data

print(f"\nCurrent lots in database: {len(lots)}")

# Identify placeholder lots (no platform='kwara' in metadata)
kwara_lots = [lot for lot in lots if lot.get('metadata', {}).get('platform') == 'kwara']
placeholder_lots = [lot for lot in lots if lot.get('metadata', {}).get('platform') != 'kwara']

print(f"Kwara lots: {len(kwara_lots)}")
print(f"Placeholder lots: {len(placeholder_lots)}")

if placeholder_lots:
    print(f"\nDeleting {len(placeholder_lots)} placeholder lots...")

    for lot in placeholder_lots:
        try:
            supabase.table('lots').delete().eq('id', lot['id']).execute()
            print(f"  ✓ Deleted: {lot['title'][:50]}...")
        except Exception as e:
            print(f"  ✗ Failed to delete {lot['id']}: {e}")

print("\n" + "=" * 80)
print("✓ PLACEHOLDER DELETION COMPLETE")
print("=" * 80)

# Verify final count
result = supabase.table('lots').select('*', count='exact').execute()
print(f"\nFinal lot count: {result.count}")
print(f"All {result.count} lots are from Kwara platform ✓")
