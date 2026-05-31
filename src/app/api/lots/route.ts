"use server";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

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
 * - leiloes: If "true", applies active auction filters (outcome_status=null, enrichment_status=enriched, valor=not.null)
 */
export async function GET(request: NextRequest) {
  try {
    const svc = await createAdminClient();
    const searchParams = request.nextUrl.searchParams;

    const category = searchParams.get("category");
    const state = searchParams.get("state");
    const karat = searchParams.get("karat");
    const metalTag = searchParams.get("metal_tag"); // "prata" or "ouro" for tag-based filtering
    const risk_score = searchParams.get("risk_score");
    const min_bid = searchParams.get("min_bid");
    const max_bid = searchParams.get("max_bid");
    const min_weight = searchParams.get("min_weight");
    const max_weight = searchParams.get("max_weight");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const sort = searchParams.get("sort") || "id";
    const order = searchParams.get("order") || "desc";
    const leiloes = searchParams.get("leiloes") === "true";
    const vendas = searchParams.get("vendas") === "true";

    // Build query
    const selectCols = leiloes || vendas
      ? "*, auctions(auction_code, bid_end_date, result_date, status, centralizer_unit, bid_start_date)"
      : "*";
    let query = svc
      .from("lots")
      .select(selectCols, { count: "estimated" });

    // Leiloes active auction filters
    if (leiloes) {
      query = query.is("outcome_status", null);
      query = query.eq("enrichment_status", "enriched");
      query = query.not("valor", "is", null);
    }

    // Vendas sold lots filters
    if (vendas) {
      query = query.eq("was_sold", true);
    }

    // Apply filters
    if (category) {
      // Use category_enriched for enriched types (Aliança, Anel, etc.), fallback to category
      query = query.or(`category_enriched.ilike.%${category}%,category.eq.${category}`);
    }

    if (state) {
      query = query.eq("sg_uf", state);
    }

    if (karat) {
      if (karat === "unspecified") {
        query = query.is("karat", null);
      } else {
        query = query.eq("karat", karat);
      }
    }

    // Tag-based metal filter: "prata" for silver, "ouro" for gold
    if (metalTag) {
      query = query.or(`tags.cs.{"${metalTag}"}`);
    }

    if (risk_score) {
      query = query.eq("risk_score", risk_score);
    }

    if (min_bid) {
      query = query.gte("valor", parseFloat(min_bid));
    }

    if (max_bid) {
      query = query.lte("valor", parseFloat(max_bid));
    }

    if (min_weight) {
      query = query.gte("weight_enriched", parseFloat(min_weight));
    }

    if (max_weight) {
      query = query.lte("weight_enriched", parseFloat(max_weight));
    }

    // Full-text search on de_contrato
    if (search) {
      query = query.ilike("de_contrato", `%${search}%`);
    }

    // Fetch by specific lot ID (used by lot detail page)
    const idParam = searchParams.get("id");
    if (idParam) {
      query = query.eq("id", parseInt(idParam));
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Sorting - bid_end is computed from bid_periods, so we sort in memory after fetching
    // price_asc/desc use valor, id uses id, otherwise default to id
    let dbSortCol = "id";
    if (sort === "price") dbSortCol = "valor";
    else if (sort === "id") dbSortCol = "id";

    if (sort !== "bid_end") {
      query = query.order(dbSortCol, { ascending: order === "asc" });
    }

    // Execute query with pagination
    const { data: lots, error, count } = await query.range(from, to);

    if (error) {
      console.error("Error fetching lots:", error);
      return NextResponse.json(
        { error: "Failed to fetch lots", details: error.message },
        { status: 500 }
      );
    }

    // Get unique auctioneers for filter dropdown (only when no other filters active to avoid full table scan)
    let uniqueAuctioneers: string[] = [];
    const hasFilters = !!(category || state || karat || risk_score || min_bid || max_bid || min_weight || max_weight || search || idParam);
    if (!hasFilters) {
      const { data: auctioneers } = await svc
        .from("lots")
        .select("auctioneer")
        .not("auctioneer", "is", null);
      uniqueAuctioneers = [...new Set(auctioneers?.map((a: any) => a.auctioneer) || [])];
    }

    // Get bid periods for cities — match to auction's result_date when available
    const cityIds = [...new Set((lots as any)?.map((l: any) => l.city_id).filter(Boolean) || [])];
    let bidPeriodsByCity: Record<number, {start_date: string, end_date: string, result_date?: string}> = {};
    if (cityIds.length > 0) {
      const { data: periods } = await svc
        .from("bid_periods")
        .select("city_id, start_date, end_date, is_active")
        .in("city_id", cityIds)
        .order("end_date", { ascending: false });
      if (periods) {
        const seen = new Set<number>();
        for (const p of periods) {
          if (!seen.has(p.city_id)) {
            seen.add(p.city_id);
            bidPeriodsByCity[p.city_id] = { start_date: p.start_date, end_date: p.end_date };
          }
        }
      }
    }

    // Also get result_dates for completed auctions
    const auctionIds = [...new Set((lots as any)?.map((l: any) => l.auction_id).filter(Boolean) || [])];
    let resultDatesByAuctionId: Record<number, string> = {};
    if (auctionIds.length > 0) {
      const { data: completedAuctions } = await svc
        .from("auctions")
        .select("id, result_date, status")
        .in("id", auctionIds)
        .eq("status", "COMPLETED");
      if (completedAuctions) {
        for (const a of completedAuctions) {
          if (a.result_date) {
            resultDatesByAuctionId[a.id] = a.result_date;
          }
        }
      }
    }

    // Use auction's bid dates if available, else bid_periods, else result_date (completed)
    let lotsWithSourceUrl = (lots as any)?.map((lot: any) => {
      const auction = lot.auctions;
      // auction bid dates (usually null — scrape didn't capture them)
      const bid_end_auction = auction?.bid_end_date || null;
      const bid_start_auction = auction?.bid_start_date || null;

      // city-wide bid_periods (match by city)
      const cityPeriod = bidPeriodsByCity[lot.city_id];

      // For completed auctions, prefer result_date over city-wide bid_periods
      const isCompleted = auction?.status === "COMPLETED" || lot.was_sold;
      const result_date = resultDatesByAuctionId[lot.auction_id];

      // Priority: auction dates > (completed ? result_date) > bid_periods
      let bid_end = bid_end_auction;
      let bid_start = bid_start_auction;
      if (!bid_end) {
        if (isCompleted && result_date) {
          bid_end = result_date;
          bid_start = null;
        } else if (cityPeriod) {
          bid_end = cityPeriod.end_date;
          bid_start = cityPeriod.start_date;
        }
      }

      return {
        ...lot,
        source_url: lot.metadata?.source_url || lot.source_url,
        bid_end,
        bid_start,
      };
    });

    // Sort by bid_end if requested (most urgent first)
    // Past bid_end (auction ended, awaiting results) goes to bottom; future dates sort normally
    if (sort === "bid_end") {
      const now = Date.now();
      lotsWithSourceUrl.sort((a: any, b: any) => {
        const aEnd = a.bid_end ? new Date(a.bid_end).getTime() : Infinity;
        const bEnd = b.bid_end ? new Date(b.bid_end).getTime() : Infinity;
        const aPast = aEnd < now;
        const bPast = bEnd < now;
        if (aPast && !bPast) return 1;   // past → push down
        if (!aPast && bPast) return -1; // future → bring forward
        return aEnd - bEnd;              // both same status → sort ascending
      });
    }

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
    if (!body.lot_number) {
      return NextResponse.json(
        { error: "Missing required fields: title, auctioneer, category" },
        { status: 400 }
      );
    }

    // Create lot using service role client
    const svc = await createAdminClient();
    const { data, error } = await svc
      .from("lots")
      .insert({
        lot_number: body.lot_number,
        contract_number: body.contract_number,
        de_contrato: body.de_contrato,
        valor: body.valor,
        url_imagem_capa: body.url_imagem_capa,
        outcome_status: body.outcome_status,
        sg_uf: body.sg_uf,
        co_leilao: body.co_leilao,
        city_id: body.city_id,
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
