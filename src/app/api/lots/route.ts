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
    const idParam = searchParams.get("id");

    // Build query — always include auctions for single-lot fetches
    // idParam needs auction_id for the auction data fetch; leiloes/vendas use auction FK join
    const selectCols = leiloes || vendas || idParam
      ? "*, auctions(auction_code, bid_end_date, result_date, status, centralizer_unit, bid_start_date)"
      : "*, auction_id";
    let query = svc
      .from("lots")
      .select(selectCols, { count: "estimated" });

    // Leiloes active auction filters
    if (leiloes) {
      query = query.is("outcome_status", null);
      query = query.eq("enrichment_status", "enriched");
      query = query.not("valor", "is", null);
      // Note: completed auction exclusion is done post-fetch (see below)
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
    if (idParam) {
      query = query.eq("id", parseInt(idParam));
    }

    // Sorting - bid_end is computed from bid_periods, so we sort in memory after fetching
    // price_asc/desc use valor, id uses id, otherwise default to id
    let dbSortCol = "id";
    if (sort === "price") dbSortCol = "valor";
    else if (sort === "id") dbSortCol = "id";

    // For bid_end sort, we must fetch all results first then sort+paginate in memory
    // because bid_end comes from bid_periods join and can't be sorted in SQL
    const isBidEndSort = sort === "bid_end";
    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit - 1;

    if (!isBidEndSort) {
      query = query.order(dbSortCol, { ascending: order === "asc" });
    }

    // Execute query — use range pagination for normal sorts, fetch all for bid_end sort
    console.error("DEBUG: before query, fromIdx=", fromIdx, "toIdx=", toIdx, "isBidEndSort=", isBidEndSort);
    let { data: lots, error, count } = isBidEndSort
      ? await query.limit(500) // cap at 500 for bid_end sort to prevent OOM
      : await query.range(fromIdx, toIdx);
    console.error("DEBUG: after query, lots count =", (lots || []).length, "count =", count);

    if (error) {
      console.error("Error fetching lots:", error);
      return NextResponse.json(
        { error: "Failed to fetch lots", details: error.message },
        { status: 500 }
      );
    }

    // For leiloes: filter out lots from auctions that have ended OR cities with no future bid periods
    if (leiloes) {
      const today = new Date().toISOString().split("T")[0];
      const { data: allAuctions } = await svc
        .from("auctions")
        .select("id, auction_code, status, result_date");
      // Exclude: status=COMPLETED OR result_date is in the past
      const excludeAuctionIds: number[] = [];
      const excludeAuctionCodes: Set<string> = new Set();
      if (allAuctions) {
        for (const a of allAuctions as any[]) {
          if (a.status === "COMPLETED" || (a.result_date && a.result_date < today)) {
            excludeAuctionIds.push(a.id);
            if (a.auction_code) excludeAuctionCodes.add(a.auction_code);
          }
        }
      }
      // Find cities whose latest bid_period ended before today (no future bidding possible)
      const { data: latestPeriods } = await svc
        .from("bid_periods")
        .select("city_id, end_date")
        .order("end_date", { ascending: false });
      const latestByCity: Record<number, string> = {};
      if (latestPeriods) {
        for (const p of latestPeriods as any[]) {
          if (!latestByCity[p.city_id]) {
            latestByCity[p.city_id] = p.end_date;
          }
        }
      }
      const endedCityIds = Object.entries(latestByCity)
        .filter(([_, end_date]) => end_date < today)
        .map(([city_id]) => parseInt(city_id));

      // Only filter if we have exclude criteria
      if (excludeAuctionIds.length > 0 || excludeAuctionCodes.size > 0 || endedCityIds.length > 0) {
        lots = (lots || []).filter((l: any) => {
          // Exclude if auction is ended (COMPLETED or past result_date)
          if (l.auction_id && excludeAuctionIds.includes(l.auction_id)) return false;
          // Exclude if co_leilao matches an ended auction_code
          if (l.co_leilao && excludeAuctionCodes.has(l.co_leilao)) return false;
          // Exclude ONLY if city has NO future bid periods AND no auction_id
          // (lots with valid auction_id that isn't excluded should remain)
          if (!l.auction_id && l.city_id && endedCityIds.includes(l.city_id)) return false;
          return true;
        }) as any;
      }
    }

    // For vendas: also fetch lots from completed auctions awaiting results (outcome_status=null)
    // These are NOT in the was_sold=true query but should appear on vendas page
    if (vendas) {
      const { data: completedAuctionRows } = await svc
        .from("auctions")
        .select("id")
        .eq("status", "COMPLETED");
      const completedIds = completedAuctionRows?.map((a: any) => a.id) || [];

      if (completedIds.length > 0 && page === 1) {
        // On first page only: fetch completed auction lots (no pagination, capped at 200)
        const { data: completedLots } = await svc
          .from("lots")
          .select(selectCols, { count: "estimated" })
          .in("auction_id", completedIds)
          .is("outcome_status", null)
          .limit(200);

        // Merge with was_sold lots, avoiding duplicates — awaiting results first, then sold
        const soldIds = new Set((lots as any)?.map((l: any) => l.id) || []);
        const extraLots = (completedLots || []).filter((l: any) => !soldIds.has(l.id));
        lots = [...extraLots, ...(lots || [])].slice(0, limit) as any;
      }
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

    // Get bid periods for cities — store both past and future periods per city
    const cityIds = [...new Set((lots as any)?.map((l: any) => l.city_id).filter(Boolean) || [])];
    let bidPeriodsByCity: Record<number, {past: {start_date: string, end_date: string} | null, future: {start_date: string, end_date: string} | null}> = {};
    if (cityIds.length > 0) {
      const { data: periods } = await svc
        .from("bid_periods")
        .select("city_id, start_date, end_date, is_active")
        .in("city_id", cityIds)
        .order("end_date", { ascending: false });
      if (periods) {
        for (const p of periods) {
          if (!bidPeriodsByCity[p.city_id]) {
            bidPeriodsByCity[p.city_id] = { past: null, future: null };
          }
          const today = new Date().toISOString().split("T")[0];
          if (p.end_date < today) {
            // Past period — store the most recent past period
            if (!bidPeriodsByCity[p.city_id].past) {
              bidPeriodsByCity[p.city_id].past = { start_date: p.start_date, end_date: p.end_date };
            }
          } else {
            // Future period — store the nearest future period
            if (!bidPeriodsByCity[p.city_id].future) {
              bidPeriodsByCity[p.city_id].future = { start_date: p.start_date, end_date: p.end_date };
            }
          }
        }
      }
    }

    // Fetch auction data separately (join via FK not reliable in this context)
    // For leiloes: use co_leilao to lookup auction by auction_code; for others: use auction_id column
    let auctionDataById: Record<string, {status: string, result_date: string, bid_end_date: string, bid_start_date: string}> = {};
    if (leiloes) {
      // For leiloes, lookup by co_leilao (auction_code format) and auction status
      const coLeiloes = [...new Set((lots as any)?.map((l: any) => l.co_leilao).filter(Boolean) || [])];
      if (coLeiloes.length > 0) {
        const { data: auctionRows } = await svc
          .from("auctions")
          .select("id, auction_code, status, result_date, bid_end_date, bid_start_date")
          .in("auction_code", coLeiloes);
        if (auctionRows) {
          for (const a of auctionRows) {
            auctionDataById[a.auction_code] = a;
          }
        }
      }
    } else {
      const auctionIds = [...new Set((lots as any)?.map((l: any) => l.auction_id).filter(Boolean) || [])];
      if (auctionIds.length > 0) {
        const { data: auctionRows } = await svc
          .from("auctions")
          .select("id, status, result_date, bid_end_date, bid_start_date")
          .in("id", auctionIds);
        if (auctionRows) {
          for (const a of auctionRows) {
            auctionDataById[a.id] = a;
          }
        }
      }
    }

    // Use auction's bid dates if available, else bid_periods, else result_date (completed)
    let lotsWithSourceUrl = (lots as any)?.map((lot: any) => {
      // For leiloes: lookup auction by co_leilao (auction_code); for others: use auctionDataById by id
      const auction = leiloes ? auctionDataById[lot.co_leilao] : auctionDataById[lot.auction_id];
      const bid_end_auction = auction?.bid_end_date || null;
      const bid_start_auction = auction?.bid_start_date || null;

      const isCompleted = auction?.status === "COMPLETED" || lot.was_sold;
      const result_date = auction?.result_date || null;

      // For completed auctions: use most recent past bid_period, or auction result_date
      // For active auctions: use nearest future bid_period
      let bid_end = bid_end_auction;
      let bid_start = bid_start_auction;

      if (!bid_end) {
        const cityPeriod = bidPeriodsByCity[lot.city_id];
        if (isCompleted) {
          // Completed: prefer past period, then result_date, then future period
          if (cityPeriod?.past) {
            bid_end = cityPeriod.past.end_date;
            bid_start = cityPeriod.past.start_date;
          } else if (result_date) {
            bid_end = result_date;
            bid_start = null;
          } else if (cityPeriod?.future) {
            bid_end = cityPeriod.future.end_date;
            bid_start = cityPeriod.future.start_date;
          }
        } else {
          // Active: use nearest future period
          if (cityPeriod?.future) {
            bid_end = cityPeriod.future.end_date;
            bid_start = cityPeriod.future.start_date;
          } else if (cityPeriod?.past) {
            bid_end = cityPeriod.past.end_date;
            bid_start = cityPeriod.past.start_date;
          }
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
    if (isBidEndSort) {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD in UTC, timezone-neutral enough
      lotsWithSourceUrl.sort((a: any, b: any) => {
        const aEnd = a.bid_end || "9999-12-31";
        const bEnd = b.bid_end || "9999-12-31";
        const aPast = aEnd < today; // only strictly past dates go to bottom
        const bPast = bEnd < today;
        if (aPast && !bPast) return 1;   // past → push down
        if (!aPast && bPast) return -1; // future → bring forward
        return aEnd.localeCompare(bEnd);  // both same status → sort ascending
      });
      // Apply pagination after sorting
      lotsWithSourceUrl = lotsWithSourceUrl.slice(fromIdx, fromIdx + limit);
    }

    const totalSorted = count || 0;

    // Return response with pagination metadata
    return NextResponse.json({
      lots: lotsWithSourceUrl,
      pagination: {
        page,
        limit,
        total: totalSorted,
        totalPages: Math.ceil(totalSorted / limit),
        hasMore: totalSorted > page * limit,
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
