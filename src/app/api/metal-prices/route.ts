"use server";

import { NextResponse } from "next/server";

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache
let cachedData: { data: any; timestamp: number } | null = null;

export async function GET() {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData.data);
  }

  try {
    // Fetch gold, silver, platinum, palladium from Yahoo Finance (free, no auth)
    const [goldRes, silverRes, platinumRes, palladiumRes, usdBrlRes] = await Promise.all([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d", {
        headers: { "User-Agent": "Mozilla/5.0" },
      }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d", {
        headers: { "User-Agent": "Mozilla/5.0" },
      }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/ALI.V?interval=1d&range=1d", {
        headers: { "User-Agent": "Mozilla/5.0" },
      }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/PA=F?interval=1d&range=1d", {
        headers: { "User-Agent": "Mozilla/5.0" },
      }),
      // BCB USD/BRL exchange rate (Brazil's Central Bank - free, public)
      fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.10813/dados/ultimos/1?formato=json"),
    ]);

    let goldSpot = 4520;
    let silverSpot = 75.8;
    let platinumSpot = 1050; // fallback
    let palladiumSpot = 1381; // fallback from prior test
    let usdBrl = 5.75;

    if (goldRes.ok) {
      const d = await goldRes.json();
      const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (p) goldSpot = p;
    }
    if (silverRes.ok) {
      const d = await silverRes.json();
      const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (p) silverSpot = p;
    }
    if (platinumRes.ok) {
      const d = await platinumRes.json();
      const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (p > 0) platinumSpot = p;
    }
    if (palladiumRes.ok) {
      const d = await palladiumRes.json();
      const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (p > 0) palladiumSpot = p;
    }
    if (usdBrlRes.ok) {
      const data = await usdBrlRes.json();
      if (data?.[0]?.valor) usdBrl = parseFloat(data[0].valor);
    }

    const TROY_TO_GRAM = 31.1035;
    const goldPerGramUsd = goldSpot / TROY_TO_GRAM;
    const silverPerGramUsd = silverSpot / TROY_TO_GRAM;
    const platinumPerGramUsd = platinumSpot / TROY_TO_GRAM;
    const palladiumPerGramUsd = palladiumSpot / TROY_TO_GRAM;
    const goldPerGramBrl = goldPerGramUsd * usdBrl;
    const silverPerGramBrl = silverPerGramUsd * usdBrl;
    const platinumPerGramBrl = platinumPerGramUsd * usdBrl;
    const palladiumPerGramBrl = palladiumPerGramUsd * usdBrl;

    const result = {
      updated_at: new Date().toISOString(),
      source: "Yahoo Finance / Banco Central do Brasil",
      currency: "BRL",
      exchange_rate_usd_brl: usdBrl,
      gold: { spot_usd_per_oz: goldSpot, per_gram_brl: Math.round(goldPerGramBrl * 100) / 100 },
      silver: { spot_usd_per_oz: silverSpot, per_gram_brl: Math.round(silverPerGramBrl * 100) / 100 },
      platinum: { spot_usd_per_oz: platinumSpot, per_gram_brl: Math.round(platinumPerGramBrl * 100) / 100 },
      palladium: { spot_usd_per_oz: palladiumSpot, per_gram_brl: Math.round(palladiumPerGramBrl * 100) / 100 },
      karat: {
        "24k": Math.round(goldPerGramBrl * 1.15 * 100) / 100,
        "18k": Math.round(goldPerGramBrl * 0.75 * 1.15 * 100) / 100,
        "14k": Math.round(goldPerGramBrl * 0.585 * 1.15 * 100) / 100,
        "10k": Math.round(goldPerGramBrl * 0.417 * 1.15 * 100) / 100,
      },
      silver_purity: { "925": Math.round(silverPerGramBrl * 0.925 * 100) / 100, "800": Math.round(silverPerGramBrl * 0.800 * 100) / 100 },
    };

    cachedData = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching metal prices:", error);
    if (cachedData) return NextResponse.json(cachedData.data);
    return NextResponse.json({
      updated_at: new Date().toISOString(),
      source: "fallback",
      currency: "BRL",
      exchange_rate_usd_brl: 5.75,
      gold: { spot_usd_per_oz: 4520, per_gram_brl: 167.40 },
      silver: { spot_usd_per_oz: 75.8, per_gram_brl: 2.81 },
      platinum: { spot_usd_per_oz: 1050, per_gram_brl: 38.88 },
      palladium: { spot_usd_per_oz: 1381, per_gram_brl: 51.16 },
      karat: { "24k": 192.50, "18k": 144.40, "14k": 112.60, "10k": 80.20 },
      silver_purity: { "925": 2.60, "800": 2.25 },
    });
  }
}
