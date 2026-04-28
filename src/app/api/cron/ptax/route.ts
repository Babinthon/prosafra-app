import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// BCB Olinda API — Cotação do dólar (PTAX)
// Docs: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/documentacao
// Retorna cotação de compra e venda do dia útil anterior

async function fetchPtax(): Promise<{
  dataRef: string;
  compra: number;
  venda: number;
} | null> {
  try {
    // Buscar últimas 5 cotações para pegar a mais recente
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 7); // últimos 7 dias para garantir dia útil

    const startStr = `'${start.toLocaleDateString("pt-BR", { month: "2-digit", day: "2-digit", year: "numeric" })}'`;
    const endStr = `'${today.toLocaleDateString("pt-BR", { month: "2-digit", day: "2-digit", year: "numeric" })}'`;

    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial=${startStr}&@dataFinalCotacao=${endStr}&$orderby=dataHoraCotacao%20desc&$top=5&$format=json`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`BCB PTAX API error: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const values = json?.value;

    if (!values || values.length === 0) {
      console.error("BCB PTAX: no data returned");
      return null;
    }

    // Pegar a cotação mais recente (tipo "Fechamento" se disponível, senão a primeira)
    const closing = values.find((v: any) => v.tipoBoletim === "Fechamento") || values[0];

    // dataHoraCotacao format: "2026-04-15 13:09:26.757"
    const dataRef = closing.dataHoraCotacao.split(" ")[0]; // "2026-04-15"

    return {
      dataRef,
      compra: closing.cotacaoCompra,
      venda: closing.cotacaoVenda,
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
