import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// BCB API — Cotação do dólar (PTAX)
// Using the BCB series API (more reliable than Olinda)
// Series 1 = Dólar comercial compra
// Series 10813 = Dólar comercial venda

async function fetchPtax(): Promise<{
  dataRef: string;
  compra: number;
  venda: number;
} | null> {
  try {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 10); // últimos 10 dias para garantir dia útil

    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtBCB = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    
    const startStr = fmtBCB(start);
    const endStr = fmtBCB(today);

    // Fetch compra (série 1)
    const urlCompra = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${startStr}&dataFinal=${endStr}`;
    // Fetch venda (série 10813)  
    const urlVenda = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.10813/dados?formato=json&dataInicial=${startStr}&dataFinal=${endStr}`;

    console.log("PTAX compra URL:", urlCompra);

    const [resCompra, resVenda] = await Promise.all([
      fetch(urlCompra, { headers: { Accept: "application/json" } }),
      fetch(urlVenda, { headers: { Accept: "application/json" } }),
    ]);

    if (!resCompra.ok || !resVenda.ok) {
      console.error(`BCB API error: compra=${resCompra.status} venda=${resVenda.status}`);
      return null;
    }

    const dataCompra = await resCompra.json();
    const dataVenda = await resVenda.json();

    if (!dataCompra?.length || !dataVenda?.length) {
      console.error("BCB: no data returned");
      return null;
    }

    // Pegar o último (mais recente)
    const lastCompra = dataCompra[dataCompra.length - 1];
    const lastVenda = dataVenda[dataVenda.length - 1];

    // data format from BCB: "dd/MM/yyyy" → convert to "yyyy-MM-dd"
    const parts = lastCompra.data.split("/");
    const dataRef = `${parts[2]}-${parts[1]}-${parts[0]}`;

    return {
      dataRef,
      compra: parseFloat(lastCompra.valor),
      venda: parseFloat(lastVenda.valor),
    };
  } catch (e: any) {
    console.error("BCB PTAX fetch error:", e.message);
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
