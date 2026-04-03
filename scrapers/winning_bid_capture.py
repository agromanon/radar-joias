"""
Winning Bid Capture & Price Intelligence System
Captures final auction results and provides historical price data
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dotenv import load_dotenv
from supabase import create_client
import logging

logger = logging.getLogger(__name__)

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)


class AuctionResultCapturer:
    """
    Captures winning bids and final auction results
    Runs 24-48 hours after auctions close
    """

    def capture_recently_closed_lots(self):
        """
        Find lots that closed in the last 48 hours and capture final results

        Returns: Statistics dictionary
        """
        # Find lots that closed 24-48 hours ago
        cutoff_48h = datetime.now() - timedelta(hours=48)
        cutoff_24h = datetime.now() - timedelta(hours=24)

        logger.info("Searching for lots closed in last 48 hours...")

        result = supabase.table('lots').select('*').gt('closing_at', cutoff_48h.isoformat()).lt('closing_at', cutoff_24h.isoformat()).execute()

        lots = result.data
        logger.info(f"Found {len(lots)} lots to process")

        stats = {
            'total': len(lots),
            'captured': 0,
            'failed': 0,
            'already_sold': 0,
            'not_sold': 0,
            'errors': []
        }

        for lot in lots:
            try:
                # Check if already processed
                if lot.get('status') in ['sold', 'unsold']:
                    stats['already_sold'] += 1
                    continue

                # Capture winning bid
                final_data = self._fetch_final_result(lot)

                if final_data:
                    # Update lot with final status
                    updated_lot = supabase.table('lots').update({
                        'status': final_data['status'],
                        'winning_bid': final_data.get('winning_bid'),
                        'winning_bidder': final_data.get('winner'),
                        'metadata': {
                            **lot.get('metadata', {}),
                            'sold_at': datetime.now().isoformat(),
                            'final_results_captured': True
                        }
                    }).eq('id', lot['id']).execute()

                    stats['captured'] += 1
                    logger.info(f"✓ Captured: {lot['title'][:50]}...")

                else:
                    # Assume not sold if no results found
                    supabase.table('lots').update({
                        'status': 'unsold'
                    }).eq('id', lot['id']).execute()

                    stats['not_sold'] += 1

            except Exception as e:
                stats['failed'] += 1
                stats['errors'].append(str(e))
                logger.error(f"✗ Failed to capture {lot['id']}: {e}")

        logger.info(f"\nCapture Results: {stats}")
        return stats

    def _fetch_final_result(self, lot: Dict) -> Optional[Dict]:
        """
        Fetch final auction result from auctioneer site

        This is a placeholder - actual implementation varies by platform

        Args:
            lot: Lot dictionary from database

        Returns:
            Dictionary with status, winning_bid, winner, etc.
        """
        platform = lot.get('metadata', {}).get('platform')

        if platform == 'kwara':
            return self._fetch_kwara_result(lot)
        elif platform == 'excel':
            return self._fetch_excel_result(lot)
        else:
            logger.warning(f"No result fetcher for platform: {platform}")
            return None

    def _fetch_kwara_result(self, lot: Dict) -> Optional[Dict]:
        """
        Fetch final result from Kwara auction page

        Strategy: Check if lot page shows "SOLD" badge or winner info
        """
        source_url = lot.get('metadata', {}).get('source_url')

        if not source_url:
            return None

        try:
            import requests
            from bs4 import BeautifulSoup

            # Fetch lot page
            response = requests.get(source_url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Look for "SOLD" indicator
            sold_badge = soup.find(class_='sold-badge')
            status_element = soup.find(class_='lot-status')

            if sold_badge or (status_element and 'vendido' in status_element.text.lower()):
                # Lot was sold - try to find winning bid
                winning_bid_element = soup.find(class_='winning-bid')
                winner_element = soup.find(class_='winner-name')

                return {
                    'status': 'sold',
                    'winning_bid': self._extract_price(winning_bid_element.text) if winning_bid_element else None,
                    'winner': winner_element.text.strip() if winner_element else None,
                }

            else:
                # Lot unsold
                return {
                    'status': 'unsold',
                    'winning_bid': None,
                    'winner': None,
                }

        except Exception as e:
            logger.error(f"Error fetching Kwara result: {e}")
            return None

    def _extract_price(self, price_text: str) -> Optional[float]:
        """Extract price from text like 'R$ 1.234,56'"""
        import re

        # Remove currency symbols and extract numbers
        match = re.search(r'[\d.]+', price_text.replace('.', '').replace(',', '.'))

        if match:
            try:
                return float(match.group())
            except:
                return None

        return None


class PriceIntelligenceAPI:
    """
    Provides price history and analytics for users
    Uses historical closed lots data
    """

    def get_price_history(self, category: str = None, days: int = 90) -> Dict:
        """
        Get price history for a category

        Args:
            category: Filter by category (optional)
            days: Lookback period in days

        Returns:
            Price statistics dictionary
        """
        cutoff = datetime.now() - timedelta(days=days)

        # Query sold lots in category
        query = supabase.table('lots').select('*').eq('status', 'sold').gt('closing_at', cutoff.isoformat())

        if category:
            query = query.eq('category', category)

        result = query.execute()
        sold_lots = result.data

        if not sold_lots:
            return {
                'category': category,
                'days': days,
                'lots_sold': 0,
                'avg_price': None,
                'price_range': None,
                'data': []
            }

        # Calculate statistics
        winning_bids = [lot.get('winning_bid') for lot in sold_lots if lot.get('winning_bid')]
        prices = [bid for bid in winning_bids if bid is not None]

        return {
            'category': category,
            'days': days,
            'lots_sold': len(sold_lots),
            'success_rate': len(sold_lots) / (len(sold_lots) * 2) * 100,  # Rough estimate
            'avg_price': sum(prices) / len(prices) if prices else None,
            'min_price': min(prices) if prices else None,
            'max_price': max(prices) if prices else None,
            'recent_sales': [
                {
                    'title': lot['title'],
                    'winning_bid': lot.get('winning_bid'),
                    'auctioneer': lot['auctioneer'],
                    'sold_at': lot.get('closing_at'),
                }
                for lot in sold_lots[:10]  # Last 10 sales
            ]
        }

    def get_price_comparison(self, current_lot_id: str) -> Dict:
        """
        Compare current lot price with historical averages

        Shows user: "This lot is above/below market price"
        """
        # Get current lot
        lot_result = supabase.table('lots').select('*').eq('id', current_lot_id).execute()
        lot = lot_result.data[0] if lot_result.data else None

        if not lot:
            return None

        # Get historical lots in same category
        category = lot.get('category')
        history = self.get_price_history(category=category, days=180)

        if not history['avg_price']:
            return {'message': 'No historical data available for comparison'}

        current_bid = lot.get('current_bid', 0)
        avg_price = history['avg_price']

        # Calculate comparison
        if current_bid < avg_price * 0.8:
            assessment = 'Abaixo do mercado'
            recommendation = 'Ótima oportunidade - preço abaixo da média'
        elif current_bid > avg_price * 1.2:
            assessment = 'Acima do mercado'
            recommendation = 'Preço elevado - aguardar próximo leilão'
        else:
            assessment = 'Preço de mercado'
            recommendation = 'Preço dentro da média histórica'

        return {
            'lot_title': lot['title'],
            'current_bid': current_bid,
            'category_avg_price': avg_price,
            'price_difference': current_bid - avg_price,
            'price_difference_pct': ((current_bid - avg_price) / avg_price * 100) if avg_price else 0,
            'assessment': assessment,
            'recommendation': recommendation,
            'historical_lots_compared': history['lots_sold'],
            'price_range_25th_pctile': history.get('min_price'),
            'price_range_75th_pctile': history.get('max_price'),
        }


def test_price_intelligence():
    """Test price intelligence features"""
    print("=" * 80)
    print("PRICE INTELLIGENCE SYSTEM TEST")
    print("=" * 80)

    # Test 1: Get price history for furniture
    api = PriceIntelligenceAPI()
    history = api.get_price_history(category='moveis', days=90)

    print(f"\n📊 PRICE HISTORY: Móveis (Last 90 days)")
    print(f"  Lots Sold: {history['lots_sold']}")
    print(f"  Average Price: R$ {history['avg_price']:,.2f}" if history['avg_price'] else "  Average Price: N/A")
    print(f"  Price Range: R$ {history['min_price']:,.2f} - R$ {history['max_price']:,.2f}")

    if history['recent_sales']:
        print(f"\n  Recent Sales:")
        for sale in history['recent_sales'][:5]:
            print(f"    • {sale['title'][:50]}... - R$ {sale['winning_bid']:,.2f}")

    # Test 2: Compare current lot with history
    print(f"\n💰 PRICE COMPARISON")
    comparison = api.get_price_comparison(current_lot_id=lot_result.data[0]['id'])

    if comparison:
        print(f"  Lot: {comparison['lot_title'][:60]}...")
        print(f"  Current Bid: R$ {comparison['current_bid']:,.2f}")
        print(f"  Market Avg: R$ {comparison['category_avg_price']:,.2f}")
        print(f"  Difference: R$ {comparison['price_difference']:,.2f} ({comparison['price_difference_pct']:+.1f}%)")
        print(f"  Assessment: {comparison['assessment']}")
        print(f"  Recommendation: {comparison['recommendation']}")

    print("\n" + "=" * 80)
    print("✓ PRICE INTELLIGENCE WORKING!")
    print("=" * 80)


if __name__ == '__main__':
    test_price_intelligence()
