import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  // Puxa todas as linhas (paginado) só com mercado/cidade/estado para mapear o que existe
  const all: { cidade: string; estado: string; mercado: string }[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("basis_historico")
      .select("cidade, estado, mercado")
      .range(page * size, page * size + size - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < size) break;
    page++;
    if (page > 50) break;
  }

  // Mercados distintos + contagem
  const mercadoCounts: Record<string, number> = {};
  for (const r of all) mercadoCounts[r.mercado] = (mercadoCounts[r.mercado] || 0) + 1;

  // Para cada mercado, em quais (cidade-estado) ele aparece
  const mercadoPorPraca: Record<string, string[]> = {};
  for (const r of all) {
    const praca = `${r.cidade}-${r.estado}`;
    (mercadoPorPraca[r.mercado] ||= []);
    if (!mercadoPorPraca[r.mercado].includes(praca)) mercadoPorPraca[r.mercado].push(praca);
  }

  // Linhas detalhadas de Porto Nacional
  const { data: porto } = await supabase
    .from("basis_historico")
    .select("cidade, estado, mercado, mes_referencia, basis_min, basis_max, medio")
    .eq("cidade", "Porto Nacional");

  return NextResponse.json({
    totalRows: all.length,
    mercadosDistintos: mercadoCounts,
    pracasPorMercado: mercadoPorPraca,
    portoNacional: porto || [],
  });
}
