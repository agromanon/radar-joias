"""
Inspect all fields in Kwara API response
"""

import requests
import json

build_id = 'ziWczoweSgRNOjgvfT9eZ'
api_url = f'https://www.kwara.com.br/_next/data/{build_id}/pt-BR/lote/sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848.json'

try:
    response = requests.get(api_url, timeout=30)
    if response.status_code == 200:
        data = response.json()

        print("=" * 80)
        print("FULL API RESPONSE STRUCTURE")
        print("=" * 80)

        # Pretty print the JSON structure
        print(json.dumps(data, indent=2, ensure_ascii=False))

        print("\n" + "=" * 80)
        print("AVAILABLE FIELDS")
        print("=" * 80)

        # Navigate the structure to find all fields
        def print_fields(obj, path="root"):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    current_path = f"{path}.{key}" if path != "root" else key
                    print(f"{current_path}: {type(value).__name__}")

                    if isinstance(value, (dict, list)) and len(str(value)) < 200:
                        print_fields(value, current_path)
            elif isinstance(obj, list) and len(obj) > 0:
                print(f"{path}[0]:")
                print_fields(obj[0], path)

        print_fields(data)

except Exception as e:
    print(f"Error: {e}")
