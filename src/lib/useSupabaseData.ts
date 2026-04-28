"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CotacaoRow {
  lp: number;
  ch: number;
  chp: number;
  hi: number | null;
  lo: number | null;
  vol: number | null;
}

export interface PracaRow {
  id: number;
  cidade: string;
  estado: string;
}

export interface BasisMonth {
  mes: string;
  basis_min: number;
  basis_max: number;
  medio: number;
}

export interface ContractDash {
  sym: string;
  mo: string;
  lp: number;
  ch: number;
  chp: number;
  hi: number;
  lo: number;
  vol: number;
  u?: string;
}

// ═══════════════════════════════════════════════════════════════
// FALLBACK DATA (current hardcoded values — used if Supabase is down)
// ═══════════════════════════════════════════════════════════════

const COTACOES_FALLBACK: Record<string, CotacaoRow> = {
  "CBOT:ZSF2027":{lp:1166.25,ch:11,chp:0.95,hi:1168.75,lo:1153.25,vol:5419},
  "CBOT:ZSH2027":{lp:1165.5,ch:10.5,chp:0.91,hi:1167.75,lo:1154.5,vol:3761},
  "CBOT:ZSK2026":{lp:1167,ch:9,chp:0.78,hi:1171,lo:1156.75,vol:137118},
  "CBOT:ZSK2027":{lp:1168.75,ch:10.5,chp:0.91,hi:1171,lo:1157.75,vol:1359},
  "CBOT:ZSN2026":{lp:1183.25,ch:10.5,chp:0.9,hi:1186.25,lo:1171,vol:126817},
  "CBOT:ZSN2027":{lp:1174.25,ch:10,chp:0.86,hi:1176.75,lo:1164.75,vol:949},
  "CBOT:ZSX2026":{lp:1154.5,ch:10.5,chp:0.92,hi:1157.25,lo:1141,vol:28820},
  "CBOT:ZSX2027":{lp:1126.5,ch:10,chp:0.9,hi:1128.75,lo:1117.75,vol:282},
  "CBOT:ZCK2026":{lp:451.5,ch:5,chp:1.12,hi:452,lo:446,vol:45200},
  "CBOT:ZCN2026":{lp:461,ch:5.25,chp:1.15,hi:462,lo:455.5,vol:32100},
  "CBOT:ZCU2026":{lp:463.75,ch:4.75,chp:1.03,hi:464.5,lo:459,vol:8500},
  "CBOT:ZCZ2026":{lp:478.75,ch:5.5,chp:1.16,hi:479.5,lo:473,vol:18900},
  "CBOT:ZCH2027":{lp:483,ch:5,chp:1.05,hi:484,lo:478,vol:9061},
  "CBOT:ZCK2027":{lp:488,ch:5.25,chp:1.09,hi:489,lo:483,vol:1242},
  "CBOT:ZCN2027":{lp:493,ch:5,chp:1.02,hi:494,lo:488,vol:905},
  "CBOT:ZCU2027":{lp:497,ch:4.75,chp:0.96,hi:498,lo:492,vol:223},
  "CBOT:ZCZ2027":{lp:502,ch:5,chp:1.01,hi:503,lo:497,vol:1229},
  "BMFBOVESPA:CCMK2026":{lp:66.32,ch:0.09,chp:0.14,hi:66.4,lo:66.21,vol:808},
  "BMFBOVESPA:CCMN2026":{lp:67.25,ch:0.08,chp:0.12,hi:67.25,lo:66.99,vol:429},
  "BMFBOVESPA:CCMU2026":{lp:68.4,ch:0.2,chp:0.29,hi:68.4,lo:68.23,vol:55},
  "BMFBOVESPA:CCMX2026":{lp:70.77,ch:-0.02,chp:-0.03,hi:70.95,lo:70.75,vol:160},
  "BMFBOVESPA:CCMF2027":{lp:73.4,ch:0.34,chp:0.47,hi:73.4,lo:73.39,vol:64},
  "BMFBOVESPA:CCMH2027":{lp:75.15,ch:-0.03,chp:-0.04,hi:75.15,lo:75,vol:46},
  "BMFBOVESPA:CCMK2027":{lp:71.52,ch:-0.46,chp:-0.64,hi:71.52,lo:71.52,vol:0},
  "BMFBOVESPA:CCMN2027":{lp:71.81,ch:-0.46,chp:-0.64,hi:71.81,lo:71.81,vol:0},
  "BMFBOVESPA:CCMU2027":{lp:72,ch:-0.04,chp:-0.06,hi:72,lo:72,vol:1},
  "BMFBOVESPA:DOLK2026":{lp:5008,ch:-0.5,chp:-0.01,hi:5016.5,lo:4999,vol:154095},
  "BMFBOVESPA:DOLM2026":{lp:5041,ch:-2,chp:-0.04,hi:5042,lo:5039,vol:820},
  "BMFBOVESPA:DOLN2026":{lp:5078.43,ch:-8.5,chp:-0.17,hi:5078.43,lo:5078.43,vol:0},
  "BMFBOVESPA:DOLQ2026":{lp:5117.01,ch:-8.5,chp:-0.17,hi:5117.01,lo:5117.01,vol:0},
  "BMFBOVESPA:DOLU2026":{lp:5152.69,ch:-9.5,chp:-0.18,hi:5152.69,lo:5152.69,vol:0},
  "BMFBOVESPA:DOLV2026":{lp:5187.71,ch:-10,chp:-0.19,hi:5187.71,lo:5187.71,vol:0},
  "BMFBOVESPA:DOLX2026":{lp:5220.86,ch:-9.5,chp:-0.18,hi:5220.86,lo:5220.86,vol:0},
  "BMFBOVESPA:DOLZ2026":{lp:5252.27,ch:-11,chp:-0.21,hi:5252.27,lo:5252.27,vol:0},
  "BMFBOVESPA:DOLF2027":{lp:5285.09,ch:-11.5,chp:-0.22,hi:5285.09,lo:5285.09,vol:0},
  "BMFBOVESPA:DOLG2027":{lp:5320,ch:-12,chp:-0.23,hi:5320,lo:5320,vol:0},
  "BMFBOVESPA:DOLH2027":{lp:5348.43,ch:-13,chp:-0.24,hi:5348.43,lo:5348.43,vol:0},
  "BMFBOVESPA:DOLJ2027":{lp:5383.39,ch:-14.5,chp:-0.27,hi:5383.39,lo:5383.39,vol:0},
  "BMFBOVESPA:DOLN2027":{lp:5483.75,ch:-15,chp:-0.27,hi:5483.75,lo:5483.75,vol:0},
  "BMFBOVESPA:DOLQ2027":{lp:5517.46,ch:-15.5,chp:-0.28,hi:5517.46,lo:5517.46,vol:0},
  "BMFBOVESPA:DOLV2027":{lp:5586.1,ch:-17,chp:-0.3,hi:5586.1,lo:5586.1,vol:0},
  "FX:USDBRL":{lp:5.008,ch:-0.01,chp:-0.2,hi:5.02,lo:4.99,vol:0},
};

