import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * POST /api/lots/[id]/refresh
 * Fetch fresh bidding data from Kwara API
 * Updates only dynamic fields: current_bid, bids_count, views
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    // Get current lot to find slug
    const { data: currentLot } = await supabase
      .from('lots')
      .select('slug')
      .eq('id', id)
      .single();

    if (!currentLot) {
      return NextResponse.json(
        { error: 'Lot not found' },
        { status: 404 }
      );
    }

    // Fetch fresh data from Kwara API
    const buildId = '9cYkevqRi1YyTe6cMTdam';
    const url = `https://www.kwara.com.br/_next/data/${buildId}/bens/${currentLot.slug}.json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLeilao-Bot/1.0)',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'x-nextjs-data': '1'
      }
    });

    if (!response.ok) {
      console.error(`Kwara API error: ${response.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch fresh data from Kwara' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const lotDetails = data?.pageProps?.lotDetails;

    if (!lotDetails) {
      console.error('Invalid API response structure:', JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: 'Invalid response from Kwara API' },
        { status: 502 }
      );
    }

    // Debug: log the auction settings to understand the API structure
    console.log('Lot ID:', id);
    console.log('Slug:', currentLot.slug);
    console.log('cachedPriceAmountCents:', lotDetails.cachedPriceAmountCents);
    console.log('lotAuctionSettings:', JSON.stringify(lotDetails.lotAuctionSettings, null, 2));
    console.log('cachedBidsCount:', lotDetails.cachedBidsCount);
    console.log('views:', lotDetails.views);


    // Extract dynamic fields
    // Use cachedPriceAmountCents from the item directly (not from auctionSettings)
    const freshData = {
      id: id,
      current_bid: lotDetails.cachedPriceAmountCents !== null && lotDetails.cachedPriceAmountCents !== undefined
        ? lotDetails.cachedPriceAmountCents / 100
        : null,
      bids_count: lotDetails.cachedBidsCount || 0,
      views: lotDetails.views || 0,
      last_scraped_at: new Date().toISOString(),
    };

    // Update database
    const { error: updateError } = await supabase
      .from('lots')
      .update({
        current_bid: freshData.current_bid,
        bids_count: freshData.bids_count,
        views: freshData.views,
        last_scraped_at: freshData.last_scraped_at,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating database:', updateError);
      return NextResponse.json(
        { error: 'Failed to update lot data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lot: freshData,
      message: 'Price updated successfully'
    });

  } catch (error) {
    console.error('Error refreshing lot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
