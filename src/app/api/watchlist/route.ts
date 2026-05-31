import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/watchlist
 * Get current user's watchlist
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - authentication required" },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();
    const searchParams = await request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: watchlist, error, count } = await supabase
      .from("watchlist")
      .select(
        `
        id,
        notes,
        created_at,
        lots (*)
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching watchlist:", error);
      return NextResponse.json(
        { error: "Failed to fetch watchlist", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      watchlist,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: (count || 0) > to + 1,
      },
    });
  } catch (error) {
    console.error("Error in watchlist API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watchlist
 * Add a lot to user's watchlist
 *
 * Body:
 * - lot_id: string (required)
 * - notes: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - authentication required" },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();
    const body = await request.json();

    if (!body.lot_id) {
      return NextResponse.json(
        { error: "Missing required field: lot_id" },
        { status: 400 }
      );
    }

    // Verify lot exists
    const { data: lot, error: lotError } = await supabase
      .from("lots")
      .select("id")
      .eq("id", body.lot_id)
      .maybeSingle();

    if (lotError || !lot) {
      return NextResponse.json(
        { error: "Lot not found" },
        { status: 404 }
      );
    }

    // Check if already in watchlist
    const { data: existing } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("lot_id", body.lot_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Lot already in watchlist" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("watchlist")
      .insert({
        user_id: user.id,
        lot_id: body.lot_id,
        notes: body.notes,
      })
      .select(`
        *,
        lots (*)
      `)
      .single();

    if (error) {
      console.error("Error adding to watchlist:", error);
      return NextResponse.json(
        { error: "Failed to add to watchlist", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ watchlist: data }, { status: 201 });
  } catch (error) {
    console.error("Error in watchlist API POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/watchlist
 * Bulk operations on user's watchlist
 *
 * Body:
 * - action: "add_bulk" | "remove_bulk"
 * - lot_ids: number[] (required for bulk)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - authentication required" },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();
    const body = await request.json();

    if (!body.action || !body.lot_ids || !Array.isArray(body.lot_ids)) {
      return NextResponse.json(
        { error: "Missing required fields: action and lot_ids[]" },
        { status: 400 }
      );
    }

    if (body.action === "remove_bulk") {
      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("user_id", user.id)
        .in("lot_id", body.lot_ids);

      if (error) {
        console.error("Error bulk removing from watchlist:", error);
        return NextResponse.json(
          { error: "Failed to remove from watchlist", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, removed: body.lot_ids.length });
    }

    if (body.action === "add_bulk") {
      const existing = await supabase
        .from("watchlist")
        .select("lot_id")
        .eq("user_id", user.id)
        .in("lot_id", body.lot_ids);

      const existingIds = (existing.data || []).map((w: any) => w.lot_id);
      const newIds = body.lot_ids.filter((id: number) => !existingIds.includes(id));

      if (newIds.length === 0) {
        return NextResponse.json({ added: 0, skipped: body.lot_ids.length, message: "All lots already in watchlist" });
      }

      const items = newIds.map((lot_id: number) => ({
        user_id: user.id,
        lot_id,
      }));

      const { error } = await supabase
        .from("watchlist")
        .insert(items);

      if (error) {
        console.error("Error bulk adding to watchlist:", error);
        return NextResponse.json(
          { error: "Failed to add to watchlist", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ added: newIds.length, skipped: body.lot_ids.length - newIds.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in watchlist API PATCH:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/watchlist
 * Remove a lot from user's watchlist
 *
 * Body:
 * - lot_id: string (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - authentication required" },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();
    const body = await request.json();

    if (!body.lot_id) {
      return NextResponse.json(
        { error: "Missing required field: lot_id" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("lot_id", body.lot_id);

    if (error) {
      console.error("Error removing from watchlist:", error);
      return NextResponse.json(
        { error: "Failed to remove from watchlist", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in watchlist API DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