const PRACAS_FALLBACK: PracaRow[] = [
  { id: 1, cidade: "Rio Verde", estado: "GO" },
  { id: 2, cidade: "Sorriso", estado: "MT" },
  { id: 3, cidade: "Lucas do Rio Verde", estado: "MT" },
  { id: 4, cidade: "Dourados", estado: "MS" },
  { id: 5, cidade: "Cascavel", estado: "PR" },
  { id: 6, cidade: "Luís Eduardo Magalhães", estado: "BA" },
  { id: 7, cidade: "Uberaba", estado: "MG" },
  { id: 8, cidade: "Não-Me-Toque", estado: "RS" },
  { id: 9, cidade: "Balsas", estado: "MA" },
  { id: 10, cidade: "Uruçuí", estado: "PI" },
  { id: 11, cidade: "Paragominas", estado: "PA" },
  { id: 12, cidade: "Palmas", estado: "TO" },
  { id: 13, cidade: "Chapecó", estado: "SC" },
  { id: 14, cidade: "Cristalina", estado: "GO" },
  { id: 15, cidade: "Primavera do Leste", estado: "MT" },
];

const DEFAULT_BASIS: BasisMonth[] = [
  { mes: "Janeiro", basis_min: -120, basis_max: -70, medio: -95 },
  { mes: "Fevereiro", basis_min: -125, basis_max: -75, medio: -100 },
  { mes: "Março", basis_min: -135, basis_max: -85, medio: -110 },
  { mes: "Abril", basis_min: -130, basis_max: -77, medio: -103.5 },
  { mes: "Maio", basis_min: -115, basis_max: -65, medio: -90 },
  { mes: "Junho", basis_min: -105, basis_max: -55, medio: -80 },
  { mes: "Julho", basis_min: -100, basis_max: -50, medio: -75 },
  { mes: "Agosto", basis_min: -95, basis_max: -45, medio: -70 },
  { mes: "Setembro", basis_min: -90, basis_max: -40, medio: -65 },
  { mes: "Outubro", basis_min: -85, basis_max: -35, medio: -60 },
  { mes: "Novembro", basis_min: -95, basis_max: -45, medio: -70 },
  { mes: "Dezembro", basis_min: -105, basis_max: -55, medio: -80 },
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ═══════════════════════════════════════════════════════════════
// CONTRACT SYMBOL → MONTH LABEL MAPPING
// ═══════════════════════════════════════════════════════════════

const CODE_TO_MONTH: Record<string, string> = {
  F:"Jan",G:"Fev",H:"Mar",J:"Abr",K:"Mai",M:"Jun",
  N:"Jul",Q:"Ago",U:"Set",V:"Out",X:"Nov",Z:"Dez"
};

function symToMonthLabel(sym: string): string {
  // e.g. "CBOT:ZSK2026" → "Mai/26", "BMFBOVESPA:CCMK2026" → "Mai/26"
  const clean = sym.includes(":") ? sym.split(":")[1] : sym;
  const code = clean.replace(/\d+/g, "").slice(-1); // last letter before year
  const year = clean.slice(-4);
  const moName = CODE_TO_MONTH[code] || "???";
  return `${moName}/${year.slice(-2)}`;
}

// ═══════════════════════════════════════════════════════════════
// BUILD CONTRACTS_DASH FROM COTACOES
// ═══════════════════════════════════════════════════════════════

function buildContractsDash(cotacoes: Record<string, CotacaoRow>) {
  const sojaCbot: ContractDash[] = [];
  const milhoCbot: ContractDash[] = [];
  const milhoB3: ContractDash[] = [];
  const dolarB3: ContractDash[] = [];

  // Sort order for contract codes
  const codeOrder = "FGHJKMNQUVXZ";

  const entries = Object.entries(cotacoes);

  for (const [symbol, cot] of entries) {
    const clean = symbol.includes(":") ? symbol.split(":")[1] : symbol;
    const mo = symToMonthLabel(symbol);

    const item: ContractDash = {
      sym: clean,
      mo,
      lp: cot.lp,
      ch: cot.ch,
      chp: cot.chp,
      hi: cot.hi ?? cot.lp,
      lo: cot.lo ?? cot.lp,
      vol: cot.vol ?? 0,
    };

    if (symbol.startsWith("CBOT:ZS")) {
      sojaCbot.push(item);
    } else if (symbol.startsWith("CBOT:ZC")) {
      milhoCbot.push(item);
    } else if (symbol.includes("CCM")) {
      milhoB3.push({ ...item, u: "R$/sc" });
    } else if (symbol.includes("DOL")) {
      dolarB3.push(item);
    }
    // skip FX:USDBRL — it's not a contract
  }

  // Sort each group by year then month code
  const sortContracts = (a: ContractDash, b: ContractDash) => {
    const aYear = parseInt(a.sym.slice(-4));
    const bYear = parseInt(b.sym.slice(-4));
    if (aYear !== bYear) return aYear - bYear;
    const aCode = a.sym.replace(/\d+/g, "").slice(-1);
    const bCode = b.sym.replace(/\d+/g, "").slice(-1);
    return codeOrder.indexOf(aCode) - codeOrder.indexOf(bCode);
  };

  sojaCbot.sort(sortContracts);
  milhoCbot.sort(sortContracts);
  milhoB3.sort(sortContracts);
  dolarB3.sort(sortContracts);

  return { sojaCbot, milhoCbot, milhoB3, dolarB3 };
}

// ═══════════════════════════════════════════════════════════════
// BUILD BASIS_DATA FROM basis_historico ROWS
// ═══════════════════════════════════════════════════════════════

interface BasisHistoricoRow {
  praca_cidade: string;
  praca_estado: string;
  mercado: string;
  mes: number; // 1-12
  basis_min: number;
  basis_max: number;
  basis_medio: number;
}

function buildBasisData(rows: BasisHistoricoRow[]): Record<string, BasisMonth[]> {
  const grouped: Record<string, Map<number, { mins: number[]; maxs: number[]; medios: number[] }>> = {};

  for (const row of rows) {
    const key = `${row.praca_cidade}-${row.praca_estado}-${row.mercado}`;
    if (!grouped[key]) grouped[key] = new Map();
    const mesMap = grouped[key];
    const mesIdx = row.mes; // 1-12

    if (!mesMap.has(mesIdx)) {
      mesMap.set(mesIdx, { mins: [], maxs: [], medios: [] });
    }
    const bucket = mesMap.get(mesIdx)!;
    bucket.mins.push(row.basis_min);
    bucket.maxs.push(row.basis_max);
    bucket.medios.push(row.basis_medio);
  }

  const result: Record<string, BasisMonth[]> = {};

  for (const [key, mesMap] of Object.entries(grouped)) {
    const months: BasisMonth[] = [];
    for (let m = 0; m < 12; m++) {
      const bucket = mesMap.get(m + 1);
      if (bucket && bucket.medios.length > 0) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        months.push({
          mes: MESES[m],
          basis_min: Math.round(avg(bucket.mins) * 10) / 10,
          basis_max: Math.round(avg(bucket.maxs) * 10) / 10,
          medio: Math.round(avg(bucket.medios) * 10) / 10,
        });
      } else {
        // Use DEFAULT_BASIS for this month if no data
        months.push(DEFAULT_BASIS[m]);
      }
    }
    result[key] = months;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════

export interface PtaxRow {
  data_ref: string;
  compra: number;
  venda: number;
}

export interface SupabaseData {
  cotacoes: Record<string, CotacaoRow>;
  contractsDash: ReturnType<typeof buildContractsDash>;
  pracas: PracaRow[];
  basisData: Record<string, BasisMonth[]>;
  defaultBasis: BasisMonth[];
  ptax: PtaxRow | null;
  loading: boolean;
  lastUpdate: string | null;
  isLive: boolean; // true = Supabase data, false = fallback
  refresh: () => void;
}

export function useSupabaseData(): SupabaseData {
  const [cotacoes, setCotacoes] = useState<Record<string, CotacaoRow>>(COTACOES_FALLBACK);
  const [pracas, setPracas] = useState<PracaRow[]>(PRACAS_FALLBACK);
  const [basisData, setBasisData] = useState<Record<string, BasisMonth[]>>({});
  const [ptax, setPtax] = useState<PtaxRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      // ─── 1. COTAÇÕES ───
      const { data: cotData, error: cotErr } = await supabase
        .from("cotacoes_mercado")
        .select("symbol, last_price, change_val, change_pct, high, low, volume, updated_at")
        .order("updated_at", { ascending: false });

      if (!cotErr && cotData && cotData.length > 0) {
        const mapped: Record<string, CotacaoRow> = {};
        for (const row of cotData) {
          mapped[row.symbol] = {
            lp: row.last_price,
            ch: row.change_val,
            chp: row.change_pct,
            hi: row.high,
            lo: row.low,
            vol: row.volume,
          };
        }
        setCotacoes(mapped);
        setLastUpdate(cotData[0]?.updated_at || null);
        setIsLive(true);
      }

      // ─── 2. PRAÇAS ───
      const { data: pracasData, error: pracasErr } = await supabase
        .from("pracas")
        .select("id, cidade, estado")
        .order("estado", { ascending: true })
        .order("cidade", { ascending: true });

      if (!pracasErr && pracasData && pracasData.length > 0) {
        setPracas(pracasData);
      }

      // ─── 3. BASIS HISTÓRICO ───
      const { data: basisRows, error: basisErr } = await supabase
        .from("basis_historico")
        .select("praca_cidade, praca_estado, mercado, mes, basis_min, basis_max, basis_medio");

      if (!basisErr && basisRows && basisRows.length > 0) {
        const built = buildBasisData(basisRows as BasisHistoricoRow[]);
        setBasisData(built);
      }

      // ─── 4. PTAX ───
      const { data: ptaxData, error: ptaxErr } = await supabase
        .from("ptax_diaria")
        .select("data_ref, compra, venda")
        .order("data_ref", { ascending: false })
        .limit(1);

      if (!ptaxErr && ptaxData && ptaxData.length > 0) {
        setPtax(ptaxData[0] as PtaxRow);
      }
    } catch (e) {
      console.error("useSupabaseData: fetch error, using fallback", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Refresh every 10 minutes (matches cron)
    const interval = setInterval(fetchAll, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const contractsDash = useMemo(() => buildContractsDash(cotacoes), [cotacoes]);

  return {
    cotacoes,
    contractsDash,
    pracas,
    basisData,
    defaultBasis: DEFAULT_BASIS,
    ptax,
    loading,
    lastUpdate,
    isLive,
    refresh: fetchAll,
  };
}
