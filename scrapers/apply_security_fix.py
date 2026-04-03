"""
Apply security fix to user_alert_matches view
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def apply_security_fix():
    """Apply the security fix migration"""

    # Read the migration SQL
    with open('supabase/migrations/004_fix_view_security.sql', 'r') as f:
        sql = f.read()

    print("=" * 80)
    print("APPLYING SECURITY FIX")
    print("=" * 80)
    print("\nFixing user_alert_matches view...")

    # Connect to Supabase
    supabase = create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    )

    # Execute the migration
    # Note: We need to use RPC since Supabase client doesn't support raw SQL
    # For now, we'll create a SQL file that can be run in Supabase SQL Editor

    print("\n" + "=" * 80)
    print("SECURITY FIX PREPARED")
    print("=" * 80)
    print("\nTo apply this fix, run the following SQL in Supabase SQL Editor:")
    print("\n1. Go to: https://supabase.com/dashboard/project/jelikvfcxvumdhwkirje/sql")
    print("2. Open 'SQL Editor'")
    print("3. Paste the contents of: supabase/migrations/004_fix_view_security.sql")
    print("4. Click 'Run'")
    print("\n" + "=" * 80)
    print("What this fixes:")
    print("  - ❌ BEFORE: user_alert_matches shows ALL users' alerts")
    print("  - ✅ AFTER: user_alert_matches filters by auth.uid()")
    print("\nUsers will ONLY see their own alerts and matched lots.")
    print("=" * 80)

    # Also save to a file for easy copy-paste
    with open('/tmp/security_fix.sql', 'w') as f:
        f.write(sql)

    print(f"\nSQL also saved to: /tmp/security_fix.sql")
    print("\nAfter running the SQL, you should see:")
    print("  ✅ Security fix applied: user_alert_matches filters by auth.uid()")
    print("  ✅ lots_with_watchlist_status is secure (uses auth.uid())")

if __name__ == '__main__':
    apply_security_fix()
