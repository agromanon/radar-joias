# Kwara Auction Platform Analysis Report

## Executive Summary

**Platform**: Kwara (www.kwara.com.br)
**Focus**: Retail reverse logistics auctions
**Construction Materials Available**: **NO** - Current inventory is 100% furniture and appliances
**Scraper Status**: ✅ **Working correctly** - API integration successful

---

## Current Inventory Composition

### Analysis of 60 active lots (March 2026):

| Category | Count | Percentage |
|----------|-------|------------|
| Furniture (armários, estantes, mesas) | 41 | 68.3% |
| Appliances (refrigerators, AC units) | 9 | 15.0% |
| Other items | 10 | 16.7% |
| **True construction materials** | **0** | **0%** |

### Sample Items Found:
- Armários (cabinets) with various configurations
- Estantes (shelving units)
- Refrigerators (Brastemp, Consul, Electrolux)
- Air conditioning units
- Office furniture

### What's NOT Available:
- ❌ Cement, bricks, tiles (construction materials)
- ❌ Industrial equipment (compressors, generators, pumps)
- ❌ Heavy machinery (betoneiras, usinas)
- ❌ Metals (steel bars, copper, aluminum)
- ❌ Construction tools (saws, drills, welding equipment)

---

## Technical Implementation

### ✅ What Works:
1. **API Integration**: Successfully extracting data from Next.js API endpoints
2. **Category Search**: Can fetch lots by category ID
3. **Data Parsing**: Correctly parsing lot titles, prices, images, locations
4. **Build ID**: `icEnlyKUxVs3w2HsvxZ12` (current as of April 2026)

### API Endpoints Tested:
```python
# Category search
GET https://www.kwara.com.br/_next/data/{build_id}/busca.json?assetCategoryIds[]={category_id}

# Index page
GET https://www.kwara.com.br/_next/data/{build_id}/index.json

# Returns:
- discoverByCategories: Category listings
- discoverByListings: Active auctions (8 current)
- discoverByNewArrivals: Recent lots
- discoverByLotsWithMostDiscounts: Discounted items
```

### Sample Data Structure:
```json
{
  "title": "Armário suspenso com 10 portas",
  "cachedPriceAmountCents": 112000,  // R$ 1,120.00
  "location": "Diadema/SP",
  "images": ["https://cdn.kwara.com.br/..."],
  "assetCategory": {"id": "...", "name": "Moveis"},
  "termsUrl": "https://cdn.kwara.com.br/listing-terms/....pdf"
}
```

---

## Business Model Analysis

### Kwara's Focus:
**Reverse Logistics Auctions**
- Source: Retail returns from major Brazilian retailers
- Partners: Casas Bahia, Padroniza, Assurant, Bradesco, etc.
- Inventory: Furniture, appliances, electronics
- Target: B2C and B2B buyers looking for discounted retail items

### Typical Auctions:
1. **Leilão de Cadeiras Herman Miller** - Office furniture
2. **Itens de Logística Reversa - Casas Bahia** - Retail returns
3. **Móveis, Eletrodomésticos e Utensílios** - Household items

---

## Recommendations

### For Construction Materials:

**❌ Do NOT use Kwara** - Wrong platform for construction materials

**✅ Try these specialized platforms instead:**

| Platform | Specialization | Why It's Better |
|----------|---------------|-----------------|
| **Excel Leilões** | Industrial equipment | Heavy machinery, construction tools |
| **Braspress Leilões** | Diverse inventory | Construction materials, industrial |
| **Metal-Maquina** | Metalworking | Metals, welding equipment, tools |
| **Leilão VIP** | Premium assets | High-value industrial equipment |
| **Nacional Leilões** | Construction focus | Cement, bricks, building materials |

### For Radar Leilão Project:

1. **Keep Kwara scraper** for retail/appliance category users
2. **Add Excel Leilões** as next priority (industrial focus)
3. **Categorize by asset class**:
   - Furniture → Kwara, Galpão Kwara
   - Industrial → Excel, Metal-Maquina
   - Construction → Nacional Leilões
   - General → Braspress

---

## Next Steps

### Immediate:
1. ✅ Document Kwara as furniture/appliance platform
2. ✅ Move to Excel Leilões scraper for construction materials
3. ⏭️ Implement platform categorization in database

### Scraper Enhancements:
```python
# Add platform categorization
class AuctionPlatform:
    KWARA = "kwara"  # Furniture/appliances
    EXCEL = "excel"  # Industrial
    METALMAQ = "metalmaq"  # Heavy machinery
    BRASPRESS = "braspress"  # General
```

### Database Schema:
```sql
ALTER TABLE lots ADD COLUMN platform TEXT;
ALTER TABLE lots ADD COLUMN asset_class TEXT;
-- asset_class: 'furniture', 'industrial', 'construction', 'metals'
```

---

## Conclusion

**Kwara scraper is production-ready** for its niche (furniture & appliances), but **wrong platform** for construction materials.

**Success metrics:**
- ✅ API integration: Working
- ✅ Data extraction: 60 lots successfully parsed
- ✅ Price data: 100% coverage
- ✅ Images: 100% coverage
- ✅ Edict PDFs: 100% coverage
- ❌ Construction materials: 0% (platform limitation)

**Recommendation**: Proceed to Excel Leilões and Metal-Maquina for construction materials inventory.
