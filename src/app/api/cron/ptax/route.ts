import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PTAX — Tenta BCB oficial primeiro, depois AwesomeAPI como fallback

async function fetchPtaxBCB(): Promise<{
  dataRef: string;
  compra: number;
  venda: number;
} | null> {
  try {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 10);

    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtBCB = (d: Date) => `'${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}'`;

    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial=${fmtBCB(start)}&@dataFinalCotacao=${fmtBCB(today)}&$orderby=dataHoraCotacao%20desc&$top=10&$format=json`;

    console.log("BCB PTAX URL:", url);

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok) {
      console.error(`BCB PTAX error: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const values = json?.value;

    if (!values || values.length === 0) {
      console.error("BCB PTAX: no data");
      return null;
    }

    // Pegar fechamento mais recente
    const closing = values.find((v: any) => v.tipoBoletim === "Fechamento") || values[0];
    const dataRef = closing.dataHoraCotacao.split(" ")[0]; // "2026-06-19"

    return {
      dataRef,
      compra: closing.cotacaoCompra,
      venda: closing.cotacaoVenda,
    };
  } catch (e: any) {
    console.error("BCB PTAX fetch failed:", e.message);
    return null;
  }
}

async function fetchPtaxAwesome(): Promise<{
  dataRef: string;
  compra: number;
  venda: number;
} | null> {
  try {
    const url = "https://economia.awesomeapi.com.br/json/daily/USD-BRL/5";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    const latest = data[0];
    const dt = new Date(parseInt(latest.timestamp) * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dataRef = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    return { dataRef, compra: parseFloat(latest.bid), venda: parseFloat(latest.ask) };
  } catch { return null; }
}

async function fetchPtax(): Promise<{
  dataRef: string;
  compra: number;
  venda: number;
  fonte: string;
} | null> {
  // Tentar BCB oficial primeiro
  const bcb = await fetchPtaxBCB();
  if (bcb) return { ...bcb, fonte: "BCB/PTAX" };

  // Fallback: AwesomeAPI
  console.log("BCB failed, trying AwesomeAPI...");
  const awesome = await fetchPtaxAwesome();
  if (awesome) return { ...awesome, fonte: "AwesomeAPI" };

  return null;
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
      fonte: ptax.fonte,
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
