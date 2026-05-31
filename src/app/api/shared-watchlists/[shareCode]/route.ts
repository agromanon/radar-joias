import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/shared-watchlists/[shareCode]
 * Access a shared watchlist by its share code
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const { shareCode } = await params;
    const supabase = await createServerClient();

    const { data: watchlist, error } = await supabase
      .from("shared_watchlists")
      .select(`
        id,
        name,
        description,
        share_code,
        is_public,
        tier_required,
        owner_id,
        created_at,
        updated_at,
        user_profiles!owner_id (name, email, company)
      `)
      .eq("share_code", shareCode)
      .single();

    if (error || !watchlist) {
      return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });
    }

    // Check access
    const user = await getServerUser();
    const isOwner = user?.id === watchlist.owner_id;
    if (!watchlist.is_public && !isOwner) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Fetch items with lot details
    const { data: items, error: itemsError } = await supabase
      .from("shared_watchlist_items")
      .select(`
        id,
        notes,
        created_at,
        lots (
          id,
          lot_number,
          de_contrato,
          valor,
          imagem_capa_url,
          url_imagem_capa,
          sg_uf,
          co_leilao,
          peso_lote,
          karat,
          outcome_status,
          cities (name, states (uf))
        )
      `)
      .eq("shared_watchlist_id", watchlist.id)
      .order("created_at", { ascending: false });

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
    }

    return NextResponse.json({
      watchlist: {
        ...watchlist,
        item_count: items?.length || 0,
      },
      items: items || [],
      is_owner: isOwner,
    });
  } catch (error) {
    console.error("Error in shared-watchlists GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/shared-watchlists/[shareCode]
 * Update a shared watchlist (owner only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shareCode } = await params;
    const supabase = await createServerClient();
    const body = await request.json();

    // Verify ownership
    const { data: existing } = await supabase
      .from("shared_watchlists")
      .select("id, owner_id")
      .eq("share_code", shareCode)
      .single();

    if (!existing || existing.owner_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("shared_watchlists")
      .update({
        name: body.name,
        description: body.description,
        is_public: body.is_public,
        tier_required: body.tier_required,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ watchlist: data });
  } catch (error) {
    console.error("Error in shared-watchlists PUT:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/shared-watchlists/[shareCode]
 * Delete a shared watchlist (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shareCode } = await params;
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("shared_watchlists")
      .delete()
      .eq("share_code", shareCode)
      .eq("owner_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in shared-watchlists DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
