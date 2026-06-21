"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSupabaseData } from "../lib/useSupabaseData";
import type { CotacaoRow, PracaRow, BasisMonth, ContractDash } from "../lib/useSupabaseData";

// ═══════════════════════════════════════════════════════════════
// SHARED DATA — now loaded from Supabase via useSupabaseData hook
// COTACOES, CONTRACTS_DASH, PRACAS, BASIS_DATA, DEFAULT_BASIS
// are passed as props from the root component
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const SOJA_MAP = {0:"F",1:"H",2:"H",3:"K",4:"K",5:"N",6:"N",7:"Q",8:"U",9:"X",10:"X",11:"F"};
const MILHO_MAP = {0:"H",1:"H",2:"H",3:"K",4:"K",5:"N",6:"N",7:"U",8:"U",9:"Z",10:"Z",11:"Z"};
const CODE_NAME = {F:"Jan",G:"Fev",H:"Mar",J:"Abr",K:"Mai",M:"Jun",N:"Jul",Q:"Ago",U:"Set",V:"Out",X:"Nov",Z:"Dez"};
const DOL_CODE = {0:"F",1:"G",2:"H",3:"J",4:"K",5:"M",6:"N",7:"Q",8:"U",9:"V",10:"X",11:"Z"};

const buildSoja = (mi,yr) => { const c=SOJA_MAP[mi]; return `CBOT:ZS${c}${mi===11?yr+1:yr}`; };
const buildMilho = (mi,yr) => `CBOT:ZC${MILHO_MAP[mi]}${yr}`;
const buildDol = (mi,yr) => `BMFBOVESPA:DOL${DOL_CODE[mi]}${yr}`;

function findClosest(sym, keys, cotacoes) {
  if (cotacoes[sym]) return sym;
  const m = sym.match(/^(.+?)([A-Z])(\d{4})$/);
  if (!m) return sym;
  const ord = "FGHJKMNQUVXZ";
  const t = parseInt(m[3])*12 + ord.indexOf(m[2]);
  let best=null, bd=Infinity;
  for (const k of keys) { if (!k.startsWith(m[1])) continue; const m2=k.match(/([A-Z])(\d{4})$/); if(!m2) continue; const d=Math.abs(parseInt(m2[2])*12+ord.indexOf(m2[1])-t); if(d<bd){bd=d;best=k;} }
  return best||sym;
}

const FATOR = 2.20462;
const calc = (c,b,d) => (c+b)*FATOR/100*d;
const calcUSD = (c,b) => (c+b)*FATOR/100;
const fmt = (n,d=2) => n.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtVol = v => v>=1000?(v/1000).toFixed(1).replace(".",",")+`k`:String(v);

const BZ = {
  bg:"#F7F7F5", surface:"#FFFFFF", surfaceAlt:"#FCFBF9",
  border:"#ECE7DD", borderSoft:"#F2EEE6",
  gold:"#D5A246", goldSoft:"#FBF4E6", goldBorder:"#EBD9B5", goldHover:"#F6EBD3",
  bronze:"#B67A33", brown:"#6B4324", brownDeep:"#4A2C16",
  text:"#2E2620", textMute:"#8A7E6F", textFaint:"#A89C8A",
  up:"#4E7C5A", down:"#B0503F",
};

function BZLogo({size=34}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M9,26 A15,15 0 0 1 39,26" stroke="#D5A246" strokeWidth="2" strokeLinecap="round"/>
      <line x1="17" y1="30" x2="17" y2="21" stroke="#D5A246" strokeWidth="2.1" strokeLinecap="round"/>
      <line x1="20.5" y1="30" x2="20.5" y2="15.5" stroke="#CB933C" strokeWidth="2.1" strokeLinecap="round"/>
      <line x1="24" y1="30" x2="24" y2="12.5" stroke="#B67A33" strokeWidth="2.1" strokeLinecap="round"/>
      <line x1="27.5" y1="30" x2="27.5" y2="16.5" stroke="#9C6730" strokeWidth="2.1" strokeLinecap="round"/>
      <line x1="31" y1="30" x2="31" y2="21.5" stroke="#6B4324" strokeWidth="2.1" strokeLinecap="round"/>
      <path d="M11,32 Q24,38 37,32" stroke="#B67A33" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <path d="M14,35 Q24,40 34,35" stroke="#6B4324" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

const NAV = [
  {id:"dashboard",label:"Dashboard",icon:"◉"},
  {id:"preco-justo",label:"Preço Justo",icon:"◎"},
  {id:"premios",label:"Prêmios Porto",icon:"⚓"},
  {id:"analise",label:"Análise Técnica",icon:"△"},
  {id:"fundamentos",label:"Fundamentos",icon:"▤"},
  {id:"fundos",label:"Posição Fundos",icon:"◧"},
  {id:"cambio",label:"Câmbio",icon:"◈"},
  {id:"paridade",label:"Paridade",icon:"⬡"},
  {id:"carrego",label:"Custo Carrego",icon:"⊞"},
  {id:"ofertas",label:"Ofertas Firmes",icon:"✉"},
  {id:"mercado",label:"Mercado",icon:"≣"},
  {id:"consultoria",label:"Consultoria",icon:"★"},
  {id:"admin",label:"Admin",icon:"⚙"},
];

function buildOpts() {
  const now = new Date();
  const curMonth = now.getMonth(); // 0-11
  const curYear = now.getFullYear();
  const o=[];
  // Generate 18 months forward from current month
  for(let n=0;n<18;n++){
    const mi=(curMonth+n)%12;
    const yr=curYear+Math.floor((curMonth+n)/12);
    o.push({mi,yr,label:`${MESES[mi]} ${yr}`});
  }
  return o;
}
const OPTS = buildOpts();

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Sel({label,value,onChange,children,w,grow}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:w,flex:grow?1:undefined}}>
      <label style={{fontSize:9,color:"#8A7E6F",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{
        background:"#F6F3ED",border:"1px solid #E4DECF",borderRadius:7,
        color:"#4A2C16",padding:"9px 10px",fontSize:12,fontFamily:"'Outfit',sans-serif",
        cursor:"pointer",outline:"none",appearance:"none",
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 4L5 7L8 4' fill='none' stroke='%236B7280' stroke-width='1.5'/%3E%3C/svg%3E")`,
        backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",paddingRight:28,
      }}>{children}</select>
    </div>
  );
}

function Chg({ch,chp}) {
  const p=ch>=0;
  return <span style={{color:p?BZ.up:BZ.down,fontSize:10,fontWeight:500}}>{p?"▲":"▼"} {p?"+":""}{fmt(ch)} ({p?"+":""}{fmt(chp)}%)</span>;
}

