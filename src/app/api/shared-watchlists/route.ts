import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/shared-watchlists
 * List shared watchlists owned by the user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("shared_watchlists")
      .select(`
        id,
        name,
        description,
        share_code,
        is_public,
        tier_required,
        created_at,
        updated_at,
        owner_id,
        shared_watchlist_items (count)
      `)
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching shared watchlists:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    return NextResponse.json({ watchlists: data });
  } catch (error) {
    console.error("Error in shared-watchlists GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/shared-watchlists
 * Create a new shared watchlist
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("shared_watchlists")
      .insert({
        owner_id: user.id,
        name: body.name || "Minha Lista",
        description: body.description || null,
        is_public: body.is_public || false,
        tier_required: body.tier_required || "free",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating shared watchlist:", error);
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }

    return NextResponse.json({ watchlist: data }, { status: 201 });
  } catch (error) {
    console.error("Error in shared-watchlists POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
