import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RAPIDAPI_KEY = process.env.TRADINGVIEW_API_KEY!;
const RAPIDAPI_HOST = "tradingview-data1.p.rapidapi.com";

// 42 contratos — 5 batches de 10 (máximo por request)
const BATCHES = [
  // Batch 1: Soja CBOT (8)
  [
    "CBOT:ZSK2026", "CBOT:ZSN2026", "CBOT:ZSQ2026", "CBOT:ZSU2026",
    "CBOT:ZSX2026", "CBOT:ZSF2027", "CBOT:ZSH2027", "CBOT:ZSK2027",
    "CBOT:ZSN2027", "CBOT:ZSX2027",
  ],
  // Batch 2: Milho CBOT (9) + Milho B3 (1)
  [
    "CBOT:ZCK2026", "CBOT:ZCN2026", "CBOT:ZCU2026", "CBOT:ZCZ2026",
    "CBOT:ZCH2027", "CBOT:ZCK2027", "CBOT:ZCN2027", "CBOT:ZCU2027",
    "CBOT:ZCZ2027", "BMFBOVESPA:CCMK2026",
  ],
  // Batch 3: Milho B3 (8) + Dólar (2)
  [
    "BMFBOVESPA:CCMN2026", "BMFBOVESPA:CCMU2026", "BMFBOVESPA:CCMX2026",
    "BMFBOVESPA:CCMF2027", "BMFBOVESPA:CCMH2027", "BMFBOVESPA:CCMK2027",
    "BMFBOVESPA:CCMN2027", "BMFBOVESPA:CCMU2027",
    "BMFBOVESPA:DOLK2026", "BMFBOVESPA:DOLM2026",
  ],
  // Batch 4: Dólar B3 (10)
  [
    "BMFBOVESPA:DOLN2026", "BMFBOVESPA:DOLQ2026", "BMFBOVESPA:DOLU2026",
    "BMFBOVESPA:DOLV2026", "BMFBOVESPA:DOLX2026", "BMFBOVESPA:DOLZ2026",
    "BMFBOVESPA:DOLF2027", "BMFBOVESPA:DOLG2027", "BMFBOVESPA:DOLH2027",
    "BMFBOVESPA:DOLJ2027",
  ],
  // Batch 5: Dólar restante (3) + FX spot (1)
  [
    "BMFBOVESPA:DOLN2027", "BMFBOVESPA:DOLQ2027", "BMFBOVESPA:DOLV2027",
    "FX:USDBRL",
  ],
];

async function fetchBatch(symbols: string[]): Promise<any[]> {
  const res = await fetch("https://tradingview-data1.p.rapidapi.com/api/quote/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
    body: JSON.stringify({
      symbols,
      fields: "lp,ch,chp,high_price,low_price,volume",
      session: "regular",
    }),
  });

  if (!res.ok) {
    console.error(`Batch failed: ${res.status}`);
    return [];
  }

  const json = await res.json();
  if (!json.success || !json.data?.data) return [];

  return json.data.data
    .filter((d: any) => d.success && d.data)
    .map((d: any) => {
      const parts = d.symbol.split(":");
      return {
        symbol: d.symbol,
        exchange: parts[0],
        last_price: d.data.lp ?? 0,
        change_val: d.data.ch ?? 0,
        change_pct: d.data.chp ?? 0,
        high: d.data.high_price ?? null,
        low: d.data.low_price ?? null,
        volume: d.data.volume ?? null,
        updated_at: new Date().toISOString(),
      };
    });
}

export async function GET(request: Request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: "TRADINGVIEW_API_KEY not configured" }, { status: 500 });
  }

  try {
    let totalUpdated = 0;
    let totalErrors = 0;

    for (let i = 0; i < BATCHES.length; i++) {
      const batch = BATCHES[i];
      const quotes = await fetchBatch(batch);

      if (quotes.length > 0) {
        const { error } = await supabase
          .from("cotacoes_mercado")
          .upsert(quotes, { onConflict: "symbol" });

        if (error) {
          console.error(`Supabase upsert error batch ${i}:`, error);
          totalErrors++;
        } else {
          totalUpdated += quotes.length;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i < BATCHES.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      errors: totalErrors,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Cron cotacoes error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
