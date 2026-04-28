import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PTAX via AwesomeAPI (economia.awesomeapi.com.br) — gratuita, sem bloqueio
// Retorna cotação comercial compra/venda do dólar

async function fetchPtax(): Promise<{
  dataRef: string;
  compra: number;
  venda: number;
} | null> {
  try {
    // Buscar últimos 5 dias de cotação USD-BRL
    const url = "https://economia.awesomeapi.com.br/json/daily/USD-BRL/5";

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`AwesomeAPI error: ${res.status}`);
      return null;
    }

    const data = await res.json();

    if (!data || data.length === 0) {
      console.error("AwesomeAPI: no data returned");
      return null;
    }

    // Primeiro item é o mais recente
    const latest = data[0];

    // timestamp é Unix em segundos
    const dt = new Date(parseInt(latest.timestamp) * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dataRef = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

    return {
      dataRef,
      compra: parseFloat(latest.bid),
      venda: parseFloat(latest.ask),
    };
  } catch (e: any) {
    console.error("PTAX fetch error:", e.message);
    return null;
  }
}

export async function GET(request: Request) {
  // Optional auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ptax = await fetchPtax();

    if (!ptax) {
      return NextResponse.json({
        success: false,
        error: "Could not fetch PTAX from BCB",
      }, { status: 500 });
    }

    // Upsert na tabela ptax_diaria
    const { error } = await supabase
      .from("ptax_diaria")
      .upsert({
        data_ref: ptax.dataRef,
        compra: ptax.compra,
        venda: ptax.venda,
        updated_at: new Date().toISOString(),
      }, { onConflict: "data_ref" });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        data_ref: ptax.dataRef,
        compra: ptax.compra,
        venda: ptax.venda,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Cron PTAX error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
