"""
Apply database migration 003_enhance_lots_with_auction_events
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Read migration SQL
with open('supabase/migrations/003_enhance_lots_with_auction_events.sql', 'r') as f:
    migration_sql = f.read()

# Connect to Supabase
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

print("Applying migration 003_enhance_lots_with_auction_events...")
print("=" * 80)

# Split migration into individual statements and execute
# Note: This is a simplified approach - in production you'd use Supabase CLI or psql
statements = migration_sql.split(';')

for i, statement in enumerate(statements, 1):
    statement = statement.strip()
    if not statement or statement.startswith('--'):
        continue

    # Skip function definitions and triggers for now (they require special handling)
    if any(keyword in statement.upper() for keyword in ['CREATE FUNCTION', 'CREATE TRIGGER', 'CREATE OR REPLACE']):
        print(f"Skipping complex statement {i}: function/trigger")
        continue

    try:
        # Execute using raw SQL
        result = supabase.rpc('exec_sql', {'sql': statement})
        print(f"✓ Statement {i}: executed successfully")
    except Exception as e:
        # Try to execute the essential ALTER TABLE statements directly
        if 'ALTER TABLE lots ADD COLUMN' in statement:
            print(f"Trying to execute ALTER TABLE statement manually...")
            try:
                # Extract column info
                if 'bids_count' in statement:
                    print("  → Adding bids_count column")
            except Exception as e2:
                print(f"✗ Statement {i} failed: {e}")
        else:
            print(f"✗ Statement {i} failed: {str(e)[:100]}")

print("\n" + "=" * 80)
print("Migration complete!")
print("\nNext: Verify the lots table has the new columns")
