import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const mercadoMap: Record<string, string> = {
  "soja_export": "Soja Exportação",
  "soja_exportacao": "Soja Exportação",
  "Soja Exportação": "Soja Exportação",
  "milho_export": "Milho Exportação",
  "milho_exportacao": "Milho Exportação",
  "Milho Exportação": "Milho Exportação",
  "milho_b3": "Milho B3",
  "Milho B3": "Milho B3",
};

export async function GET() {
  const { data: rows, error } = await supabase
    .from("basis_historico")
    .select("cidade, estado, mercado, mes_referencia, basis_min, basis_max, medio")
    .eq("cidade", "Porto Nacional")
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Show raw data + what key would be generated
  const processed = (rows || []).map(row => {
    const mercadoDisplay = mercadoMap[row.mercado] || row.mercado;
    const key = `${row.cidade}-${row.estado}-${mercadoDisplay}`;
    
    let mesIdx = MESES.indexOf(row.mes_referencia);
    if (mesIdx < 0) {
      const prefix = row.mes_referencia.slice(0, 3).toLowerCase();
      const prefixes = MESES.map(m => m.slice(0, 3).toLowerCase());
      mesIdx = prefixes.indexOf(prefix);
    }

    return {
      raw_mercado: row.mercado,
      mapped_mercado: mercadoDisplay,
      raw_mes: row.mes_referencia,
      mapped_mesIdx: mesIdx,
      mapped_mesName: mesIdx >= 0 ? MESES[mesIdx] : "UNKNOWN",
      key,
      basis_min: row.basis_min,
      basis_max: row.basis_max,
      medio: row.medio,
    };
  });

  // Also show what the component would look for
  const componentKey = "Porto Nacional-TO-Soja Exportação";

  return NextResponse.json({
    componentLooksFor: componentKey,
    totalRows: rows?.length || 0,
    processed,
  });
}
