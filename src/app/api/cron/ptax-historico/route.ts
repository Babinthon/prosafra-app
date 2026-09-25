import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { preencherPtax, diasAtras, hojeSP } from "@/lib/ptaxHistorico";

// Rotina diária de conferência: completa em ptax_diaria os dias úteis dos
// últimos 15 dias que ficaram sem PTAX (ex.: falha da rotina principal).
// Só insere dias que faltam; não altera nada que já existe.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const r = await preencherPtax(supabase, diasAtras(15), hojeSP());
    return NextResponse.json({ success: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
