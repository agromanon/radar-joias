import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * POST /api/shared-watchlists/[shareCode]/items
 * Add a lot to a shared watchlist
 */
export async function POST(
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

    if (!body.lot_id) {
      return NextResponse.json({ error: "lot_id required" }, { status: 400 });
    }

    // Find watchlist and verify ownership
    const { data: watchlist } = await supabase
      .from("shared_watchlists")
      .select("id, owner_id")
      .eq("share_code", shareCode)
      .single();

    if (!watchlist) {
      return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });
    }

    if (watchlist.owner_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Add item
    const { data, error } = await supabase
      .from("shared_watchlist_items")
      .upsert({
        shared_watchlist_id: watchlist.id,
        lot_id: body.lot_id,
        added_by: user.id,
        notes: body.notes || null,
      }, {
        onConflict: "shared_watchlist_id,lot_id",
      })
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
          sg_uf,
          co_leilao
        )
      `)
      .single();

    if (error) {
      console.error("Error adding item:", error);
      return NextResponse.json({ error: "Failed to add" }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    console.error("Error in shared-watchlists items POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/shared-watchlists/[shareCode]/items?lotId=X
 * Remove a lot from a shared watchlist
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
    const searchParams = request.nextUrl.searchParams;
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Find watchlist and verify ownership
    const { data: watchlist } = await supabase
      .from("shared_watchlists")
      .select("id, owner_id")
      .eq("share_code", shareCode)
      .single();

    if (!watchlist) {
      return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });
    }

    if (watchlist.owner_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { error } = await supabase
      .from("shared_watchlist_items")
      .delete()
      .eq("shared_watchlist_id", watchlist.id)
      .eq("lot_id", parseInt(lotId, 10));

    if (error) {
      return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in shared-watchlists items DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
