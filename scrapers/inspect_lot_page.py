"""
Simple test to fetch lot page HTML and show available data
"""

import requests
from bs4 import BeautifulSoup

url = "https://www.kwara.com.br/lote/sofa-2-lugares-manta-e-almofada-ref-ab-26518-61848"

print("Fetching lot page...")
response = requests.get(url, timeout=30)

if response.status_code == 200:
    soup = BeautifulSoup(response.text, 'html.parser')

    # Look for all text content
    print("\n" + "=" * 80)
    print("PAGE TEXT CONTENT")
    print("=" * 80)

    # Get main content area
    content_selectors = [
        'main',
        '[class*="lot"]',
        'article',
        'div[class*="content"]',
    ]

    for selector in content_selectors:
        main = soup.select_one(selector)
        if main:
            text = main.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            # Print first 100 meaningful lines
            for i, line in enumerate(lines[:100], 1):
                if len(line) > 10:  # Only meaningful content
                    print(f"{i:3d}. {line}")
            break

    print("\n" + "=" * 80)
    print("LOOKING FOR SPECIFIC FIELDS")
    print("=" * 80)

    # Look for specific field names
    field_patterns = [
        "Informações",
        "Referência",
        "Descrição",
        "Observações",
        "Visitação",
        "Retirada",
        "Evento"
    ]

    page_text = soup.get_text()
    for pattern in field_patterns:
        if pattern in page_text:
            print(f"✓ Found: {pattern}")

    # Save full HTML for inspection
    with open('/tmp/lot_page.html', 'w', encoding='utf-8') as f:
        f.write(response.text)
    print("\n✓ Full HTML saved to /tmp/lot_page.html")
else:
    print(f"Failed to fetch page: {response.status_code}")
