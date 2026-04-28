import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const tables = ["cotacoes_mercado", "pracas", "basis_historico", "premios_porto", "ptax_diaria"];
  const result: Record<string, any> = {};

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(2);
      if (error) {
        result[table] = { error: error.message };
      } else {
        result[table] = {
          columns: data && data.length > 0 ? Object.keys(data[0]) : [],
          sample: data,
          count: data?.length ?? 0,
        };
      }
    } catch (e: any) {
      result[table] = { error: e.message };
    }
  }

  // Also get actual row counts
  for (const table of tables) {
    if (result[table]?.error) continue;
    try {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (!error) result[table].totalRows = count;
    } catch (_) {}
  }

  return NextResponse.json(result, { status: 200 });
}
