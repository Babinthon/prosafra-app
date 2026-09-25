// Histórico da PTAX (Banco Central) — usado pela rotina diária de conferência
// e pelo botão do Admin. Só INSERE dias que ainda não existem em ptax_diaria;
// nunca altera um dia já gravado.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PtaxDia {
  data_ref: string; // AAAA-MM-DD
  compra: number;
  venda: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtBCB = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `'${m}-${d}-${y}'`;
};

/** Busca no BCB a PTAX de fechamento de cada dia útil do período (inclusive). */
export async function buscarPtaxBCB(inicio: string, fim: string): Promise<PtaxDia[]> {
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
    `?@dataInicial=${fmtBCB(inicio)}&@dataFinalCotacao=${fmtBCB(fim)}` +
    "&$top=10000&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao";
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`BCB respondeu ${res.status}`);
  const json = await res.json();
  const values: any[] = Array.isArray(json?.value) ? json.value : [];
  // Um registro por dia (se vier mais de um, fica o último horário = fechamento)
  const porDia = new Map<string, any>();
  for (const v of values) {
    if (!v?.dataHoraCotacao) continue;
    const dia = String(v.dataHoraCotacao).slice(0, 10);
    const atual = porDia.get(dia);
    if (!atual || String(v.dataHoraCotacao) > String(atual.dataHoraCotacao)) porDia.set(dia, v);
  }
  return [...porDia.entries()]
    .map(([dia, v]) => ({ data_ref: dia, compra: Number(v.cotacaoCompra), venda: Number(v.cotacaoVenda) }))
    .filter(r => r.compra > 0 && r.venda > 0)
    .sort((a, b) => (a.data_ref < b.data_ref ? -1 : 1));
}

/** Divide o período em blocos de 1 ano para não sobrecarregar o BCB. */
function blocos(inicio: string, fim: string): [string, string][] {
  const out: [string, string][] = [];
  let a = new Date(inicio + "T12:00:00Z");
  const f = new Date(fim + "T12:00:00Z");
  while (a <= f) {
    const b = new Date(a);
    b.setUTCFullYear(b.getUTCFullYear() + 1);
    b.setUTCDate(b.getUTCDate() - 1);
    const fimBloco = b < f ? b : f;
    const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    out.push([iso(a), iso(fimBloco)]);
    a = new Date(fimBloco);
    a.setUTCDate(a.getUTCDate() + 1);
  }
  return out;
}

/** Preenche em ptax_diaria os dias do período que ainda não existem. */
export async function preencherPtax(supabase: SupabaseClient, inicio: string, fim: string) {
  let encontrados = 0;
  let inseridos = 0;
  const divergentes: { data_ref: string; gravado: number; bcb: number }[] = [];
  for (const [a, b] of blocos(inicio, fim)) {
    const bcb = await buscarPtaxBCB(a, b);
    encontrados += bcb.length;
    if (!bcb.length) continue;
    const { data: existentes, error: e1 } = await supabase
      .from("ptax_diaria")
      .select("data_ref, venda")
      .gte("data_ref", a)
      .lte("data_ref", b);
    if (e1) throw new Error(e1.message);
    const gravados = new Map((existentes || []).map((r: any) => [r.data_ref, Number(r.venda)]));
    const novos = bcb.filter(r => !gravados.has(r.data_ref));
    for (const r of bcb) {
      const g = gravados.get(r.data_ref);
      if (g != null && Math.abs(g - r.venda) > 0.0005) divergentes.push({ data_ref: r.data_ref, gravado: g, bcb: r.venda });
    }
    if (novos.length) {
      const agora = new Date().toISOString();
      const { error: e2 } = await supabase
        .from("ptax_diaria")
        .upsert(novos.map(r => ({ ...r, updated_at: agora })), { onConflict: "data_ref", ignoreDuplicates: true });
      if (e2) throw new Error(e2.message);
      inseridos += novos.length;
    }
  }
  return { inicio, fim, encontrados, inseridos, divergentes };
}

export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
export function diasAtras(n: number): string {
  const d = new Date(hojeSP() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
