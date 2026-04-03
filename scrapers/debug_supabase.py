"""
Debug supabase connection issues
"""

import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()  # scrapers/.env
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env.local')  # project root

print("=" * 80)
print("ENVIRONMENT VARIABLES:")
print("=" * 80)

for key in ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']:
    value = os.getenv(key)
    if value:
        print(f"{key}:")
        print(f"  Length: {len(value)}")
        print(f"  Starts with: {value[:30]}...")
        print(f"  Ends with: ...{value[-10:]}")
    else:
        print(f"{key}: NOT SET")

print("\n" + "=" * 80)
print("TESTING SUPABASE CLIENT CREATION:")
print("=" * 80)

from supabase import create_client

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

try:
    print(f"\nAttempting to create client...")
    print(f"  URL: {SUPABASE_URL}")
    print(f"  Key length: {len(SUPABASE_ANON_KEY)}")

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    print("  ✓ Client created successfully")

    # Try a simple query
    print(f"\nAttempting test query...")
    result = client.table('lots').select('*').limit(1).execute()
    print(f"  ✓ Query successful! Found {len(result.data)} lots")

except Exception as e:
    print(f"  ✗ Failed: {e}")
    import traceback
    print(f"\nFull traceback:")
    traceback.print_exc()
