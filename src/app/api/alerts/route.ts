import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getServerUser } from "@/lib/auth";

/**
 * GET /api/alerts
 * Get current user's alerts
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
    const { data: alerts, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching alerts:", error);
      return NextResponse.json(
        { error: "Failed to fetch alerts", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error in alerts API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Create a new alert
 *
 * Body:
 * - name: string (required)
 * - criteria: object (required) - JSONB filter criteria
 * - notification_method: "email" | "push" | "both"
 * - notification_frequency: "immediate" | "hourly" | "daily"
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

    // Check if user has access to alerts (Pro tier or higher)
    if (user.tier === "free") {
      return NextResponse.json(
        { error: "Forbidden - Pro tier or higher required to create alerts" },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();
    const body = await request.json();

    if (!body.name || !body.criteria) {
      return NextResponse.json(
        { error: "Missing required fields: name, criteria" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("alerts")
      .insert({
        user_id: user.id,
        name: body.name,
        criteria: body.criteria,
        notification_method: body.notification_method || "email",
        notification_frequency: body.notification_frequency || "immediate",
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating alert:", error);
      return NextResponse.json(
        { error: "Failed to create alert", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert: data }, { status: 201 });
  } catch (error) {
    console.error("Error in alerts API POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/alerts
 * Update an existing alert
 *
 * Body:
 * - id: string (required)
 * - name: string
 * - criteria: object
 * - notification_method: "email" | "push" | "both"
 * - notification_frequency: "immediate" | "hourly" | "daily"
 * - is_active: boolean
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

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // Verify alert belongs to user
    const { data: existingAlert } = await supabase
      .from("alerts")
      .select("user_id")
      .eq("id", body.id)
      .maybeSingle();

    if (!existingAlert) {
      return NextResponse.json(
        { error: "Alert not found" },
        { status: 404 }
      );
    }

    if (existingAlert.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - alert belongs to another user" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("alerts")
      .update({
        name: body.name,
        criteria: body.criteria,
        notification_method: body.notification_method,
        notification_frequency: body.notification_frequency,
        is_active: body.is_active,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating alert:", error);
      return NextResponse.json(
        { error: "Failed to update alert", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert: data });
  } catch (error) {
    console.error("Error in alerts API PATCH:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts
 * Delete an alert
 *
 * Body:
 * - id: string (required)
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

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // Verify alert belongs to user
    const { data: existingAlert } = await supabase
      .from("alerts")
      .select("user_id")
      .eq("id", body.id)
      .maybeSingle();

    if (!existingAlert) {
      return NextResponse.json(
        { error: "Alert not found" },
        { status: 404 }
      );
    }

    if (existingAlert.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - alert belongs to another user" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("alerts")
      .delete()
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting alert:", error);
      return NextResponse.json(
        { error: "Failed to delete alert", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in alerts API DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
