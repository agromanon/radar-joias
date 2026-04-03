# Field Standardization Strategy for Multi-Platform Scrapers

## Problem

Different auction websites have different API structures and field names:

**Example: Same data, different names**
| Field Concept | Kwara | Excel Leilões | Braspress |
|--------------|-------|---------------|-----------|
| Current bid | `cachedPriceAmountCents` | `lance_atual` | `valor_atual` |
| Bids count | `cachedBidsCount` | `total_lances` | `numero_lances` |
| Closing time | `scheduledEndAt` | `data_fechamento` | `horario_encerramento` |
| Seller | `sellerName` | `vendedor` | `leiloeiro` |

## Solution: Field Normalization Layer

### 1. Standard Field Schema (All Platforms Must Map To)

```python
STANDARD_FIELDS = {
    # Core Identity
    'title': str,                    # Lot title (required)
    'auctioneer': str,               # Auction house name (required)
    'platform': str,                 # Platform identifier (required)

    # Pricing
    'current_bid': float,            # Highest current bid
    'starting_bid': float,            # Initial/minimum bid
    'estimated_value': float,         # Estimated market value

    # Bidding
    'bids_count': int,                # Number of bids placed

    # Categorization
    'category': str,                  # Basic category
    'category_primary': str,          # Enhanced: Main category
    'category_secondary': str,         # Enhanced: Subcategory
    'tags': list[str],                # Enhanced: Material/feature tags

    # Location
    'location_city': str,             # City name
    'location_state': str,            # State code (SP, RJ, etc.)
    'location_address': str,           # Full address

    # Media
    'primary_image_url': str,         # Main display image
    'images': list[str],               # All image URLs

    # Documents
    'edict_url': str,                 # Link to PDF edict

    # Timing
    'closing_at': datetime,            # Auction end time

    # Seller
    'seller_name': str,                # Seller/auctioneer name

    # Status
    'status': str,                     # Lot status (active, closed, sold)

    # Source
    'source_url': str,                 # Original URL on auctioneer site

    # Risk
    'risk_score': str,                 # BAIXO, MÉDIO, ALTO

    # Metadata (flexible catch-all)
    'metadata': dict,                  # Platform-specific raw data
}
```

### 2. Field Mapping System

Each scraper defines how to map its platform-specific fields to standard fields:

```python
# kwara_scraper.py
FIELD_MAPPINGS = {
    'current_bid': 'cachedPriceAmountCents',  # API field → standard field
    'bids_count': 'cachedBidsCount',
    'closing_at': 'scheduledEndAt',
    'seller_name': 'sellerName',
}

# excel_scraper.py
FIELD_MAPPINGS = {
    'current_bid': 'lance_atual',
    'bids_count': 'total_lances',
    'closing_at': 'data_fechamento',
    'seller_name': 'vendedor',
}
```

### 3. Value Transformers

Some fields need transformation (e.g., cents to reais):

```python
VALUE_TRANSFORMERS = {
    'current_bid': lambda x: x / 100 if x else None,  # Kwara uses cents
    'closing_at': lambda x: parse_iso_datetime(x),      # Parse various date formats
    'location_state': lambda x: extract_state_code(x),  # Extract "SP" from "São Paulo/SP"
}
```

### 4. Default Values for Missing Fields

When a platform doesn't provide a field, use sensible defaults:

```python
DEFAULT_VALUES = {
    'bids_count': 0,                  # Assume no bids if not provided
    'status': 'active',                # Default to active
    'risk_score': 'MÉDIO',             # Default risk level
    'category_primary': 'Outros',      # Fallback category
    'images': [],                      # Empty array if no images
    'tags': [],                        # Empty array if no tags
}
```

## Implementation Architecture

### Base Scraper with Normalization

```python
# base.py (enhanced)
class BaseScraper(ABC):
    STANDARD_FIELDS = { ... }  # Defined above
    DEFAULT_VALUES = { ... }   # Defined above

    def __init__(self, auctioneer_name: str, platform: str):
        self.auctioneer_name = auctioneer_name
        self.platform = platform
        self.field_mappings = {}
        self.value_transformers = {}

    @abstractmethod
    def fetch_lots(self) -> List[Dict]:
        """Fetch raw data from platform API"""
        pass

    def normalize_lot(self, raw_lot: Dict) -> AuctionLot:
        """
        Transform platform-specific lot into standard AuctionLot
        """
        normalized = {}

        # 1. Apply field mappings
        for standard_field, api_field in self.field_mappings.items():
            value = self._get_nested_value(raw_lot, api_field)
            normalized[standard_field] = value

        # 2. Apply value transformers
        for field, transformer in self.value_transformers.items():
            if field in normalized:
                normalized[field] = transformer(normalized[field])

        # 3. Apply default values for missing fields
        for field, default_value in self.DEFAULT_VALUES.items():
            if field not in normalized or normalized[field] is None:
                normalized[field] = default_value

        # 4. Platform-specific processing
        normalized = self._platform_specific_processing(normalized, raw_lot)

        # 5. Store original data in metadata
        normalized['metadata'] = raw_lot

        # 6. Add platform metadata
        normalized['platform'] = self.platform
        normalized['auctioneer'] = self.auctioneer_name

        return AuctionLot(**normalized)
```

### Example: Kwara Scraper with Normalization

