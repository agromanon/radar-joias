import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Radar Jóias <noreply@radarjoias.com.br>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface Match {
  alert_id: string;
  user_id: string;
  lot_id: string;
  lot_title: string;
  alert_name: string;
  notification_method: string;
  notification_frequency: string;
}

interface LotDetails {
  id: number;
  lot_number: number;
  de_contrato: string;
  valor: number;
  imagem_capa_url: string;
  sg_uf: string;
  peso_lote: number;
  karat: string;
  url_imagem_capa: string;
  cities: { name: string };
}

async function sendEmailViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("[alerts] RESEND_API_KEY not configured, skipping email");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[alerts] Resend error:", data);
    return { ok: false, error: data };
  }
  return { ok: true, data };
}

function buildAlertEmail(matches: (Match & { lot_details?: LotDetails })[], userName?: string): string {
  const firstName = userName?.split(" ")[0] || "você";
  const lotRows = matches.slice(0, 10).map((m, i) => {
    const lot = m.lot_details;
    const img = lot?.imagem_capa_url
      ? `<img src="${lot.imagem_capa_url}" alt="Lote" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-right:12px;" />`
      : `<div style="width:60px;height:60px;background:#2F3136;border-radius:8px;margin-right:12px;display:inline-block;"></div>`;
    const price = lot?.valor
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lot.valor)
      : "—";
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #2F3136;">
          ${img}
        </td>
        <td style="padding:12px;border-bottom:1px solid #2F3136;">
          <div style="color:#fff;font-weight:600;font-size:14px;">${lot?.de_contrato || `Lote ${lot?.lot_number}`}</div>
          <div style="color:#8E9297;font-size:12px;margin-top:4px;">
            ${lot?.karat ? `${lot.karat}k · ` : ""}${lot?.cities?.name || ""} ${lot?.sg_uf || ""}
            ${lot?.peso_lote ? `· ${lot.peso_lote}g` : ""}
          </div>
        </td>
        <td style="padding:12px;border-bottom:1px solid #2F3136;text-align:right;">
          <div style="color:#fff;font-weight:700;font-size:14px;">${price}</div>
          <a href="${APP_URL}/lote/${lot?.id}" style="color:#5865F2;font-size:12px;text-decoration:none;margin-top:4px;display:inline-block;">Ver detalhes →</a>
        </td>
      </tr>`;
  }).join("");

  const extra = matches.length > 10 ? `<tr><td colspan="3" style="padding:12px;text-align:center;color:#8E9297;font-size:12px;">...e mais ${matches.length - 10} lotes</td></tr>` : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0B0E14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#F59E0B;font-size:24px;font-weight:800;margin:0;">Radar Jóias</h1>
      <p style="color:#8E9297;font-size:14px;margin:8px 0 0;">Novos lotes encontrados</p>
    </div>

    <div style="background:#151A22;border:1px solid #272A31;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #272A31;">
        <p style="color:#fff;font-size:16px;margin:0;">
          Olá <strong>${firstName}</strong>, encontramos <strong style="color:#F59E0B;">${matches.length} novo${matches.length !== 1 ? "s" : ""} lote${matches.length !== 1 ? "s" : ""}</strong> que correspondem aos seus alertas.
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${lotRows}
          ${extra}
        </tbody>
      </table>

      <div style="padding:20px 24px;text-align:center;border-top:1px solid #272A31;">
        <a href="${APP_URL}/alertas" style="display:inline-block;background:#5865F2;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;text-decoration:none;">
          Gerenciar Alertas
        </a>
      </div>
    </div>

    <p style="color:#454655;font-size:12px;text-align:center;margin-top:24px;">
      Você está recibiendo este e-mail porque tem alertas ativos no Radar Jóias.<br/>
      <a href="${APP_URL}/alertas" style="color:#454655;">Gerenciar notificações</a>
    </p>
  </div>
</body>
</html>`;
}

async function getLotDetails(lotIds: string[], supabase: any): Promise<Record<string, LotDetails>> {
  const { data } = await supabase
    .from("lots")
    .select("id, lot_number, de_contrato, valor, imagem_capa_url, sg_uf, peso_lote, karat, url_imagem_capa, cities(name)")
    .in("id", lotIds);
  return (data || []).reduce((acc: Record<string, LotDetails>, lot: any) => {
    acc[String(lot.id)] = lot;
    return acc;
  }, {});
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const searchParams = await request.nextUrl.searchParams;
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*")
      .eq("is_active", true);

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }

    // Get lots seen in the last 24 hours
    const { data: lots, error: lotsError } = await supabase
      .from("lots")
      .select("*")
      .is("outcome_status", null)
      .gte("last_seen_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("last_seen_at", { ascending: false });

    if (lotsError) {
      console.error("Error fetching lots:", lotsError);
      return NextResponse.json({ error: "Failed to fetch lots" }, { status: 500 });
    }

    // Match lots against alerts
    const matches: Match[] = [];

    for (const alert of alerts) {
      const criteria = alert.criteria;

      for (const lot of lots) {
        let isMatch = true;

        if (isMatch && criteria.karats?.length > 0) {
          if (!criteria.karats.includes(lot.karat)) isMatch = false;
        }
        if (isMatch && criteria.categories?.length > 0) {
          if (!criteria.categories.includes(lot.category)) isMatch = false;
        }
        if (isMatch && criteria.states?.length > 0) {
          if (!criteria.states.includes(lot.sg_uf)) isMatch = false;
        }
        if (isMatch && criteria.min_bid && lot.valor) {
          if (Number(lot.valor) < criteria.min_bid) isMatch = false;
        }
        if (isMatch && criteria.max_bid && lot.valor) {
          if (Number(lot.valor) > criteria.max_bid) isMatch = false;
        }
        if (isMatch && criteria.keywords?.length > 0) {
          const searchText = `${lot.de_contrato || ""}`.toLowerCase();
          const hasAllKeywords = criteria.keywords.every((keyword: string) =>
            searchText.includes(keyword.toLowerCase())
          );
          if (!hasAllKeywords) isMatch = false;
        }

        if (isMatch) {
          matches.push({
            alert_id: alert.id,
            user_id: alert.user_id,
            lot_id: String(lot.id),
            lot_title: lot.de_contrato || `Lote ${lot.lot_number}`,
            alert_name: alert.name,
            notification_method: alert.notification_method,
            notification_frequency: alert.notification_frequency,
          });
        }
      }
    }

    // Group matches by user
    const matchesByUser: Record<string, Match[]> = {};
    for (const match of matches) {
      if (!matchesByUser[match.user_id]) matchesByUser[match.user_id] = [];
      matchesByUser[match.user_id].push(match);
    }

    // Send notifications to each user
    const userIds = Object.keys(matchesByUser);
    if (userIds.length > 0) {
      // Fetch user profiles for email addresses
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, email, name")
        .in("id", userIds);

      const profileMap: Record<string, any> = {};
      for (const p of profiles || []) {
        profileMap[p.id] = p;
      }

      // Fetch lot details for all matched lots
      const allLotIds = matches.map(m => m.lot_id);
      const lotDetails = allLotIds.length > 0 ? await getLotDetails(allLotIds, supabase) : {};

      // Process each user's matches
      for (const [userId, userMatches] of Object.entries(matchesByUser)) {
        const profile = profileMap[userId];
        if (!profile?.email) continue;

        const shouldNotify =
          profile.email &&
          (userMatches.some(m => m.notification_method === "email" || m.notification_method === "both"));

        if (!shouldNotify) continue;

        // Attach lot details to matches
        const enrichedMatches = userMatches.map(m => ({
          ...m,
          lot_details: lotDetails[m.lot_id],
        }));

        const subject = enrichedMatches.length === 1
          ? `Radar Jóias: 1 novo lote corresponde a "${enrichedMatches[0].alert_name}"`
          : `Radar Jóias: ${enrichedMatches.length} novos lotes encontrados`;

        const html = buildAlertEmail(enrichedMatches, profile.name);
        const result = await sendEmailViaResend(profile.email, subject, html);

        if (result.ok) {
          // Update last_notified_at for all alerts that had matches for this user
          const alertIds = [...new Set(userMatches.map(m => m.alert_id))];
          for (const alertId of alertIds) {
            await supabase
              .from("alerts")
              .update({ last_notified_at: new Date().toISOString() })
              .eq("id", alertId);
          }
          console.log(`[alerts] Sent notification to ${profile.email} for ${enrichedMatches.length} lots`);
        }
      }
    }

    // Update trigger counts
    const matchedAlertIds = [...new Set(matches.map(m => m.alert_id))];
    if (matchedAlertIds.length > 0) {
      const { data: currentAlerts } = await supabase
        .from("alerts")
        .select("id, trigger_count")
        .in("id", matchedAlertIds);

      const updates = currentAlerts?.reduce((acc, alert) => {
        acc[alert.id] = (alert.trigger_count || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      if (updates) {
        for (const [alertId, newCount] of Object.entries(updates)) {
          await supabase
            .from("alerts")
            .update({ last_triggered_at: new Date().toISOString(), trigger_count: newCount })
            .eq("id", alertId);
        }
      }
    }

    return NextResponse.json({
      matches,
      summary: {
        totalMatches: matches.length,
        totalAlertsMatched: matchedAlertIds.length,
        totalUsersNotified: userIds.length,
      },
    });
  } catch (error) {
    console.error("Error in alert matcher API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
