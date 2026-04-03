import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * POST /api/watchlist/[lotId]
 * Add lot to user's watchlist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Check if already in watchlist
    const { data: existing } = await supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", user.id)
      .eq("lot_id", lotId)
      .single();

    if (existing) {
      return NextResponse.json({ message: "Already in watchlist" }, { status: 200 });
    }

    // Add to watchlist
    const { error } = await supabase
      .from("watchlist")
      .insert({
        user_id: user.id,
        lot_id: lotId,
      });

    if (error) {
      console.error("Error adding to watchlist:", error);
      return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
    }

    return NextResponse.json({ message: "Added to watchlist" }, { status: 201 });
  } catch (error) {
    console.error("Error in watchlist POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/watchlist/[lotId]
 * Remove lot from user's watchlist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lotId: string }> }
) {
  try {
    const { lotId } = await params;
    const user = await getServerUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Remove from watchlist
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("lot_id", lotId);

    if (error) {
      console.error("Error removing from watchlist:", error);
      return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
    }

    return NextResponse.json({ message: "Removed from watchlist" }, { status: 200 });
  } catch (error) {
    console.error("Error in watchlist DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
