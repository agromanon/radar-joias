"""
Get current Kwara build ID dynamically

Kwara changes their build ID when they deploy updates.
We need to fetch the current build ID from their homepage.
"""

import re
import requests
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def get_kwara_build_id() -> Optional[str]:
    """
    Fetch current Kwara Next.js build ID from homepage

    The build ID is in the __NEXT_DATA__ script tag as buildId:"..."
    """
    try:
        print("Fetching Kwara homepage to find current build ID...")

        response = requests.get(
            "https://www.kwara.com.br",
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; RadarLeilao-Bot/1.0)',
                'Accept': 'text/html',
            },
            timeout=30
        )
        response.raise_for_status()

        html = response.text

        # Look for buildId in __NEXT_DATA__
        pattern = r'buildId":"([a-zA-Z0-9]+)"'
        matches = re.findall(pattern, html)

        if matches:
            # Use the first match
            build_id = matches[0]
            print(f"✓ Found build ID: {build_id}")
            return build_id
        else:
            print("✗ Could not find build ID in HTML")
            return None

    except Exception as e:
        print(f"✗ Error fetching build ID: {e}")
        return None


def update_build_id_in_file(file_path: str, old_build_id: str, new_build_id: str):
    """Update build ID in a file"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()

        if old_build_id not in content:
            print(f"⚠️  Old build ID {old_build_id} not found in {file_path}")
            return False

        updated_content = content.replace(old_build_id, new_build_id)

        with open(file_path, 'w') as f:
            f.write(updated_content)

        print(f"✓ Updated {file_path}")
        return True

    except Exception as e:
        print(f"✗ Error updating {file_path}: {e}")
        return False


def main():
    """Update build ID in all scraper files"""
    old_build_id = '9cYkevqRiYyTe6cMTdam'  # Current hardcoded build ID

    # Get new build ID
    new_build_id = get_kwara_build_id()

    if not new_build_id:
        print("\nFailed to get new build ID. Exiting.")
        return

    if new_build_id == old_build_id:
        print(f"\nBuild ID is already up to date: {new_build_id}")
        return

    print(f"\nUpdating build ID from {old_build_id} → {new_build_id}")
    print("=" * 80)

    # Files to update
    files_to_update = [
        'price_refresh_strategy.py',
        '../src/app/api/lots/[id]/route.ts',
        '../src/app/api/lots/[id]/refresh/route.ts',
    ]

    # Update each file
    success_count = 0
    for file_path in files_to_update:
        full_path = Path(__file__).parent / file_path
        if update_build_id_in_file(str(full_path), old_build_id, new_build_id):
            success_count += 1

    print("=" * 80)
    print(f"✓ Updated {success_count}/{len(files_to_update)} files")


if __name__ == '__main__':
    main()
