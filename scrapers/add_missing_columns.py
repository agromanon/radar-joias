"""
Add missing columns to lots table using Supabase SQL execution
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL')
service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Essential columns that the scraper needs
columns_to_add = [
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'kwara';",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS category_primary TEXT;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS category_secondary TEXT;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS starting_bid NUMERIC(15,2);",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS bids_count INTEGER DEFAULT 0;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS seller_name TEXT;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS primary_image_url TEXT;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS source_url TEXT;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE lots ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(15,2);",
]

print("Adding missing columns to lots table...")
print("=" * 80)

# Execute each ALTER TABLE statement using Supabase SQL API
for i, sql in enumerate(columns_to_add, 1):
    try:
        response = requests.post(
            f"{supabase_url}/rest/v1/rpc/exec_sql",
            headers={
                'apikey': service_role_key,
                'Authorization': f'Bearer {service_role_key}',
                'Content-Type': 'application/json'
            },
            json={'sql': sql},
            timeout=30
        )

        if response.status_code == 200:
            print(f"✓ Statement {i}: {sql[:60]}...")
        else:
            print(f"✗ Statement {i} failed: {response.text[:100]}")

    except Exception as e:
        print(f"✗ Statement {i} error: {str(e)[:100]}")

print("\n" + "=" * 80)
print("Column addition complete!")
print("\nNow you can run the scraper:")
print("  python3 run_kwara_with_db.py")