function Legend({color,border,text,dot}) {
  return <div style={{display:"flex",alignItems:"center",gap:4}}>
    <div style={{width:dot?7:10,height:dot?7:6,borderRadius:dot?"50%":2,background:color,border:border?`1px solid ${border}`:"none"}}/>
    <span style={{color:"#8A7E6F",fontSize:9}}>{text}</span>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════

function DashContractRow({item,unit,isDol}) {
  const dp = isDol ? fmt(item.lp/1000,3) : fmt(item.lp,2);
  const u = isDol ? "R$" : unit||"c/bu";
  return (
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr 95px 70px",alignItems:"center",padding:"7px 12px",borderBottom:`1px solid ${BZ.borderSoft}`}}
      onMouseEnter={e=>e.currentTarget.style.background=BZ.goldSoft}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <span style={{color:BZ.textMute,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{item.mo}</span>
      <span style={{color:BZ.brownDeep,fontSize:13,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{dp} <span style={{color:BZ.textFaint,fontSize:10,fontWeight:400}}>{u}</span></span>
      <Chg ch={item.ch} chp={item.chp}/>
      <span style={{color:BZ.textFaint,fontSize:10,textAlign:"right"}}>{fmtVol(item.vol)}</span>
    </div>
  );
}

function DashSection({title,sub,color,contracts,unit,isDol,defOpen=false}) {
  const [open,setOpen]=useState(defOpen);
  const lead=contracts[0];
  return (
    <div style={{background:BZ.surface,border:`1px solid ${BZ.border}`,borderRadius:12,overflow:"hidden"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=BZ.goldBorder}
      onMouseLeave={e=>e.currentTarget.style.borderColor=BZ.border}>
      <div onClick={()=>setOpen(!open)} style={{padding:"14px 18px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start",userSelect:"none"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:color}}/>
            <span style={{color:BZ.brownDeep,fontSize:13,fontWeight:600}}>{title}</span>
            <span style={{fontSize:9,color:BZ.textMute,background:BZ.goldSoft,padding:"1px 6px",borderRadius:3}}>{contracts.length}</span>
          </div>
          <span style={{color:BZ.textMute,fontSize:11}}>{sub}</span>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:BZ.brownDeep,fontSize:18,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>
            {isDol?fmt(lead.lp/1000,3):fmt(lead.lp,2)}
          </div>
          <div style={{marginTop:2}}><Chg ch={lead.ch} chp={lead.chp}/></div>
          <div style={{color:BZ.textFaint,fontSize:9,marginTop:1}}>{lead.sym}</div>
        </div>
      </div>
      {open && <div style={{borderTop:`1px solid ${BZ.borderSoft}`}}>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr 95px 70px",padding:"5px 12px",borderBottom:`1px solid ${BZ.borderSoft}`}}>
          {["Venc.","Último","Var.","Vol."].map(h=><span key={h} style={{color:BZ.textFaint,fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:h==="Vol."?"right":undefined}}>{h}</span>)}
        </div>
        {contracts.map(c=><DashContractRow key={c.sym} item={c} unit={unit} isDol={isDol}/>)}
      </div>}
      <div onClick={()=>setOpen(!open)} style={{textAlign:"center",padding:"5px",cursor:"pointer",color:BZ.textMute,fontSize:10,borderTop:`1px solid ${BZ.borderSoft}`}}
        onMouseEnter={e=>e.currentTarget.style.color=BZ.gold} onMouseLeave={e=>e.currentTarget.style.color=BZ.textMute}>
        {open?"▲ Recolher":"▼ Ver contratos"}
      </div>
    </div>
  );
}

function bzPrecoJusto(praca, COTACOES, BASIS_DATA, DEFAULT_BASIS, eMi, eYr, pMi, pYr){
  const mercado="Soja Exportação";
  const bKey=praca?`${praca.cidade}-${praca.estado}-${mercado}`:"";
  const bAll=BASIS_DATA[bKey]||DEFAULT_BASIS;
  const bM=(bAll&&bAll[eMi])||{medio:-100};
  const allK=Object.keys(COTACOES);
  const dolKeys=allK.filter(k=>k.includes("DOL"));
  const csym=findClosest(buildSoja(eMi,eYr),allK,COTACOES);
  const chi=COTACOES[csym]?COTACOES[csym].lp:1150;
  const dsym=findClosest(buildDol(pMi,pYr),dolKeys,COTACOES);
  const dol=COTACOES[dsym]?COTACOES[dsym].lp/1000:5.05;
  return {pj:calc(chi,bM.medio,dol), csym, chi};
}

function bzScenarioSignals(eMi,eYr,csym,chi,premiosData,analiseData,fundosData){
  let premio={tag:"Neutro",txt:"Sem leitura"};
  if(premiosData&&premiosData.atual&&premiosData.atual.length){
    const pr=premiosData.atual.slice().sort((a,b)=>Math.abs(a.mes_idx-eMi)-Math.abs(b.mes_idx-eMi))[0];
    if(pr){const up=(pr.var_dia||0)>=0; premio={tag:up?"Favorável":"Neutro",txt:`${pr.venda>=0?"+":""}${fmt(pr.venda,0)} c/bu`};}
  }
  let tec={tag:"Neutro",txt:"Sem leitura"};
  if(analiseData&&analiseData.length){
    const row=analiseData.find(a=>a.sym===csym)||analiseData.find(a=>(a.produto||"").toLowerCase()==="soja");
    if(row){
      const zs=[{v:row.zona1_valor,t:"Favorável",l:row.zona1_label},{v:row.zona2_valor,t:"Favorável",l:row.zona2_label},{v:row.zona3_valor,t:"Neutro",l:row.zona3_label}].filter(z=>typeof z.v==="number").sort((a,b)=>a.v-b.v);
      if(zs.length){
        if(chi<zs[0].v){tec={tag:"Atenção",txt:"Abaixo do suporte"};}
        else{for(let i=zs.length-1;i>=0;i--){if(chi>=zs[i].v){tec={tag:zs[i].t,txt:zs[i].l||"Zona mapeada"};break;}}}
      }
    }
  }
  const fd=fundosData&&fundosData.soja?fundosData.soja:null;
  const fundos=fd?(fd.posAtual>=0?{tag:"Favorável",txt:"Comprados"}:{tag:"Atenção",txt:"Vendidos"}):{tag:"Neutro",txt:"Sem leitura"};
  return [["Prêmio",premio],["Técnica",tec],["Fundos",fundos]];
}

function DashboardPage({goTo, PRACAS, COTACOES, BASIS_DATA, DEFAULT_BASIS, premiosData, analiseData, fundosData}) {
  const mercado="Soja Exportação";
  const [pracaIds,setPracaIds]=useState([]);
  const [activeId,setActiveId]=useState(null);
  const [custo,setCusto]=useState(5500);
  const [prod,setProd]=useState(60);
  const [cenario,setCenario]=useState("disp");
  const hydrated=useRef(false);

  const byState=useMemo(()=>{
    const g={};
    PRACAS.forEach(p=>{const bk=`${p.cidade}-${p.estado}-${mercado}`; if(BASIS_DATA[bk]){(g[p.estado]||=[]).push(p);}});
    return g;
  },[PRACAS,BASIS_DATA]);
  const availPracas=useMemo(()=>Object.values(byState).flat(),[byState]);

  // Hidratação única: região ativa = a última salva (bz_praca_ref), nunca a primeira da lista
  useEffect(()=>{
    if(hydrated.current) return;
    try{
      const c=localStorage.getItem("bz_custo"); if(c)setCusto(parseFloat(c));
      const q=localStorage.getItem("bz_prod"); if(q)setProd(parseFloat(q));
      const raw=localStorage.getItem("bz_pracas");
      let list=raw?JSON.parse(raw):[];
      if(!Array.isArray(list))list=[];
      const refRaw=localStorage.getItem("bz_praca_ref");
      const ref=(refRaw!=null&&refRaw!=="")?parseInt(refRaw):null;
      if(ref!=null&&!list.includes(ref))list=[...list,ref];
      if(list.length){
        setPracaIds(list);
        setActiveId(ref!=null?ref:list[0]);
        hydrated.current=true;
      } else if(availPracas.length>0){
        const id=availPracas[0].id;
        setPracaIds([id]); setActiveId(id);
        hydrated.current=true;
      }
    }catch(e){}
  },[availPracas]);

  // Persistência (só após hidratar, para não sobrescrever o que já está salvo)
  useEffect(()=>{if(hydrated.current){try{localStorage.setItem("bz_pracas",JSON.stringify(pracaIds));}catch(e){}}},[pracaIds]);
  useEffect(()=>{if(hydrated.current&&activeId!=null){try{localStorage.setItem("bz_praca_ref",String(activeId));}catch(e){}}},[activeId]);
  useEffect(()=>{if(hydrated.current){try{localStorage.setItem("bz_custo",String(custo));}catch(e){}}},[custo]);
  useEffect(()=>{if(hydrated.current){try{localStorage.setItem("bz_prod",String(prod));}catch(e){}}},[prod]);

  const effId=availPracas.some(p=>p.id===activeId)?activeId:(pracaIds.find(id=>availPracas.some(p=>p.id===id))??availPracas[0]?.id);
  const praca=PRACAS.find(p=>p.id===effId);
  const pLabel=praca?`${praca.cidade} - ${praca.estado}`:"—";
  const savedPracas=pracaIds.map(id=>PRACAS.find(p=>p.id===id)).filter(Boolean);
  const addable=availPracas.filter(p=>!pracaIds.includes(p.id));

  function addPraca(id){ if(id&&!pracaIds.includes(id)){setPracaIds([...pracaIds,id]); setActiveId(id);} }
  function removePraca(id){ const nl=pracaIds.filter(x=>x!==id); setPracaIds(nl); if(activeId===id)setActiveId(nl[0]??null); }

  const now=new Date();
  const pag30=new Date(now); pag30.setDate(pag30.getDate()+30);
  const disp=bzPrecoJusto(praca,COTACOES,BASIS_DATA,DEFAULT_BASIS,now.getMonth(),now.getFullYear(),pag30.getMonth(),pag30.getFullYear());
  const fut=bzPrecoJusto(praca,COTACOES,BASIS_DATA,DEFAULT_BASIS,2,2027,3,2027);
  const dispSig=bzScenarioSignals(now.getMonth(),now.getFullYear(),disp.csym,disp.chi,premiosData,analiseData,fundosData);
  const futSig=bzScenarioSignals(2,2027,fut.csym,fut.chi,premiosData,analiseData,fundosData);

  const pj=cenario==="disp"?disp.pj:fut.pj;
  const custoN=parseFloat(custo)||0, prodN=parseFloat(prod)||0;
  const recJusto=prodN*pj, resJusto=recJusto-custoN, be=prodN?custoN/prodN:0;
  const rowSel=nearestVal(RES_PRODS,prodN), colSel=nearestVal(RES_PRECOS,pj);
  const fmtBR=n=>Math.round(n).toLocaleString("pt-BR");
  const TAG={"Favorável":["#4E7C5A","#E6EEE7"],"Neutro":["#8A7E6F","#F0ECE3"],"Atenção":["#B67A33","#FBF4E6"]};
  const inpStyle={display:"flex",alignItems:"center",background:"#F6F3ED",border:`1px solid #E4DECF`,borderRadius:7,padding:"0 9px"};
  const inpField={background:"transparent",border:"none",color:BZ.brownDeep,padding:"9px 4px",fontSize:14,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",outline:"none"};

  function SigRow({sigs}){
    return (
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:13}}>
        {sigs.map(([nome,s],i)=>{const t=TAG[s.tag]||TAG.Neutro;return (
          <span key={i} style={{display:"inline-flex",alignItems:"center",gap:6,background:BZ.surfaceAlt,border:`1px solid ${BZ.borderSoft}`,borderRadius:9,padding:"6px 9px"}}>
            <span style={{fontSize:10,color:BZ.brown,fontWeight:500}}>{nome}</span>
            <span style={{fontSize:9,color:BZ.textMute}}>{s.txt}</span>
            <span style={{fontSize:8,fontWeight:700,color:t[0],background:t[1],padding:"2px 6px",borderRadius:10,whiteSpace:"nowrap"}}>{s.tag}</span>
          </span>
        );})}
      </div>
    );
  }
  function ScCard({tag,c,ent,pag,accent,sigs}){
    return (
      <div style={{background:BZ.surface,border:`1px solid ${BZ.border}`,borderRadius:14,padding:"18px 20px",borderTop:`3px solid ${accent}`}}>
        <span style={{fontSize:10,color:BZ.textFaint,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600}}>{tag}</span>
        <div style={{display:"flex",alignItems:"baseline",gap:7,marginTop:8}}><span style={{fontSize:32,fontWeight:800,color:BZ.brownDeep,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>R$ {fmt(c.pj)}</span><span style={{fontSize:12,color:BZ.textFaint}}>/saca</span></div>
        <div style={{fontSize:10,color:BZ.textMute,marginTop:6}}>{ent} • {pag}</div>
        <SigRow sigs={sigs}/>
      </div>
    );
  }

  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 28px"}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:9,color:BZ.textMute,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Minhas regiões</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,alignItems:"center"}}>
          {savedPracas.map(p=>{const act=p.id===effId;return (
            <span key={p.id} onClick={()=>setActiveId(p.id)} style={{display:"inline-flex",alignItems:"center",gap:7,cursor:"pointer",
              background:act?BZ.goldSoft:BZ.surface,border:`1px solid ${act?BZ.goldBorder:BZ.border}`,color:act?BZ.brown:BZ.textMute,
              borderRadius:20,padding:"6px 13px",fontSize:12,fontWeight:act?600:500}}>
              {p.cidade} - {p.estado}
              {savedPracas.length>1&&<span onClick={e=>{e.stopPropagation();removePraca(p.id);}} style={{fontSize:14,color:BZ.textFaint,lineHeight:1,marginLeft:1}}>×</span>}
            </span>
          );})}
          {addable.length>0&&(
            <select value="" onChange={e=>addPraca(+e.target.value)} style={{border:`1px dashed ${BZ.goldBorder}`,background:BZ.surface,color:BZ.bronze,borderRadius:20,padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer",outline:"none"}}>
              <option value="">+ região</option>
              {Object.entries(byState).sort().map(([st,cs])=><optgroup key={st} label={st}>{cs.filter(c=>!pracaIds.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.cidade} - {c.estado}</option>)}</optgroup>)}
            </select>
          )}
        </div>
      </div>

      <div style={{fontSize:12,color:BZ.textMute,marginBottom:12}}>Quanto sua soja vale hoje em <b style={{color:BZ.brownDeep,fontWeight:600}}>{pLabel}</b></div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:14,marginBottom:22}}>
        <ScCard tag="Soja disponível" c={disp} ent="Entrega imediata" pag="Pag. 30 dias" accent={BZ.gold} sigs={dispSig}/>
        <ScCard tag="Soja futuro" c={fut} ent="Entrega Mar/27" pag="Pag. 30/04/27" accent={BZ.bronze} sigs={futSig}/>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:3,height:18,background:BZ.gold,borderRadius:2}}/>
          <span style={{fontSize:15,fontWeight:700,color:BZ.brownDeep}}>Análise de resultado</span>
          <span style={{color:BZ.textMute,fontSize:11}}>Receita bruta por cenário</span>
        </div>
        <div style={{display:"flex",gap:5,background:BZ.surfaceAlt,border:`1px solid ${BZ.border}`,borderRadius:8,padding:3}}>
          {[["disp","Disponível"],["fut","Futuro Mar/27"]].map(([k,l])=>(
            <div key={k} onClick={()=>setCenario(k)} style={{padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,background:cenario===k?BZ.goldSoft:"transparent",color:cenario===k?BZ.brown:BZ.textMute}}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:14,alignItems:"flex-end"}}>
        <div>
          <label style={{fontSize:9,color:BZ.textMute,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:3}}>Custo / hectare</label>
          <div style={inpStyle}><span style={{fontSize:12,color:BZ.textFaint}}>R$</span><input type="number" value={custo} onChange={e=>setCusto(e.target.value)} style={{...inpField,width:90}}/></div>
        </div>
        <div>
          <label style={{fontSize:9,color:BZ.textMute,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:3}}>Produtividade</label>
          <div style={inpStyle}><input type="number" value={prod} onChange={e=>setProd(e.target.value)} style={{...inpField,width:54}}/><span style={{fontSize:11,color:BZ.textFaint}}>sc/ha</span></div>
        </div>
        <div style={{background:BZ.surface,border:`1px solid ${BZ.border}`,borderRadius:10,padding:"9px 16px"}}>
          <div style={{fontSize:9,color:BZ.textFaint,textTransform:"uppercase",letterSpacing:"0.05em"}}>Preço justo {cenario==="disp"?"disponível":"futuro"} (R$ {fmt(pj)}/sc)</div>
          <div style={{fontSize:13,color:BZ.brownDeep,marginTop:3}}>Receita <b style={{fontWeight:600}}>R$ {fmtBR(recJusto)}/ha</b> · Resultado <b style={{fontWeight:600,color:resJusto>=0?"#2F6A45":"#8A3D31"}}>{resJusto>=0?"+":""}R$ {fmtBR(resJusto)}/ha</b></div>
        </div>
        <div style={{background:BZ.surface,border:`1px solid ${BZ.border}`,borderRadius:10,padding:"9px 16px"}}>
          <div style={{fontSize:9,color:BZ.textFaint,textTransform:"uppercase",letterSpacing:"0.05em"}}>Ponto de equilíbrio</div>
          <div style={{fontSize:18,fontWeight:700,color:BZ.brown,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>R$ {fmt(be)}<span style={{fontSize:11,fontWeight:400,color:BZ.textFaint}}>/sc</span></div>
        </div>
      </div>

      <div style={{display:"flex",gap:16,marginBottom:9,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:BZ.textMute}}><span style={{width:10,height:10,borderRadius:2,background:"#A9CBB0"}}/>Lucro bruto</span>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:BZ.textMute}}><span style={{width:10,height:10,borderRadius:2,background:"#E2B8AE"}}/>Prejuízo</span>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:BZ.textMute}}><span style={{width:10,height:10,borderRadius:2,border:`2px solid ${BZ.gold}`}}/>Você hoje</span>
        <span style={{fontSize:9,color:BZ.textFaint,marginLeft:"auto"}}>Receita bruta = produtividade × preço. Não inclui impostos nem frete.</span>
      </div>

      <div style={{overflowX:"auto",paddingBottom:4}}>
        <table style={{borderCollapse:"separate",borderSpacing:3,width:"100%",minWidth:860}}>
          <tbody>
            <tr>
              <th style={{textAlign:"left",fontSize:9,color:BZ.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600,padding:"4px 6px"}}>Prod./Preço</th>
              {RES_PRECOS.map(p=><th key={p} style={{fontSize:10,color:p===colSel?BZ.brown:BZ.textMute,fontWeight:600,padding:"4px 2px",fontFamily:"'JetBrains Mono',monospace"}}>R$ {p}</th>)}
            </tr>
            {RES_PRODS.map(pr=>(
              <tr key={pr}>
                <td style={{fontSize:10,color:pr===rowSel?BZ.brown:BZ.textMute,fontWeight:600,padding:"4px 6px",whiteSpace:"nowrap"}}>{pr} sc</td>
                {RES_PRECOS.map(pc=>{
                  const rec=pr*pc, res=rec-custoN, cc=bzCellColor(res), me=(pr===rowSel&&pc===colSel);
                  return <td key={pc} style={{background:cc.bg,borderRadius:6,padding:"6px 3px",textAlign:"center",boxShadow:me?`0 0 0 2px ${BZ.gold}`:"none"}}>
                    <div style={{fontSize:10.5,fontWeight:600,color:"#3A2E22",fontFamily:"'JetBrains Mono',monospace",lineHeight:1.25}}>{fmtBR(rec)}</div>
                    <div style={{fontSize:8.5,color:cc.fg,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.2}}>{res>=0?"+":""}{fmtBR(res)}</div>
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div onClick={()=>goTo("mercado")} style={{textAlign:"center",padding:"16px 10px 2px",cursor:"pointer",color:BZ.bronze,fontSize:12,fontWeight:500}}>
        Ver mercado (bolsa) — Chicago, B3, contratos →
      </div>
    </div>
  );
}

function MercadoPage({goTo, contractsDash}) {
  const sLead = contractsDash.sojaCbot[0];
  const mcLead = contractsDash.milhoCbot[0];
  const mbLead = contractsDash.milhoB3[0];
  const spots = [
    {label:"Soja 1º Venc.",value:sLead?fmt(sLead.lp):"—",unit:"c/bu",ch:sLead?(sLead.ch>=0?"+":"")+fmt(sLead.ch):"—",up:sLead?sLead.ch>=0:true,sub:sLead?sLead.sym:"—"},
    {label:"Milho CBOT 1º Venc.",value:mcLead?fmt(mcLead.lp):"—",unit:"c/bu",ch:mcLead?(mcLead.ch>=0?"+":"")+fmt(mcLead.ch):"—",up:mcLead?mcLead.ch>=0:true,sub:mcLead?mcLead.sym:"—"},
    {label:"Milho B3 1º Venc.",value:mbLead?fmt(mbLead.lp):"—",unit:"R$/sc",ch:mbLead?(mbLead.ch>=0?"+":"")+fmt(mbLead.ch):"—",up:mbLead?mbLead.ch>=0:true,sub:mbLead?mbLead.sym:"—"},
  ];
  const totalAtivos = contractsDash.sojaCbot.length + contractsDash.milhoCbot.length + contractsDash.milhoB3.length;
  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 28px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14,marginBottom:28}}>
        {spots.map((s,i)=>(
          <div key={i} style={{background:BZ.surface,border:`1px solid ${BZ.border}`,borderRadius:12,padding:"18px"}}>
            <div style={{color:BZ.textFaint,fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>{s.label}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:5}}>
              <span style={{fontSize:24,fontWeight:700,color:BZ.brownDeep,fontFamily:"'JetBrains Mono',monospace"}}>{s.value}</span>
              <span style={{color:BZ.textFaint,fontSize:11}}>{s.unit}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
              <span style={{color:s.up?BZ.up:BZ.down,fontSize:11,fontWeight:500}}>{s.up?"▲":"▼"} {s.ch}</span>
              <span style={{color:BZ.textFaint,fontSize:9}}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{width:3,height:18,background:BZ.gold,borderRadius:2}}/>
        <span style={{fontSize:15,fontWeight:700,color:BZ.brownDeep}}>Todos os contratos</span>
        <span style={{color:BZ.textMute,fontSize:11}}>{totalAtivos} ativos monitorados</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14,marginBottom:14}}>
        <DashSection title="Soja CBOT" sub="c/bu" color={BZ.gold} contracts={contractsDash.sojaCbot} defOpen/>
        <DashSection title="Milho CBOT" sub="c/bu" color={BZ.bronze} contracts={contractsDash.milhoCbot} defOpen/>
      </div>
      <div style={{marginBottom:28}}>
        <DashSection title="Milho B3" sub="R$/saca" color={BZ.brown} contracts={contractsDash.milhoB3} unit="R$/sc" defOpen/>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {[{label:"Preço Justo",color:BZ.gold,id:"preco-justo"},{label:"Paridade",color:BZ.bronze,id:"paridade"},{label:"Nova Oferta",color:BZ.brown,id:"ofertas"}].map(b=>(
          <div key={b.id} onClick={()=>goTo(b.id)} style={{
            background:BZ.goldSoft,border:`1px solid ${BZ.goldBorder}`,borderRadius:8,
            padding:"12px 24px",cursor:"pointer",color:b.color,fontSize:13,fontWeight:600,
            transition:"all 0.15s",
          }} onMouseEnter={e=>e.currentTarget.style.background=BZ.goldHover}
             onMouseLeave={e=>e.currentTarget.style.background=BZ.goldSoft}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PREÇO JUSTO PAGE
// ═══════════════════════════════════════════════════════════════

function PrecoJustoPage({PRACAS, COTACOES, BASIS_DATA, DEFAULT_BASIS}) {
  const [mercado,setMercado]=useState("Soja Exportação");
  const [pracaId,setPracaId]=useState(null);
  // Default to current month and next month for payment
  const now = new Date();
  const defMi = now.getMonth();
  const defYr = now.getFullYear();
  const defPagMi = (defMi + 1) % 12;
  const defPagYr = defMi === 11 ? defYr + 1 : defYr;
  const [entK,setEntK]=useState(`${defMi}-${defYr}`);
  const [pagK,setPagK]=useState(`${defPagMi}-${defPagYr}`);
  const [offer,setOffer]=useState(0);
  useEffect(()=>{try{const r=localStorage.getItem("bz_praca_ref"); if(r)setPracaId(parseInt(r));}catch(e){}},[]);
  useEffect(()=>{if(pracaId!=null){try{localStorage.setItem("bz_praca_ref",String(pracaId));}catch(e){}}},[pracaId]);

  const [eMi,eYr]=entK.split("-").map(Number);
  const [pMi,pYr]=pagK.split("-").map(Number);
  const isSoja=mercado==="Soja Exportação";
  const byState=useMemo(()=>{
    const g={};
    PRACAS.forEach(p=>{
      const bk=`${p.cidade}-${p.estado}-${mercado}`;
      if(BASIS_DATA[bk]){(g[p.estado]||=[]).push(p);}
    });
    return g;
  },[PRACAS,mercado,BASIS_DATA]);
  const availPracas=useMemo(()=>Object.values(byState).flat(),[byState]);
  const pracaOk=availPracas.some(p=>p.id===pracaId);
  const effPracaId=pracaOk?pracaId:(availPracas[0]?.id||pracaId);
  useEffect(()=>{if(!pracaOk&&availPracas.length>0)setPracaId(availPracas[0].id);},[pracaOk,availPracas]);
  const praca=PRACAS.find(p=>p.id===effPracaId);
  const pLabel=praca?`${praca.cidade} - ${praca.estado}`:"";
  const bKey=praca?`${praca.cidade}-${praca.estado}-${mercado}`:"";
  const bAll=BASIS_DATA[bKey]||DEFAULT_BASIS;
  const bM=bAll[eMi];
  const allK=Object.keys(COTACOES);
  const rawCS=isSoja?buildSoja(eMi,eYr):buildMilho(eMi,eYr);
  const csym=findClosest(rawCS,allK,COTACOES);
  const ccot=COTACOES[csym];
  const chi=ccot?ccot.lp:(isSoja?1165:490);
  const cCh=ccot?.ch||0; const cChp=ccot?.chp||0;
  const cShort=csym.replace("CBOT:","");
  const cCode=cShort.charAt(2);
  const cLabel=`${CODE_NAME[cCode]}/${cShort.slice(-4)}`;
  const cFB=csym!==rawCS;
  const rawDS=buildDol(pMi,pYr);
  const dsym=findClosest(rawDS,allK.filter(k=>k.includes("DOL")),COTACOES);
  const dcot=COTACOES[dsym];
  const dol=dcot?dcot.lp/1000:5.008;
  const dCh=dcot?dcot.ch/1000:0; const dChp=dcot?.chp||0;
  const dShort=dsym.replace("BMFBOVESPA:","");
  const dFB=dsym!==rawDS;
  const pMin=calc(chi,bM.basis_min,dol);
  const pJusto=calc(chi,bM.medio,dol);
  const pMax=calc(chi,bM.basis_max,dol);
  const pMinU=calcUSD(chi,bM.basis_min);
  const pJustoU=calcUSD(chi,bM.medio);
  const pMaxU=calcUSD(chi,bM.basis_max);

  // Seasonality: current month → 12 months forward
  const dolKeys=allK.filter(k=>k.includes("DOL"));
  const season=useMemo(()=>{
    const curM = new Date().getMonth();
    const curY = new Date().getFullYear();
    const ms=[];
    for(let n=0;n<13;n++){
      const mi=(curM+n)%12;
      const yr=curY+Math.floor((curM+n)/12);
      const b=bAll[mi];
      const rawC=isSoja?buildSoja(mi,yr):buildMilho(mi,yr);
      const cs=findClosest(rawC,allK,COTACOES); const cc=COTACOES[cs]; const ch=cc?cc.lp:null;
      const pmi=(mi+1)%12; const pyr=(mi===11)?yr+1:yr;
      const rawD=buildDol(pmi,pyr);
      const ds=findClosest(rawD,dolKeys,COTACOES); const dc=COTACOES[ds]; const md=dc?dc.lp/1000:null;
      const has=ch!==null&&md!==null;
      ms.push({label:`${MESES_SHORT[mi]}/${String(yr).slice(-2)}`,basis:b.medio,bMin:b.basis_min,bMax:b.basis_max,has,
        pMin:has?calc(ch,b.basis_min,md):null,pJusto:has?calc(ch,b.medio,md):null,pMax:has?calc(ch,b.basis_max,md):null,idx:n,
        chi:ch,dol:md,mi,yr});
    }
    return ms;
  },[bAll,isSoja,allK,dolKeys]);

  const sWD=season.filter(s=>s.has);
  const sAllP=sWD.flatMap(s=>[s.pMin,s.pMax]);
  const sMin=sAllP.length?Math.min(...sAllP):0;
  const sMax=sAllP.length?Math.max(...sAllP):1;

  const oR=pMax-pMin;
  const oP=oR>0?Math.max(0,Math.min(1,(offer-pMin)/oR)):0.5;
  let oC,oL;
  if(offer<pMin){oC="#B0503F";oL="Abaixo da região mínima — preço ruim";}
  else if(offer<pJusto){oC="#D5A246";oL="Entre Mínimo e Justo — abaixo do ideal";}
  else if(offer<pMax){oC="#4E7C5A";oL="Na região do Preço Justo — boa negociação";}
  else{oC="#4E7C5A";oL="Acima do Agressivo — oportunidade rara";}

  return (
    <div style={{maxWidth:1060,margin:"0 auto",padding:"20px 28px 48px"}}>
      {/* Seletores */}
      <div style={{background:"#FFFFFF",border:"1px solid #ECE7DD",borderRadius:10,padding:"16px 18px",marginBottom:16,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Sel label="Mercado" value={mercado} onChange={setMercado} w={170}>
          <option value="Soja Exportação">Soja Exportação</option>
          <option value="Milho Exportação">Milho Exportação</option>
          <option value="Milho Interno (B3)">Milho Interno (B3)</option>
        </Sel>
        <Sel label="Praça" value={effPracaId} onChange={v=>setPracaId(+v)} w={220} grow>
          {Object.entries(byState).sort().map(([st,cs])=><optgroup key={st} label={st}>{cs.map(c=><option key={c.id} value={c.id}>{c.cidade} - {c.estado}</option>)}</optgroup>)}
        </Sel>
        <Sel label="Mês de entrega" value={entK} onChange={setEntK} w={165}>
          {OPTS.map(o=><option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
        </Sel>
        <Sel label="Data de pagamento" value={pagK} onChange={setPagK} w={165}>
          {OPTS.map(o=><option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
        </Sel>
      </div>

      {/* Dados de mercado */}
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <MktCard label={`Chicago ${isSoja?"Soja":"Milho"} — ${cLabel}`} value={fmt(chi)} unit="c/bu" sym={cShort} ch={cCh} chp={cChp} color="#4E7C5A" fb={cFB}/>
        <MktCard label={`Dólar projetado — ${MESES[pMi]} ${pYr}`} value={`R$ ${fmt(dol,4)}`} sym={dShort} ch={dCh} chp={dChp} color="#B67A33" fb={dFB} fd={4}/>
        <div style={{background:"#FFFFFF",border:"1px solid #ECE7DD",borderRadius:10,padding:"14px 18px",minWidth:155}}>
          <div style={{color:"#8A7E6F",fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Basis histórico — {MESES[eMi]}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:3}}>
            <span style={{fontSize:22,fontWeight:700,color:"#D5A246",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(bM.medio,0)}</span>
            <span style={{color:"#A89C8A",fontSize:10}}>c/bu</span>
          </div>
          <div style={{color:"#C2B7A6",fontSize:9}}>Min {fmt(bM.basis_min,0)} | Max {fmt(bM.basis_max,0)}</div>
          <div style={{color:"#C2B7A6",fontSize:8,marginTop:3}}>Média 5 anos • {pLabel}</div>
        </div>
      </div>

      {/* 3 regiões */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <div style={{width:3,height:18,background:"#D5A246",borderRadius:2}}/>
        <span style={{fontSize:15,fontWeight:700}}>Regiões de preço</span>
        <span style={{color:"#A89C8A",fontSize:11}}>{pLabel} — {MESES[eMi]} {eYr}</span>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:20,alignItems:"stretch"}}>
        <RegCard label="Preço Mínimo" brl={pMin} usd={pMinU} basis={bM.basis_min} color="#D5A246" sub="Abaixo disso, preço está ruim"/>
        <RegCard label="Preço Justo" brl={pJusto} usd={pJustoU} basis={bM.medio} color="#4E7C5A" hl sub="Região ideal para negociar"/>
        <RegCard label="Preço Agressivo" brl={pMax} usd={pMaxU} basis={bM.basis_max} color="#4E7C5A" sub="Oportunidade excepcional, raro"/>
      </div>

      {/* Oferta */}
      <div style={{background:"#FFFFFF",border:"1px solid #ECE7DD",borderRadius:10,padding:"18px",marginBottom:20}}>
        <div style={{color:"#4A2C16",fontSize:13,fontWeight:600,marginBottom:3}}>Análise de oferta recebida</div>
        <div style={{color:"#8A7E6F",fontSize:10,marginBottom:14}}>Informe o preço que te ofereceram e veja onde se posiciona</div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end",marginBottom:16}}>
          <div>
            <label style={{fontSize:9,color:"#8A7E6F",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:3}}>Recebi oferta de</label>
            <div style={{display:"flex",alignItems:"center"}}>
              <span style={{background:"#EFE8DB",border:"1px solid #E4DECF",borderRight:"none",borderRadius:"7px 0 0 7px",padding:"9px 10px",color:"#8A7E6F",fontSize:12}}>R$</span>
              <input type="number" value={offer||""} onChange={e=>setOffer(parseFloat(e.target.value)||0)} placeholder="0,00" style={{background:"#F6F3ED",border:"1px solid #E4DECF",borderRadius:"0 7px 7px 0",color:"#4A2C16",padding:"9px 10px",fontSize:15,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,outline:"none",width:130}}/>
              <span style={{color:"#A89C8A",fontSize:11,marginLeft:6}}>/saca</span>
            </div>
          </div>
          {offer>0&&<div style={{background:`${oC}11`,border:`1px solid ${oC}33`,borderRadius:7,padding:"9px 14px",flex:1}}><div style={{color:oC,fontSize:12,fontWeight:600}}>{oL}</div></div>}
        </div>
        {offer>0&&<>
          <div style={{position:"relative",height:36,marginBottom:2}}>
            <div style={{display:"flex",height:10,borderRadius:5,overflow:"hidden",marginTop:13}}>
              <div style={{flex:1,background:"#D5A24633"}}/><div style={{flex:1,background:"#4E7C5A33"}}/><div style={{flex:1,background:"#4E7C5A33"}}/>
            </div>
            <div style={{position:"absolute",top:0,left:`${Math.max(2,Math.min(98,oP*100))}%`,transform:"translateX(-50%)",transition:"left 0.3s"}}>
              <div style={{width:2,height:34,background:"#4A2C16",borderRadius:1,margin:"0 auto"}}/>
              <div style={{background:"#4A2C16",color:"#F7F7F5",fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:3,marginTop:3,whiteSpace:"nowrap",fontFamily:"'JetBrains Mono',monospace",textAlign:"center"}}>R$ {fmt(offer)}</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#A89C8A",marginTop:22}}>
            <span>Mín: R$ {fmt(pMin)}</span><span>Justo: R$ {fmt(pJusto)}</span><span>Agr: R$ {fmt(pMax)}</span>
          </div>
        </>}
      </div>

      {/* Sazonalidade — curva de preço futuro */}
      <div style={{background:"#FFFFFF",border:"1px solid #ECE7DD",borderRadius:10,padding:"18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{color:"#4A2C16",fontSize:13,fontWeight:600}}>Curva de preço projetado — {isSoja?"Soja":"Milho"}</div>
            <div style={{color:"#8A7E6F",fontSize:10,marginTop:2}}>Preço justo R$/saca por mês de embarque • Chicago + basis × câmbio</div>
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <Legend color="#B67A3322" border="#B67A3344" text="Faixa min–max"/>
            <Legend color="#B67A33" text="Preço justo" dot/>
          </div>
        </div>

        {/* SVG Chart */}
        {sWD.length > 0 && (() => {
          const W = 760, H = 200, padL = 60, padR = 20, padT = 25, padB = 35;
          const chartW = W - padL - padR;
          const chartH = H - padT - padB;
          const margin = (sMax - sMin) * 0.1 || 10;
          const yMin = sMin - margin;
          const yMax = sMax + margin;
          const yRange = yMax - yMin || 1;

          const xStep = sWD.length > 1 ? chartW / (sWD.length - 1) : chartW;
          const toX = (i) => padL + i * xStep;
          const toY = (v) => padT + chartH - ((v - yMin) / yRange) * chartH;

          // Build paths
          const justoPts = sWD.map((s, i) => `${toX(i)},${toY(s.pJusto)}`);
          const minPts = sWD.map((s, i) => `${toX(i)},${toY(s.pMin)}`);
          const maxPts = sWD.map((s, i) => `${toX(i)},${toY(s.pMax)}`);
          const bandPath = `M${maxPts.join(" L")} L${[...minPts].reverse().join(" L")} Z`;

          // Y axis labels (5 ticks)
          const yTicks = [];
          for (let i = 0; i <= 4; i++) {
            const v = yMin + (yRange * i) / 4;
            yTicks.push({ v, y: toY(v) });
          }

          return (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginBottom: 10 }}>
              {/* Grid lines */}
              {yTicks.map((t, i) => (
                <g key={i}>
                  <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#F2EEE6" strokeWidth="1" />
                  <text x={padL - 8} y={t.y + 3} fill="#A89C8A" fontSize="8" textAnchor="end" fontFamily="'JetBrains Mono',monospace">{fmt(t.v, 0)}</text>
                </g>
              ))}

              {/* Band (min-max area) */}
              <path d={bandPath} fill="rgba(69,123,157,0.12)" stroke="none" />

              {/* Max line */}
              <polyline points={maxPts.join(" ")} fill="none" stroke="rgba(69,123,157,0.25)" strokeWidth="1" strokeDasharray="4,3" />

              {/* Min line */}
              <polyline points={minPts.join(" ")} fill="none" stroke="rgba(69,123,157,0.25)" strokeWidth="1" strokeDasharray="4,3" />

              {/* Justo line */}
              <polyline points={justoPts.join(" ")} fill="none" stroke="#B67A33" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

              {/* Dots + labels */}
              {sWD.map((s, i) => (
                <g key={i}>
                  <circle cx={toX(i)} cy={toY(s.pJusto)} r="4" fill="#B67A33" stroke="#FFFFFF" strokeWidth="2" />
                  <text x={toX(i)} y={toY(s.pJusto) - 10} fill="#6B6052" fontSize="7.5" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontWeight="600">{fmt(s.pJusto, 0)}</text>
                  <text x={toX(i)} y={H - 8} fill="#6B6052" fontSize="7.5" textAnchor="middle" fontWeight="500">{s.label}</text>
                </g>
              ))}
            </svg>
          );
        })()}

        {/* Tabela detalhada */}
        <div style={{borderTop:"1px solid #ECE7DD",paddingTop:12,marginTop:4}}>
          <div style={{display:"grid",gridTemplateColumns:"90px repeat(4,1fr)",gap:0,fontSize:9,color:"#A89C8A",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6,paddingLeft:4}}>
            <div>Embarque</div><div style={{textAlign:"right"}}>Chicago</div><div style={{textAlign:"right"}}>Câmbio</div><div style={{textAlign:"right"}}>R$/sc Min</div><div style={{textAlign:"right",color:"#B67A33"}}>R$/sc Justo</div>
          </div>
          {season.filter(s=>s.has).map(s=>(
            <div key={s.idx} style={{display:"grid",gridTemplateColumns:"90px repeat(4,1fr)",gap:0,fontSize:11,padding:"5px 4px",borderBottom:"1px solid #F5F1EA"}}>
              <div style={{color:"#6B6052",fontWeight:500}}>{s.label}</div>
              <div style={{textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"#8A7E6F"}}>{s.chi?fmt(s.chi,1):"-"}</div>
              <div style={{textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"#8A7E6F"}}>{s.dol?fmt(s.dol,4):"-"}</div>
              <div style={{textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"#D5A246"}}>{s.pMin?fmt(s.pMin,0):"-"}</div>
              <div style={{textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"#B67A33",fontWeight:600}}>{s.pJusto?fmt(s.pJusto,0):"-"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MktCard({label,value,unit,sym,ch,chp,color,fb,fd=2}) {
  return <div style={{background:"#FFFFFF",border:"1px solid #ECE7DD",borderRadius:10,padding:"14px 18px",flex:1,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:0.5}}/>
    <div style={{color:"#8A7E6F",fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{label}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:5,marginBottom:3}}>
      <span style={{fontSize:22,fontWeight:700,color:"#4A2C16",fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
      {unit&&<span style={{color:"#A89C8A",fontSize:10}}>{unit}</span>}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{color:ch>=0?"#4E7C5A":"#B0503F",fontSize:10,fontWeight:500}}>{ch>=0?"▲":"▼"} {ch>=0?"+":""}{fmt(ch,fd)} ({chp>=0?"+":""}{fmt(chp)}%)</span>
      <span style={{color:"#C2B7A6",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{sym}</span>
    </div>
    {fb&&<div style={{color:"#D5A246",fontSize:8,marginTop:4,fontStyle:"italic"}}>Usando contrato mais próximo</div>}
  </div>;
}

function RegCard({label,brl,usd,basis,color,hl,sub}) {
  return <div style={{background:hl?`${color}0D`:"#FFFFFF",border:`1px solid ${hl?`${color}33`:"#ECE7DD"}`,borderRadius:10,padding:hl?"22px 18px":"18px",flex:1,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}}/>
    {hl&&<div style={{position:"absolute",top:10,right:10,background:`${color}22`,color,fontSize:8,fontWeight:700,padding:"2px 7px",borderRadius:3,textTransform:"uppercase",letterSpacing:"0.1em"}}>Região ideal</div>}
    <div style={{color:"#6B6052",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>{label}</div>
    <div style={{fontSize:hl?28:22,fontWeight:800,color:"#4A2C16",fontFamily:"'JetBrains Mono',monospace",lineHeight:1,marginBottom:5}}>R$ {fmt(brl)}</div>
    <div style={{fontSize:12,color:"#6B6052",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>US$ {fmt(usd)}/sc</div>
    <div style={{fontSize:10,color:"#A89C8A"}}>Basis: {fmt(basis,0)} c/bu</div>
    {sub&&<div style={{fontSize:9,color,marginTop:7,fontWeight:500}}>{sub}</div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// PRÊMIOS PORTO PAGE
// ═══════════════════════════════════════════════════════════════

// Historical premiums from Supabase premios_porto (168 records)
// Key: month index → average historical premium for that shipment month
const PREMIOS_HIST = {
  0: 15, 1: 18, 2: 22, 3: 28, 4: 35, 5: 40,
  6: 50, 7: 65, 8: 85, 9: 60, 10: 45, 11: 25,
};

// Current premiums — in production: from Supabase (admin inserts)
// Each entry: shipment month, year, contract ref, venda price, daily change
const PREMIOS_ATUAIS_INIT = [
  { id: 1, mesIdx: 4, yr: 2026, contrato: "SK6", venda: 32.7, varDia: 5.3 },
  { id: 2, mesIdx: 5, yr: 2026, contrato: "SN6", venda: 30.0, varDia: 2.0 },
  { id: 3, mesIdx: 6, yr: 2026, contrato: "SN6", venda: 50.7, varDia: 2.7 },
  { id: 4, mesIdx: 7, yr: 2026, contrato: "SQ6", venda: 75.0, varDia: 0.0 },
  { id: 5, mesIdx: 8, yr: 2026, contrato: "SU6", venda: 100.0, varDia: 0.0 },
  { id: 6, mesIdx: 1, yr: 2027, contrato: "SH7", venda: 22.0, varDia: 3.0 },
  { id: 7, mesIdx: 2, yr: 2027, contrato: "SH7", venda: -7.3, varDia: 1.7 },
  { id: 8, mesIdx: 3, yr: 2027, contrato: "SK7", venda: -6.0, varDia: -1.0 },
  { id: 9, mesIdx: 4, yr: 2027, contrato: "SK7", venda: 10.0, varDia: 0.0 },
];

function PremiosPortoPage({premiosData}) {
  // Use Supabase data if available, otherwise fallback
  const hasLive = premiosData && premiosData.atual && premiosData.atual.length > 0;
  const premios = hasLive
    ? premiosData.atual.map((p, i) => ({ id: i + 1, mesIdx: p.mes_idx, yr: p.ano, contrato: p.contrato, venda: p.venda, varDia: p.var_dia || 0 }))
    : PREMIOS_ATUAIS_INIT;

  // Build historico stats per month (min, max, avg from premios_historico)
  const histStats = useMemo(() => {
    if (!premiosData?.historico?.length) return {};
    const byMes = {};
    for (const h of premiosData.historico) {
      const key = `${h.mes_idx}-${h.ano}`;
      if (!byMes[key]) byMes[key] = [];
      byMes[key].push(h.premio);
    }
    const stats = {};
    for (const [key, vals] of Object.entries(byMes)) {
      const arr = vals;
      stats[key] = {
        min: Math.min(...arr),
        max: Math.max(...arr),
        avg: arr.reduce((a, b) => a + b, 0) / arr.length,
        count: arr.length,
      };
    }
    return stats;
  }, [premiosData]);

  // Sort by date and filter out past months
  const now = new Date();
  const curMonth = now.getMonth(); // 0-11
  const curYear = now.getFullYear();
  const sorted = [...premios]
    .filter(p => (p.yr > curYear) || (p.yr === curYear && p.mesIdx >= curMonth))
    .sort((a, b) => (a.yr * 12 + a.mesIdx) - (b.yr * 12 + b.mesIdx));

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Prêmios de Soja — Paranaguá</span>
          <span style={{ color: "#A89C8A", fontSize: 11 }}>Compra • cents/bushel</span>
        </div>
        <div style={{ color: "#C2B7A6", fontSize: 10 }}>{hasLive ? "✓ Dados ao vivo" : "Dados de exemplo"}</div>
      </div>

      {/* ─── PRODUTOR VIEW — TABLE ─── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 80px 100px 100px 1fr 100px", padding: "10px 16px", borderBottom: "1px solid #ECE7DD" }}>
          {["Embarque", "Contrato", "Prêmio atual", "Média hist.", "Termômetro", "Var. dia"].map(h => (
            <div key={h} style={{ color: "#A89C8A", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
          ))}
        </div>
        {sorted.map(p => {
          const hKey = `${p.mesIdx}-${p.yr}`;
          const hs = histStats[hKey];
          const hist = hs ? hs.avg : p.venda;
          const diff = p.venda - hist;
          const isAbove = diff >= 0;
          const color = isAbove ? "#4E7C5A" : "#B0503F";
          const barMax = 60;
          const absDiff = Math.abs(diff);
          const barW = Math.min(absDiff / Math.max(Math.abs(hist), 1) * barMax, barMax);

          return (
            <div key={p.id} style={{
              display: "grid", gridTemplateColumns: "140px 80px 100px 100px 1fr 100px",
              padding: "12px 16px", borderBottom: "1px solid #F2EEE6",
              alignItems: "center",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#FAF7F1"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

              {/* Embarque */}
              <div>
                <span style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>{MESES[p.mesIdx]} {p.yr}</span>
              </div>

              {/* Contrato */}
              <span style={{ color: "#8A7E6F", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{p.contrato}</span>

              {/* Prêmio atual */}
              <span style={{ color: "#4A2C16", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                {p.venda >= 0 ? "+" : ""}{fmt(p.venda, 1)}
              </span>

              {/* Histórico */}
              <span style={{ color: "#8A7E6F", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                +{fmt(hist, 1)}
              </span>

              {/* Termômetro */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", width: barMax * 2 + 2, height: 14, display: "flex", alignItems: "center" }}>
                  {/* Center line */}
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#DED8CC" }} />
                  {/* Background */}
                  <div style={{ position: "absolute", left: 0, right: 0, top: 3, bottom: 3, background: "#F5F1EA", borderRadius: 3 }} />
                  {/* Bar */}
                  {isAbove ? (
                    <div style={{ position: "absolute", left: "50%", top: 2, bottom: 2, width: barW, background: `${color}33`, borderRadius: "0 3px 3px 0", borderRight: `2px solid ${color}` }} />
                  ) : (
                    <div style={{ position: "absolute", right: "50%", top: 2, bottom: 2, width: barW, background: `${color}33`, borderRadius: "3px 0 0 3px", borderLeft: `2px solid ${color}` }} />
                  )}
                </div>
                <span style={{ color, fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", minWidth: 55 }}>
                  {isAbove ? "+" : ""}{fmt(diff, 1)} c/bu
                </span>
              </div>

              {/* Var dia */}
              <span style={{ color: p.varDia >= 0 ? "#4E7C5A" : "#B0503F", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                {p.varDia >= 0 ? "+" : ""}{fmt(p.varDia, 1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ─── RESUMO VISUAL ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {(() => {
          const above = sorted.filter(p => { const hs = histStats[`${p.mesIdx}-${p.yr}`]; return p.venda >= (hs ? hs.avg : p.venda); });
          const below = sorted.filter(p => { const hs = histStats[`${p.mesIdx}-${p.yr}`]; return hs && p.venda < hs.avg; });
          const avgDiff = sorted.length ? sorted.reduce((s, p) => { const hs = histStats[`${p.mesIdx}-${p.yr}`]; return s + (hs ? p.venda - hs.avg : 0); }, 0) / sorted.length : 0;
          return [
            { label: "Acima do histórico", value: above.length, total: sorted.length, color: "#4E7C5A" },
            { label: "Abaixo do histórico", value: below.length, total: sorted.length, color: "#B0503F" },
            { label: "Diferença média", value: `${avgDiff >= 0 ? "+" : ""}${fmt(avgDiff, 1)} c/bu`, color: avgDiff >= 0 ? "#4E7C5A" : "#B0503F" },
          ].map((c, i) => (
            <div key={i} style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontFamily: "'JetBrains Mono',monospace" }}>
                {typeof c.value === "number" ? `${c.value}/${c.total}` : c.value}
              </div>
              {typeof c.value === "number" && (
                <div style={{ marginTop: 6, height: 4, background: "#F2EEE6", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(c.value / c.total) * 100}%`, background: c.color, borderRadius: 2 }} />
                </div>
              )}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISE TÉCNICA PAGE
// ═══════════════════════════════════════════════════════════════

const ANALISE_CONTRATOS = [
  { sym: "CBOT:ZSK2026", label: "Soja Mai/26 (ZSK2026)", produto: "Soja" },
  { sym: "CBOT:ZSN2026", label: "Soja Jul/26 (ZSN2026)", produto: "Soja" },
  { sym: "CBOT:ZSX2026", label: "Soja Nov/26 (ZSX2026)", produto: "Soja" },
  { sym: "CBOT:ZSF2027", label: "Soja Jan/27 (ZSF2027)", produto: "Soja" },
  { sym: "CBOT:ZSH2027", label: "Soja Mar/27 (ZSH2027)", produto: "Soja" },
  { sym: "CBOT:ZSK2027", label: "Soja Mai/27 (ZSK2027)", produto: "Soja" },
  { sym: "CBOT:ZCK2026", label: "Milho Mai/26 (ZCK2026)", produto: "Milho" },
  { sym: "CBOT:ZCN2026", label: "Milho Jul/26 (ZCN2026)", produto: "Milho" },
  { sym: "CBOT:ZCU2026", label: "Milho Set/26 (ZCU2026)", produto: "Milho" },
  { sym: "CBOT:ZCZ2026", label: "Milho Dez/26 (ZCZ2026)", produto: "Milho" },
  { sym: "CBOT:ZCH2027", label: "Milho Mar/27 (ZCH2027)", produto: "Milho" },
  { sym: "CBOT:ZCK2027", label: "Milho Mai/27 (ZCK2027)", produto: "Milho" },
  { sym: "CBOT:ZCN2027", label: "Milho Jul/27 (ZCN2027)", produto: "Milho" },
];

// Sample data — in production: from Supabase table analise_tecnica
const ANALISE_DATA = {
  "CBOT:ZSK2026": {
    updatedAt: "11/04/2026",
    leitura: "Mercado testou resistência em 1176 e recuou. Seguimos em tendência de alta dentro do canal ascendente. Suporte imediato em 1146. Se romper 1207 com volume, abre caminho para testar 1239. RSI em 43 — espaço para subir antes de sobrecompra.",
    faixas: [
      { valor: 1239, tipo: "intensificar", label: "Intensificar negócios", color: "#2F6A45", desc: "Topo do canal — oportunidade rara" },
      { valor: 1207, tipo: "forte", label: "Zona forte", color: "#4E7C5A", desc: "Resistência importante — bom momento para negociar" },
      { valor: 1176, tipo: "buscar", label: "Buscar negócios", color: "#CFE3D2", desc: "Início da região de interesse — começar a olhar" },
      { valor: 1146, tipo: "segurar", label: "Segurar", color: "#D5A246", desc: "Suporte — abaixo disso, preço está ruim" },
    ],
    imageUrl: null, // fundador faz upload via admin
  },
  "CBOT:ZSN2026": {
    updatedAt: "11/04/2026",
    leitura: "Contrato de julho segue correlacionado ao K. Spread K/N estável. Mesmas referências de canal se aplicam com ajuste de +16 c/bu em média.",
    faixas: [
      { valor: 1255, tipo: "intensificar", label: "Intensificar negócios", color: "#2F6A45", desc: "Topo do canal" },
      { valor: 1223, tipo: "forte", label: "Zona forte", color: "#4E7C5A", desc: "Resistência forte" },
      { valor: 1192, tipo: "buscar", label: "Buscar negócios", color: "#CFE3D2", desc: "Início região de interesse" },
      { valor: 1162, tipo: "segurar", label: "Segurar", color: "#D5A246", desc: "Suporte principal" },
    ],
    imageUrl: null,
  },
};

function AnaliseTecnicaPage({COTACOES, analiseData}) {
  // Use Supabase data if available, otherwise fallback to hardcoded
  const hasLive = analiseData && analiseData.length > 0;
  const contratos = hasLive
    ? analiseData.map(a => ({ sym: a.sym, label: a.label, produto: a.produto }))
    : ANALISE_CONTRATOS;

  const [selSym, setSelSym] = useState(contratos[0]?.sym || "CBOT:ZSK2026");

  // Auto-select first available contract when data changes
  useEffect(() => {
    if (hasLive && !analiseData.find(a => a.sym === selSym)) {
      setSelSym(analiseData[0].sym);
    }
  }, [analiseData, hasLive]);

  const contrato = contratos.find(c => c.sym === selSym);
  const cotacao = COTACOES[selSym];
  const preco = cotacao ? cotacao.lp : 0;
  const ch = cotacao?.ch || 0;
  const chp = cotacao?.chp || 0;

  // Build analise from Supabase row or fallback
  const liveRow = hasLive ? analiseData.find(a => a.sym === selSym) : null;
  const analise = liveRow ? {
    updatedAt: new Date(liveRow.updated_at).toLocaleDateString("pt-BR"),
    leitura: liveRow.leitura || "",
    faixas: [
      { valor: liveRow.zona1_valor, tipo: "intensificar", label: liveRow.zona1_label, color: "#2F6A45", desc: "Topo do canal" },
      { valor: liveRow.zona2_valor, tipo: "buscar", label: liveRow.zona2_label, color: "#4E7C5A", desc: "Início região de interesse" },
      { valor: liveRow.zona3_valor, tipo: "segurar", label: liveRow.zona3_label, color: "#D5A246", desc: "Suporte principal" },
    ],
  } : ANALISE_DATA[selSym];

  // Determine which zone the current price is in
  let zonaAtual = null;
  let zonaColor = "#8A7E6F";
  let zonaLabel = "Fora das regiões mapeadas";
  if (analise) {
    const sorted = [...analise.faixas].sort((a, b) => a.valor - b.valor);
    if (preco < sorted[0].valor) {
      zonaAtual = "abaixo";
      zonaColor = "#B0503F";
      zonaLabel = "Abaixo do suporte — preço desfavorável";
    } else {
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (preco >= sorted[i].valor) {
          zonaAtual = sorted[i].tipo;
          zonaColor = sorted[i].color;
          zonaLabel = sorted[i].label;
          break;
        }
      }
    }
  }

  // Visual gauge: position of current price relative to faixas
  const faixaMin = analise ? Math.min(...analise.faixas.map(f => f.valor)) - 50 : 1000;
  const faixaMax = analise ? Math.max(...analise.faixas.map(f => f.valor)) + 50 : 1300;
  const faixaRange = faixaMax - faixaMin || 1;
  const precoPct = Math.max(0, Math.min(100, ((preco - faixaMin) / faixaRange) * 100));

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Seletor de contrato */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20 }}>
        <Sel label="Contrato" value={selSym} onChange={setSelSym} w={280}>
          <optgroup label="Soja CBOT">
            {contratos.filter(c => c.produto === "Soja").map(c => <option key={c.sym} value={c.sym}>{c.label}</option>)}
          </optgroup>
          <optgroup label="Milho CBOT">
            {contratos.filter(c => c.produto === "Milho").map(c => <option key={c.sym} value={c.sym}>{c.label}</option>)}
          </optgroup>
        </Sel>
        {analise && <span style={{ color: "#C2B7A6", fontSize: 10, paddingBottom: 10 }}>Atualizado em {analise.updatedAt}</span>}
      </div>

      {!analise ? (
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "40px", textAlign: "center" }}>
          <div style={{ color: "#A89C8A", fontSize: 14 }}>Análise técnica ainda não publicada para este contrato</div>
          <div style={{ color: "#C2B7A6", fontSize: 11, marginTop: 4 }}>O fundador publica semanalmente via painel admin</div>
        </div>
      ) : (
        <>
          {/* Cotação atual + zona */}
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            {/* Preço atual */}
            <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", flex: 1, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: zonaColor }} />
              <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                {contrato?.label}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(preco, 2)}</span>
                <span style={{ color: "#A89C8A", fontSize: 12 }}>c/bu</span>
              </div>
              <Chg ch={ch} chp={chp} />
            </div>

            {/* Zona atual */}
            <div style={{ background: `${zonaColor}0D`, border: `1px solid ${zonaColor}33`, borderRadius: 10, padding: "18px 22px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Zona atual do preço</div>
              <div style={{ color: zonaColor, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{zonaLabel}</div>
              <div style={{ color: "#8A7E6F", fontSize: 11 }}>
                {zonaAtual === "segurar" && "Não é momento — aguardar melhora"}
                {zonaAtual === "buscar" && "Começar a olhar oportunidades"}
                {zonaAtual === "forte" && "Bom momento para negociar"}
                {zonaAtual === "intensificar" && "Oportunidade rara — agir com urgência"}
                {zonaAtual === "abaixo" && "Preço abaixo do suporte — segurar posição"}
              </div>
            </div>
          </div>

          {/* Gauge visual — preço na régua das faixas */}
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
            <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Mapa de regiões de preço</div>

            <div style={{ position: "relative", height: 60, marginBottom: 8 }}>
              {/* Background bar */}
              <div style={{ position: "absolute", left: 0, right: 0, top: 24, height: 12, background: "#F5F1EA", borderRadius: 6 }} />

              {/* Zone segments */}
              {(() => {
                const sorted = [...analise.faixas].sort((a, b) => a.valor - b.valor);
                const segments = [];
                // Below first faixa
                const firstPct = ((sorted[0].valor - faixaMin) / faixaRange) * 100;
                segments.push(<div key="below" style={{ position: "absolute", left: 0, top: 24, height: 12, width: `${firstPct}%`, background: "#B0503F22", borderRadius: "6px 0 0 6px" }} />);
                // Between faixas
                for (let i = 0; i < sorted.length; i++) {
                  const left = ((sorted[i].valor - faixaMin) / faixaRange) * 100;
                  const right = i < sorted.length - 1 ? ((sorted[i + 1].valor - faixaMin) / faixaRange) * 100 : 100;
                  segments.push(<div key={i} style={{ position: "absolute", left: `${left}%`, top: 24, height: 12, width: `${right - left}%`, background: `${sorted[i].color}22` }} />);
                }
                return segments;
              })()}

              {/* Faixa markers */}
              {analise.faixas.map((f, i) => {
                const pct = ((f.valor - faixaMin) / faixaRange) * 100;
                return (
                  <div key={i} style={{ position: "absolute", left: `${pct}%`, top: 18, transform: "translateX(-50%)" }}>
                    <div style={{ width: 2, height: 24, background: f.color, borderRadius: 1, margin: "0 auto" }} />
                    <div style={{ fontSize: 8, color: f.color, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", textAlign: "center" }}>
                      {fmt(f.valor, 0)}
                    </div>
                  </div>
                );
              })}

              {/* Current price marker */}
              <div style={{ position: "absolute", left: `${precoPct}%`, top: 4, transform: "translateX(-50%)", zIndex: 2 }}>
                <div style={{ background: "#4A2C16", color: "#F7F7F5", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace", textAlign: "center" }}>
                  {fmt(preco, 0)}
                </div>
                <div style={{ width: 2, height: 16, background: "#4A2C16", margin: "2px auto 0", borderRadius: 1 }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4A2C16", margin: "-1px auto 0", boxShadow: "0 0 8px #A89C8A" }} />
              </div>
            </div>

            {/* Faixas legend */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
              {[...analise.faixas].sort((a, b) => b.valor - a.valor).map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: `${f.color}0D`, border: `1px solid ${f.color}22`, borderRadius: 6, padding: "6px 12px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: f.color }} />
                  <span style={{ color: f.color, fontSize: 10, fontWeight: 600 }}>{fmt(f.valor, 0)}</span>
                  <span style={{ color: "#6B6052", fontSize: 10 }}>{f.label}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 6, padding: "6px 12px" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#B0503F" }} />
                <span style={{ color: "#B0503F", fontSize: 10, fontWeight: 600 }}>{"<"}{fmt(analise.faixas.find(f => f.tipo === "segurar")?.valor || 0, 0)}</span>
                <span style={{ color: "#6B6052", fontSize: 10 }}>Preço desfavorável</span>
              </div>
            </div>
          </div>

          {/* Leitura do fundador */}
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>Leitura do mercado</div>
              <span style={{ color: "#C2B7A6", fontSize: 9 }}>Atualizado {analise.updatedAt}</span>
            </div>
            <div style={{ color: "#6B6052", fontSize: 12, lineHeight: 1.7 }}>{analise.leitura}</div>
          </div>

          {/* Tabela de pontos */}
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, overflow: "hidden", marginTop: 20 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #ECE7DD" }}>
              <span style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>Pontos de referência — {contrato?.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 160px 80px", padding: "8px 18px", borderBottom: "1px solid #ECE7DD" }}>
              {["Preço (c/bu)", "Região", "Ação", "Distância"].map(h => (
                <span key={h} style={{ color: "#A89C8A", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>
            {[...analise.faixas].sort((a, b) => b.valor - a.valor).map((f, i) => {
              const dist = preco - f.valor;
              const isAtOrAbove = preco >= f.valor;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 160px 80px", padding: "12px 18px", borderBottom: "1px solid #F2EEE6", alignItems: "center" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: f.color }}>{fmt(f.valor, 0)}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: f.color }} />
                      <span style={{ color: "#4A2C16", fontSize: 12, fontWeight: 500 }}>{f.label}</span>
                    </div>
                    <span style={{ color: "#A89C8A", fontSize: 10, marginLeft: 14 }}>{f.desc}</span>
                  </div>
                  <span style={{ color: "#8A7E6F", fontSize: 11 }}>
                    {f.tipo === "segurar" && "Segurar posição"}
                    {f.tipo === "buscar" && "Começar a buscar"}
                    {f.tipo === "forte" && "Negociar ativamente"}
                    {f.tipo === "intensificar" && "Intensificar — raro"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: isAtOrAbove ? "#4E7C5A" : "#B0503F" }}>
                    {dist >= 0 ? "+" : ""}{fmt(dist, 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FUNDAMENTOS (USDA) PAGE
// ═══════════════════════════════════════════════════════════════

// Data from USDA PSD API — updated monthly after WASDE
// In production: cron job fetches from apps.fas.usda.gov/OpenData/api/psd/
// Commodity codes: Soybean=2222000, Corn=0440000
const USDA_DATA = {
  soja: {
    safraAtual: "2025/26",
    safraAnterior: "2024/25",
    mundo: {
      producao: { atual: 420.8, anterior: 395.3 },
      consumo: { atual: 405.2, anterior: 387.1 },
      exportacao: { atual: 182.5, anterior: 175.8 },
      estoqueFinal: { atual: 128.4, anterior: 112.3 },
    },
    paises: [
      { nome: "Brasil", prod: 169.0, prodAnt: 153.0, exp: 105.5, expAnt: 97.0 },
      { nome: "EUA", prod: 118.8, prodAnt: 113.3, exp: 49.7, expAnt: 50.4 },
      { nome: "Argentina", prod: 52.0, prodAnt: 49.5, exp: 5.2, expAnt: 4.8 },
      { nome: "China", prod: 20.7, prodAnt: 20.8, exp: 0.1, expAnt: 0.1, consumo: 126.0, consumoAnt: 121.5, importacao: 109.0, impAnt: 105.0 },
    ],
    relEstoqueUso: 31.7,
    relEstoqueUsoAnt: 29.0,
  },
  milho: {
    safraAtual: "2025/26",
    safraAnterior: "2024/25",
    mundo: {
      producao: { atual: 1230.5, anterior: 1217.8 },
      consumo: { atual: 1215.0, anterior: 1198.3 },
      exportacao: { atual: 195.2, anterior: 192.7 },
      estoqueFinal: { atual: 312.8, anterior: 297.5 },
    },
    paises: [
      { nome: "EUA", prod: 389.7, prodAnt: 377.6, exp: 62.2, expAnt: 58.0 },
      { nome: "Brasil", prod: 127.0, prodAnt: 122.0, exp: 50.0, expAnt: 46.5 },
      { nome: "Argentina", prod: 51.0, prodAnt: 50.0, exp: 36.0, expAnt: 33.0 },
      { nome: "China", prod: 292.0, prodAnt: 288.8, exp: 0.1, expAnt: 0.1, consumo: 315.0, consumoAnt: 308.0, importacao: 23.0, impAnt: 21.0 },
    ],
    relEstoqueUso: 25.7,
    relEstoqueUsoAnt: 24.8,
  },
  // Founder analysis — from Supabase (admin writes)
  leitura: "Relatório WASDE de abril trouxe aumento nos estoques mundiais de soja, reflexo da safra recorde brasileira. Mercado absorveu bem, mas estoques pressionam. Milho segue equilibrado — produção cresce mas consumo acompanha. China mantém ritmo forte de importação de soja, fator de sustentação. Relação estoque/uso da soja subiu para 31,7% — nível confortável, pressiona Chicago para baixo. Milho em 25,7% — neutro.",
  leituraDate: "12/04/2026",
};

function FundamentosPage({fundamentosData}) {
  const [produto, setProduto] = useState("soja");

  // Use Supabase data if available
  const liveRow = fundamentosData?.find(r => r.produto === produto);
  const hasLive = !!liveRow;

  const d = hasLive ? {
    safraAtual: liveRow.safra_atual,
    safraAnterior: liveRow.safra_anterior,
    mundo: {
      producao: { atual: liveRow.prod_mundo, anterior: liveRow.prod_mundo_ant },
      consumo: { atual: liveRow.consumo_mundo, anterior: liveRow.consumo_mundo_ant },
      exportacao: { atual: liveRow.export_mundo, anterior: liveRow.export_mundo_ant },
      estoqueFinal: { atual: liveRow.estoque_mundo, anterior: liveRow.estoque_mundo_ant },
    },
    paises: [
      { nome: "Brasil", prod: liveRow.brasil_prod, prodAnt: liveRow.brasil_prod_ant, exp: liveRow.brasil_exp, expAnt: liveRow.brasil_exp_ant },
      { nome: "EUA", prod: liveRow.eua_prod, prodAnt: liveRow.eua_prod_ant, exp: liveRow.eua_exp, expAnt: liveRow.eua_exp_ant },
      { nome: "Argentina", prod: liveRow.argentina_prod, prodAnt: liveRow.argentina_prod_ant, exp: liveRow.argentina_exp, expAnt: liveRow.argentina_exp_ant },
      { nome: "China", prod: 0, prodAnt: 0, exp: 0, expAnt: 0, consumo: liveRow.china_consumo, consumoAnt: liveRow.china_consumo_ant, importacao: liveRow.china_import, impAnt: liveRow.china_import_ant },
    ],
    relEstoqueUso: liveRow.rel_estoque_uso,
    relEstoqueUsoAnt: liveRow.rel_estoque_uso_ant,
  } : USDA_DATA[produto];

  const estoqueNivel = d.relEstoqueUso < 20 ? "apertado" : d.relEstoqueUso < 30 ? "equilibrado" : "folgado";
  const estoqueColor = estoqueNivel === "apertado" ? "#B0503F" : estoqueNivel === "equilibrado" ? "#D5A246" : "#4E7C5A";
  const estoqueIcon = estoqueNivel === "apertado" ? "▲ Altista" : estoqueNivel === "equilibrado" ? "◉ Neutro" : "▼ Baixista";

  const varPct = (at, ant) => ant ? (((at - ant) / ant) * 100) : 0;
  const varArrow = (at, ant) => at >= ant ? "▲" : "▼";
  const varColor = (at, ant, invert) => {
    const up = at >= ant;
    if (invert) return up ? "#B0503F" : "#4E7C5A"; // more stock = bearish for price
    return up ? "#4E7C5A" : "#B0503F";
  };

  function StatCard({ label, valor, anterior, unit, invert }) {
    const v = varPct(valor, anterior);
    const c = varColor(valor, anterior, invert);
    return (
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(valor, 1)}</span>
          <span style={{ color: "#A89C8A", fontSize: 9 }}>{unit}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: c, fontSize: 10, fontWeight: 500 }}>
            {varArrow(valor, anterior)} {v >= 0 ? "+" : ""}{fmt(v, 1)}%
          </span>
          <span style={{ color: "#C2B7A6", fontSize: 9 }}>ant: {fmt(anterior, 1)}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Seletor + título */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Fundamentos — USDA/WASDE</span>
          <span style={{ color: "#A89C8A", fontSize: 11 }}>Safra {d.safraAtual}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["soja", "milho"].map(p => (
            <div key={p} onClick={() => setProduto(p)} style={{
              padding: "7px 18px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: produto === p ? "rgba(230,57,70,0.1)" : "#F5F1EA",
              color: produto === p ? "#D5A246" : "#8A7E6F",
              border: `1px solid ${produto === p ? "rgba(230,57,70,0.3)" : "#ECE7DD"}`,
            }}>{p === "soja" ? "Soja" : "Milho"}</div>
          ))}
        </div>
      </div>

      {/* Termômetro principal */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <div style={{ background: `${estoqueColor}0D`, border: `1px solid ${estoqueColor}33`, borderRadius: 10, padding: "20px 24px", flex: 1 }}>
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Estoque mundial — sentimento</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: estoqueColor, fontFamily: "'JetBrains Mono',monospace" }}>{estoqueIcon}</div>
            <div>
              <div style={{ color: "#4A2C16", fontSize: 14, fontWeight: 600 }}>Estoque {estoqueNivel}</div>
              <div style={{ color: "#6B6052", fontSize: 11, marginTop: 2 }}>
                Relação estoque/uso: {fmt(d.relEstoqueUso, 1)}% (anterior: {fmt(d.relEstoqueUsoAnt, 1)}%)
              </div>
            </div>
          </div>
          {/* Gauge bar */}
          <div style={{ marginTop: 14, position: "relative", height: 10, borderRadius: 5, overflow: "hidden", display: "flex" }}>
            <div style={{ flex: 20, background: "#B0503F44" }} />
            <div style={{ flex: 10, background: "#D5A24644" }} />
            <div style={{ flex: 20, background: "#4E7C5A44" }} />
          </div>
          <div style={{ position: "relative", marginTop: -14, height: 14 }}>
            <div style={{ position: "absolute", left: `${Math.min(95, Math.max(5, (d.relEstoqueUso / 50) * 100))}%`, transform: "translateX(-50%)", top: 0 }}>
              <div style={{ width: 3, height: 14, background: "#4A2C16", borderRadius: 1, margin: "0 auto" }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#A89C8A", marginTop: 4 }}>
            <span>Apertado {"(<20%)"}</span><span>Equilibrado</span><span>Folgado {"(>30%)"}</span>
          </div>
        </div>

        {/* Estoque final card */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "20px 24px", minWidth: 200 }}>
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Estoque final mundial</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(d.mundo.estoqueFinal.atual, 1)}</span>
            <span style={{ color: "#A89C8A", fontSize: 10 }}>mi ton</span>
          </div>
          <span style={{ color: varColor(d.mundo.estoqueFinal.atual, d.mundo.estoqueFinal.anterior, true), fontSize: 11, fontWeight: 500 }}>
            {varArrow(d.mundo.estoqueFinal.atual, d.mundo.estoqueFinal.anterior)} {fmt(varPct(d.mundo.estoqueFinal.atual, d.mundo.estoqueFinal.anterior), 1)}% vs safra anterior
          </span>
        </div>
      </div>

      {/* Números mundiais */}
      <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Balanço mundial — {produto === "soja" ? "Soja" : "Milho"} ({d.safraAtual})</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Produção mundial" valor={d.mundo.producao.atual} anterior={d.mundo.producao.anterior} unit="mi ton" />
        <StatCard label="Consumo mundial" valor={d.mundo.consumo.atual} anterior={d.mundo.consumo.anterior} unit="mi ton" />
        <StatCard label="Exportação mundial" valor={d.mundo.exportacao.atual} anterior={d.mundo.exportacao.anterior} unit="mi ton" />
        <StatCard label="Estoque final" valor={d.mundo.estoqueFinal.atual} anterior={d.mundo.estoqueFinal.anterior} unit="mi ton" invert />
      </div>

      {/* Por país */}
      <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Principais países</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px repeat(4,1fr)", padding: "10px 16px", borderBottom: "1px solid #ECE7DD" }}>
          {["País", "Produção", "Var.", "Exportação", "Var."].map(h => (
            <span key={h} style={{ color: "#A89C8A", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
          ))}
        </div>
        {d.paises.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px repeat(4,1fr)", padding: "12px 16px", borderBottom: "1px solid #F2EEE6", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "#FAF7F1"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>{p.nome}</span>
            <span style={{ color: "#4A2C16", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(p.prod, 1)}</span>
            <span style={{ color: varColor(p.prod, p.prodAnt, false), fontSize: 10, fontWeight: 500 }}>
              {varArrow(p.prod, p.prodAnt)} {fmt(varPct(p.prod, p.prodAnt), 1)}%
            </span>
            <span style={{ color: "#4A2C16", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(p.exp, 1)}</span>
            <span style={{ color: varColor(p.exp, p.expAnt, false), fontSize: 10, fontWeight: 500 }}>
              {varArrow(p.exp, p.expAnt)} {fmt(varPct(p.exp, p.expAnt), 1)}%
            </span>
          </div>
        ))}
        <div style={{ padding: "8px 16px", color: "#C2B7A6", fontSize: 9 }}>Valores em milhões de toneladas</div>
      </div>

      {/* China destaque */}
      {d.paises.find(p => p.nome === "China") && (() => {
        const cn = d.paises.find(p => p.nome === "China");
        return (
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px", marginBottom: 24 }}>
            <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>China — maior importador mundial</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {cn.importacao != null && <StatCard label="Importação" valor={cn.importacao} anterior={cn.impAnt} unit="mi ton" />}
              {cn.consumo != null && <StatCard label="Consumo interno" valor={cn.consumo} anterior={cn.consumoAnt} unit="mi ton" />}
              <StatCard label="Produção" valor={cn.prod} anterior={cn.prodAnt} unit="mi ton" />
            </div>
          </div>
        );
      })()}

      {/* Leitura do fundador */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>Análise dos números</div>
          <span style={{ color: "#C2B7A6", fontSize: 9 }}>Atualizado {hasLive ? liveRow.leitura_date : USDA_DATA.leituraDate}</span>
        </div>
        <div style={{ color: "#6B6052", fontSize: 12, lineHeight: 1.7 }}>{hasLive ? (liveRow.leitura || "Sem leitura cadastrada") : USDA_DATA.leitura}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// POSIÇÃO DOS FUNDOS PAGE
// ═══════════════════════════════════════════════════════════════

// Source: CFTC Commitments of Traders (COT) — weekly, free
// Managed Money net position in CBOT futures
// In production: cron job fetches from CFTC API and saves to Supabase
const FUNDOS_DATA = {
  soja: {
    posAtual: 145200, // net long (positive = bought, negative = sold)
    posAnterior: 138700,
    historico: [
      { data: "18/03", pos: 82300 },
      { data: "25/03", pos: 95400 },
      { data: "01/04", pos: 110800 },
      { data: "08/04", pos: 128500 },
      { data: "15/04", pos: 138700 },
      { data: "22/04", pos: 145200 },
    ],
    max12m: 185000,
    min12m: -42000,
  },
  milho: {
    posAtual: 210500,
    posAnterior: 195300,
    historico: [
      { data: "18/03", pos: 120000 },
      { data: "25/03", pos: 142500 },
      { data: "01/04", pos: 158000 },
      { data: "08/04", pos: 178200 },
      { data: "15/04", pos: 195300 },
      { data: "22/04", pos: 210500 },
    ],
    max12m: 280000,
    min12m: -65000,
  },
  leitura: "Fundos seguem ampliando posição comprada em soja e milho nas últimas 6 semanas. Soja saiu de 82 mil para 145 mil contratos — movimento consistente de alta. Milho ainda mais agressivo, de 120 mil para 210 mil. Esse posicionamento dá suporte aos preços no curto prazo, mas atenção: quanto mais comprados, maior o risco de liquidação rápida se houver mudança de cenário (safra EUA, dólar, geopolítica).",
  leituraDate: "22/04/2026",
  fonte: "CFTC Commitments of Traders — Managed Money",
};

function PosicaoFundosPage({fundosData}) {
  const [produto, setProduto] = useState("soja");

  // Use Supabase data if available, otherwise fallback
  const hasLive = fundosData && fundosData.soja && fundosData.soja.historico.length > 0;
  const d = hasLive ? fundosData[produto] : FUNDOS_DATA[produto];

  const isLong = d.posAtual >= 0;
  const sentimento = isLong ? (d.posAtual > 100000 ? "Fortemente comprado" : "Comprado") : (d.posAtual < -100000 ? "Fortemente vendido" : "Vendido");
  const sentColor = isLong ? "#4E7C5A" : "#B0503F";
  const sentIcon = isLong ? "▲" : "▼";
  const sentDesc = isLong ? "Fundos apostam na alta — suporte aos preços" : "Fundos apostam na baixa — pressão nos preços";

  const varSemanal = d.posAtual - d.posAnterior;
  const varPct = d.posAnterior !== 0 ? ((varSemanal / Math.abs(d.posAnterior)) * 100) : 0;

  // Chart dimensions
  const chartW = 700;
  const chartH = 180;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const hist = d.historico;
  const allPos = hist.map(h => h.pos);
  const maxP = Math.max(...allPos, 0);
  const minP = Math.min(...allPos, 0);
  const range = maxP - minP || 1;

  const toX = (i) => padL + (i / (hist.length - 1)) * plotW;
  const toY = (v) => padT + (1 - (v - minP) / range) * plotH;
  const zeroY = toY(0);

  // Build path
  const pathD = hist.map((h, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(h.pos).toFixed(1)}`).join(" ");
  // Area fill
  const areaD = pathD + ` L${toX(hist.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  // Gauge: position relative to 12-month range
  const gaugeRange = d.max12m - d.min12m || 1;
  const gaugePct = Math.max(0, Math.min(100, ((d.posAtual - d.min12m) / gaugeRange) * 100));

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Posição dos fundos — CBOT</span>
          <span style={{ color: "#A89C8A", fontSize: 11 }}>Managed Money (CFTC COT)</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["soja", "milho"].map(p => (
            <div key={p} onClick={() => setProduto(p)} style={{
              padding: "7px 18px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: produto === p ? "rgba(230,57,70,0.1)" : "#F5F1EA",
              color: produto === p ? "#D5A246" : "#8A7E6F",
              border: `1px solid ${produto === p ? "rgba(230,57,70,0.3)" : "#ECE7DD"}`,
            }}>{p === "soja" ? "Soja" : "Milho"}</div>
          ))}
        </div>
      </div>

      {/* Posição atual + sentimento */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {/* Posição atual */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "20px 24px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: sentColor }} />
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Posição líquida atual</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: sentColor, fontFamily: "'JetBrains Mono',monospace" }}>
              {d.posAtual >= 0 ? "+" : ""}{(d.posAtual / 1000).toFixed(1)}k
            </span>
            <span style={{ color: "#A89C8A", fontSize: 11 }}>contratos</span>
          </div>
          <div style={{ color: "#8A7E6F", fontSize: 11 }}>{d.posAtual >= 0 ? "Comprado (long)" : "Vendido (short)"} — {fmt(Math.abs(d.posAtual), 0)} contratos</div>
        </div>

        {/* Sentimento */}
        <div style={{ background: `${sentColor}0D`, border: `1px solid ${sentColor}33`, borderRadius: 10, padding: "20px 24px", flex: 1 }}>
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sentimento</div>
          <div style={{ color: sentColor, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{sentIcon} {sentimento}</div>
          <div style={{ color: "#6B6052", fontSize: 11 }}>{sentDesc}</div>
        </div>

        {/* Variação semanal */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "20px 24px", minWidth: 180 }}>
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Variação semanal</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: varSemanal >= 0 ? "#4E7C5A" : "#B0503F", fontFamily: "'JetBrains Mono',monospace" }}>
              {varSemanal >= 0 ? "+" : ""}{(varSemanal / 1000).toFixed(1)}k
            </span>
          </div>
          <span style={{ color: varPct >= 0 ? "#4E7C5A" : "#B0503F", fontSize: 10, fontWeight: 500 }}>
            {varPct >= 0 ? "▲" : "▼"} {varPct >= 0 ? "+" : ""}{fmt(varPct, 1)}%
          </span>
        </div>
      </div>

      {/* Gauge: onde estamos no range de 12 meses */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Posição no range de 12 meses</div>
        <div style={{ position: "relative", height: 24, marginBottom: 6 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 8, height: 8, borderRadius: 4, overflow: "hidden", display: "flex" }}>
            <div style={{ flex: 1, background: "#B0503F33" }} />
            <div style={{ flex: 1, background: "#D5A24633" }} />
            <div style={{ flex: 1, background: "#4E7C5A33" }} />
          </div>
          <div style={{ position: "absolute", left: `${gaugePct}%`, top: 0, transform: "translateX(-50%)" }}>
            <div style={{ width: 3, height: 24, background: "#4A2C16", borderRadius: 1, margin: "0 auto" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#A89C8A" }}>
          <span>Máx. vendido: {(d.min12m / 1000).toFixed(0)}k</span>
          <span>Neutro: 0</span>
          <span>Máx. comprado: {(d.max12m / 1000).toFixed(0)}k</span>
        </div>
      </div>

      {/* Gráfico de evolução */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Evolução — últimas {hist.length} semanas</div>
        <div style={{ color: "#8A7E6F", fontSize: 10, marginBottom: 14 }}>Posição líquida Managed Money — contratos</div>

        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow: "visible" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = padT + f * plotH;
            const val = maxP - f * range;
            return <g key={f}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#F2EEE6" strokeWidth="0.5" />
              <text x={padL - 8} y={y + 3} fill="#A89C8A" fontSize="9" textAnchor="end" fontFamily="'JetBrains Mono',monospace">{(val / 1000).toFixed(0)}k</text>
            </g>;
          })}
          {/* Zero line */}
          {minP < 0 && <line x1={padL} y1={zeroY} x2={chartW - padR} y2={zeroY} stroke="#DED8CC" strokeWidth="1" strokeDasharray="4 3" />}
          {/* Area fill */}
          <path d={areaD} fill={isLong ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"} />
          {/* Line */}
          <path d={pathD} fill="none" stroke={sentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Points */}
          {hist.map((h, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(h.pos)} r={i === hist.length - 1 ? 5 : 3} fill={sentColor} opacity={i === hist.length - 1 ? 1 : 0.6} />
              {/* Date labels */}
              <text x={toX(i)} y={chartH - 5} fill="#A89C8A" fontSize="9" textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{h.data}</text>
              {/* Value on last point */}
              {i === hist.length - 1 && (
                <text x={toX(i)} y={toY(h.pos) - 10} fill="#4A2C16" fontSize="10" textAnchor="middle" fontWeight="600" fontFamily="'JetBrains Mono',monospace">
                  {(h.pos / 1000).toFixed(1)}k
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Leitura do fundador */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>Leitura do posicionamento</div>
          <span style={{ color: "#C2B7A6", fontSize: 9 }}>Atualizado {FUNDOS_DATA.leituraDate}</span>
        </div>
        <div style={{ color: "#6B6052", fontSize: 12, lineHeight: 1.7 }}>{FUNDOS_DATA.leitura}</div>
        <div style={{ color: "#C2B7A6", fontSize: 9, marginTop: 10 }}>Fonte: {FUNDOS_DATA.fonte}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CÂMBIO PROJETADO PAGE
// ═══════════════════════════════════════════════════════════════

const DOL_CONTRACTS = [
  { sym: "BMFBOVESPA:DOLN2026", mo: "Jul/26", mes: "Julho 2026" },
  { sym: "BMFBOVESPA:DOLQ2026", mo: "Ago/26", mes: "Agosto 2026" },
  { sym: "BMFBOVESPA:DOLU2026", mo: "Set/26", mes: "Setembro 2026" },
  { sym: "BMFBOVESPA:DOLV2026", mo: "Out/26", mes: "Outubro 2026" },
  { sym: "BMFBOVESPA:DOLX2026", mo: "Nov/26", mes: "Novembro 2026" },
  { sym: "BMFBOVESPA:DOLZ2026", mo: "Dez/26", mes: "Dezembro 2026" },
  { sym: "BMFBOVESPA:DOLF2027", mo: "Jan/27", mes: "Janeiro 2027" },
  { sym: "BMFBOVESPA:DOLG2027", mo: "Fev/27", mes: "Fevereiro 2027" },
  { sym: "BMFBOVESPA:DOLH2027", mo: "Mar/27", mes: "Março 2027" },
  { sym: "BMFBOVESPA:DOLJ2027", mo: "Abr/27", mes: "Abril 2027" },
  { sym: "BMFBOVESPA:DOLK2027", mo: "Mai/27", mes: "Maio 2027" },
  { sym: "BMFBOVESPA:DOLM2027", mo: "Jun/27", mes: "Junho 2027" },
  { sym: "BMFBOVESPA:DOLN2027", mo: "Jul/27", mes: "Julho 2027" },
  { sym: "BMFBOVESPA:DOLQ2027", mo: "Ago/27", mes: "Agosto 2027" },
  { sym: "BMFBOVESPA:DOLV2027", mo: "Out/27", mes: "Outubro 2027" },
  { sym: "BMFBOVESPA:DOLF2028", mo: "Jan/28", mes: "Janeiro 2028" },
];

function CambioPage({COTACOES, ptax}) {
  const contracts = DOL_CONTRACTS.map(c => {
    const cot = COTACOES[c.sym];
    const rate = cot ? cot.lp / 1000 : null;
    const ch = cot ? cot.ch / 1000 : 0;
    const chp = cot?.chp || 0;
    return { ...c, rate, ch, chp };
  }).filter(c => c.rate !== null);

  const rates = contracts.map(c => c.rate);
  const minR = Math.min(...rates);
  const maxR = Math.max(...rates);
  const rangeR = maxR - minR || 0.01;
  const spot = contracts[0]?.rate || 5.008;

  // Chart
  const chartW = 700;
  const chartH = 200;
  const padL = 60;
  const padR = 20;
  const padT = 25;
  const padB = 35;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (i) => padL + (i / (contracts.length - 1)) * plotW;
  const toY = (v) => padT + (1 - (v - (minR - 0.02)) / (rangeR + 0.04)) * plotH;

  const pathD = contracts.map((c, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(c.rate).toFixed(1)}`).join(" ");
  const areaD = pathD + ` L${toX(contracts.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${toX(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  const isUp = contracts[contracts.length - 1].rate > contracts[0].rate;
  const curveColor = isUp ? "#B0503F" : "#4E7C5A";

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Câmbio projetado</span>
        <span style={{ color: "#A89C8A", fontSize: 11 }}>Dólar futuro B3 — {contracts.length} vencimentos</span>
      </div>

      {/* Ptax + Dólar comercial */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 20px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#D5A246" }} />
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Ptax — dia anterior (BCB)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ color: "#6B6052", fontSize: 9, marginBottom: 2 }}>Compra</div>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {ptax ? fmt(ptax.compra, 4) : "—"}</span>
            </div>
            <div style={{ width: 1, height: 30, background: "#ECE7DD" }} />
            <div>
              <div style={{ color: "#6B6052", fontSize: 9, marginBottom: 2 }}>Venda</div>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {ptax ? fmt(ptax.venda, 4) : "—"}</span>
            </div>
          </div>
          <div style={{ color: "#C2B7A6", fontSize: 9, marginTop: 6 }}>{ptax ? `Ref: ${ptax.data_ref.split("-").reverse().join("/")}` : "Sem dados"} — Fonte: Banco Central do Brasil</div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 20px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#B67A33" }} />
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dólar comercial — hoje</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(spot, 4)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Chg ch={contracts[0]?.ch || 0} chp={contracts[0]?.chp || 0} />
            <span style={{ color: "#C2B7A6", fontSize: 9 }}>Ref: DOL B3 1º venc. ({contracts[0]?.mo})</span>
          </div>
        </div>
      </div>

      {/* Spot + resumo */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#B67A33" }} />
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dólar 1º vencimento (spot ref.)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(spot, 4)}</span>
          </div>
          <div style={{ marginTop: 4 }}><Chg ch={contracts[0]?.ch || 0} chp={contracts[0]?.chp || 0} /></div>
          <div style={{ color: "#C2B7A6", fontSize: 9, marginTop: 4 }}>{contracts[0]?.sym.replace("BMFBOVESPA:", "")}</div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", minWidth: 180 }}>
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Último vencimento</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(contracts[contracts.length - 1].rate, 4)}</span>
          </div>
          <div style={{ color: "#C2B7A6", fontSize: 10, marginTop: 4 }}>{contracts[contracts.length - 1].mo}</div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", minWidth: 180 }}>
          <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Variação na curva</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: isUp ? "#B0503F" : "#4E7C5A", fontFamily: "'JetBrains Mono',monospace" }}>
              {isUp ? "+" : ""}{fmt(contracts[contracts.length - 1].rate - spot, 4)}
            </span>
          </div>
          <div style={{ color: isUp ? "#B0503F" : "#4E7C5A", fontSize: 10, marginTop: 4 }}>
            {isUp ? "▲ Curva ascendente — mercado projeta dólar subindo" : "▼ Curva descendente — mercado projeta dólar caindo"}
          </div>
        </div>
      </div>

      {/* Curva gráfica */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Curva de dólar futuro</div>
        <div style={{ color: "#8A7E6F", fontSize: 10, marginBottom: 14 }}>Projeção do mercado para o câmbio nos próximos meses</div>

        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow: "visible" }}>
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = padT + f * plotH;
            const val = (maxR + 0.02) - f * (rangeR + 0.04);
            return <g key={f}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#F2EEE6" strokeWidth="0.5" />
              <text x={padL - 8} y={y + 3} fill="#A89C8A" fontSize="9" textAnchor="end" fontFamily="'JetBrains Mono',monospace">{val.toFixed(2)}</text>
            </g>;
          })}
          {/* Area */}
          <path d={areaD} fill={`${curveColor}08`} />
          {/* Line */}
          <path d={pathD} fill="none" stroke={curveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Points + labels */}
          {contracts.map((c, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(c.rate)} r={3} fill={curveColor} opacity={0.7} />
              <text x={toX(i)} y={chartH - 5} fill="#A89C8A" fontSize="8" textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{c.mo}</text>
              {(i === 0 || i === contracts.length - 1 || i % 3 === 0) && (
                <text x={toX(i)} y={toY(c.rate) - 8} fill="#6B6052" fontSize="8" textAnchor="middle" fontWeight="500" fontFamily="'JetBrains Mono',monospace">{c.rate.toFixed(3)}</text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Tabela de vencimentos */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #ECE7DD" }}>
          <span style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>Todos os vencimentos</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px 100px", padding: "8px 18px", borderBottom: "1px solid #ECE7DD" }}>
          {["Vencimento", "Cotação (R$)", "Var. dia", "Vs. spot"].map(h => (
            <span key={h} style={{ color: "#A89C8A", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
          ))}
        </div>
        {contracts.map((c, i) => {
          const vSpot = c.rate - spot;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px 100px", padding: "11px 18px", borderBottom: "1px solid #F2EEE6", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "#FAF7F1"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div>
                <span style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>{c.mes}</span>
                <span style={{ color: "#C2B7A6", fontSize: 9, marginLeft: 8 }}>{c.sym.replace("BMFBOVESPA:", "")}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(c.rate, 4)}</span>
              <Chg ch={c.ch} chp={c.chp} />
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: vSpot >= 0 ? "#B0503F" : "#4E7C5A" }}>
                {i === 0 ? "—" : `${vSpot >= 0 ? "+" : ""}${fmt(vSpot, 4)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARIDADE DE EXPORTAÇÃO PAGE
// ═══════════════════════════════════════════════════════════════

function ParidadePage({COTACOES}) {
  const [entK, setEntK] = useState("4-2026");
  const [pagK, setPagK] = useState("5-2026");
  const [freteRton, setFreteRton] = useState(380);

  const [eMi, eYr] = entK.split("-").map(Number);
  const [pMi, pYr] = pagK.split("-").map(Number);
  const isSoja = true; // Paridade é soja exportação

  // Chicago — contrato correto pelo mês de entrega
  const allK = Object.keys(COTACOES);
  const rawCS = buildSoja(eMi, eYr);
  const csym = findClosest(rawCS, allK, COTACOES);
  const ccot = COTACOES[csym];
  const chicagoCbu = ccot ? ccot.lp : 1049;
  const cShort = csym.replace("CBOT:", "");
  const cCode = cShort.charAt(2);
  const cLabel = `${CODE_NAME[cCode]}/${cShort.slice(-4)}`;

  // Dólar — contrato futuro pelo mês de pagamento
  const dolKeys = allK.filter(k => k.includes("DOL"));
  const rawDS = buildDol(pMi, pYr);
  const dsym = findClosest(rawDS, dolKeys, COTACOES);
  const dcot = COTACOES[dsym];
  const cambio = dcot ? dcot.lp / 1000 : 5.008;
  const dShort = dsym.replace("BMFBOVESPA:", "");

  // Prêmio Brasil — fundador lança por mês de embarque (admin)
  // In production: query Supabase premios_porto where mes_embarque = eMi, ano = eYr
  const PREMIOS_POR_MES = {
    "4-2026": 32.7, "5-2026": 30.0, "6-2026": 50.7,
    "7-2026": 75.0, "8-2026": 100.0,
    "1-2027": 22.0, "2-2027": -7.3, "3-2027": -6.0, "4-2027": 10.0,
  };
  const premioBrasil = PREMIOS_POR_MES[entK] ?? 30.0;

  // Constants
  const FATOR_CBU_USD_TON = 0.367437;

  // ETAPA 1 — FOB
  const custoFobBR = (chicagoCbu + premioBrasil) * FATOR_CBU_USD_TON;

  // ETAPA 2 — Custos internos
  const despPortuarias = 12;
  const icms = 0;
  const quebra = custoFobBR * 0.0025;
  const corretagem = custoFobBR * 0.001875;
  const pis = 0;
  const comissoes = 0.5;
  const freteInterno = 0;
  const ttlCustos = despPortuarias + icms + quebra + corretagem + pis + comissoes + freteInterno;

  // ETAPA 3 — Custo no porto
  const custoLiqTon = custoFobBR - ttlCustos;
  const custoLiqSaca = custoLiqTon * 60 / 1000;
  const custoPortoBRL = custoLiqSaca * cambio;

  // ETAPA 4 — Frete
  const freteSaca = freteRton * 60 / 1000;
  const precoPraca = custoPortoBRL - freteSaca;

  function CustoRow({ label, valor, unit, dim, highlight }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F2EEE6" }}>
        <span style={{ color: dim ? "#C2B7A6" : highlight ? highlight : "#6B6052", fontSize: 12 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ color: dim ? "#A89C8A" : highlight ? highlight : "#4A2C16", fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(valor, 2)}</span>
          <span style={{ color: "#A89C8A", fontSize: 9 }}>{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Paridade de exportação</span>
          <span style={{ color: "#A89C8A", fontSize: 11 }}>Preço máximo que a trading consegue pagar</span>
        </div>
      </div>

      {/* Seletores */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Sel label="Mês de entrega" value={entK} onChange={setEntK} w={165}>
          {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
        </Sel>
        <Sel label="Data de pagamento" value={pagK} onChange={setPagK} w={165}>
          {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
        </Sel>
        <div style={{ display: "flex", gap: 16, marginLeft: "auto", alignItems: "center", fontSize: 10, color: "#A89C8A" }}>
          <span>Chicago: {cLabel} ({fmt(chicagoCbu, 0)} c/bu)</span>
          <span>Dólar: {dShort} (R$ {fmt(cambio, 4)})</span>
          <span>Prêmio: {fmt(premioBrasil, 1)} c/bu</span>
        </div>
      </div>

      {/* Resultado principal */}
      <div style={{ background: "#FFFFFF", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "24px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#4E7C5A" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Preço no porto — Paranaguá — {MESES[eMi]} {eYr}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: "#4E7C5A", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(custoPortoBRL)}</span>
              <span style={{ color: "#A89C8A", fontSize: 13 }}>/saca</span>
            </div>
            <div style={{ color: "#6B6052", fontSize: 12, marginTop: 4 }}>US$ {fmt(custoLiqSaca)}/saca</div>
          </div>
          <div style={{ textAlign: "right", color: "#C2B7A6", fontSize: 9, lineHeight: 1.6 }}>
            <div>Preço máximo que uma trading</div>
            <div>de exportação consegue pagar</div>
            <div style={{ marginTop: 4 }}>Diferença porto→praça = frete do comprador</div>
          </div>
        </div>
      </div>

      {/* Frete */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Desconte seu frete</div>
        <div style={{ color: "#8A7E6F", fontSize: 10, marginBottom: 14 }}>Informe o frete da sua região até o porto para ver o preço na sua praça</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Frete até o porto</label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ background: "#EFE8DB", border: "1px solid #E4DECF", borderRight: "none", borderRadius: "7px 0 0 7px", padding: "9px 10px", color: "#8A7E6F", fontSize: 12 }}>R$</span>
              <input type="number" value={freteRton} onChange={e => setFreteRton(parseFloat(e.target.value) || 0)}
                style={{ background: "#F6F3ED", border: "1px solid #E4DECF", borderRadius: "0 7px 7px 0", color: "#4A2C16", padding: "9px 10px", fontSize: 15, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, outline: "none", width: 100 }} />
              <span style={{ color: "#A89C8A", fontSize: 11, marginLeft: 6 }}>/ton</span>
              <span style={{ color: "#C2B7A6", fontSize: 10, marginLeft: 12 }}>= R$ {fmt(freteSaca)}/saca</span>
            </div>
          </div>
          <div style={{ background: "rgba(69,123,157,0.08)", border: "1px solid rgba(69,123,157,0.2)", borderRadius: 8, padding: "12px 20px" }}>
            <div style={{ color: "#8A7E6F", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Preço na sua praça</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(precoPraca)}</span>
            <span style={{ color: "#A89C8A", fontSize: 11, marginLeft: 6 }}>/saca</span>
          </div>
        </div>
      </div>

      {/* Componentes do preço */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
          <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Componentes do preço</div>
          <CustoRow label={`Chicago CBOT (${cLabel})`} valor={chicagoCbu} unit="c/bu" />
          <CustoRow label={`Prêmio Brasil — ${MESES[eMi]} ${eYr}`} valor={premioBrasil} unit="c/bu" />
          <CustoRow label="FOB Brasil" valor={custoFobBR} unit="USD/ton" />
          <CustoRow label="Custos internos (total)" valor={ttlCustos} unit="USD/ton" />
          <CustoRow label="Custo líquido porto" valor={custoLiqTon} unit="USD/ton" />
          <CustoRow label="Custo líquido porto" valor={custoLiqSaca} unit="USD/sc" />
          <CustoRow label={`Câmbio ${MESES[pMi]} ${pYr} (R$ ${fmt(cambio, 4)})`} valor={custoPortoBRL} unit="R$/sc" />
          <div style={{ marginTop: 10, padding: "10px 0", borderTop: "1px solid #ECE7DD", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#4E7C5A", fontSize: 13, fontWeight: 600 }}>Preço no porto</span>
            <span style={{ color: "#4E7C5A", fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(custoPortoBRL)}/sc</span>
          </div>
        </div>

      {/* Custos internos da trading */}
      <div style={{ background: "#FFFFFF", border: "1px solid rgba(230,57,70,0.15)", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600 }}>Custos internos da trading</div>
          </div>
          <CustoRow label="Despesas portuárias" valor={despPortuarias} unit="USD/ton" />
          <CustoRow label="ICMS" valor={icms} unit="USD/ton" dim />
          <CustoRow label="Quebra (0,25%)" valor={quebra} unit="USD/ton" />
          <CustoRow label="Corretagem cambial (0,19%)" valor={corretagem} unit="USD/ton" />
          <CustoRow label="PIS" valor={pis} unit="USD/ton" dim />
          <CustoRow label="Comissões e taxas" valor={comissoes} unit="USD/ton" />
          <div style={{ marginTop: 10, padding: "10px 0", borderTop: "1px solid #ECE7DD", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#D5A246", fontSize: 12, fontWeight: 600 }}>Total custos internos</span>
            <span style={{ color: "#D5A246", fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(ttlCustos)} USD/ton</span>
          </div>
          <div style={{ color: "#C2B7A6", fontSize: 9, marginTop: 8 }}>Quanto menor os custos internos, mais a trading consegue pagar. Revisados mensalmente.</div>
        </div>

      {/* Premissas */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ color: "#A89C8A", fontSize: 10, fontWeight: 600, marginBottom: 8 }}>Premissas utilizadas</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 10, color: "#C2B7A6" }}>
          <span>Chicago: {cLabel} — {fmt(chicagoCbu, 0)} c/bu</span>
          <span>Prêmio: {fmt(premioBrasil, 1)} c/bu ({MESES[eMi]}/{eYr})</span>
          <span>Câmbio: R$ {fmt(cambio, 4)} ({MESES[pMi]}/{pYr})</span>
          <span>Fator: {FATOR_CBU_USD_TON}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CUSTO CARREGO PAGE
// ═══════════════════════════════════════════════════════════════

function CustoCarregoPage({PRACAS, COTACOES, BASIS_DATA, DEFAULT_BASIS}) {
  const mercado = "Soja Exportação"; // Custo carrego é só soja inicialmente
  const [pracaId, setPracaId] = useState(1);
  const _carregoHyd = useRef(false);
  useEffect(()=>{ if(_carregoHyd.current) return; if(!PRACAS||PRACAS.length===0) return; try{ const r=localStorage.getItem("bz_praca_ref"); if(r){const n=parseInt(r); if(PRACAS.some(p=>p.id===n)) setPracaId(n);} }catch(e){} _carregoHyd.current=true; },[PRACAS]);
  useEffect(()=>{ if(_carregoHyd.current&&pracaId!=null){ try{localStorage.setItem("bz_praca_ref",String(pracaId));}catch(e){} } },[pracaId]);

  // Datas padrão calculadas na abertura da aba, a partir da data atual
  const _hoje = new Date();
  const _fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const _addDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const _addMeses = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
  const _entregaPadrao = _fmt(_hoje);                               // entrega = hoje
  const _pagtoPadrao = _fmt(_addDias(_hoje, 30));                   // pagamento = hoje + 30 dias
  const _entregaFutPadrao = _fmt(_addMeses(_hoje, 5));             // projeção = hoje + 5 meses
  const _pagtoFutPadrao = _fmt(_addDias(_addMeses(_hoje, 5), 30)); // pagamento futuro = entrega futura + 30 dias

  const [dtEntrega, setDtEntrega] = useState(_entregaPadrao);
  const [dtPagto, setDtPagto] = useState(_pagtoPadrao);
  const [dtEntregaFut, setDtEntregaFut] = useState(_entregaFutPadrao);
  const [dtPagtoFut, setDtPagtoFut] = useState(_pagtoFutPadrao);
  const [volume, setVolume] = useState(10000);
  const [precoInput, setPrecoInput] = useState(110);
  const [moeda, setMoeda] = useState("BRL");
  const [armMes, setArmMes] = useState(0.35);
  const [quebraAm, setQuebraAm] = useState(0.30);
  const [finAm, setFinAm] = useState(1);
  const [subTab, setSubTab] = useState("calc");
  const [posicoes, setPosicoes] = useState([]);

  const praca = PRACAS.find(p => p.id === pracaId);
  const pLabel = praca ? `${praca.cidade} - ${praca.estado}` : "";
  const isSoja = mercado === "Soja Exportação";

  const byState = useMemo(() => {
    const g = {};
    PRACAS.forEach(p => {
      const bk = `${p.cidade}-${p.estado}-${mercado}`;
      if (BASIS_DATA[bk]) { (g[p.estado] ||= []).push(p); }
    });
    return g;
  }, [PRACAS, mercado, BASIS_DATA]);

  // Auto-fetch Chicago and Cambio from dates
  const allK = Object.keys(COTACOES);
  const dolKeys = allK.filter(k => k.includes("DOL"));

  function getMonthYear(dateStr) {
    // Parse "YYYY-MM-DD" directly to avoid timezone issues
    const parts = dateStr.split("-");
    return { mi: parseInt(parts[1]) - 1, yr: parseInt(parts[0]) };
  }

  // Current date → Chicago + Cambio
  const cur = getMonthYear(dtEntrega);
  const curPag = getMonthYear(dtPagto);
  const rawCurC = buildSoja(cur.mi, cur.yr);
  const curCSym = findClosest(rawCurC, allK, COTACOES);
  const curCot = COTACOES[curCSym];
  const chicagoAtual = curCot ? curCot.lp / 100 : 10.50; // Convert c/bu to US$/bu
  const chicagoAtualCbu = curCot ? curCot.lp : 1050;

  const rawCurD = buildDol(curPag.mi, curPag.yr);
  const curDSym = findClosest(rawCurD, dolKeys, COTACOES);
  const curDCot = COTACOES[curDSym];
  const cambioAtual = curDCot ? curDCot.lp / 1000 : 5.008;

  // Future date → Chicago + Cambio
  const fut = getMonthYear(dtEntregaFut);
  const futPag = getMonthYear(dtPagtoFut);
  const rawFutC = buildSoja(fut.mi, fut.yr);
  const futCSym = findClosest(rawFutC, allK, COTACOES);
  const futCot = COTACOES[futCSym];
  const chicagoFut = futCot ? futCot.lp / 100 : 10.80;
  const chicagoFutCbu = futCot ? futCot.lp : 1080;

  const rawFutD = buildDol(futPag.mi, futPag.yr);
  const futDSym = findClosest(rawFutD, dolKeys, COTACOES);
  const futDCot = COTACOES[futDSym];
  const cambioFut = futDCot ? futDCot.lp / 1000 : 5.25;

  // Resolve input price to BRL
  const preco = moeda === "BRL" ? precoInput : precoInput * cambioAtual;
  const precoUSD = moeda === "USD" ? precoInput : precoInput / cambioAtual;

  // Calculations
  const d1 = new Date(dtEntrega);
  const d2 = new Date(dtEntregaFut);
  const meses = Math.max(0.1, (d2 - d1) / (1000 * 60 * 60 * 24 * 30.44));
  const fator = 2.20462;

  const precoUsdSc = preco / cambioAtual;
  const precoUsdBu = precoUsdSc / fator;
  const basisAtual = precoUsdBu - chicagoAtual;

  const custoArm = armMes * meses;
  const custoQuebra = preco * (quebraAm / 100) * meses;
  const custoFin = preco * (finAm / 100) * meses;
  const custoTotal = custoArm + custoQuebra + custoFin;

  // Ponto 0x0: preço que precisa vender no futuro para empatar
  const precoViab = preco + custoTotal;

  // Tabela de ganho: R$1 a R$10 acima do 0x0
  const ganhoTable = [];
  for (let i = 0; i <= 10; i++) {
    const precoVenda = precoViab + i;
    const ganhaSc = i;
    const ganhaTotal = i * volume;
    ganhoTable.push({ acima: i, precoVenda, ganhaSc, ganhaTotal });
  }

  // Projeção pior cenário: basis do mês futuro para a praça selecionada
  const basisKeyCarrego = praca ? `${praca.cidade}-${praca.estado}-${mercado}` : "";
  const basisDataFut = BASIS_DATA[basisKeyCarrego] || DEFAULT_BASIS;
  const basisMesFut = basisDataFut[fut.mi];
  const basisMinFut = basisMesFut ? basisMesFut.basis_min : -120;
  const basisMedFut = basisMesFut ? basisMesFut.medio : -95;
  const basisMaxFut = basisMesFut ? basisMesFut.basis_max : -70;

  // Preço possível no pior cenário (basis_min)
  const precoFutPior = (chicagoFutCbu + basisMinFut) * fator / 100 * cambioFut;
  const precoFutMedio = (chicagoFutCbu + basisMedFut) * fator / 100 * cambioFut;
  const precoFutMelhor = (chicagoFutCbu + basisMaxFut) * fator / 100 * cambioFut;

  const piorViavel = precoFutPior >= precoViab;
  const medioViavel = precoFutMedio >= precoViab;
  const melhorViavel = precoFutMelhor >= precoViab;

  // Contract labels
  const cCurShort = curCSym.replace("CBOT:", "");
  const cFutShort = futCSym.replace("CBOT:", "");
  const dCurShort = curDSym.replace("BMFBOVESPA:", "");
  const dFutShort = futDSym.replace("BMFBOVESPA:", "");

  function Inp({ label, value, onChange, type = "number", step, unit, w }) {
    return (
      <div style={{ minWidth: w }}>
        <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>{label}</label>
        <div style={{ display: "flex", alignItems: "center" }}>
          <input type={type} step={step} value={value} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
            style={{ background: "#F6F3ED", border: "1px solid #E4DECF", borderRadius: 7, color: "#4A2C16", padding: "8px 10px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: "none", width: "100%" }} />
          {unit && <span style={{ color: "#A89C8A", fontSize: 10, marginLeft: 6, whiteSpace: "nowrap" }}>{unit}</span>}
        </div>
      </div>
    );
  }

  function AutoCard({ label, value, unit, sym, color }) {
    return (
      <div style={{ background: "#F6F3ED", borderRadius: 7, padding: "10px 14px", flex: 1 }}>
        <div style={{ color: "#A89C8A", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: color || "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>{value}</span>
          <span style={{ color: "#A89C8A", fontSize: 9 }}>{unit}</span>
        </div>
        <div style={{ color: "#C2B7A6", fontSize: 8, marginTop: 2 }}>{sym} (auto)</div>
      </div>
    );
  }

  // Wrap calculator as renderCalc
  const renderCalc = (
    <>
      {/* Praça */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.2)", borderRadius: 6, padding: "9px 14px", fontSize: 12, fontWeight: 600, color: "#D5A246" }}>Soja</div>
        <Sel label="Praça" value={pracaId} onChange={v => setPracaId(+v)} w={220} grow>
          {Object.entries(byState).sort().map(([st, cs]) => (
            <optgroup key={st} label={st}>
              {cs.map(c => <option key={c.id} value={c.id}>{c.cidade} - {c.estado}</option>)}
            </optgroup>
          ))}
        </Sel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Datas e volume */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>Datas e volume</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Inp label="Data entrega atual" value={dtEntrega} onChange={setDtEntrega} type="date" />
            <Inp label="Data pagamento atual" value={dtPagto} onChange={setDtPagto} type="date" />
            <Inp label="Data entrega futura" value={dtEntregaFut} onChange={setDtEntregaFut} type="date" />
            <Inp label="Data pagamento futuro" value={dtPagtoFut} onChange={setDtPagtoFut} type="date" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ background: "#F6F3ED", borderRadius: 7, padding: "10px 14px", flex: 1 }}>
              <div style={{ color: "#A89C8A", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Meses de carrego</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(meses, 1)}</div>
            </div>
            <Inp label="Volume (sacas)" value={volume} onChange={setVolume} step="500" />
          </div>
        </div>

        {/* Preço + dados automáticos */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>Preço ofertado</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Preço informado</label>
              <div style={{ display: "flex", alignItems: "center" }}>
                <input type="number" step="0.5" value={precoInput} onChange={e => setPrecoInput(parseFloat(e.target.value) || 0)}
                  style={{ background: "#F6F3ED", border: "1px solid #E4DECF", borderRadius: "7px 0 0 7px", color: "#4A2C16", padding: "8px 10px", fontSize: 16, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, outline: "none", width: 120 }} />
                <div style={{ display: "flex" }}>
                  {["BRL", "USD"].map(m => (
                    <div key={m} onClick={() => setMoeda(m)} style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                      background: moeda === m ? "#B67A33" : "#EFE8DB",
                      color: moeda === m ? "#fff" : "#8A7E6F",
                      border: "1px solid #E4DECF",
                      borderRadius: m === "USD" ? "0 7px 7px 0" : 0,
                    }}>{m === "BRL" ? "R$/sc" : "US$/sc"}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Dual display */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "#F6F3ED", borderRadius: 7, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: "#A89C8A", fontSize: 8 }}>Em reais</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(preco)}/sc</span>
            </div>
            <div style={{ background: "#F6F3ED", borderRadius: 7, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: "#A89C8A", fontSize: 8 }}>Em dólar</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>US$ {fmt(precoUSD)}/sc</span>
            </div>
          </div>

          <div style={{ color: "#A89C8A", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dados automáticos (da API)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <AutoCard label="Chicago atual" value={fmt(chicagoAtual, 2)} unit="US$/bu" sym={cCurShort} color="#4E7C5A" />
            <AutoCard label="Câmbio atual" value={`R$ ${fmt(cambioAtual, 4)}`} unit="" sym={dCurShort} color="#B67A33" />
            <AutoCard label="Chicago futuro" value={fmt(chicagoFut, 2)} unit="US$/bu" sym={cFutShort} />
            <AutoCard label="Câmbio futuro" value={`R$ ${fmt(cambioFut, 4)}`} unit="" sym={dFutShort} />
          </div>
        </div>
      </div>

      {/* Custos de carrego + Basis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>Custos de carrego</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <Inp label="Armazenagem (R$/sc/mês)" value={armMes} onChange={setArmMes} step="0.05" />
            <Inp label="Quebra (% a.m.)" value={quebraAm} onChange={setQuebraAm} step="0.05" />
            <Inp label="Financeiro (% a.m.)" value={finAm} onChange={setFinAm} step="0.05" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {[
              { l: "Armazenagem", v: custoArm },
              { l: "Quebra", v: custoQuebra },
              { l: "Financeiro", v: custoFin },
              { l: "TOTAL", v: custoTotal, hl: true },
            ].map((c, i) => (
              <div key={i} style={{ background: c.hl ? "rgba(245,158,11,0.08)" : "#F6F3ED", border: c.hl ? "1px solid rgba(245,158,11,0.2)" : "none", borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ color: c.hl ? "#D5A246" : "#A89C8A", fontSize: 8, fontWeight: 600 }}>{c.l}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.hl ? "#D5A246" : "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(c.v)}</div>
                <div style={{ color: "#C2B7A6", fontSize: 8 }}>por saca</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>Cálculo do basis atual</div>
          {[
            ["Preço atual", `R$ ${fmt(preco)}`, "R$/sc"],
            ["÷ Câmbio atual", fmt(cambioAtual, 4), "BRL/USD"],
            ["= Preço em US$/sc", fmt(precoUsdSc, 4), "US$/sc"],
            ["÷ Fator conversão", "2,20462", "sc→bu"],
            ["= Preço em US$/bu", fmt(precoUsdBu, 4), "US$/bu"],
            ["- Chicago atual", fmt(chicagoAtual, 4), "US$/bu"],
          ].map(([l, v, u], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #F2EEE6", fontSize: 12 }}>
              <span style={{ color: "#6B6052" }}>{l}</span>
              <span style={{ color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>{v} <span style={{ color: "#A89C8A", fontSize: 9 }}>{u}</span></span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4 }}>
            <span style={{ color: "#D5A246", fontSize: 13, fontWeight: 600 }}>= BASIS ATUAL</span>
            <span style={{ color: "#D5A246", fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(basisAtual, 4)} US$/bu</span>
          </div>
        </div>
      </div>

      {/* Ponto de equilíbrio 0x0 */}
      <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "18px 22px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#D5A246", fontSize: 13, fontWeight: 700 }}>Ponto de equilíbrio (0×0)</div>
          <div style={{ color: "#D5A246", fontSize: 10, opacity: 0.7, marginTop: 2 }}>Preço atual (R$ {fmt(preco)}) + custos de carrego (R$ {fmt(custoTotal)}) = preço mínimo para não perder</div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#D5A246", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(precoViab)}/sc</div>
      </div>

      {/* Tabela de ganho */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 14 }}>
        <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Se vender acima do equilíbrio</div>
        <div style={{ color: "#8A7E6F", fontSize: 10, marginBottom: 12 }}>Quanto rende cada real acima do 0×0 ({volume.toLocaleString("pt-BR")} sacas)</div>

        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 1fr", gap: 0, fontSize: 12 }}>
          {["Acima", "Preço venda", "Ganho/sc", "Ganho total"].map(h => (
            <div key={h} style={{ padding: "6px 10px", color: "#A89C8A", fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #ECE7DD" }}>{h}</div>
          ))}
          {ganhoTable.map((g, i) => (
            <React.Fragment key={i}>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid #F2EEE6", color: i === 0 ? "#D5A246" : "#6B6052", fontWeight: i === 0 ? 600 : 400 }}>
                {i === 0 ? "0×0" : `+R$ ${i}`}
              </div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid #F2EEE6", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: i === 0 ? "#D5A246" : "#4A2C16" }}>
                R$ {fmt(g.precoVenda)}
              </div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid #F2EEE6", fontFamily: "'JetBrains Mono',monospace", color: i === 0 ? "#D5A246" : "#4E7C5A" }}>
                {i === 0 ? "—" : `+R$ ${fmt(g.ganhaSc)}`}
              </div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid #F2EEE6", fontFamily: "'JetBrains Mono',monospace", color: i === 0 ? "#D5A246" : "#4E7C5A" }}>
                {i === 0 ? "—" : `+R$ ${g.ganhaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Projeção: o mercado consegue pagar? */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 14 }}>
        <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>O mercado consegue pagar?</div>
        <div style={{ color: "#8A7E6F", fontSize: 10, marginBottom: 14 }}>Projeção de preço em {MESES[fut.mi]} {fut.yr} usando basis histórico 5 anos + Chicago ({cFutShort}) + câmbio projetado (R$ {fmt(cambioFut, 4)})</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { label: "Pior cenário", sub: `Basis mín: ${fmt(basisMinFut, 0)} c/bu`, valor: precoFutPior, viavel: piorViavel, color: "#B0503F" },
            { label: "Cenário médio", sub: `Basis médio: ${fmt(basisMedFut, 0)} c/bu`, valor: precoFutMedio, viavel: medioViavel, color: "#D5A246" },
            { label: "Melhor cenário", sub: `Basis máx: ${fmt(basisMaxFut, 0)} c/bu`, valor: precoFutMelhor, viavel: melhorViavel, color: "#4E7C5A" },
          ].map((c, i) => (
            <div key={i} style={{ background: `${c.viavel ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)"}`, border: `1px solid ${c.viavel ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ color: c.color, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>R$ {fmt(c.valor)}</div>
              <div style={{ color: "#8A7E6F", fontSize: 9, marginBottom: 6 }}>{c.sub}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.viavel ? "#4E7C5A" : "#B0503F" }} />
                <span style={{ color: c.viavel ? "#4E7C5A" : "#B0503F", fontSize: 10, fontWeight: 600 }}>
                  {c.viavel ? `Cobre o 0×0 (+R$ ${fmt(c.valor - precoViab)})` : `Não cobre (falta R$ ${fmt(precoViab - c.valor)})`}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Linha de referência visual */}
        <div style={{ position: "relative", height: 32, marginBottom: 6 }}>
          {(() => {
            const allVals = [precoFutPior, precoFutMedio, precoFutMelhor, precoViab];
            const mn = Math.min(...allVals) - 5;
            const mx = Math.max(...allVals) + 5;
            const rng = mx - mn || 1;
            const toPct = (v) => Math.max(2, Math.min(98, ((v - mn) / rng) * 100));
            return <>
              <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 8, background: "#F5F1EA", borderRadius: 4 }} />
              {/* 0x0 marker */}
              <div style={{ position: "absolute", left: `${toPct(precoViab)}%`, top: 4, transform: "translateX(-50%)", zIndex: 2 }}>
                <div style={{ background: "#D5A246", color: "#F7F7F5", fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" }}>0×0: {fmt(precoViab, 0)}</div>
                <div style={{ width: 2, height: 10, background: "#D5A246", margin: "1px auto 0", borderRadius: 1 }} />
              </div>
              {/* Scenario markers */}
              {[
                { v: precoFutPior, c: "#B0503F", l: "Pior" },
                { v: precoFutMedio, c: "#D5A246", l: "Médio" },
                { v: precoFutMelhor, c: "#4E7C5A", l: "Melhor" },
              ].map((s, i) => (
                <div key={i} style={{ position: "absolute", left: `${toPct(s.v)}%`, top: 26, transform: "translateX(-50%)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.c, margin: "0 auto" }} />
                </div>
              ))}
            </>;
          })()}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#C2B7A6", marginTop: 8 }}>
          <span>Pior: R$ {fmt(precoFutPior, 0)}</span>
          <span style={{ color: "#D5A246" }}>0×0: R$ {fmt(precoViab, 0)}</span>
          <span>Melhor: R$ {fmt(precoFutMelhor, 0)}</span>
        </div>
      </div>

      {/* Botão travar posição */}
      <div onClick={() => {
        setPosicoes(prev => [...prev, {
          id: Date.now(), praca: pLabel,
          dtEntrega, dtPagto, dtEntregaFut, dtPagtoFut,
          volume, precoEntrada: preco,
          // Salvar Chicago e câmbio do FUTURO (mesmo contrato que monitora)
          chicagoEntrada: chicagoFutCbu,
          cambioEntrada: cambioFut,
          custoTotal, precoViab,
          basisMinFut, basisMedFut, basisMaxFut,
          mesFutIdx: fut.mi, mesFutYr: fut.yr,
          cFutShort, dFutShort,
          // Preço teórico no momento da entrada (referência)
          ptEntradaMin: precoFutPior,
          ptEntradaMed: precoFutMedio,
          ptEntradaMax: precoFutMelhor,
          dataAbertura: new Date().toLocaleDateString("pt-BR"),
        }]);
        setSubTab("posicoes");
      }} style={{
        background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 10, padding: "14px 22px", marginTop: 14, cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.18)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(34,197,94,0.1)"}>
        <div>
          <div style={{ color: "#4E7C5A", fontSize: 13, fontWeight: 700 }}>Travar posição e acompanhar</div>
          <div style={{ color: "#4E7C5A", fontSize: 10, opacity: 0.7, marginTop: 2 }}>Salva os dados e permite acompanhar até a venda</div>
        </div>
        <div style={{ color: "#4E7C5A", fontSize: 20 }}>+</div>
      </div>
    </>
  );

  // ─── POSIÇÕES ───
  const renderPosicoes = () => (
    <div>
      {posicoes.length === 0 ? (
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "40px", textAlign: "center" }}>
          <div style={{ color: "#A89C8A", fontSize: 14 }}>Nenhuma posição travada</div>
          <div style={{ color: "#C2B7A6", fontSize: 11, marginTop: 4 }}>Use a calculadora, simule e clique "Travar posição"</div>
        </div>
      ) : posicoes.map(pos => {
        const rawC = buildSoja(pos.mesFutIdx, pos.mesFutYr);
        const cS = findClosest(rawC, allK, COTACOES); const cC = COTACOES[cS];
        const chiHj = cC ? cC.lp : pos.chicagoEntrada;
        const rawD = buildDol(pos.mesFutIdx, pos.mesFutYr);
        const dS = findClosest(rawD, dolKeys, COTACOES); const dC = COTACOES[dS];
        const camHj = dC ? dC.lp / 1000 : pos.cambioEntrada;

        // Preço teórico ATUAL
        const ptMinHj = (chiHj + pos.basisMinFut) * fator / 100 * camHj;
        const ptMedHj = (chiHj + pos.basisMedFut) * fator / 100 * camHj;
        const ptMaxHj = (chiHj + pos.basisMaxFut) * fator / 100 * camHj;

        // Variação vs ENTRADA (não vs 0×0)
        const varMin = ptMinHj - (pos.ptEntradaMin || ptMinHj);
        const varMed = ptMedHj - (pos.ptEntradaMed || ptMedHj);
        const varMax = ptMaxHj - (pos.ptEntradaMax || ptMaxHj);

        return (
          <div key={pos.id} style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "18px 22px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #ECE7DD" }}>
              <div>
                <span style={{ color: "#4A2C16", fontSize: 14, fontWeight: 700 }}>{pos.praca}</span>
                <span style={{ color: "#8A7E6F", fontSize: 10, marginLeft: 10 }}>Aberta {pos.dataAbertura} — {pos.volume.toLocaleString("pt-BR")} sc</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ background: "rgba(34,197,94,0.1)", borderRadius: 5, padding: "3px 10px", fontSize: 9, fontWeight: 600, color: "#4E7C5A" }}>Aberta</div>
                <div onClick={() => setPosicoes(prev => prev.filter(p => p.id !== pos.id))} style={{ color: "#C2B7A6", fontSize: 11, cursor: "pointer", padding: "3px 6px" }}>✕</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Dados travados */}
              <div>
                <div style={{ color: "#A89C8A", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dados travados</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {[
                    ["Preço entrada", `R$ ${fmt(pos.precoEntrada)}`],
                    ["0×0 (equilíbrio)", `R$ ${fmt(pos.precoViab)}`],
                    ["Chicago entrada", `${fmt(pos.chicagoEntrada, 0)} c/bu`],
                    ["Câmbio entrada", `R$ ${fmt(pos.cambioEntrada, 4)}`],
                    ["Custo carrego", `R$ ${fmt(pos.custoTotal)}/sc`],
                    ["Entrega futura", pos.dtEntregaFut],
                  ].map(([l, v], i) => (
                    <div key={i} style={{ background: "#F6F3ED", borderRadius: 5, padding: "6px 8px" }}>
                      <div style={{ color: "#C2B7A6", fontSize: 7 }}>{l}</div>
                      <div style={{ color: "#6B6052", fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mercado hoje */}
              <div>
                <div style={{ color: "#A89C8A", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Mercado hoje</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
                  {[
                    { l: `Chicago ${pos.cFutShort}`, v: `${fmt(chiHj, 0)} c/bu`, d: chiHj - pos.chicagoEntrada },
                    { l: `Câmbio ${pos.dFutShort}`, v: `R$ ${fmt(camHj, 4)}`, d: camHj - pos.cambioEntrada },
                  ].map((d, i) => (
                    <div key={i} style={{ background: "#F6F3ED", borderRadius: 5, padding: "6px 8px" }}>
                      <div style={{ color: "#C2B7A6", fontSize: 7 }}>{d.l}</div>
                      <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{d.v}</div>
                      <div style={{ color: d.d >= 0 ? "#4E7C5A" : "#B0503F", fontSize: 8 }}>{d.d >= 0 ? "▲" : "▼"} {d.d >= 0 ? "+" : ""}{fmt(d.d, i === 0 ? 0 : 4)} vs entrada</div>
                    </div>
                  ))}
                </div>

                {/* Preço teórico com variação vs entrada */}
                <div style={{ color: "#A89C8A", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Preço teórico {MESES[pos.mesFutIdx]} {pos.mesFutYr}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                  {[
                    { l: "Pior", v: ptMinHj, var: varMin, ent: pos.ptEntradaMin },
                    { l: "Médio", v: ptMedHj, var: varMed, ent: pos.ptEntradaMed },
                    { l: "Melhor", v: ptMaxHj, var: varMax, ent: pos.ptEntradaMax },
                  ].map((s, i) => (
                    <div key={i} style={{ background: "#F6F3ED", borderRadius: 5, padding: "6px 8px", border: "1px solid #F2EEE6" }}>
                      <div style={{ color: "#A89C8A", fontSize: 7 }}>{s.l}</div>
                      <div style={{ color: "#4A2C16", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(s.v)}</div>
                      <div style={{ color: s.var >= 0 ? "#4E7C5A" : "#B0503F", fontSize: 8, marginTop: 2 }}>
                        {s.var >= 0 ? "▲" : "▼"} {s.var >= 0 ? "+" : ""}{fmt(s.var)} vs entrada
                      </div>
                      <div style={{ color: "#C2B7A6", fontSize: 7, marginTop: 1 }}>Entrada: R$ {fmt(s.ent || s.v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 6, background: "#FAF7F1", border: "1px solid #F2EEE6" }}>
              <div style={{ color: "#C2B7A6", fontSize: 9, lineHeight: 1.5 }}>
                Preço teórico baseado em basis histórico 5 anos — referência para o produtor se direcionar sobre o preço justo. O risco da operação é por conta e escolha do produtor.
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Custo de carrego</span>
        {posicoes.length > 0 && <div style={{ background: "rgba(34,197,94,0.1)", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#4E7C5A" }}>{posicoes.length} aberta{posicoes.length > 1 ? "s" : ""}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ id: "calc", label: "Calculadora" }, { id: "posicoes", label: `Minhas posições (${posicoes.length})` }].map(t => (
          <div key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: subTab === t.id ? "rgba(230,57,70,0.1)" : "#F5F1EA",
            color: subTab === t.id ? "#D5A246" : "#8A7E6F",
            border: `1px solid ${subTab === t.id ? "rgba(230,57,70,0.3)" : "#ECE7DD"}`,
          }}>{t.label}</div>
        ))}
      </div>
      {subTab === "calc" ? renderCalc : renderPosicoes()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OFERTAS FIRMES PAGE
// ═══════════════════════════════════════════════════════════════

function OfertasFirmesPage({PRACAS, COTACOES, BASIS_DATA, DEFAULT_BASIS}) {
  const [nome, setNome] = useState("");
  const [fazenda, setFazenda] = useState("");
  const [mercadoOf, setMercadoOf] = useState("Soja Exportação");
  const [volUnit, setVolUnit] = useState("sacas");
  const [volQtd, setVolQtd] = useState(5000);
  const [pracaId, setPracaId] = useState(1);
  const _ofertasHyd = useRef(false);
  useEffect(()=>{ if(_ofertasHyd.current) return; if(!PRACAS||PRACAS.length===0) return; try{ const r=localStorage.getItem("bz_praca_ref"); if(r){const n=parseInt(r); if(PRACAS.some(p=>p.id===n)) setPracaId(n);} }catch(e){} _ofertasHyd.current=true; },[PRACAS]);
  useEffect(()=>{ if(_ofertasHyd.current&&pracaId!=null){ try{localStorage.setItem("bz_praca_ref",String(pracaId));}catch(e){} } },[pracaId]);
  const [entK, setEntK] = useState("4-2026");
  const [pagK, setPagK] = useState("5-2026");
  const [modalidade, setModalidade] = useState("FOB");
  const [funrural, setFunrural] = useState("descontado");
  const [coordenadas, setCoordenadas] = useState(""); // lat,lng or Google Maps link
  const [precoOferta, setPrecoOferta] = useState(0);
  const [moedaOferta, setMoedaOferta] = useState("BRL");
  const [historico, setHistorico] = useState([]);
  const [copied, setCopied] = useState(false);

  const [eMi, eYr] = entK.split("-").map(Number);
  const [pMi, pYr] = pagK.split("-").map(Number);

  const praca = PRACAS.find(p => p.id === pracaId);
  const pLabel = praca ? `${praca.cidade} - ${praca.estado}` : "";

  const byState = useMemo(() => {
    const g = {};
    PRACAS.forEach(p => {
      const bk = `${p.cidade}-${p.estado}-${mercadoOf}`;
      if (BASIS_DATA[bk]) { (g[p.estado] ||= []).push(p); }
    });
    return g;
  }, [PRACAS, mercadoOf, BASIS_DATA]);

  // Volume conversion
  const volSacas = volUnit === "sacas" ? volQtd : Math.round(volQtd * 16.6667);
  const volTon = volUnit === "toneladas" ? volQtd : (volQtd / 16.6667);

  // Preço Justo reference
  const allK = Object.keys(COTACOES);
  const dolKeys = allK.filter(k => k.includes("DOL"));
  const isSojaOf = mercadoOf === "Soja Exportação";
  const rawCS = isSojaOf ? buildSoja(eMi, eYr) : buildMilho(eMi, eYr);
  const csym = findClosest(rawCS, allK, COTACOES);
  const ccot = COTACOES[csym];
  const chi = ccot ? ccot.lp : (isSojaOf ? 1167 : 491);

  const rawDS = buildDol(pMi, pYr);
  const dsym = findClosest(rawDS, dolKeys, COTACOES);
  const dcot = COTACOES[dsym];
  const dol = dcot ? dcot.lp / 1000 : 5.008;

  const bKey = praca ? `${praca.cidade}-${praca.estado}-${mercadoOf}` : "";
  const bAll = BASIS_DATA[bKey] || DEFAULT_BASIS;
  const bM = bAll[eMi];

  const pMin = calc(chi, bM.basis_min, dol);
  const pJusto = calc(chi, bM.medio, dol);
  const pMax = calc(chi, bM.basis_max, dol);
  const pMinU = calcUSD(chi, bM.basis_min);
  const pJustoU = calcUSD(chi, bM.medio);
  const pMaxU = calcUSD(chi, bM.basis_max);

  function selectPreco(brl, usd) {
    setPrecoOferta(Math.round((moedaOferta === "BRL" ? brl : usd) * 100) / 100);
  }

  const cShortLabel = csym.replace("CBOT:", "");
  const chicagoRef = fmt(chi, 0);
  const dolarRef = fmt(dol, 4);

  function gerarTexto() {
    const coordLine = modalidade === "FOB" && coordenadas ? `\n*Localização (FOB):* ${coordenadas}` : "";
    const simbolo = moedaOferta === "BRL" ? "R$" : "US$";
    return `*OFERTA FIRME — ProSafra*
━━━━━━━━━━━━━━━━━━
*Cliente:* ${nome || "—"}
*Fazenda:* ${fazenda || "—"}
*Praça:* ${pLabel}
*Volume:* ${volSacas.toLocaleString("pt-BR")} sacas (${fmt(volTon, 1)} ton)
*Preço:* ${simbolo} ${fmt(precoOferta)}/saca
*Entrega:* ${MESES[eMi]} ${eYr}
*Pagamento:* ${MESES[pMi]} ${pYr}
*Modalidade:* ${modalidade}
*Funrural:* ${funrural === "descontado" ? "Descontado no preço" : "Por conta do comprador (em folha)"}${coordLine}
━━━━━━━━━━━━━━━━━━
_Oferta válida para o dia de hoje_
_Gerado via ProSafra_`;
  }

  function copiarOferta() {
    const texto = gerarTexto();
    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
    setHistorico(prev => [{
      id: Date.now(), nome, fazenda, praca: pLabel, mercado: mercadoOf,
      volume: volSacas, preco: precoOferta, moeda: moedaOferta,
      entrega: `${MESES[eMi]} ${eYr}`, pagamento: `${MESES[pMi]} ${pYr}`,
      modalidade, funrural, coordenadas: modalidade === "FOB" ? coordenadas : "",
      chicago: chi, dolar: dol,
      data: new Date().toLocaleDateString("pt-BR"),
    }, ...prev]);
  }

  function Inp2({ label, value, onChange, type = "text", placeholder, w }) {
    return (
      <div style={{ minWidth: w, flex: w ? undefined : 1 }}>
        <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>{label}</label>
        <input type={type} value={value} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)} placeholder={placeholder}
          style={{ background: "#F6F3ED", border: "1px solid #E4DECF", borderRadius: 7, color: "#4A2C16", padding: "9px 10px", fontSize: 13, fontFamily: type === "number" ? "'JetBrains Mono',monospace" : "'Outfit',sans-serif", outline: "none", width: "100%", boxSizing: "border-box" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Ofertas firmes</span>
        <span style={{ color: "#A89C8A", fontSize: 11 }}>Gere sua oferta e envie via WhatsApp</span>
      </div>

      {/* Mercado */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "14px 18px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <Sel label="Produto / Mercado" value={mercadoOf} onChange={setMercadoOf} w={200}>
          <option value="Soja Exportação">Soja Exportação</option>
          <option value="Milho Exportação">Milho Exportação</option>
          <option value="Milho Interno (B3)">Milho Interno (B3)</option>
        </Sel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Dados do produtor */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>Dados do produtor</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Inp2 label="Nome / Empresa" value={nome} onChange={setNome} placeholder="João Silva" />
            <Inp2 label="Fazenda" value={fazenda} onChange={setFazenda} placeholder="Fazenda Boa Vista" />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Volume</label>
              <div style={{ display: "flex" }}>
                <input type="number" value={volQtd} onChange={e => setVolQtd(parseFloat(e.target.value) || 0)}
                  style={{ background: "#F6F3ED", border: "1px solid #E4DECF", borderRadius: "7px 0 0 7px", color: "#4A2C16", padding: "9px 10px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: "none", width: 100 }} />
                {["sacas", "toneladas"].map(u => (
                  <div key={u} onClick={() => setVolUnit(u)} style={{
                    padding: "9px 10px", cursor: "pointer", fontSize: 10, fontWeight: 600,
                    background: volUnit === u ? "#B67A33" : "#EFE8DB", color: volUnit === u ? "#fff" : "#8A7E6F",
                    border: "1px solid #E4DECF", borderLeft: "none",
                    borderRadius: u === "toneladas" ? "0 7px 7px 0" : 0,
                  }}>{u === "sacas" ? "Sacas" : "Ton"}</div>
                ))}
              </div>
              <div style={{ color: "#C2B7A6", fontSize: 9, marginTop: 3 }}>
                = {volUnit === "sacas" ? `${fmt(volTon, 1)} ton` : `${volSacas.toLocaleString("pt-BR")} sacas`}
              </div>
            </div>
            <Sel label="Praça" value={pracaId} onChange={v => setPracaId(+v)} w={180} grow>
              {Object.entries(byState).sort().map(([st, cs]) => (
                <optgroup key={st} label={st}>
                  {cs.map(c => <option key={c.id} value={c.id}>{c.cidade} - {c.estado}</option>)}
                </optgroup>
              ))}
            </Sel>
          </div>
        </div>

        {/* Condições comerciais */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>Condições comerciais</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Sel label="Mês de entrega" value={entK} onChange={setEntK} w={150}>
              {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
            </Sel>
            <Sel label="Data de pagamento" value={pagK} onChange={setPagK} w={150}>
              {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
            </Sel>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div>
              <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Modalidade</label>
              <div style={{ display: "flex" }}>
                {["FOB", "CIF"].map(m => (
                  <div key={m} onClick={() => setModalidade(m)} style={{
                    padding: "9px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: modalidade === m ? "#B67A33" : "#EFE8DB", color: modalidade === m ? "#fff" : "#8A7E6F",
                    border: "1px solid #E4DECF",
                    borderRadius: m === "FOB" ? "7px 0 0 7px" : "0 7px 7px 0",
                  }}>{m}</div>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Funrural</label>
              <div style={{ display: "flex" }}>
                {[{ id: "descontado", l: "Descontado" }, { id: "folha", l: "Em folha" }].map(f => (
                  <div key={f.id} onClick={() => setFunrural(f.id)} style={{
                    padding: "9px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                    background: funrural === f.id ? "#B67A33" : "#EFE8DB", color: funrural === f.id ? "#fff" : "#8A7E6F",
                    border: "1px solid #E4DECF",
                    borderRadius: f.id === "descontado" ? "7px 0 0 7px" : "0 7px 7px 0",
                  }}>{f.l}</div>
                ))}
              </div>
            </div>
          </div>
          {/* Coordenadas FOB */}
          {modalidade === "FOB" && (
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Localização da fazenda (FOB)</label>
              <input value={coordenadas} onChange={e => setCoordenadas(e.target.value)} placeholder="Cole o link do Google Maps ou lat, lng"
                style={{ background: "#F6F3ED", border: "1px solid #E4DECF", borderRadius: 7, color: "#4A2C16", padding: "9px 10px", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
              <div style={{ color: "#C2B7A6", fontSize: 8, marginTop: 3 }}>Ex: -17.7969, -49.3197 ou link do Google Maps</div>
            </div>
          )}
        </div>
      </div>

      {/* Preço da oferta */}
      <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>
          Preço da oferta — {pLabel} — {MESES[eMi]} {eYr}
        </div>

        {/* Moeda primeiro */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#8A7E6F", fontSize: 9, marginBottom: 6 }}>Sua oferta será em:</div>
          <div style={{ display: "flex", gap: 0 }}>
            {["BRL", "USD"].map(m => (
              <div key={m} onClick={() => { setMoedaOferta(m); setPrecoOferta(0); }} style={{
                padding: "10px 24px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: moedaOferta === m ? "#B67A33" : "#EFE8DB",
                color: moedaOferta === m ? "#fff" : "#8A7E6F",
                border: "1px solid #E4DECF",
                borderRadius: m === "BRL" ? "8px 0 0 8px" : "0 8px 8px 0",
              }}>{m === "BRL" ? "R$ / saca" : "US$ / saca"}</div>
            ))}
          </div>
        </div>

        {/* Regiões na moeda selecionada */}
        <div style={{ color: "#8A7E6F", fontSize: 9, marginBottom: 8 }}>Clique em uma região para preencher, ou digite seu preço:</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { l: "Mínimo", brl: pMin, usd: pMinU, c: "#D5A246" },
            { l: "Justo", brl: pJusto, usd: pJustoU, c: "#4E7C5A" },
            { l: "Agressivo", brl: pMax, usd: pMaxU, c: "#4E7C5A" },
          ].map((r, i) => {
            const val = moedaOferta === "BRL" ? r.brl : r.usd;
            const isSelected = Math.abs(precoOferta - val) < 0.01 && precoOferta > 0;
            const simbolo = moedaOferta === "BRL" ? "R$" : "US$";
            return (
              <div key={i} onClick={() => setPrecoOferta(Math.round(val * 100) / 100)} style={{
                flex: 1, cursor: "pointer", borderRadius: 8, padding: "14px 16px",
                background: isSelected ? `${r.c}15` : "#F6F3ED",
                border: `1px solid ${isSelected ? `${r.c}44` : "#ECE7DD"}`,
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = `${r.c}33`; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = isSelected ? `${r.c}44` : "#ECE7DD"; }}>
                <div style={{ color: r.c, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{r.l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#4A2C16", fontFamily: "'JetBrains Mono',monospace" }}>{simbolo} {fmt(val)}</div>
                <div style={{ fontSize: 10, color: "#A89C8A", marginTop: 2 }}>por saca</div>
              </div>
            );
          })}
        </div>

        {/* Input de preço */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 9, color: "#8A7E6F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Preço da oferta ({moedaOferta === "BRL" ? "R$/sc" : "US$/sc"})</label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ background: "#EFE8DB", border: "1px solid #E4DECF", borderRight: "none", borderRadius: "7px 0 0 7px", padding: "10px 12px", color: "#8A7E6F", fontSize: 13 }}>
                {moedaOferta === "BRL" ? "R$" : "US$"}
              </span>
              <input type="number" step="0.01" value={precoOferta || ""} onChange={e => setPrecoOferta(parseFloat(e.target.value) || 0)}
                style={{ background: "#F6F3ED", border: "1px solid #E4DECF", borderRadius: "0 7px 7px 0", color: "#4E7C5A", padding: "10px 12px", fontSize: 22, fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, outline: "none", width: 140 }} />
              <span style={{ color: "#A89C8A", fontSize: 11, marginLeft: 6 }}>/saca</span>
            </div>
          </div>
          {precoOferta > 0 && (
            <div style={{ paddingBottom: 12 }}>
              <div style={{ color: "#C2B7A6", fontSize: 10 }}>
                Total: {moedaOferta === "BRL" ? "R$" : "US$"} {(precoOferta * volSacas).toLocaleString("pt-BR", { minimumFractionDigits: 0 })} ({volSacas.toLocaleString("pt-BR")} sc)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview + botão copiar — sempre visível quando tem preço */}
      {precoOferta > 0 && (
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>Preview da oferta</div>
          <div style={{ background: "#F6F3ED", borderRadius: 8, padding: "14px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#6B6052", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 12 }}>
            {gerarTexto()}
          </div>
          <div onClick={copiarOferta} style={{
            background: copied ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)",
            border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.3)"}`,
            borderRadius: 8, padding: "12px 20px", cursor: "pointer",
            display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
            transition: "all 0.2s",
          }}>
            <span style={{ color: "#4E7C5A", fontSize: 14, fontWeight: 700 }}>
              {copied ? "Copiado! Cole no WhatsApp" : "Copiar oferta para WhatsApp"}
            </span>
          </div>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ECE7DD" }}>
            <div style={{ color: "#8A7E6F", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Ofertas enviadas ({historico.length})
            </div>
            <div style={{ color: "#C2B7A6", fontSize: 9 }}>Cotações se atualizam diariamente</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historico.map(o => {
              const oParts = o.entrega.split(" ");
              const oMi = MESES.indexOf(oParts[0]);
              const oYr = parseInt(oParts[1]);
              const isSojaH = !o.mercado || o.mercado === "Soja Exportação";
              const rawOC = oMi >= 0 ? (isSojaH ? buildSoja(oMi, oYr) : buildMilho(oMi, oYr)) : null;
              const oCSym = rawOC ? findClosest(rawOC, allK, COTACOES) : null;
              const oCot = oCSym ? COTACOES[oCSym] : null;
              const chiHj = oCot ? oCot.lp : o.chicago;
              const rawOD = oMi >= 0 ? buildDol(oMi, oYr) : null;
              const oDSym = rawOD ? findClosest(rawOD, dolKeys, COTACOES) : null;
              const oDCot = oDSym ? COTACOES[oDSym] : null;
              const dolHj = oDCot ? oDCot.lp / 1000 : o.dolar;
              const simb = o.moeda === "USD" ? "US$" : "R$";

              return (
                <div key={o.id} style={{ background: "#F6F3ED", borderRadius: 8, padding: "14px 16px" }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #ECE7DD" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#4E7C5A", fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{simb} {fmt(o.preco)}/sc</span>
                      <span style={{ color: "#4A2C16", fontSize: 11, fontWeight: 500 }}>{o.fazenda || o.nome}</span>
                      {o.mercado && <span style={{ color: "#C2B7A6", fontSize: 9 }}>{o.mercado}</span>}
                    </div>
                    <span style={{ color: "#A89C8A", fontSize: 9 }}>{o.data}</span>
                  </div>
                  {/* Info */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: "#8A7E6F", marginBottom: 10 }}>
                    <span>{o.praca}</span>
                    <span>{o.volume.toLocaleString("pt-BR")} sc</span>
                    <span>Entrega: {o.entrega}</span>
                    <span>{o.modalidade}</span>
                    <span style={{ color: "#A89C8A", fontFamily: "'JetBrains Mono',monospace" }}>Chi: {fmt(chiHj, 0)} c/bu</span>
                    <span style={{ color: "#A89C8A", fontFamily: "'JetBrains Mono',monospace" }}>Dol: R$ {fmt(dolHj, 4)}</span>
                  </div>
                  {/* Buttons */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <div onClick={() => {
                      const txt = `*OFERTA FIRME — ProSafra*
━━━━━━━━━━━━━━━━━━
*Cliente:* ${o.nome || "—"}
*Fazenda:* ${o.fazenda || "—"}
*Praça:* ${o.praca}
*Volume:* ${o.volume.toLocaleString("pt-BR")} sacas
*Preço:* ${simb} ${fmt(o.preco)}/saca
*Entrega:* ${o.entrega}
*Pagamento:* ${o.pagamento}
*Modalidade:* ${o.modalidade}
━━━━━━━━━━━━━━━━━━
_Cotações atualizadas em ${new Date().toLocaleDateString("pt-BR")}_
_Gerado via ProSafra_`;
                      navigator.clipboard.writeText(txt);
                      setHistorico(prev => prev.map(p => p.id === o.id ? { ...p, chicago: chiHj, dolar: dolHj, data: new Date().toLocaleDateString("pt-BR") } : p));
                    }} style={{
                      background: "rgba(69,123,157,0.1)", border: "1px solid rgba(69,123,157,0.2)",
                      borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#B67A33",
                    }}>Atualizar cotações e copiar</div>
                    <div onClick={() => {
                      const txt = `*OFERTA FIRME — ProSafra*
━━━━━━━━━━━━━━━━━━
*Cliente:* ${o.nome || "—"}
*Fazenda:* ${o.fazenda || "—"}
*Praça:* ${o.praca}
*Volume:* ${o.volume.toLocaleString("pt-BR")} sacas
*Preço:* ${simb} ${fmt(o.preco)}/saca
*Entrega:* ${o.entrega}
*Pagamento:* ${o.pagamento}
*Modalidade:* ${o.modalidade}
━━━━━━━━━━━━━━━━━━
_Oferta reenviada_
_Gerado via ProSafra_`;
                      navigator.clipboard.writeText(txt);
                    }} style={{
                      background: "#F5F1EA", border: "1px solid #ECE7DD",
                      borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#8A7E6F",
                    }}>Reenviar original</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN PAGE
// ═══════════════════════════════════════════════════════════════

function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [tab, setTab] = useState("fundos");

  // Fundos state
  const [fDataRef, setFDataRef] = useState(new Date().toISOString().slice(0, 10));
  const [fSoja, setFSoja] = useState("");
  const [fMilho, setFMilho] = useState("");
  const [fHist, setFHist] = useState([]);
  const [fMsg, setFMsg] = useState("");
  const [fLoading, setFLoading] = useState(false);

  // Premios state
  const [pItems, setPItems] = useState([]);
  const [pDataRef, setPDataRef] = useState(new Date().toISOString().slice(0, 10));
  const [pNewMes, setPNewMes] = useState("4-2026");
  const [pNewContrato, setPNewContrato] = useState("");
  const [pNewPremio, setPNewPremio] = useState("");
  const [pNewVar, setPNewVar] = useState("");
  const [pMsg, setPMsg] = useState("");
  const [pLoading, setPLoading] = useState(false);
  const [pHist, setPHist] = useState([]);

  // Analise state
  const [aItems, setAItems] = useState([]);
  const [aSym, setASym] = useState("CBOT:ZSN2026");
  const [aLabel, setALabel] = useState("Soja Jul/26 (ZSN2026)");
  const [aProduto, setAProduto] = useState("Soja");
  const [aZ1, setAZ1] = useState("");
  const [aZ2, setAZ2] = useState("");
  const [aZ3, setAZ3] = useState("");
  const [aLeitura, setALeitura] = useState("");
  const [aMsg, setAMsg] = useState("");
  const [aLoading, setALoading] = useState(false);

  // Fundamentos state
  const [uProduto, setUProduto] = useState("soja");
  const [uData, setUData] = useState({
    safra_atual:"2025/26", safra_anterior:"2024/25",
    prod_mundo:"", consumo_mundo:"", export_mundo:"", estoque_mundo:"", rel_estoque_uso:"",
    prod_mundo_ant:"", consumo_mundo_ant:"", export_mundo_ant:"", estoque_mundo_ant:"", rel_estoque_uso_ant:"",
    brasil_prod:"", brasil_exp:"", brasil_prod_ant:"", brasil_exp_ant:"",
    eua_prod:"", eua_exp:"", eua_prod_ant:"", eua_exp_ant:"",
    argentina_prod:"", argentina_exp:"", argentina_prod_ant:"", argentina_exp_ant:"",
    china_consumo:"", china_import:"", china_consumo_ant:"", china_import_ant:"",
    leitura:"", leitura_date:"",
  });
  const [uMsg, setUMsg] = useState("");
  const [uLoading, setULoading] = useState(false);

  const doLogin = async () => {
    setAuthErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "auth_check" }),
      });
      const j = await res.json();
      if (j.success) { setAuthed(true); loadFundos(); loadPremios(); loadAnalise(); loadFundamentos(); }
      else setAuthErr(j.error || "Senha incorreta");
    } catch { setAuthErr("Erro de conexão"); }
  };

  const loadFundos = async () => {
    try {
      const res = await fetch("/api/admin?type=fundos");
      const j = await res.json();
      if (j.data) setFHist(j.data);
    } catch {}
  };

  const saveFundos = async () => {
    if (!fDataRef) { setFMsg("Informe a data"); return; }
    if (!fSoja && !fMilho) { setFMsg("Informe pelo menos soja ou milho"); return; }
    setFLoading(true); setFMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "fundos_upsert", data: { data_ref: fDataRef, soja: fSoja, milho: fMilho } }),
      });
      const j = await res.json();
      if (j.success) { setFMsg(`✓ Salvo! ${j.inserted} registro(s)`); setFSoja(""); setFMilho(""); loadFundos(); }
      else setFMsg(`Erro: ${j.error}`);
    } catch { setFMsg("Erro de conexão"); }
    setFLoading(false);
  };

  const deleteFundos = async (data_ref, produto) => {
    if (!confirm(`Deletar ${produto} de ${data_ref}?`)) return;
    try {
      await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "fundos_delete", data: { data_ref, produto } }) });
      loadFundos();
    } catch {}
  };

  // ─── Premios functions ───
  const loadPremios = async () => {
    try {
      const res = await fetch("/api/admin?type=premios");
      const j = await res.json();
      if (j.atual) setPItems(j.atual);
      if (j.historico) setPHist(j.historico);
    } catch {}
  };

  const addPremioItem = () => {
    const contrato = pNewContrato.trim();
    const premio = pNewPremio.toString().trim();
    if (!contrato || !premio) { setPMsg("Preencha contrato e prêmio"); return; }
    const [mi, yr] = pNewMes.split("-").map(Number);
    setPItems(prev => {
      const exists = prev.findIndex(p => p.mes_idx === mi && p.ano === yr);
      const item = { mes_idx: mi, ano: yr, contrato: pNewContrato, venda: parseFloat(pNewPremio), var_dia: parseFloat(pNewVar) || 0 };
      if (exists >= 0) { const n = [...prev]; n[exists] = item; return n; }
      return [...prev, item];
    });
    setPNewContrato(""); setPNewPremio(""); setPNewVar("");
  };

  const removePremioItem = async (mi, yr) => {
    if (!confirm(`Deletar prêmio ${MESES_SHORT[mi]}/${String(yr).slice(-2)}?`)) return;
    // Remove from local state
    setPItems(prev => prev.filter(p => !(p.mes_idx === mi && p.ano === yr)));
    // Delete from Supabase
    try {
      await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "premios_delete", data: { mes_idx: mi, ano: yr } }),
      });
    } catch {}
  };

  const savePremios = async () => {
    if (pItems.length === 0) { setPMsg("Adicione pelo menos 1 prêmio"); return; }
    setPLoading(true); setPMsg("");
    try {
      const items = pItems.map(p => ({ mes_idx: p.mes_idx, ano: p.ano, contrato: p.contrato, premio: p.venda, var_dia: p.var_dia || 0 }));
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "premios_upsert", data: { items, data_ref: pDataRef } }),
      });
      const j = await res.json();
      if (j.success) { setPMsg(`✓ ${j.inserted} prêmio(s) salvos + histórico gravado`); loadPremios(); }
      else setPMsg(`Erro: ${j.error}`);
    } catch { setPMsg("Erro de conexão"); }
    setPLoading(false);
  };

  // ─── Analise functions ───
  const loadAnalise = async () => {
    try {
      const res = await fetch("/api/admin?type=analise");
      const j = await res.json();
      if (j.data) setAItems(j.data);
    } catch {}
  };

  const editAnalise = (item) => {
    setASym(item.sym);
    setALabel(item.label);
    setAProduto(item.produto);
    setAZ1(String(item.zona1_valor));
    setAZ2(String(item.zona2_valor));
    setAZ3(String(item.zona3_valor));
    setALeitura(item.leitura || "");
  };

  const saveAnalise = async () => {
    if (!aSym || !aZ1 || !aZ2 || !aZ3) { setAMsg("Preencha contrato e as 3 zonas"); return; }
    setALoading(true); setAMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "analise_upsert", data: {
          sym: aSym, label: aLabel, produto: aProduto,
          zona1_valor: parseFloat(aZ1), zona2_valor: parseFloat(aZ2), zona3_valor: parseFloat(aZ3),
          leitura: aLeitura,
        }}),
      });
      const j = await res.json();
      if (j.success) { setAMsg("✓ Análise salva"); loadAnalise(); }
      else setAMsg(`Erro: ${j.error}`);
    } catch { setAMsg("Erro de conexão"); }
    setALoading(false);
  };

  const deleteAnalise = async (sym) => {
    if (!confirm(`Remover análise de ${sym}?`)) return;
    try {
      await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "analise_delete", data: { sym } }),
      });
      loadAnalise();
    } catch {}
  };

  // ─── Fundamentos functions ───
  const loadFundamentos = async () => {
    try {
      const res = await fetch("/api/admin?type=fundamentos");
      const j = await res.json();
      if (j.data) {
        const row = j.data.find(r => r.produto === uProduto);
        if (row) {
          const d = {};
          for (const k of Object.keys(uData)) { d[k] = row[k] !== null && row[k] !== undefined ? String(row[k]) : ""; }
          setUData(d);
        }
      }
    } catch {}
  };

  const saveFundamentos = async () => {
    setULoading(true); setUMsg("");
    try {
      const numFields = ["prod_mundo","consumo_mundo","export_mundo","estoque_mundo","rel_estoque_uso",
        "prod_mundo_ant","consumo_mundo_ant","export_mundo_ant","estoque_mundo_ant","rel_estoque_uso_ant",
        "brasil_prod","brasil_exp","brasil_prod_ant","brasil_exp_ant",
        "eua_prod","eua_exp","eua_prod_ant","eua_exp_ant",
        "argentina_prod","argentina_exp","argentina_prod_ant","argentina_exp_ant",
        "china_consumo","china_import","china_consumo_ant","china_import_ant"];
      const payload = { produto: uProduto };
      for (const [k, v] of Object.entries(uData)) {
        payload[k] = numFields.includes(k) ? (v ? parseFloat(v) : null) : v;
      }
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, action: "fundamentos_upsert", data: payload }),
      });
      const j = await res.json();
      if (j.success) setUMsg("✓ Fundamentos salvos");
      else setUMsg(`Erro: ${j.error}`);
    } catch { setUMsg("Erro de conexão"); }
    setULoading(false);
  };

  const inputStyle = { background: "#FFFFFF", border: "1px solid #DED8CC", borderRadius: 6, padding: "8px 12px", color: "#4A2C16", fontSize: 13, outline: "none", width: "100%" };
  const btnStyle = { background: "#D5A246", border: "none", borderRadius: 7, padding: "10px 24px", color: "#4A2C16", fontSize: 13, fontWeight: 600, cursor: "pointer" };

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 28px" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>⚙ Admin ProSafra</div>
          <div style={{ color: "#8A7E6F", fontSize: 12, marginBottom: 24 }}>Digite a senha para acessar o painel</div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} placeholder="Senha" style={{ ...inputStyle, marginBottom: 14 }} />
          {authErr && <div style={{ color: "#B0503F", fontSize: 12, marginBottom: 10 }}>{authErr}</div>}
          <button onClick={doLogin} style={btnStyle}>Entrar</button>
        </div>
      </div>
    );
  }

  // Group fundos by date
  const fundosByDate = {};
  fHist.forEach(r => { if (!fundosByDate[r.data_ref]) fundosByDate[r.data_ref] = {}; fundosByDate[r.data_ref][r.produto] = r.posicao_net; });
  const fundosDates = Object.keys(fundosByDate).sort().reverse();

  // Sort premios
  const pSorted = [...pItems].sort((a, b) => (a.ano * 12 + a.mes_idx) - (b.ano * 12 + b.mes_idx));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 28px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{ width: 3, height: 18, background: "#D5A246", borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Painel Admin</span>
        <span style={{ color: "#A89C8A", fontSize: 11 }}>Atualizar dados manualmente</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {[{ id: "fundos", label: "Posição Fundos" }, { id: "premios", label: "Prêmios Porto" }, { id: "analise", label: "Análise Técnica" }, { id: "usda", label: "Fundamentos USDA" }].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: tab === t.id ? "rgba(230,57,70,0.1)" : "#F5F1EA",
            color: tab === t.id ? "#D5A246" : "#8A7E6F",
            border: `1px solid ${tab === t.id ? "rgba(230,57,70,0.3)" : "#ECE7DD"}`,
          }}>{t.label}</div>
        ))}
      </div>

      {/* ═══ FUNDOS TAB ═══ */}
      {tab === "fundos" && (
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Lançar posição dos fundos</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Data (CFTC)</label>
                <input type="date" value={fDataRef} onChange={e => setFDataRef(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Soja Net (contratos)</label>
                <input type="number" value={fSoja} onChange={e => setFSoja(e.target.value)} placeholder="ex: 187573" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Milho Net (contratos)</label>
                <input type="number" value={fMilho} onChange={e => setFMilho(e.target.value)} placeholder="ex: 182213" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={saveFundos} disabled={fLoading} style={{ ...btnStyle, opacity: fLoading ? 0.6 : 1 }}>{fLoading ? "Salvando..." : "Salvar"}</button>
              {fMsg && <span style={{ fontSize: 12, color: fMsg.startsWith("✓") ? "#4E7C5A" : "#B0503F" }}>{fMsg}</span>}
            </div>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Histórico ({fundosDates.length} datas)</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: "1px solid #E4DECF" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Data</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Soja Net</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Milho Net</th>
                <th style={{ textAlign: "center", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Ações</th>
              </tr></thead>
              <tbody>
                {fundosDates.map(dt => { const row = fundosByDate[dt]; return (
                  <tr key={dt} style={{ borderBottom: "1px solid #F2EEE6" }}>
                    <td style={{ padding: "8px 12px", color: "#6B6052" }}>{dt.split("-").reverse().join("/")}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: row.soja >= 0 ? "#4E7C5A" : "#B0503F" }}>{row.soja !== undefined ? row.soja.toLocaleString("pt-BR") : "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: row.milho >= 0 ? "#4E7C5A" : "#B0503F" }}>{row.milho !== undefined ? row.milho.toLocaleString("pt-BR") : "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      {row.soja !== undefined && <span onClick={() => deleteFundos(dt, "soja")} style={{ color: "#B0503F", cursor: "pointer", fontSize: 10, marginRight: 8 }}>✕ soja</span>}
                      {row.milho !== undefined && <span onClick={() => deleteFundos(dt, "milho")} style={{ color: "#B0503F", cursor: "pointer", fontSize: 10 }}>✕ milho</span>}
                    </td>
                  </tr>
                ); })}
                {fundosDates.length === 0 && <tr><td colSpan={4} style={{ padding: "20px 12px", textAlign: "center", color: "#A89C8A" }}>Nenhum registro.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ PRÊMIOS TAB ═══ */}
      {tab === "premios" && (
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Lançar prêmios — Soja Paranaguá</div>
            <div style={{ color: "#8A7E6F", fontSize: 11, marginBottom: 16 }}>Adicione cada mês de embarque, depois clique "Salvar todos"</div>

            {/* Date ref */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Data de referência</label>
              <input type="date" value={pDataRef} onChange={e => setPDataRef(e.target.value)} style={{ ...inputStyle, width: 180 }} />
            </div>

            {/* Add row */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Mês embarque</label>
                <select value={pNewMes} onChange={e => setPNewMes(e.target.value)} style={{ ...inputStyle, width: 140 }}>
                  {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Contrato ref.</label>
                <input value={pNewContrato} onChange={e => setPNewContrato(e.target.value)} placeholder="SK6" style={{ ...inputStyle, width: 70 }} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Prêmio (c/bu)</label>
                <input type="number" value={pNewPremio} onChange={e => setPNewPremio(e.target.value)} placeholder="45.0" style={{ ...inputStyle, width: 90, fontFamily: "'JetBrains Mono',monospace" }} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Var. dia</label>
                <input type="number" value={pNewVar} onChange={e => setPNewVar(e.target.value)} placeholder="0.0" style={{ ...inputStyle, width: 70, fontFamily: "'JetBrains Mono',monospace" }} />
              </div>
              <button type="button" onClick={addPremioItem} style={{
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 7,
                padding: "9px 16px", cursor: "pointer", color: "#4E7C5A", fontSize: 12, fontWeight: 600,
              }}>+ Adicionar</button>
            </div>

            {/* Current items table */}
            {pSorted.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "130px 70px 100px 70px 40px", gap: 0, fontSize: 11 }}>
                  {["Embarque", "Contrato", "Prêmio (c/bu)", "Var.", ""].map(h => (
                    <div key={h} style={{ padding: "6px 8px", color: "#A89C8A", fontWeight: 600, textTransform: "uppercase", fontSize: 9, letterSpacing: "0.06em", borderBottom: "1px solid #ECE7DD" }}>{h}</div>
                  ))}
                  {pSorted.map(p => (
                    <React.Fragment key={`${p.mes_idx}-${p.ano}`}>
                      <div style={{ padding: "8px 8px", color: "#6B6052", borderBottom: "1px solid #F2EEE6" }}>{MESES_SHORT[p.mes_idx]}/{String(p.ano).slice(-2)}</div>
                      <div style={{ padding: "8px 8px", color: "#8A7E6F", borderBottom: "1px solid #F2EEE6", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{p.contrato}</div>
                      <div style={{ padding: "8px 8px", color: p.venda >= 0 ? "#4E7C5A" : "#B0503F", borderBottom: "1px solid #F2EEE6", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>{p.venda > 0 ? "+" : ""}{p.venda}</div>
                      <div style={{ padding: "8px 8px", color: "#8A7E6F", borderBottom: "1px solid #F2EEE6", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{p.var_dia || 0}</div>
                      <div onClick={() => removePremioItem(p.mes_idx, p.ano)} style={{ padding: "8px 4px", borderBottom: "1px solid #F2EEE6", color: "#B0503F", cursor: "pointer", textAlign: "center", fontSize: 13 }}>✕</div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={savePremios} disabled={pLoading || pSorted.length === 0} style={{ ...btnStyle, opacity: pLoading || pSorted.length === 0 ? 0.6 : 1 }}>
                {pLoading ? "Salvando..." : `Salvar todos (${pSorted.length})`}
              </button>
              {pMsg && <span style={{ fontSize: 12, color: pMsg.startsWith("✓") ? "#4E7C5A" : "#B0503F" }}>{pMsg}</span>}
            </div>
          </div>

          {/* Histórico de lançamentos */}
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Histórico de lançamentos ({pHist.length} registros)</div>
            {pHist.length > 0 ? (
              <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E4DECF", position: "sticky", top: 0, background: "#FFFFFF" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Data ref.</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Embarque</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Prêmio (c/bu)</th>
                      <th style={{ textAlign: "center", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Excluir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...pHist].reverse().map((h, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F2EEE6" }}>
                        <td style={{ padding: "6px 12px", color: "#6B6052" }}>{h.data_ref?.split("-").reverse().join("/")}</td>
                        <td style={{ padding: "6px 12px", color: "#6B6052" }}>{MESES_SHORT[h.mes_idx]}/{String(h.ano).slice(-2)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: h.premio >= 0 ? "#4E7C5A" : "#B0503F", fontWeight: 600 }}>
                          {h.premio > 0 ? "+" : ""}{h.premio}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                          <span onClick={async () => {
                            if (!confirm(`Excluir ${MESES_SHORT[h.mes_idx]}/${String(h.ano).slice(-2)} de ${h.data_ref?.split("-").reverse().join("/")}?`)) return;
                            try {
                              await fetch("/api/admin", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ password: pw, action: "premios_hist_delete", data: { data_ref: h.data_ref, mes_idx: h.mes_idx, ano: h.ano } }),
                              });
                              loadPremios();
                            } catch {}
                          }} style={{ color: "#B0503F", cursor: "pointer", fontSize: 11 }}>✕</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "#A89C8A", fontSize: 11 }}>Nenhum histórico ainda. Lance prêmios acima e clique "Salvar todos".</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ANÁLISE TÉCNICA TAB ═══ */}
      {tab === "analise" && (
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Publicar análise técnica</div>
            <div style={{ color: "#8A7E6F", fontSize: 11, marginBottom: 16 }}>Defina o contrato, as 3 zonas de preço e a leitura do mercado</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Contrato (símbolo)</label>
                <input value={aSym} onChange={e => setASym(e.target.value)} placeholder="CBOT:ZSN2026" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Nome para exibição</label>
                <input value={aLabel} onChange={e => setALabel(e.target.value)} placeholder="Soja Jul/26 (ZSN2026)" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Produto</label>
                <select value={aProduto} onChange={e => setAProduto(e.target.value)} style={inputStyle}>
                  <option value="Soja">Soja</option>
                  <option value="Milho">Milho</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ color: "#2F6A45", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Zona 1 — Intensificar (c/bu)</label>
                <input type="number" value={aZ1} onChange={e => setAZ1(e.target.value)} placeholder="1255" style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }} />
              </div>
              <div>
                <label style={{ color: "#4E7C5A", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Zona 2 — Buscar negócios (c/bu)</label>
                <input type="number" value={aZ2} onChange={e => setAZ2(e.target.value)} placeholder="1192" style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }} />
              </div>
              <div>
                <label style={{ color: "#D5A246", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Zona 3 — Segurar (c/bu)</label>
                <input type="number" value={aZ3} onChange={e => setAZ3(e.target.value)} placeholder="1162" style={{ ...inputStyle, fontFamily: "'JetBrains Mono',monospace" }} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Leitura do mercado</label>
              <textarea value={aLeitura} onChange={e => setALeitura(e.target.value)} placeholder="Seguimos em tendência de alta..." rows={3}
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={saveAnalise} disabled={aLoading} style={{ ...btnStyle, opacity: aLoading ? 0.6 : 1 }}>
                {aLoading ? "Salvando..." : "Salvar análise"}
              </button>
              {aMsg && <span style={{ fontSize: 12, color: aMsg.startsWith("✓") ? "#4E7C5A" : "#B0503F" }}>{aMsg}</span>}
            </div>
          </div>

          {/* Análises publicadas */}
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Análises publicadas ({aItems.length})</div>
            {aItems.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E4DECF" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Contrato</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#2F6A45", fontWeight: 500 }}>Intensificar</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#4E7C5A", fontWeight: 500 }}>Buscar</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "#D5A246", fontWeight: 500 }}>Segurar</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "#8A7E6F", fontWeight: 500 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {aItems.map(a => (
                    <tr key={a.sym} style={{ borderBottom: "1px solid #F2EEE6" }}>
                      <td style={{ padding: "8px 12px", color: "#6B6052" }}>{a.label}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#2F6A45" }}>{a.zona1_valor}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#4E7C5A" }}>{a.zona2_valor}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#D5A246" }}>{a.zona3_valor}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <span onClick={() => editAnalise(a)} style={{ color: "#B67A33", cursor: "pointer", fontSize: 10, marginRight: 10 }}>✎ editar</span>
                        <span onClick={() => deleteAnalise(a.sym)} style={{ color: "#B0503F", cursor: "pointer", fontSize: 10 }}>✕ excluir</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: "#A89C8A", fontSize: 11 }}>Nenhuma análise publicada. Preencha acima e clique "Salvar análise".</div>
            )}
          </div>
        </div>
      )}
      {/* ═══ FUNDAMENTOS USDA TAB ═══ */}
      {tab === "usda" && (
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE7DD", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Fundamentos USDA/WASDE</div>
                <div style={{ color: "#8A7E6F", fontSize: 11 }}>Preencha os números do último relatório (milhões de toneladas)</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["soja","milho"].map(p => (
                  <div key={p} onClick={() => { setUProduto(p); setTimeout(loadFundamentos, 100); }} style={{
                    padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: uProduto === p ? "rgba(230,57,70,0.1)" : "#F5F1EA",
                    color: uProduto === p ? "#D5A246" : "#8A7E6F",
                    border: `1px solid ${uProduto === p ? "rgba(230,57,70,0.3)" : "#ECE7DD"}`,
                    textTransform: "capitalize",
                  }}>{p}</div>
                ))}
              </div>
            </div>

            {/* Safras */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Safra atual</label>
                <input value={uData.safra_atual} onChange={e => setUData(d => ({...d, safra_atual: e.target.value}))} placeholder="2025/26" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Safra anterior</label>
                <input value={uData.safra_anterior} onChange={e => setUData(d => ({...d, safra_anterior: e.target.value}))} placeholder="2024/25" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Data do relatório</label>
                <input value={uData.leitura_date} onChange={e => setUData(d => ({...d, leitura_date: e.target.value}))} placeholder="Jun/2026" style={inputStyle} />
              </div>
            </div>

            {/* MUNDO */}
            <div style={{ color: "#D5A246", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Mundo</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 }}>
              {[["prod_mundo","Produção"],["consumo_mundo","Consumo"],["export_mundo","Exportação"],["estoque_mundo","Est. Final"],["rel_estoque_uso","Est/Uso %"]].map(([k,l]) => (
                <div key={k}>
                  <label style={{ color: "#4E7C5A", fontSize: 9, display: "block", marginBottom: 2 }}>{l} (atual)</label>
                  <input type="number" value={uData[k]} onChange={e => setUData(d => ({...d, [k]: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
                </div>
              ))}
              {[["prod_mundo_ant","Produção"],["consumo_mundo_ant","Consumo"],["export_mundo_ant","Exportação"],["estoque_mundo_ant","Est. Final"],["rel_estoque_uso_ant","Est/Uso %"]].map(([k,l]) => (
                <div key={k}>
                  <label style={{ color: "#8A7E6F", fontSize: 9, display: "block", marginBottom: 2 }}>{l} (ant.)</label>
                  <input type="number" value={uData[k]} onChange={e => setUData(d => ({...d, [k]: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
                </div>
              ))}
            </div>

            {/* PAÍSES */}
            <div style={{ color: "#D5A246", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Principais países</div>
            <div style={{ display: "grid", gridTemplateColumns: "80px repeat(4,1fr)", gap: 8, marginBottom: 4, fontSize: 9, color: "#A89C8A" }}>
              <div></div><div>Prod. atual</div><div>Prod. ant.</div><div>Exp. atual</div><div>Exp. ant.</div>
            </div>
            {[["brasil","Brasil"],["eua","EUA"],["argentina","Argentina"]].map(([k,l]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "80px repeat(4,1fr)", gap: 8, marginBottom: 6 }}>
                <div style={{ color: "#6B6052", fontSize: 11, paddingTop: 6 }}>{l}</div>
                <input type="number" value={uData[`${k}_prod`]} onChange={e => setUData(d => ({...d, [`${k}_prod`]: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
                <input type="number" value={uData[`${k}_prod_ant`]} onChange={e => setUData(d => ({...d, [`${k}_prod_ant`]: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
                <input type="number" value={uData[`${k}_exp`]} onChange={e => setUData(d => ({...d, [`${k}_exp`]: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
                <input type="number" value={uData[`${k}_exp_ant`]} onChange={e => setUData(d => ({...d, [`${k}_exp_ant`]: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "80px repeat(4,1fr)", gap: 8, marginBottom: 16, fontSize: 9, color: "#A89C8A" }}>
              <div></div><div>Consumo atual</div><div>Consumo ant.</div><div>Import. atual</div><div>Import. ant.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "80px repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
              <div style={{ color: "#6B6052", fontSize: 11, paddingTop: 6 }}>China</div>
              <input type="number" value={uData.china_consumo} onChange={e => setUData(d => ({...d, china_consumo: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
              <input type="number" value={uData.china_consumo_ant} onChange={e => setUData(d => ({...d, china_consumo_ant: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
              <input type="number" value={uData.china_import} onChange={e => setUData(d => ({...d, china_import: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
              <input type="number" value={uData.china_import_ant} onChange={e => setUData(d => ({...d, china_import_ant: e.target.value}))} style={{ ...inputStyle, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: "6px 8px" }} />
            </div>

            {/* Leitura */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: "#8A7E6F", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Leitura do relatório</label>
              <textarea value={uData.leitura} onChange={e => setUData(d => ({...d, leitura: e.target.value}))} placeholder="O relatório indica..." rows={3}
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={saveFundamentos} disabled={uLoading} style={{ ...btnStyle, opacity: uLoading ? 0.6 : 1 }}>
                {uLoading ? "Salvando..." : `Salvar ${uProduto}`}
              </button>
              {uMsg && <span style={{ fontSize: 12, color: uMsg.startsWith("✓") ? "#4E7C5A" : "#B0503F" }}>{uMsg}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ANÁLISE DE RESULTADO (RECEITA BRUTA POR CENÁRIO)
// ═══════════════════════════════════════════════════════════════

function bzHexLerp(a,b,t){
  const p=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const A=p(a),B=p(b);
  return "#"+[0,1,2].map(i=>("0"+Math.round(A[i]+(B[i]-A[i])*t).toString(16)).slice(-2)).join("");
}
function bzCellColor(res){
  if(res>=0){const t=Math.min(res/6000,1);return{bg:bzHexLerp("#EEF4EF","#A9CBB0",t),fg:"#2F6A45"};}
  const t=Math.min(-res/6000,1);return{bg:bzHexLerp("#F7ECEA","#E2B8AE",t),fg:"#8A3D31"};
}
const RES_PRECOS=(()=>{const a=[];for(let p=85;p<=150;p+=5)a.push(p);return a;})();
const RES_PRODS=(()=>{const a=[];for(let q=50;q<=130;q+=10)a.push(q);return a;})();
const nearestVal=(arr,v)=>arr.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);

function ResultadoPage({PRACAS, COTACOES, BASIS_DATA, DEFAULT_BASIS}) {
  const mercado="Soja Exportação";
  const [custo,setCusto]=useState(5500);
  const [prod,setProd]=useState(60);
  const [pracaId,setPracaId]=useState(null);
  const [cenario,setCenario]=useState("disp");

  useEffect(()=>{try{
    const c=localStorage.getItem("bz_custo"); if(c) setCusto(parseFloat(c));
    const q=localStorage.getItem("bz_prod"); if(q) setProd(parseFloat(q));
    const r=localStorage.getItem("bz_praca_ref"); if(r) setPracaId(parseInt(r));
  }catch(e){}},[]);
  useEffect(()=>{try{localStorage.setItem("bz_custo",String(custo));}catch(e){}},[custo]);
  useEffect(()=>{try{localStorage.setItem("bz_prod",String(prod));}catch(e){}},[prod]);
  useEffect(()=>{if(pracaId!=null){try{localStorage.setItem("bz_praca_ref",String(pracaId));}catch(e){}}},[pracaId]);

  const byState=useMemo(()=>{
    const g={};
    PRACAS.forEach(p=>{const bk=`${p.cidade}-${p.estado}-${mercado}`; if(BASIS_DATA[bk]){(g[p.estado]||=[]).push(p);}});
    return g;
  },[PRACAS,BASIS_DATA]);
  const availPracas=useMemo(()=>Object.values(byState).flat(),[byState]);
  const effId=availPracas.some(p=>p.id===pracaId)?pracaId:(availPracas[0]?.id);
  const praca=PRACAS.find(p=>p.id===effId);
  const pLabel=praca?`${praca.cidade} - ${praca.estado}`:"—";
  const bKey=praca?`${praca.cidade}-${praca.estado}-${mercado}`:"";
  const bAll=BASIS_DATA[bKey]||DEFAULT_BASIS;

  const allK=Object.keys(COTACOES);
  const dolKeys=allK.filter(k=>k.includes("DOL"));
  function precoJusto(eMi,eYr,pMi,pYr){
    const bM=bAll[eMi]||{medio:-100};
    const csym=findClosest(buildSoja(eMi,eYr),allK,COTACOES);
    const chi=COTACOES[csym]?COTACOES[csym].lp:1150;
    const dsym=findClosest(buildDol(pMi,pYr),dolKeys,COTACOES);
    const dol=COTACOES[dsym]?COTACOES[dsym].lp/1000:5.05;
    return calc(chi,bM.medio,dol);
  }
  const now=new Date();
  const pag30=new Date(now); pag30.setDate(pag30.getDate()+30);
  const pjDisp=precoJusto(now.getMonth(),now.getFullYear(),pag30.getMonth(),pag30.getFullYear());
  const pjFut=precoJusto(2,2027,3,2027);
  const pj=cenario==="disp"?pjDisp:pjFut;

  const custoN=parseFloat(custo)||0;
  const prodN=parseFloat(prod)||0;
  const recJusto=prodN*pj;
  const resJusto=recJusto-custoN;
  const be=prodN?custoN/prodN:0;
  const rowSel=nearestVal(RES_PRODS,prodN);
  const colSel=nearestVal(RES_PRECOS,pj);
  const fmtBR=n=>Math.round(n).toLocaleString("pt-BR");
  const inpStyle={display:"flex",alignItems:"center",background:"#F6F3ED",border:`1px solid #E4DECF`,borderRadius:7,padding:"0 9px"};
  const inpField={background:"transparent",border:"none",color:BZ.brownDeep,padding:"9px 4px",fontSize:14,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",outline:"none"};

  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12,marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:3,height:18,background:BZ.gold,borderRadius:2}}/>
          <span style={{fontSize:15,fontWeight:700,color:BZ.brownDeep}}>Análise de resultado</span>
          <span style={{color:BZ.textMute,fontSize:11}}>Receita bruta por cenário — Soja</span>
        </div>
        <div style={{display:"flex",gap:5,background:BZ.surfaceAlt,border:`1px solid ${BZ.border}`,borderRadius:8,padding:3}}>
          {[["disp","Disponível"],["fut","Futuro Mar/27"]].map(([k,l])=>(
            <div key={k} onClick={()=>setCenario(k)} style={{padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,
              background:cenario===k?BZ.goldSoft:"transparent",color:cenario===k?BZ.brown:BZ.textMute}}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:16,alignItems:"flex-end"}}>
        <Sel label="Praça de referência" value={effId} onChange={v=>setPracaId(+v)} w={220} grow>
          {Object.entries(byState).sort().map(([st,cs])=><optgroup key={st} label={st}>{cs.map(c=><option key={c.id} value={c.id}>{c.cidade} - {c.estado}</option>)}</optgroup>)}
        </Sel>
        <div>
          <label style={{fontSize:9,color:BZ.textMute,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:3}}>Custo / hectare</label>
          <div style={inpStyle}><span style={{fontSize:12,color:BZ.textFaint}}>R$</span><input type="number" value={custo} onChange={e=>setCusto(e.target.value)} style={{...inpField,width:90}}/></div>
        </div>
        <div>
          <label style={{fontSize:9,color:BZ.textMute,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:3}}>Produtividade</label>
          <div style={inpStyle}><input type="number" value={prod} onChange={e=>setProd(e.target.value)} style={{...inpField,width:54}}/><span style={{fontSize:11,color:BZ.textFaint}}>sc/ha</span></div>
        </div>
      </div>

      <div style={{background:BZ.surface,border:`1px solid ${BZ.border}`,borderRadius:12,padding:"14px 18px",marginBottom:14,display:"flex",flexWrap:"wrap",gap:"12px 24px",alignItems:"center"}}>
        <div>
          <div style={{fontSize:9,color:BZ.textFaint,textTransform:"uppercase",letterSpacing:"0.05em"}}>No preço justo {cenario==="disp"?"disponível":"futuro"} (R$ {fmt(pj)}/sc) · {pLabel}</div>
          <div style={{fontSize:13,color:BZ.brownDeep,marginTop:3}}>Receita bruta <b style={{fontWeight:600}}>R$ {fmtBR(recJusto)}/ha</b> · Resultado bruto <b style={{fontWeight:600,color:resJusto>=0?"#2F6A45":"#8A3D31"}}>{resJusto>=0?"+":""}R$ {fmtBR(resJusto)}/ha</b></div>
        </div>
        <div style={{borderLeft:`1px solid ${BZ.border}`,paddingLeft:20}}>
          <div style={{fontSize:9,color:BZ.textFaint,textTransform:"uppercase",letterSpacing:"0.05em"}}>Ponto de equilíbrio</div>
          <div style={{fontSize:18,fontWeight:700,color:BZ.brown,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>R$ {fmt(be)}<span style={{fontSize:11,fontWeight:400,color:BZ.textFaint}}>/saca</span></div>
        </div>
      </div>

      <div style={{display:"flex",gap:16,marginBottom:9,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:BZ.textMute}}><span style={{width:10,height:10,borderRadius:2,background:"#A9CBB0"}}/>Lucro bruto</span>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:BZ.textMute}}><span style={{width:10,height:10,borderRadius:2,background:"#E2B8AE"}}/>Prejuízo</span>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:BZ.textMute}}><span style={{width:10,height:10,borderRadius:2,border:`2px solid ${BZ.gold}`}}/>Você hoje</span>
        <span style={{fontSize:9,color:BZ.textFaint,marginLeft:"auto"}}>Receita bruta = produtividade × preço. Não inclui impostos nem frete.</span>
      </div>

      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"separate",borderSpacing:3,minWidth:1080}}>
          <tbody>
            <tr>
              <th style={{textAlign:"left",fontSize:9,color:BZ.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600,padding:"4px 8px"}}>Prod. / Preço</th>
              {RES_PRECOS.map(p=><th key={p} style={{fontSize:10,color:p===colSel?BZ.brown:BZ.textMute,fontWeight:600,padding:"4px 6px",fontFamily:"'JetBrains Mono',monospace"}}>R$ {p}</th>)}
            </tr>
            {RES_PRODS.map(pr=>(
              <tr key={pr}>
                <td style={{fontSize:10,color:pr===rowSel?BZ.brown:BZ.textMute,fontWeight:600,padding:"4px 8px",whiteSpace:"nowrap"}}>{pr} sc</td>
                {RES_PRECOS.map(pc=>{
                  const rec=pr*pc, res=rec-custoN, c=bzCellColor(res), me=(pr===rowSel&&pc===colSel);
                  return <td key={pc} style={{background:c.bg,borderRadius:7,padding:"7px 4px",textAlign:"center",boxShadow:me?`0 0 0 2px ${BZ.gold}`:"none"}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#3A2E22",fontFamily:"'JetBrains Mono',monospace"}}>R$ {fmtBR(rec)}</div>
                    <div style={{fontSize:9,color:c.fg,fontFamily:"'JetBrains Mono',monospace"}}>{res>=0?"+":""}{fmtBR(res)}</div>
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProSafraApp() {
  const [page,setPage]=useState("dashboard");
  const [sbOpen,setSbOpen]=useState(true);
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check();window.addEventListener("resize",check);return()=>window.removeEventListener("resize",check);
  },[]);
  useEffect(()=>{setSbOpen(!isMobile);},[isMobile]);
  const [time,setTime]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),60000);return()=>clearInterval(t);},[]);
  const greeting=time.getHours()<12?"Bom dia":time.getHours()<18?"Boa tarde":"Boa noite";
  const dateStr=time.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  // ─── SUPABASE DATA HOOK ───
  const { cotacoes, contractsDash, pracas, basisData, defaultBasis, ptax, fundosData, premiosData, analiseData, fundamentosData, loading, lastUpdate, isLive } = useSupabaseData();

  // Dólar header — prioridade: PTAX BCB > FX spot > DOL futuro
  const dolFirst = contractsDash.dolarB3[0];
  const fxSpot = cotacoes["FX_IDC:USDBRL"];
  const headerDol = ptax ? ptax.venda : (fxSpot ? fxSpot.lp : (dolFirst ? dolFirst.lp / 1000 : 5.15));
  const headerDolLabel = ptax ? "PTAX" : "USD/BRL";
  const headerDolStr = fmt(headerDol, 4);

  // Shorthand props for pages that need all data
  const dataProps = { PRACAS: pracas, COTACOES: cotacoes, BASIS_DATA: basisData, DEFAULT_BASIS: defaultBasis };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:BZ.bg,fontFamily:"'Outfit',sans-serif",color:BZ.text}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Backdrop (mobile) */}
      {isMobile && sbOpen && <div onClick={()=>setSbOpen(false)} style={{position:"fixed",inset:0,background:"rgba(74,44,22,0.35)",zIndex:40}}/>}

      {/* Sidebar */}
      <div style={isMobile
        ? {position:"fixed",top:0,left:0,height:"100vh",width:244,background:BZ.surface,borderRight:`1px solid ${BZ.border}`,display:"flex",flexDirection:"column",zIndex:50,transform:sbOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)",boxShadow:sbOpen?"0 0 40px rgba(74,44,22,0.14)":"none"}
        : {width:sbOpen?230:0,minHeight:"100vh",background:BZ.surface,borderRight:`1px solid ${BZ.border}`,display:"flex",flexDirection:"column",overflow:"hidden",transition:"width 0.3s cubic-bezier(0.4,0,0.2,1)",flexShrink:0}}>
        <div style={{padding:"18px 16px 16px",borderBottom:`1px solid ${BZ.borderSoft}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <BZLogo size={34}/>
            <div><div style={{fontSize:15,fontWeight:700,letterSpacing:"-0.01em"}}><span style={{color:BZ.brownDeep}}>BZ</span> <span style={{color:BZ.bronze}}>Grãos</span></div><div style={{fontSize:8,color:BZ.textFaint,marginTop:1,letterSpacing:"0.06em"}}>BAZAM AGRONEGÓCIOS</div></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>{setPage(n.id);if(isMobile)setSbOpen(false);}} style={{
              display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:8,cursor:"pointer",
              background:page===n.id?BZ.goldSoft:"transparent",
              color:page===n.id?BZ.brown:BZ.textMute,fontSize:12,fontWeight:page===n.id?600:500,marginBottom:2,transition:"all 0.15s",whiteSpace:"nowrap",
            }} onMouseEnter={e=>{if(page!==n.id)e.currentTarget.style.background="#FAF7F1";}}
               onMouseLeave={e=>{if(page!==n.id)e.currentTarget.style.background="transparent";}}>
              <span style={{fontSize:13,width:18,textAlign:"center",color:page===n.id?BZ.bronze:BZ.textFaint}}>{n.icon}</span>{n.label}
            </div>
          ))}
        </nav>
        <div style={{padding:"12px 14px",borderTop:`1px solid ${BZ.borderSoft}`}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#F3EADB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:BZ.bronze}}>PR</div>
            <div><div style={{fontSize:11,fontWeight:500,color:BZ.brownDeep}}>Produtor</div>
              <div style={{fontSize:9,color:BZ.bronze,background:BZ.goldSoft,padding:"1px 6px",borderRadius:3,display:"inline-block",marginTop:1}}>Plano Básico</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,minWidth:0,overflow:"auto",background:BZ.bg}}>
        <div style={{padding:"12px 20px",borderBottom:`1px solid ${BZ.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10,background:BZ.surfaceAlt,gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <button onClick={()=>setSbOpen(!sbOpen)} style={{background:"none",border:`1px solid ${BZ.border}`,color:BZ.brown,cursor:"pointer",borderRadius:6,padding:"5px 8px",fontSize:13,lineHeight:1}}>☰</button>
            <div style={{minWidth:0}}>
              <span style={{fontSize:16,fontWeight:700,color:BZ.brownDeep}}>{page==="dashboard"?greeting:NAV.find(n=>n.id===page)?.label||""}</span>
              {!isMobile&&page==="dashboard"&&<span style={{color:BZ.textFaint,fontSize:11,marginLeft:10}}>{dateStr}</span>}
              {!isMobile&&page==="preco-justo"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Regiões de preço para negociação</span>}
              {!isMobile&&page==="mercado"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Cotações de bolsa — Chicago, B3 e contratos</span>}
              {!isMobile&&page==="premios"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Prêmios de exportação — Base Paranaguá</span>}
              {!isMobile&&page==="analise"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Regiões de preço em Chicago — Análise semanal</span>}
              {!isMobile&&page==="fundamentos"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Oferta e demanda mundial — Dados USDA/WASDE</span>}
              {!isMobile&&page==="fundos"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Managed Money — CFTC Commitments of Traders</span>}
              {!isMobile&&page==="cambio"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Dólar futuro B3 — Projeção do mercado</span>}
              {!isMobile&&page==="paridade"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Preço máximo no porto — Como a trading calcula</span>}
              {!isMobile&&page==="carrego"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Vale a pena carregar ou vender agora?</span>}
              {!isMobile&&page==="ofertas"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Gere sua oferta e envie via WhatsApp</span>}
              {!isMobile&&page==="admin"&&<span style={{color:BZ.textMute,fontSize:11,marginLeft:8}}>Painel do fundador — atualizar dados</span>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{background:BZ.goldSoft,border:`1px solid ${BZ.goldBorder}`,borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:BZ.bronze,fontSize:9,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em"}}>{headerDolLabel}</span>
              <span style={{color:BZ.brownDeep,fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>R$ {headerDolStr}</span>
            </div>
            <div style={{width:7,height:7,borderRadius:"50%",background:isLive?BZ.up:BZ.gold}}/>
            {!isMobile&&<span style={{color:BZ.textMute,fontSize:10}}>{loading?"Carregando…":isLive?"Dados ao vivo":"Dados offline"}</span>}
          </div>
        </div>

        {page==="dashboard"&&<DashboardPage goTo={setPage} premiosData={premiosData} analiseData={analiseData} fundosData={fundosData} {...dataProps}/>}
        {page==="mercado"&&<MercadoPage goTo={setPage} contractsDash={contractsDash}/>}
        {page==="preco-justo"&&<PrecoJustoPage {...dataProps}/>}
        {page==="premios"&&<PremiosPortoPage premiosData={premiosData}/>}
        {page==="analise"&&<AnaliseTecnicaPage COTACOES={cotacoes} analiseData={analiseData}/>}
        {page==="fundamentos"&&<FundamentosPage fundamentosData={fundamentosData}/>}
        {page==="fundos"&&<PosicaoFundosPage fundosData={fundosData}/>}
        {page==="cambio"&&<CambioPage COTACOES={cotacoes} ptax={ptax}/>}
        {page==="paridade"&&<ParidadePage COTACOES={cotacoes}/>}
        {page==="carrego"&&<CustoCarregoPage {...dataProps}/>}
        {page==="ofertas"&&<OfertasFirmesPage {...dataProps}/>}
        {page==="admin"&&<AdminPage/>}
        {!["dashboard","preco-justo","premios","analise","fundamentos","fundos","cambio","paridade","carrego","ofertas","mercado","admin"].includes(page)&&(
          <div style={{padding:"60px 28px",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:16,opacity:0.3,color:BZ.bronze}}>{NAV.find(n=>n.id===page)?.icon}</div>
            <div style={{color:BZ.textMute,fontSize:14}}>{NAV.find(n=>n.id===page)?.label} — Em construção</div>
          </div>
        )}

        <div style={{borderTop:"1px solid #F2EEE6",margin:"0 28px",paddingTop:14,paddingBottom:20,display:"flex",justifyContent:"space-between",color:"#C2B7A6",fontSize:9}}>
          <span>Fonte: TradingView Data via RapidAPI • Supabase{isLive?" ✓":""} • {lastUpdate ? `Atualizado: ${new Date(lastUpdate).toLocaleTimeString("pt-BR")}` : "Dados com delay 10-15min"}</span>
          <span>ProSafra © 2026 — O que realmente vale seu grão</span>
        </div>
      </div>
    </div>
  );
}
