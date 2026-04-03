"""
Debug: Find where Kwara stores their build ID
"""

import re
import requests

try:
    print("Fetching Kwara homepage...")
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

    print(f"HTML length: {len(html)} characters")

    # Look for various patterns
    patterns = [
        (r'/_next/static/chunks/([a-zA-Z0-9]+)\.js', 'chunks/[BUILD_ID].js'),
        (r'buildId":"([^"]+)"', 'buildId:"..." in __NEXT_DATA__'),
        (r'"buildId":"([^"]+)"', '"buildId":"..." in JSON'),
        (r'/__next/data/([a-zA-Z0-9]+)/', '/__next/data/[BUILD_ID]/'),
        (r'id="([a-zA-Z0-9]{20})"', 'id with 20 chars'),
    ]

    for pattern, description in patterns:
        matches = re.findall(pattern, html)
        if matches:
            print(f"\n✓ Found {description}:")
            for match in matches[:3]:  # Show first 3 matches
                print(f"  - {match}")
        else:
            print(f"\n✗ No match for {description}")

    # Look for __NEXT_DATA__ script tag
    next_data_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if next_data_match:
        print("\n✓ Found __NEXT_DATA__ script")
        data = next_data_match.group(1)
        # Look for buildId in the JSON
        build_id_match = re.search(r'"buildId":"([^"]+)"', data)
        if build_id_match:
            print(f"  buildId: {build_id_match.group(1)}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
