import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/lots/[id]
 * Get a single lot by ID or slug with on-demand detailed scraping
 *
 * Strategy:
 * 1. Try to find lot by ID first
 * 2. If not found, try by slug
 * 3. If scrape_stage = 'basic', fetch extended fields on-demand
 * 4. Return complete lot data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    // Step 1: Try to find by ID first
    let { data: lot, error } = await supabase
      .from("lots")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    // Step 2: If not found by ID, try by slug
    if (!lot || error) {
      const { data: slugLot, error: slugError } = await supabase
        .from("lots")
        .select("*")
        .eq("slug", id)
        .maybeSingle();

      if (!slugLot || slugError) {
        return NextResponse.json(
          { error: "Lot not found" },
          { status: 404 }
        );
      }

      lot = slugLot;
      error = slugError;
    }

    // Step 3: On-demand scraping if only basic data available
    if (lot.scrape_stage === 'basic') {
      console.log(`⏳ Cache miss for ${lot.slug} - fetching extended fields...`);

      // Fetch extended fields from Kwara API
      const extendedLot = await fetchKwaraLotDetails(lot.slug);

      if (extendedLot) {
        // Update database with extended fields
        const { data: updatedLot, error: updateError } = await supabase
          .from("lots")
          .update({
            scrape_stage: 'detailed',
            last_scraped_at: new Date().toISOString(),
            // Extended fields
            refs: extendedLot.refs || null,
            general_observations: extendedLot.general_observations || null,
            visiting_observations: extendedLot.visiting_observations || null,
            visiting_address: extendedLot.visiting_address || null,
            pickup_observations: extendedLot.pickup_observations || null,
            pickup_address: extendedLot.pickup_address || null,
            measurements: extendedLot.measurements || null,
            listing_title: extendedLot.listing_title || null,
            starting_bid: extendedLot.starting_bid || null,
            buyer_fee_percentage: extendedLot.buyer_fee_percentage || null,
            minimum_increment: extendedLot.minimum_increment || null,
            views: (extendedLot.views || 0),
            bids_count: (extendedLot.bids_count || 0),
            seller_name: extendedLot.seller_name || null,
            seller_logo_url: extendedLot.seller_logo_url || null,
          })
          .eq("slug", lot.slug)
          .select()
          .single();

        if (!updateError && updatedLot) {
          console.log(`✓ Fetched and saved extended fields for ${lot.slug}`);
          lot = updatedLot;
        }
      }
    }

    // Check if lot is in user's watchlist
    const user = await getServerUser();
    let isInWatchlist = false;

    if (user) {
      const { data: watchlistEntry } = await supabase
        .from("watchlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("lot_id", id)
        .maybeSingle();

      isInWatchlist = !!watchlistEntry;
    }

    // Extract source_url from metadata if it exists
    const source_url = lot.metadata?.source_url || lot.source_url;

    return NextResponse.json({
      lot: {
        ...lot,
        source_url, // Promote source_url to top-level field
        is_in_watchlist: isInWatchlist,
      },
    });
  } catch (error) {
    console.error("Error in lot API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/lots/[id]
 * Update a lot (requires service role key - for scrapers only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    // Verify service role key
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - service role key required" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Forbidden - invalid service role key" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from("lots")
      .update({
        title: body.title,
        auctioneer: body.auctioneer,
        current_bid: body.current_bid,
        image_url: body.image_url,
        risk_score: body.risk_score,
        category: body.category,
        edict_url: body.edict_url,
        closing_at: body.closing_at,
        location_lat: body.location_lat,
        location_lng: body.location_lng,
        location_city: body.location_city,
        location_state: body.location_state,
        description: body.description,
        metadata: body.metadata,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating lot:", error);
      return NextResponse.json(
        { error: "Failed to update lot", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ lot: data });
  } catch (error) {
    console.error("Error in lot API PATCH:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lots/[id]
 * Delete a lot (requires service role key)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    // Verify service role key
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - service role key required" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Forbidden - invalid service role key" },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("lots").delete().eq("id", id);

    if (error) {
      console.error("Error deleting lot:", error);
      return NextResponse.json(
        { error: "Failed to delete lot", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in lot API DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Fetch extended lot details from Kwara API
 * Used for on-demand scraping when lot only has basic data
 */
async function fetchKwaraLotDetails(slug: string): Promise<any | null> {
  try {
    const buildId = '9cYkevqRi1YyTe6cMTdam'; // Current build ID
    const url = `https://www.kwara.com.br/_next/data/${buildId}/bens/${slug}.json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RadarLeilao-Bot/1.0)',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'x-nextjs-data': '1'
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error(`Kwara API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const lotDetails = data?.pageProps?.lotDetails;

    if (!lotDetails) {
      console.error('Lot details not found in API response');
      return null;
    }

    // Map API response to database schema
    return {
      refs: lotDetails.refs || [],
      general_observations: lotDetails.generalObservations || null,
      visiting_observations: lotDetails.visitingObservations || null,
      visiting_address: lotDetails.visitingAddress || null,
      pickup_observations: lotDetails.pickupObservations || null,
      pickup_address: lotDetails.pickupAddress || null,
      measurements: lotDetails.measurements || null,
      listing_title: lotDetails.listing?.title || null,
      starting_bid: lotDetails.lotAuctionSettings?.[0]?.startingBidCents
        ? lotDetails.lotAuctionSettings[0].startingBidCents / 100
        : null,
      buyer_fee_percentage: lotDetails.buyerFeePercentage || null,
      minimum_increment: lotDetails.lotAuctionSettings?.[0]?.minimumIncrementCents
        ? lotDetails.lotAuctionSettings[0].minimumIncrementCents / 100
        : null,
      views: lotDetails.views || 0,
      bids_count: lotDetails.cachedBidsCount || 0,
      seller_name: lotDetails.seller?.displayName || null,
      seller_logo_url: lotDetails.seller?.logoUrl || null
    };

  } catch (error) {
    console.error('Error fetching from Kwara API:', error);
    return null;
  }
}
