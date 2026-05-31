import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/shared-watchlists/dashboard
 * War Room dashboard: overview stats + recent activity across all user's shared watchlists
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Watchlists owned by user with item counts
    const { data: watchlists, error: wlError } = await supabase
      .from("shared_watchlists")
      .select(`
        id,
        name,
        share_code,
        is_public,
        created_at,
        updated_at,
        shared_watchlist_items (count)
      `)
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (wlError) {
      console.error("Error fetching watchlists:", wlError);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    const watchlistIds = watchlists.map(w => w.id);

    // Recent activity across all user's shared watchlists (last 20 items)
    let recentItems: any[] = [];
    if (watchlistIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from("shared_watchlist_items")
        .select(`
          id,
          notes,
          created_at,
          shared_watchlists!inner (
            name,
            share_code
          ),
          lots (
            id,
            lot_number,
            de_contrato,
            valor,
            imagem_capa_url,
            sg_uf,
            peso_lote,
            karat,
            cities (name)
          )
        `)
        .in("shared_watchlist_id", watchlistIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (itemsError) {
        console.error("Error fetching recent items:", itemsError);
      } else {
        recentItems = items || [];
      }
    }

    // Compute totals
    const totalWatchlists = watchlists.length;
    const totalItems = watchlists.reduce(
      (sum, wl) => sum + (wl.shared_watchlist_items?.[0]?.count || 0),
      0
    );
    const totalValue = recentItems.reduce((sum, item) => {
      return sum + (item.lots?.valor || 0);
    }, 0);

    // Karat distribution across user's shared watchlist items
    let karatBreakdown: Record<string, number> = {};
    if (watchlistIds.length > 0) {
      const { data: karatData } = await supabase
        .from("shared_watchlist_items")
        .select(`
          lots (
            karat
          )
        `)
        .in("shared_watchlist_id", watchlistIds);

      if (karatData) {
        for (const item of karatData) {
          const karat = (item.lots as any[])?.[0]?.karat || "unknown";
          karatBreakdown[karat] = (karatBreakdown[karat] || 0) + 1;
        }
      }
    }

    return NextResponse.json({
      stats: {
        totalWatchlists,
        totalItems,
        recentItemsCount: recentItems.length,
      },
      watchlists: watchlists.map(wl => ({
        id: wl.id,
        name: wl.name,
        shareCode: wl.share_code,
        isPublic: wl.is_public,
        itemCount: wl.shared_watchlist_items?.[0]?.count || 0,
        updatedAt: wl.updated_at,
      })),
      recentItems: recentItems.map(item => ({
        id: item.id,
        notes: item.notes,
        addedAt: item.created_at,
        watchlistName: (item.shared_watchlists as any)?.name,
        watchlistCode: (item.shared_watchlists as any)?.share_code,
        lot: item.lots ? {
          id: item.lots.id,
          lotNumber: item.lots.lot_number,
          contract: item.lots.de_contrato,
          value: item.lots.valor,
          imageUrl: item.lots.imagem_capa_url,
          city: item.lots.cities?.name,
          state: item.lots.sg_uf,
          weight: item.lots.peso_lote,
          karat: item.lots.karat,
        } : null,
      })),
      karatBreakdown,
    });
  } catch (error) {
    console.error("Error in dashboard GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
