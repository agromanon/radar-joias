"""
Base Scraper with Field Normalization
Standardizes data from multiple auction platforms into a unified schema
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class AuctionLot:
    """Standardized auction lot that all platforms must produce"""
    # Core Identity (required)
    title: str
    auctioneer: str
    platform: str

    # Pricing (optional but recommended)
    current_bid: Optional[float] = None
    starting_bid: Optional[float] = None
    estimated_value: Optional[float] = None

    # Bidding
    bids_count: int = 0

    # Categorization
    category: Optional[str] = None
    category_primary: Optional[str] = None
    category_secondary: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    # Location
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_address: Optional[str] = None

    # Media
    primary_image_url: Optional[str] = None
    images: List[str] = field(default_factory=list)

    # Documents
    edict_url: Optional[str] = None

    # Timing
    closing_at: Optional[datetime] = None

    # Seller
    seller_name: Optional[str] = None

    # Status
    status: str = 'active'
    risk_score: str = 'MÉDIO'

    # Source
    source_url: Optional[str] = None

    # Metadata (catch-all for platform-specific data)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion"""
        data = {
            'title': self.title,
            'auctioneer': self.auctioneer,
            'category': self.category,
            'current_bid': self.current_bid,
            'image_url': self.primary_image_url,
            'edict_url': self.edict_url,
            'closing_at': self.closing_at.isoformat() if self.closing_at else None,
            'risk_score': self.risk_score,
        }

        # Add optional fields if present
        if self.location_city:
            data['location_city'] = self.location_city
        if self.location_state:
            data['location_state'] = self.location_state

        # Store enhanced fields in metadata
        enhanced_metadata = {
            'platform': self.platform,
            'source_url': self.source_url,
            'category_primary': self.category_primary,
            'category_secondary': self.category_secondary,
            'tags': self.tags,
            'starting_bid': self.starting_bid,
            'bids_count': self.bids_count,
            'estimated_value': self.estimated_value,
            'seller_name': self.seller_name,
            'images': self.images,
            'primary_image_url': self.primary_image_url,
            'status': self.status,
            **self.metadata
        }

        data['metadata'] = enhanced_metadata

        # Remove None values
        return {k: v for k, v in data.items() if v is not None}


