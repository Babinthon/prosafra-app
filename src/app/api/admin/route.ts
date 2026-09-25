import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { preencherPtax, hojeSP } from "@/lib/ptaxHistorico";

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

    if (action === "fundos_leitura_upsert") {
      const { error } = await supabase.from("fundos_leitura").upsert(
        { id: 1, leitura: data.leitura || "", leitura_date: data.leitura_date || "", fonte: data.fonte || "CFTC Commitments of Traders — Managed Money", updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ─── PRÊMIOS PORTO ───
    if (action === "premios_upsert") {
      // Data de hoje no fuso de Brasília (não UTC: depois das 21h o UTC já é "amanhã").
      const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      const dataRef: string = data.data_ref || hojeSP;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRef)) {
        return NextResponse.json({ error: "Data de referência inválida" }, { status: 400 });
      }
      if (dataRef > hojeSP) {
        return NextResponse.json({ error: "Data de referência no futuro" }, { status: 400 });
      }
      // Faixa de sanidade (o banco também bloqueia: check -300..400).
      const fora = (data.items || []).filter((it: any) => !(Number(it.premio) >= -300 && Number(it.premio) <= 400));
      if (fora.length) {
        return NextResponse.json({ error: `Prêmio fora da faixa aceita (-300 a +400 c/bu): ${fora.map((it: any) => it.premio).join(", ")}` }, { status: 400 });
      }
      // Lançamento do dia: agora. Retroativo: meio-dia de Brasília da data escolhida.
      // O trigger do banco grava premios_historico com a data (America/Sao_Paulo) de updated_at.
      const updatedAt = dataRef === hojeSP ? new Date().toISOString() : `${dataRef}T12:00:00-03:00`;
      const fonte = typeof data.fonte === "string" && data.fonte.trim() ? data.fonte.trim() : null;

      const atualRows = data.items.map((it: any) => ({
        mes_idx: it.mes_idx,
        ano: it.ano,
        contrato: it.contrato,
        venda: it.premio,
        var_dia: it.var_dia || 0,
        produto: "Soja",
        porto: "Paranaguá",
        updated_at: updatedAt,
        fonte,
      }));

      const { error: e1 } = await supabase
        .from("premios_atual")
        .upsert(atualRows, { onConflict: "mes_idx,ano,produto,porto" });
      if (e1) return NextResponse.json({ error: "premios_atual: " + e1.message }, { status: 500 });

      // premios_historico agora é gravado pelo trigger trg_premio_atual_para_historico
      // (mesma transação). Aqui só lemos os lançamentos que ficaram marcados para conferência.
      const { data: alertas } = await supabase
        .from("premios_historico")
        .select("mes_idx, ano, premio, motivo_conferir")
        .eq("data_ref", dataRef)
        .eq("porto", "Paranaguá")
        .eq("produto", "Soja")
        .eq("conferir", true);

      return NextResponse.json({ success: true, inserted: data.items.length, data_ref: dataRef, alertas: alertas || [] });
    }

    if (action === "premios_hist_revisar") {
      const { error } = await supabase
        .from("premios_historico")
        .update({ conferir: false, revisado_em: new Date().toISOString(), revisado_por: "admin" })
        .eq("data_ref", data.data_ref)
        .eq("mes_idx", data.mes_idx)
        .eq("ano", data.ano)
        .eq("porto", "Paranaguá")
        .eq("produto", "Soja");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "premios_delete") {
      const { error } = await supabase
        .from("premios_atual")
        .delete()
        .eq("mes_idx", data.mes_idx)
        .eq("ano", data.ano)
        .eq("porto", "Paranaguá")
        .eq("produto", "Soja");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "premios_hist_delete") {
      const { error } = await supabase
        .from("premios_historico")
        .delete()
        .eq("data_ref", data.data_ref)
        .eq("mes_idx", data.mes_idx)
        .eq("ano", data.ano)
        .eq("porto", "Paranaguá")
        .eq("produto", "Soja");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ─── PTAX: preencher histórico (só insere dias que faltam) ───
    if (action === "ptax_preencher") {
      const inicio = /^\d{4}-\d{2}-\d{2}$/.test(data?.inicio || "") ? data.inicio : "2023-01-01";
      const fim = /^\d{4}-\d{2}-\d{2}$/.test(data?.fim || "") ? data.fim : hojeSP();
      try {
        const r = await preencherPtax(supabase, inicio, fim);
        return NextResponse.json({ success: true, ...r });
      } catch (e: any) {
        return NextResponse.json({ error: "BCB: " + e.message }, { status: 502 });
      }
    }

    // ─── ANÁLISE TÉCNICA ───
    if (action === "analise_upsert") {
      const row = {
        sym: data.sym,
        label: data.label,
        produto: data.produto,
        zona1_valor: data.zona1_valor,
        zona1_label: data.zona1_label || "Intensificar negócios",
        zona2_valor: data.zona2_valor,
        zona2_label: data.zona2_label || "Buscar negócios",
        zona3_valor: data.zona3_valor,
        zona3_label: data.zona3_label || "Segurar",
        zona1_min: data.zona1_min ?? null, zona1_max: data.zona1_max ?? null,
        zona2_min: data.zona2_min ?? null, zona2_max: data.zona2_max ?? null,
        zona3_min: data.zona3_min ?? null, zona3_max: data.zona3_max ?? null,
        zona4_valor: data.zona4_valor || null,
        zona4_label: data.zona4_label || "Preço desfavorável",
        leitura: data.leitura || "",
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("analise_tecnica").upsert(row, { onConflict: "sym" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "analise_delete") {
      const { error } = await supabase.from("analise_tecnica").delete().eq("sym", data.sym);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ─── FUNDAMENTOS USDA ───
    if (action === "fundamentos_upsert") {
      // When saving, first fetch current to preserve as "anterior"
      const { data: existing } = await supabase.from("fundamentos_usda").select("*").eq("produto", data.produto).single();
      
      const row: any = { ...data, updated_at: new Date().toISOString() };
      
      // If exists and safra changed, shift current to anterior
      if (existing && data.shift_anterior) {
        row.prod_mundo_ant = existing.prod_mundo;
        row.consumo_mundo_ant = existing.consumo_mundo;
        row.export_mundo_ant = existing.export_mundo;
        row.estoque_mundo_ant = existing.estoque_mundo;
        row.rel_estoque_uso_ant = existing.rel_estoque_uso;
        row.brasil_prod_ant = existing.brasil_prod;
        row.brasil_exp_ant = existing.brasil_exp;
        row.eua_prod_ant = existing.eua_prod;
        row.eua_exp_ant = existing.eua_exp;
        row.argentina_prod_ant = existing.argentina_prod;
        row.argentina_exp_ant = existing.argentina_exp;
        row.china_consumo_ant = existing.china_consumo;
        row.china_import_ant = existing.china_import;
        row.safra_anterior = existing.safra_atual;
      }
      delete row.shift_anterior;

      const { error } = await supabase.from("fundamentos_usda").upsert(row, { onConflict: "produto" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "produtor_create") {
      const username = (data.username || "").trim().toLowerCase();
      if (!username || !data.senha) return NextResponse.json({ success: false, error: "Usuário e senha são obrigatórios" }, { status: 400 });
      if (String(data.senha).length < 6) return NextResponse.json({ success: false, error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
      if (!/^[a-z0-9._-]+$/.test(username)) return NextResponse.json({ success: false, error: "Usuário só pode ter letras minúsculas, números, ponto, hífen ou underline (sem espaços)" }, { status: 400 });
      const email = `${username}@bazamagro.com.br`;
      const { data: created, error: cErr } = await supabase.auth.admin.createUser({ email, password: data.senha, email_confirm: true });
      if (cErr || !created?.user) return NextResponse.json({ success: false, error: cErr?.message || "Falha ao criar usuário (o nome de usuário já existe?)" }, { status: 500 });
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: created.user.id, username, role: "cliente", ativo: true,
        nome: data.nome_completo || username, regiao: data.regiao || null,
        cpf_cnpj: data.cpf_cnpj || null, telefone: data.telefone || null, email_contato: data.email_contato || null,
        fazenda: data.fazenda || null, municipio: data.municipio || null, estado: data.estado || null,
        area_ha: data.area_ha ? Number(data.area_ha) : null, culturas: data.culturas || null, observacoes: data.observacoes || null,
        vencimento: data.vencimento || null,
      }, { onConflict: "id" });
      if (pErr) {
        await supabase.auth.admin.deleteUser(created.user.id);
        return NextResponse.json({ success: false, error: pErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "produtor_toggle") {
      const { error } = await supabase.from("profiles").update({ ativo: data.ativo }).eq("id", data.id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "produtor_vencimento") {
      const { error } = await supabase.from("profiles").update({ vencimento: data.vencimento || null }).eq("id", data.id);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "produtor_reset_senha") {
      if (!data.senha) return NextResponse.json({ success: false, error: "Informe a nova senha" }, { status: 400 });
      if (String(data.senha).length < 6) return NextResponse.json({ success: false, error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
      const { error } = await supabase.auth.admin.updateUserById(data.id, { password: data.senha });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "basis_update") {
      const rows = Array.isArray(data.rows) ? data.rows : [];
      let n = 0;
      for (const r of rows) {
        if (r.id == null) continue;
        const { error } = await supabase
          .from("basis_historico")
          .update({ basis_min: Number(r.basis_min), basis_max: Number(r.basis_max), medio: Number(r.medio) })
          .eq("id", r.id);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        n++;
      }
      return NextResponse.json({ success: true, updated: n });
    }

    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const adminPw = process.env.ADMIN_PASSWORD;
  const provided = request.headers.get("x-admin-password");
  if (!adminPw || provided !== adminPw) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type === "pracas_list") {
    const { data, error } = await supabase
      .from("pracas")
      .select("cidade, estado, cidade_estado")
      .order("cidade", { ascending: true });
    if (error) return NextResponse.json({ data: [] });
    return NextResponse.json({ data });
  }

  if (type === "basis_praca") {
    const cidade = url.searchParams.get("cidade");
    if (!cidade) return NextResponse.json({ data: [] });
    const { data, error } = await supabase
      .from("basis_historico")
      .select("id, mercado, mes_referencia, basis_min, basis_max, medio")
      .eq("cidade", cidade);
    if (error) return NextResponse.json({ data: [] });
    return NextResponse.json({ data });
  }

  if (type === "produtores") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, nome, regiao, ativo, municipio, estado, fazenda, telefone, cpf_cnpj, created_at, ultimo_acesso, acessos_total, telas_uso, telas_total, vencimento")
      .eq("role", "cliente")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ data: [] });
    return NextResponse.json({ data });
  }

  if (type === "fundos") {
    const { data, error } = await supabase
      .from("fundos_posicao")
      .select("data_ref, produto, posicao_net")
      .order("data_ref", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "fundos_leitura") {
    const { data, error } = await supabase
      .from("fundos_leitura")
      .select("leitura, leitura_date, fonte")
      .eq("id", 1)
      .single();
    if (error) return NextResponse.json({ data: null });
    return NextResponse.json({ data });
  }

  if (type === "premios") {
    const { data: atual, error: e1 } = await supabase
      .from("premios_atual")
      .select("mes_idx, ano, contrato, venda, var_dia, fonte, updated_at")
      .eq("porto", "Paranaguá")
      .eq("produto", "Soja")
      .order("ano", { ascending: true })
      .order("mes_idx", { ascending: true });

    const { data: hist, error: e2 } = await supabase
      .from("premios_historico")
      .select("mes_idx, ano, premio, data_ref, fonte, conferir, motivo_conferir, var_calc, revisado_em, origem")
      .eq("porto", "Paranaguá")
      .eq("produto", "Soja")
      .order("data_ref", { ascending: true });

    // Avaliação do dia (faixa/média) — usada no aviso antes de salvar. Opcional.
    const { data: aval } = await supabase
      .from("vw_premios_atual_avaliacao_combinada")
      .select("mes_idx, ano, media_combinada, faixa_min, faixa_max, base_label")
      .eq("porto", "Paranaguá")
      .eq("produto", "Soja");

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    return NextResponse.json({ atual: atual || [], historico: hist || [], avaliacao: aval || [] });
  }

  if (type === "analise") {
    const { data, error } = await supabase
      .from("analise_tecnica")
      .select("*")
      .order("produto", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  }

  if (type === "fundamentos") {
    const { data, error } = await supabase
      .from("fundamentos_usda")
      .select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  }

  return NextResponse.json({ error: "type param required" }, { status: 400 });
}