```python
# kwara_scraper.py
class KwaraAPIScraper(BaseScraper):
    def __init__(self):
        super().__init__('Kwara', 'kwara')

        # Map Kwara API fields to standard fields
        self.field_mappings = {
            'title': 'title',
            'current_bid': 'cachedPriceAmountCents',
            'bids_count': 'cachedBidsCount',
            'closing_at': 'scheduledEndAt',
            'seller_name': 'sellerName',
            'images': 'images',
        }

        # Transform values (Kwara uses cents, need reais)
        self.value_transformers = {
            'current_bid': lambda x: x / 100 if x else None,
            'starting_bid': lambda x: x / 100 if x else None,
        }

    def _platform_specific_processing(self, normalized, raw):
        """Kwara-specific logic"""
        # Extract primary image
        if 'images' in normalized and normalized['images']:
            normalized['primary_image_url'] = normalized['images'][0]

        # Parse location from "São Paulo/SP" format
        location = raw.get('listing', {}).get('location', '')
        if '/' in location:
            city, state = location.split('/')
            normalized['location_city'] = city.strip()
            normalized['location_state'] = state.strip()

        # Enhanced categorization
        title = normalized.get('title', '')
        normalized['category_primary'] = self._map_primary_category(title)
        normalized['tags'] = self._extract_tags(title)

        return normalized
```

### Example: Excel Leilões Scraper with Normalization

```python
# excel_scraper.py
class ExcelAPIScraper(BaseScraper):
    def __init__(self):
        super().__init__('Excel Leilões', 'excel')

        # Map Excel API fields to standard fields
        self.field_mappings = {
            'title': 'titulo_lote',
            'current_bid': 'lance_atual',
            'bids_count': 'total_lances',
            'closing_at': 'data_fechamento',
            'seller_name': 'vendedor',
        }

        # Excel uses reais directly (no division needed)
        self.value_transformers = {
            'closing_at': lambda x: parse_br_datetime(x),  # Brazilian date format
        }

    def _platform_specific_processing(self, normalized, raw):
        """Excel-specific logic"""
        # Excel might have different image structure
        if 'fotos' in raw:
            normalized['images'] = raw['fotos']
            if raw['fotos']:
                normalized['primary_image_url'] = raw['fotos'][0]

        # Excel uses different location format
        location = raw.get('cidade_estado', '')
        if '-' in location:
            city, state = location.split('-')
            normalized['location_city'] = city.strip()
            normalized['location_state'] = state.strip()

        return normalized
```

## Field Presence Matrix

| Standard Field | Kwara | Excel | Braspress | Default if Missing |
|----------------|-------|-------|-----------|-------------------|
| `title` | ✅ | ✅ | ✅ | Required |
| `auctioneer` | ✅ | ✅ | ✅ | Required |
| `platform` | ✅ | ✅ | ✅ | Required |
| `current_bid` | ✅ | ✅ | ✅ | `None` |
| `starting_bid` | ✅ | ✅ | ⚠️ | `None` |
| `bids_count` | ✅ | ✅ | ⚠️ | `0` |
| `closing_at` | ✅ | ✅ | ✅ | `None` |
| `seller_name` | ✅ | ✅ | ⚠️ | `auctioneer` |
| `category_primary` | ⚠️ | ⚠️ | ⚠️ | `Outros` (derived) |
| `tags` | ⚠️ | ⚠️ | ⚠️ | `[]` (derived) |
| `images` | ✅ | ✅ | ✅ | `[]` |
| `edict_url` | ✅ | ✅ | ✅ | `None` |
| `location_city` | ⚠️ | ⚠️ | ⚠️ | `None` |
| `location_state` | ⚠️ | ⚠️ | ⚠️ | `None` |

**Legend**: ✅ = API provides, ⚠️ = Can derive from other fields

## Benefits of Standardization

### 1. Predictable Database Schema
- All platforms insert into the **same** lots table
- No platform-specific columns needed
- Easy to query across all auctioneers

### 2. Easy Platform Addition
- New scraper = define field mappings + platform logic
- No database schema changes needed
- Base class handles normalization

### 3. Consistent UI Data
- Dashboard displays all lots uniformly
- Filters work across all platforms
- Search is platform-agnostic

### 4. AI Integration
- Radar Copilot sees consistent field names
- Edict analysis works the same for all platforms
- Risk scoring uses same inputs

## Implementation Steps

### Phase 1: Update Base Scraper
1. Add `STANDARD_FIELDS`, `DEFAULT_VALUES` to `base.py`
2. Implement `normalize_lot()` method
3. Add `_get_nested_value()` helper

### Phase 2: Update Existing Scrapers
1. Update `kwara_scraper.py` to use normalization
2. Remove duplicate field logic (now in base class)
3. Test that data is still saved correctly

### Phase 3: Add New Scrapers
1. Create `excel_scraper.py` with field mappings
2. Create `braspress_scraper.py` with field mappings
3. Each scraper only defines mappings + platform logic

### Phase 4: Add Field Coverage Tracking
1. Log which fields each platform provides
2. Track data quality per platform
3. Alert when critical fields are missing

## Next Steps

When adding the next auction website scraper:

1. **Explore their API** → Document field names
2. **Create field mapping** → Map their fields to standard fields
3. **Implement transformers** → Convert units, formats, encodings
4. **Handle missing fields** → Use defaults or derive from other fields
5. **Test normalization** → Verify data appears correctly in database
6. **Add field coverage tracking** → Monitor data quality over time

This ensures **all platforms contribute to a unified, queryable database** for Radar Leilão! 🚀