class BaseScraper(ABC):
    """
    Base scraper class with field normalization
    All platform-specific scrapers inherit from this
    """

    # Standard field definitions (all platforms must map to these)
    STANDARD_FIELDS = {
        'title', 'auctioneer', 'platform',
        'current_bid', 'starting_bid', 'estimated_value',
        'bids_count',
        'category', 'category_primary', 'category_secondary', 'tags',
        'location_city', 'location_state', 'location_address',
        'primary_image_url', 'images',
        'edict_url',
        'closing_at',
        'seller_name',
        'status', 'risk_score',
        'source_url',
    }

    # Default values for missing optional fields
    DEFAULT_VALUES = {
        'bids_count': 0,
        'status': 'active',
        'risk_score': 'MÉDIO',
        'category_primary': 'Outros',
        'tags': [],
        'images': [],
    }

    def __init__(self, auctioneer_name: str, platform: str):
        """
        Initialize base scraper

        Args:
            auctioneer_name: Display name (e.g., "Kwara", "Excel Leilões")
            platform: Platform identifier (e.g., "kwara", "excel")
        """
        self.auctioneer_name = auctioneer_name
        self.platform = platform

        # Subclasses define their field mappings
        self.field_mappings: Dict[str, str] = {}

        # Subclasses define their value transformers
        self.value_transformers: Dict[str, Callable] = {}

    @abstractmethod
    def fetch_lots(self) -> List[Dict]:
        """
        Fetch raw lots from platform API
        Returns list of raw API response dictionaries
        """
        pass

    def normalize_lots(self, raw_lots: List[Dict]) -> List[AuctionLot]:
        """
        Normalize raw API data into standard AuctionLot objects

        Args:
            raw_lots: List of raw API response dictionaries

        Returns:
            List of standardized AuctionLot objects
        """
        normalized_lots = []

        for raw_lot in raw_lots:
            try:
                lot = self._normalize_lot(raw_lot)
                if lot:
                    normalized_lots.append(lot)
            except Exception as e:
                logger.error(f"Error normalizing lot: {e}")
                logger.debug(f"Raw lot data: {raw_lot}")
                continue

        return normalized_lots

    def _normalize_lot(self, raw_lot: Dict) -> Optional[AuctionLot]:
        """
        Transform single raw lot into standard AuctionLot

        Process:
        1. Extract fields using field_mappings
        2. Transform values using value_transformers
        3. Apply defaults for missing fields
        4. Run platform-specific processing
        5. Store original data in metadata
        """
        normalized = {}

        # 1. Apply field mappings
        for standard_field, api_field in self.field_mappings.items():
            value = self._get_nested_value(raw_lot, api_field)
            normalized[standard_field] = value

        # 2. Apply value transformers
        for field, transformer in self.value_transformers.items():
            if field in normalized and normalized[field] is not None:
                try:
                    normalized[field] = transformer(normalized[field])
                except Exception as e:
                    logger.warning(f"Transformer failed for {field}: {e}")
                    normalized[field] = None

        # 3. Apply default values for missing fields
        for field, default_value in self.DEFAULT_VALUES.items():
            if field not in normalized or normalized[field] is None:
                normalized[field] = default_value

        # 4. Platform-specific processing
        try:
            normalized = self._platform_specific_processing(normalized, raw_lot)
        except Exception as e:
            logger.warning(f"Platform processing failed: {e}")

        # 5. Store original data in metadata (preserve everything!)
        # Remove fields we already extracted to avoid duplication
        metadata_keys = set(raw_lot.keys()) - set(self.field_mappings.values())
        normalized['metadata'] = {
            key: raw_lot[key]
            for key in metadata_keys
            if key not in ['listing', 'item']  # Skip complex nested objects
        }

        # 6. Add platform metadata
        normalized['platform'] = self.platform
        normalized['auctioneer'] = self.auctioneer_name

        # 7. Validate required fields
        if not normalized.get('title'):
            logger.warning("Lot missing title, skipping")
            return None

        try:
            return AuctionLot(**normalized)
        except Exception as e:
            logger.error(f"Error creating AuctionLot: {e}")
            logger.debug(f"Normalized data: {normalized}")
            return None

    def _get_nested_value(self, data: Dict, key_path: str) -> Any:
        """
        Extract value from nested dictionary using dot notation

        Examples:
            "sellerName" → data["sellerName"]
            "listing.sellerName" → data["listing"]["sellerName"]
            "listing.seller.name" → data["listing"]["seller"]["name"]
        """
        keys = key_path.split('.')
        value = data

        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None

            if value is None:
                return None

        return value

    def _platform_specific_processing(self, normalized: Dict, raw: Dict) -> Dict:
        """
        Platform-specific processing logic
        Override this method in subclasses to handle platform-specific logic

        Examples:
        - Extract primary image from images array
        - Parse location from platform-specific format
        - Derive category from title/description
        - Extract tags from text

        Args:
            normalized: Dictionary with normalized field values
            raw: Original raw API response

        Returns:
            Updated normalized dictionary
        """
        # Default implementation: no platform-specific processing
        return normalized

    def log_field_coverage(self, raw_lots: List[Dict]):
        """
        Log which fields are present/missing across all lots
        Useful for monitoring data quality
        """
        total_lots = len(raw_lots)

        field_coverage = {}

        for standard_field in self.STANDARD_FIELDS:
            lots_with_field = 0

            for raw_lot in raw_lots:
                # Check if field exists in raw data (via mapping)
                api_field = self.field_mappings.get(standard_field)
                if api_field and self._get_nested_value(raw_lot, api_field):
                    lots_with_field += 1
                elif standard_field in self.DEFAULT_VALUES:
                    # Field has default value, consider it "covered"
                    lots_with_field += 1

            coverage_pct = (lots_with_field / total_lots * 100) if total_lots > 0 else 0
            field_coverage[standard_field] = {
                'lots_with_field': lots_with_field,
                'coverage_pct': coverage_pct,
                'status': '✓' if coverage_pct >= 80 else '⚠️' if coverage_pct >= 50 else '✗'
            }

        logger.info(f"\n{'='*80}")
        logger.info(f"FIELD COVERAGE REPORT - {self.platform}")
        logger.info(f"{'='*80}")

        for field, coverage in sorted(field_coverage.items()):
            status = coverage['status']
            count = coverage['lots_with_field']
            pct = coverage['coverage_pct']
            logger.info(f"  {status} {field:20} {count:3}/{total_lots} ({pct:5.1f}%)")

        logger.info(f"{'='*80}\n")

        return field_coverage
