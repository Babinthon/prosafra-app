import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, action, data } = body;

    const adminPw = process.env.ADMIN_PASSWORD;
    if (!adminPw || password !== adminPw) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }

    if (action === "auth_check") {
      return NextResponse.json({ success: true });
    }

    // ─── FUNDOS ───
    if (action === "fundos_upsert") {
      const rows = [];
      if (data.soja !== undefined && data.soja !== "") {
        rows.push({ data_ref: data.data_ref, produto: "soja", posicao_net: parseInt(data.soja) });
      }
      if (data.milho !== undefined && data.milho !== "") {
        rows.push({ data_ref: data.data_ref, produto: "milho", posicao_net: parseInt(data.milho) });
      }
      if (rows.length === 0) {
        return NextResponse.json({ error: "Informe pelo menos soja ou milho" }, { status: 400 });
      }
      const { error } = await supabase.from("fundos_posicao").upsert(rows, { onConflict: "data_ref,produto" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, inserted: rows.length });
    }

    if (action === "fundos_delete") {
      const { error } = await supabase.from("fundos_posicao").delete().eq("data_ref", data.data_ref).eq("produto", data.produto);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ─── PRÊMIOS PORTO ───
    if (action === "premios_upsert") {
      const today = data.data_ref || new Date().toISOString().slice(0, 10);

      const atualRows = data.items.map((it: any) => ({
        mes_idx: it.mes_idx,
        ano: it.ano,
        contrato: it.contrato,
        venda: it.premio,
        var_dia: it.var_dia || 0,
        produto: "Soja",
        porto: "Paranaguá",
        updated_at: new Date().toISOString(),
      }));

      const { error: e1 } = await supabase
        .from("premios_atual")
        .upsert(atualRows, { onConflict: "mes_idx,ano,produto,porto" });
      if (e1) return NextResponse.json({ error: "premios_atual: " + e1.message }, { status: 500 });

      const histRows = data.items.map((it: any) => ({
        data_ref: today,
        mes_idx: it.mes_idx,
        ano: it.ano,
        contrato: it.contrato,
        premio: it.premio,
        porto: "Paranaguá",
      }));

      const { error: e2 } = await supabase
        .from("premios_historico")
        .upsert(histRows, { onConflict: "data_ref,mes_idx,ano,porto" });
      if (e2) return NextResponse.json({ error: "premios_historico: " + e2.message }, { status: 500 });

      return NextResponse.json({ success: true, inserted: data.items.length });
    }

    if (action === "premios_delete") {
      const { error } = await supabase
        .from("premios_atual")
        .delete()
        .eq("mes_idx", data.mes_idx)
        .eq("ano", data.ano)
        .eq("porto", "Paranaguá");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type === "fundos") {
    const { data, error } = await supabase
      .from("fundos_posicao")
      .select("data_ref, produto, posicao_net")
      .order("data_ref", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "premios") {
    const { data: atual, error: e1 } = await supabase
      .from("premios_atual")
      .select("mes_idx, ano, contrato, venda, var_dia")
      .eq("porto", "Paranaguá")
      .order("ano", { ascending: true })
      .order("mes_idx", { ascending: true });

    const { data: hist, error: e2 } = await supabase
      .from("premios_historico")
      .select("mes_idx, ano, premio, data_ref")
      .eq("porto", "Paranaguá")
      .order("data_ref", { ascending: true });

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    return NextResponse.json({ atual: atual || [], historico: hist || [] });
  }

  return NextResponse.json({ error: "type param required" }, { status: 400 });
}
