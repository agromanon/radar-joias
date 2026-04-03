"""
Query the lots table to see which columns exist
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

print("Querying lots table schema...")
print("=" * 80)

# Try to query one lot to see what columns are returned
try:
    result = supabase.table('lots').select('*').limit(1).execute()

    if result.data:
        lot = result.data[0]
        columns = list(lot.keys())
        print(f"Found {len(columns)} columns in lots table:")
        for col in sorted(columns):
            print(f"  - {col}")
    else:
        print("No lots in database yet")

except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 80)
