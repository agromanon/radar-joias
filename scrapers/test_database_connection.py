"""
Test database connection and schema
"""

import os
from dotenv import load_dotenv
from supabase import create_client

def test_database_connection():
    """Test Supabase database connection"""
    print("=" * 80)
    print("Testing Database Connection")
    print("=" * 80)

    # Load environment variables
    load_dotenv()

    # Check credentials
    supabase_url = os.getenv('SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url:
        print("\n❌ SUPABASE_URL not found in environment")
        print("\nPlease setup your .env file:")
        print("  1. Copy .env.example to .env")
        print("  2. Add your Supabase credentials")
        return False

    if not service_key:
        print("\n❌ SUPABASE_SERVICE_ROLE_KEY not found")
        print("\nPlease add your service role key to .env")
        return False

    print(f"\n✓ Environment variables found")
    print(f"  URL: {supabase_url}")

    # Test connection
    try:
        print("\nTesting connection...")
        supabase = create_client(supabase_url, service_key)

        # Test query
        print("Querying lots table...")
        result = supabase.table('lots').select('*', count='exact').limit(1).execute()

        print(f"\n✓ Database connection successful!")
        print(f"  Current lots in database: {result.count or 0}")

        # Check table structure
        if result.data:
            print(f"\n  Sample lot fields: {list(result.data[0].keys())}")

        return True

    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        print("\nPossible issues:")
        print("  1. Invalid Supabase URL or key")
        print("  2. 'lots' table doesn't exist yet")
        print("  3. Network connectivity issue")
        print("\nSolutions:")
        print("  - Check your Supabase project URL")
        print("  - Verify service role key in project settings")
        print("  - Run the database migration to create tables")
        return False

if __name__ == '__main__':
    success = test_database_connection()
    print(f"\n{'=' * 80}")
    if success:
        print("✓ Database is ready for scraper!")
    else:
        print("✗ Please fix database connection before running scraper")
    print("=" * 80)
