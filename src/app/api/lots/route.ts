import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/lots
 * List lots with filtering, pagination, and search
 *
 * Query params:
 * - category: Filter by category
 * - state: Filter by location state (UF)
 * - risk_score: Filter by risk level (BAIXO, MÉDIO, ALTO)
 * - min_bid: Minimum current bid
 * - max_bid: Maximum current bid
 * - search: Full-text search query
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
 * - sort: Sort field (created_at, closing_at, current_bid)
 * - order: Sort order (asc, desc)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const searchParams = await request.nextUrl.searchParams;

    const category = searchParams.get("category");
    const state = searchParams.get("state");
    const risk_score = searchParams.get("risk_score");
    const min_bid = searchParams.get("min_bid");
    const max_bid = searchParams.get("max_bid");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    // Build query
    let query = supabase
      .from("lots")
      .select("*", { count: "exact" });

    // Apply filters
    if (category) {
      query = query.eq("category", category);
    }

    if (state) {
      query = query.eq("location_state", state);
    }

    if (risk_score) {
      query = query.eq("risk_score", risk_score);
    }

    if (min_bid) {
      query = query.gte("current_bid", parseFloat(min_bid));
    }

    if (max_bid) {
      query = query.lte("current_bid", parseFloat(max_bid));
    }

    // Full-text search
    if (search) {
      query = query.textSearch("title", search);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Sorting
    query = query.order(sort, { ascending: order === "asc" });

    // Execute query with pagination
    const { data: lots, error, count } = await query.range(from, to);

    if (error) {
      console.error("Error fetching lots:", error);
      return NextResponse.json(
        { error: "Failed to fetch lots", details: error.message },
        { status: 500 }
      );
    }

    // Get unique auctioneers for filter dropdown
    const { data: auctioneers } = await supabase
      .from("lots")
      .select("auctioneer")
      .not("auctioneer", "is", null)
      .order("auctioneer");

    const uniqueAuctioneers = [...new Set(auctioneers?.map((a) => a.auctioneer) || [])];

    // Extract source_url from metadata for each lot
    const lotsWithSourceUrl = lots?.map((lot) => ({
      ...lot,
      source_url: lot.metadata?.source_url || lot.source_url,
    })) || [];

    // Return response with pagination metadata
    return NextResponse.json({
      lots: lotsWithSourceUrl,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: (count || 0) > to + 1,
      },
      filters: {
        auctioneers: uniqueAuctioneers,
      },
    });
  } catch (error) {
    console.error("Error in lots API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lots
 * Create a new lot (requires service role key - for scrapers only)
 *
 * Body:
 * - title: string (required)
 * - auctioneer: string (required)
 * - current_bid: number
 * - image_url: string
 * - risk_score: "BAIXO" | "MÉDIO" | "ALTO"
 * - category: string (required)
 * - edict_url: string
 * - closing_at: ISO datetime
 * - location_lat: number
 * - location_lng: number
 * - location_city: string
 * - location_state: string
 * - description: string
 * - metadata: object
 */
export async function POST(request: NextRequest) {
  try {
    // Verify service role key (for scrapers)
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

    // Validate required fields
    if (!body.title || !body.auctioneer || !body.category) {
      return NextResponse.json(
        { error: "Missing required fields: title, auctioneer, category" },
        { status: 400 }
      );
    }

    // Create lot using service role client
    const { data: { user } } = await supabase.auth.getUser();
    const serviceRoleSupabase = supabase; // In production, use service role client

    const { data, error } = await serviceRoleSupabase
      .from("lots")
      .insert({
        title: body.title,
        auctioneer: body.auctioneer,
        current_bid: body.current_bid,
        image_url: body.image_url,
        risk_score: body.risk_score || "MÉDIO",
        category: body.category,
        edict_url: body.edict_url,
        closing_at: body.closing_at,
        location_lat: body.location_lat,
        location_lng: body.location_lng,
        location_city: body.location_city,
        location_state: body.location_state,
        description: body.description,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating lot:", error);
      return NextResponse.json(
        { error: "Failed to create lot", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ lot: data }, { status: 201 });
  } catch (error) {
    console.error("Error in lots API POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
