import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST: save fundos position
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, action, data } = body;

    // Auth check
    const adminPw = process.env.ADMIN_PASSWORD;
    if (!adminPw || password !== adminPw) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }

    if (action === "fundos_upsert") {
      // data: { data_ref, soja, milho }
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

      const { error } = await supabase
        .from("fundos_posicao")
        .upsert(rows, { onConflict: "data_ref,produto" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, inserted: rows.length });
    }

    if (action === "fundos_delete") {
      const { error } = await supabase
        .from("fundos_posicao")
        .delete()
        .eq("data_ref", data.data_ref)
        .eq("produto", data.produto);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "auth_check") {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: fetch fundos history
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type === "fundos") {
    const { data, error } = await supabase
      .from("fundos_posicao")
      .select("data_ref, produto, posicao_net")
      .order("data_ref", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "type param required" }, { status: 400 });
}
