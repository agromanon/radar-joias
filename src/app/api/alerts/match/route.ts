import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/**
 * GET /api/alerts/match
 * Match lots against user alerts (called by cron job)
 * This endpoint checks which lots match which user alerts and returns actionable matches
 *
 * Query params:
 * - secret: string (required) - CRON_SECRET for authentication
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Verify cron secret
    const searchParams = await request.nextUrl.searchParams;
    const secret = await searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized - invalid cron secret" },
        { status: 401 }
      );
    }

    // Get all active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*")
      .eq("is_active", true);

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      return NextResponse.json(
        { error: "Failed to fetch alerts" },
        { status: 500 }
      );
    }

    // Get lots created in the last 24 hours (or since last trigger)
    const { data: lots, error: lotsError } = await supabase
      .from("lots")
      .select("*")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (lotsError) {
      console.error("Error fetching lots:", lotsError);
      return NextResponse.json(
        { error: "Failed to fetch lots" },
        { status: 500 }
      );
    }

    // Match lots against alerts
    const matches: Array<{
      alert_id: string;
      user_id: string;
      lot_id: string;
      lot_title: string;
      alert_name: string;
      notification_method: string;
      notification_frequency: string;
    }> = [];

    for (const alert of alerts) {
      const criteria = alert.criteria;

      for (const lot of lots) {
        let isMatch = true;

        // Category filter
        if (criteria.categories?.length > 0) {
          if (!criteria.categories.includes(lot.category)) {
            isMatch = false;
          }
        }

        // Location filter (state)
        if (isMatch && criteria.states?.length > 0) {
          if (!criteria.states.includes(lot.location_state)) {
            isMatch = false;
          }
        }

        // Bid range filter
        if (isMatch && criteria.min_bid && lot.current_bid) {
          if (lot.current_bid < criteria.min_bid) {
            isMatch = false;
          }
        }

        if (isMatch && criteria.max_bid && lot.current_bid) {
          if (lot.current_bid > criteria.max_bid) {
            isMatch = false;
          }
        }

        // Risk score filter
        if (isMatch && criteria.risk_scores?.length > 0) {
          if (!criteria.risk_scores.includes(lot.risk_score)) {
            isMatch = false;
          }
        }

        // Keywords filter (search in title and description)
        if (isMatch && criteria.keywords?.length > 0) {
          const searchText = `${lot.title} ${lot.description || ""}`.toLowerCase();
          const hasAllKeywords = criteria.keywords.every((keyword: string) =>
            searchText.includes(keyword.toLowerCase())
          );
          if (!hasAllKeywords) {
            isMatch = false;
          }
        }

        if (isMatch) {
          matches.push({
            alert_id: alert.id,
            user_id: alert.user_id,
            lot_id: lot.id,
            lot_title: lot.title,
            alert_name: alert.name,
            notification_method: alert.notification_method,
            notification_frequency: alert.notification_frequency,
          });
        }
      }
    }

    // Update trigger counts for matched alerts
    const matchedAlertIds = [...new Set(matches.map((m) => m.alert_id))];

    if (matchedAlertIds.length > 0) {
      // Fetch current trigger counts
      const { data: currentAlerts } = await supabase
        .from("alerts")
        .select("id, trigger_count")
        .in("id", matchedAlertIds);

      // Create update map with incremented counts
      const updates = currentAlerts?.reduce((acc, alert) => {
        acc[alert.id] = (alert.trigger_count || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Update each alert individually
      if (updates) {
        for (const [alertId, newCount] of Object.entries(updates)) {
          const { error: updateError } = await supabase
            .from("alerts")
            .update({
              last_triggered_at: new Date().toISOString(),
              trigger_count: newCount,
            })
            .eq("id", alertId);

          if (updateError) {
            console.error(`Error updating alert ${alertId}:`, updateError);
          }
        }
      }
    }

    // Group matches by user for notification processing
    const matchesByUser = matches.reduce((acc, match) => {
      if (!acc[match.user_id]) {
        acc[match.user_id] = [];
      }
      acc[match.user_id].push(match);
      return acc;
    }, {} as Record<string, typeof matches>);

    return NextResponse.json({
      matches,
      matchesByUser,
      summary: {
        totalMatches: matches.length,
        totalAlertsMatched: matchedAlertIds.length,
        totalUsersNotified: Object.keys(matchesByUser).length,
      },
    });
  } catch (error) {
    console.error("Error in alert matcher API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
