"""
Test database connection with both anon and service role keys
"""

import os
from dotenv import load_dotenv
from supabase import create_client
from pathlib import Path

# Load environment variables from both .env files
load_dotenv()  # Load from current directory (.env)
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env.local')  # Load from project root

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

print(f"Testing connection to: {SUPABASE_URL}")

# Test with anon key first
print(f"\n1. Testing with ANON key: {SUPABASE_ANON_KEY[:20]}...")

try:
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    result = client.table('lots').select('*').limit(1).execute()
    print(f"   ✓ ANON key successful! Found {len(result.data)} lots")
except Exception as e:
    print(f"   ✗ ANON key failed: {e}")

# Test with service role key
print(f"\n2. Testing with SERVICE ROLE key: {SUPABASE_SERVICE_KEY[:20]}...")

try:
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    result = client.table('lots').select('*').limit(1).execute()
    print(f"   ✓ SERVICE ROLE key successful! Found {len(result.data)} lots")
except Exception as e:
    print(f"   ✗ SERVICE ROLE key failed: {e}")
