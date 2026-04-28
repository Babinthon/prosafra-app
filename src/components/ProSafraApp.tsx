"use client";
import React, { useState, useMemo, useEffect } from "react";
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
  {id:"consultoria",label:"Consultoria",icon:"★"},
];

function buildOpts() {
  const o=[];
  for(let m=3;m<=11;m++) o.push({mi:m,yr:2026,label:`${MESES[m]} 2026`});
  for(let m=0;m<=9;m++) o.push({mi:m,yr:2027,label:`${MESES[m]} 2027`});
  return o;
}
const OPTS = buildOpts();

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Sel({label,value,onChange,children,w,grow}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:w,flex:grow?1:undefined}}>
      <label style={{fontSize:9,color:"#6B7280",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{
        background:"#111827",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,
        color:"#F1F5F9",padding:"9px 10px",fontSize:12,fontFamily:"'Outfit',sans-serif",
        cursor:"pointer",outline:"none",appearance:"none",
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 4L5 7L8 4' fill='none' stroke='%236B7280' stroke-width='1.5'/%3E%3C/svg%3E")`,
        backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",paddingRight:28,
      }}>{children}</select>
    </div>
  );
}

function Chg({ch,chp}) {
  const p=ch>=0;
  return <span style={{color:p?"#22C55E":"#EF4444",fontSize:10,fontWeight:500}}>{p?"▲":"▼"} {p?"+":""}{fmt(ch)} ({p?"+":""}{fmt(chp)}%)</span>;
}

function Legend({color,border,text,dot}) {
  return <div style={{display:"flex",alignItems:"center",gap:4}}>
    <div style={{width:dot?7:10,height:dot?7:6,borderRadius:dot?"50%":2,background:color,border:border?`1px solid ${border}`:"none"}}/>
    <span style={{color:"#6B7280",fontSize:9}}>{text}</span>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════

function DashContractRow({item,unit,isDol}) {
  const dp = isDol ? fmt(item.lp/1000,3) : fmt(item.lp,2);
  const u = isDol ? "R$" : unit||"c/bu";
  return (
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr 95px 70px",alignItems:"center",padding:"7px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <span style={{color:"#9CA3AF",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{item.mo}</span>
      <span style={{color:"#F1F5F9",fontSize:13,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{dp} <span style={{color:"#6B7280",fontSize:10,fontWeight:400}}>{u}</span></span>
      <Chg ch={item.ch} chp={item.chp}/>
      <span style={{color:"#6B7280",fontSize:10,textAlign:"right"}}>{fmtVol(item.vol)}</span>
    </div>
  );
}

function DashSection({title,sub,color,contracts,unit,isDol,defOpen=false}) {
  const [open,setOpen]=useState(defOpen);
  const lead=contracts[0];
  return (
    <div style={{background:"#0D1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,overflow:"hidden"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=`${color}33`}
      onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.06)"}>
      <div onClick={()=>setOpen(!open)} style={{padding:"14px 18px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start",userSelect:"none"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${color}44`}}/>
            <span style={{color:"#F1F5F9",fontSize:13,fontWeight:600}}>{title}</span>
            <span style={{fontSize:9,color:"#6B7280",background:"rgba(255,255,255,0.04)",padding:"1px 6px",borderRadius:3}}>{contracts.length}</span>
          </div>
          <span style={{color:"#6B7280",fontSize:11}}>{sub}</span>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#F1F5F9",fontSize:18,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>
            {isDol?fmt(lead.lp/1000,3):fmt(lead.lp,2)}
          </div>
          <div style={{marginTop:2}}><Chg ch={lead.ch} chp={lead.chp}/></div>
          <div style={{color:"#4B5563",fontSize:9,marginTop:1}}>{lead.sym}</div>
        </div>
      </div>
      {open && <div style={{borderTop:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr 95px 70px",padding:"5px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          {["Venc.","Último","Var.","Vol."].map(h=><span key={h} style={{color:"#4B5563",fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:h==="Vol."?"right":undefined}}>{h}</span>)}
        </div>
        {contracts.map(c=><DashContractRow key={c.sym} item={c} unit={unit} isDol={isDol}/>)}
      </div>}
      <div onClick={()=>setOpen(!open)} style={{textAlign:"center",padding:"5px",cursor:"pointer",color:"#4B5563",fontSize:10,borderTop:"1px solid rgba(255,255,255,0.04)"}}
        onMouseEnter={e=>e.currentTarget.style.color=color} onMouseLeave={e=>e.currentTarget.style.color="#4B5563"}>
        {open?"▲ Recolher":"▼ Ver contratos"}
      </div>
    </div>
  );
}

function DashboardPage({goTo, contractsDash}) {
  const sLead = contractsDash.sojaCbot[0];
  const mcLead = contractsDash.milhoCbot[0];
  const mbLead = contractsDash.milhoB3[0];
  const spots = [
    {label:"Soja 1º Venc.",value:sLead?fmt(sLead.lp):"—",unit:"c/bu",ch:sLead?(sLead.ch>=0?"+":"")+fmt(sLead.ch):"—",color:sLead&&sLead.ch>=0?"#22C55E":"#EF4444",sub:sLead?sLead.sym:"—"},
    {label:"Milho CBOT 1º Venc.",value:mcLead?fmt(mcLead.lp):"—",unit:"c/bu",ch:mcLead?(mcLead.ch>=0?"+":"")+fmt(mcLead.ch):"—",color:mcLead&&mcLead.ch>=0?"#22C55E":"#EF4444",sub:mcLead?mcLead.sym:"—"},
    {label:"Milho B3 1º Venc.",value:mbLead?fmt(mbLead.lp):"—",unit:"R$/sc",ch:mbLead?(mbLead.ch>=0?"+":"")+fmt(mbLead.ch):"—",color:mbLead&&mbLead.ch>=0?"#22C55E":"#EF4444",sub:mbLead?mbLead.sym:"—"},
  ];
  const totalAtivos = contractsDash.sojaCbot.length + contractsDash.milhoCbot.length + contractsDash.milhoB3.length;
  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 28px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:28}}>
        {spots.map((s,i)=>(
          <div key={i} style={{background:"#0D1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"18px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${s.color}00,${s.color},${s.color}00)`,opacity:0.5}}/>
            <div style={{color:"#6B7280",fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{s.label}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:5}}>
              <span style={{fontSize:22,fontWeight:700,color:"#F1F5F9",fontFamily:"'JetBrains Mono',monospace"}}>{s.value}</span>
              <span style={{color:"#4B5563",fontSize:11}}>{s.unit}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
              <span style={{color:s.color,fontSize:11,fontWeight:500}}>{s.ch}</span>
              <span style={{color:"#374151",fontSize:9}}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{width:3,height:18,background:"#E63946",borderRadius:2}}/>
        <span style={{fontSize:15,fontWeight:700}}>Todos os contratos</span>
        <span style={{color:"#4B5563",fontSize:11}}>{totalAtivos} ativos monitorados</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <DashSection title="Soja CBOT" sub="c/bu" color="#22C55E" contracts={contractsDash.sojaCbot} defOpen/>
        <DashSection title="Milho CBOT" sub="c/bu" color="#F59E0B" contracts={contractsDash.milhoCbot} defOpen/>
      </div>
      <div style={{marginBottom:28}}>
        <DashSection title="Milho B3" sub="R$/saca" color="#10B981" contracts={contractsDash.milhoB3} unit="R$/sc" defOpen/>
      </div>
      <div style={{display:"flex",gap:12}}>
        {[{label:"Preço Justo",color:"#22C55E",id:"preco-justo"},{label:"Paridade",color:"#457B9D",id:"paridade"},{label:"Nova Oferta",color:"#E63946",id:"ofertas"}].map(b=>(
          <div key={b.id} onClick={()=>goTo(b.id)} style={{
            background:`${b.color}11`,border:`1px solid ${b.color}33`,borderRadius:8,
            padding:"12px 24px",cursor:"pointer",color:b.color,fontSize:13,fontWeight:600,
            transition:"all 0.15s",
          }} onMouseEnter={e=>e.currentTarget.style.background=`${b.color}22`}
             onMouseLeave={e=>e.currentTarget.style.background=`${b.color}11`}>
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
  const [pracaId,setPracaId]=useState(1);
  const [entK,setEntK]=useState("4-2026");
  const [pagK,setPagK]=useState("5-2026");
  const [offer,setOffer]=useState(0);

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

  // Seasonality: Apr/26 → Apr/27
  const dolKeys=allK.filter(k=>k.includes("DOL"));
  const season=useMemo(()=>{
    const ms=[];
    for(let n=0;n<13;n++){
      const mi=(3+n)%12;
      const yr=2026+Math.floor((3+n)/12);
      const b=bAll[mi];
      const isPast=yr<2026||(yr===2026&&mi<3);
      const rawC=isSoja?buildSoja(mi,yr):buildMilho(mi,yr);
      const cs=findClosest(rawC,allK,COTACOES); const cc=COTACOES[cs]; const ch=cc?cc.lp:null;
      const rawD=buildDol(mi,yr);
      const ds=findClosest(rawD,dolKeys,COTACOES); const dc=COTACOES[ds]; const md=dc?dc.lp/1000:null;
      const has=!isPast&&ch!==null&&md!==null;
      ms.push({label:`${MESES_SHORT[mi]}/${String(yr).slice(-2)}`,basis:b.medio,bMin:b.basis_min,bMax:b.basis_max,has,
        pMin:has?calc(ch,b.basis_min,md):null,pJusto:has?calc(ch,b.medio,md):null,pMax:has?calc(ch,b.basis_max,md):null,idx:n});
    }
    return ms;
  },[bAll,isSoja,allK,dolKeys]);

  const sWD=season.filter(s=>s.has);
  const sAllP=sWD.flatMap(s=>[s.pMin,s.pMax]);
  const sMin=sAllP.length?Math.min(...sAllP):0;
  const sMax=sAllP.length?Math.max(...sAllP):1;
  const sR=sMax-sMin||1;
  const bAbsMax=Math.max(...season.filter(s=>!s.has).map(s=>Math.abs(s.basis)),1);
  const barH=130;

  const oR=pMax-pMin;
  const oP=oR>0?Math.max(0,Math.min(1,(offer-pMin)/oR)):0.5;
  let oC,oL;
  if(offer<pMin){oC="#EF4444";oL="Abaixo da região mínima — preço ruim";}
  else if(offer<pJusto){oC="#F59E0B";oL="Entre Mínimo e Justo — abaixo do ideal";}
  else if(offer<pMax){oC="#22C55E";oL="Na região do Preço Justo — boa negociação";}
  else{oC="#10B981";oL="Acima do Agressivo — oportunidade rara";}

  return (
    <div style={{maxWidth:1060,margin:"0 auto",padding:"20px 28px 48px"}}>
      {/* Seletores */}
      <div style={{background:"#0D1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"16px 18px",marginBottom:16,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
        <Sel label="Mercado" value={mercado} onChange={setMercado} w={170}>
          <option value="Soja Exportação">Soja Exportação</option>
          <option value="Milho Exportação">Milho Exportação</option>
          <option value="Milho Interno (B3)">Milho Interno (B3)</option>
        </Sel>
        <Sel label="Praça" value={pracaId} onChange={v=>setPracaId(+v)} w={220} grow>
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
        <MktCard label={`Chicago ${isSoja?"Soja":"Milho"} — ${cLabel}`} value={fmt(chi)} unit="c/bu" sym={cShort} ch={cCh} chp={cChp} color="#22C55E" fb={cFB}/>
        <MktCard label={`Dólar projetado — ${MESES[pMi]} ${pYr}`} value={`R$ ${fmt(dol,4)}`} sym={dShort} ch={dCh} chp={dChp} color="#457B9D" fb={dFB} fd={4}/>
        <div style={{background:"#0D1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"14px 18px",minWidth:155}}>
          <div style={{color:"#6B7280",fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Basis histórico — {MESES[eMi]}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:3}}>
            <span style={{fontSize:22,fontWeight:700,color:"#F59E0B",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(bM.medio,0)}</span>
            <span style={{color:"#4B5563",fontSize:10}}>c/bu</span>
          </div>
          <div style={{color:"#374151",fontSize:9}}>Min {fmt(bM.basis_min,0)} | Max {fmt(bM.basis_max,0)}</div>
          <div style={{color:"#374151",fontSize:8,marginTop:3}}>Média 5 anos • {pLabel}</div>
        </div>
      </div>

      {/* 3 regiões */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <div style={{width:3,height:18,background:"#E63946",borderRadius:2}}/>
        <span style={{fontSize:15,fontWeight:700}}>Regiões de preço</span>
        <span style={{color:"#4B5563",fontSize:11}}>{pLabel} — {MESES[eMi]} {eYr}</span>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:20,alignItems:"stretch"}}>
        <RegCard label="Preço Mínimo" brl={pMin} usd={pMinU} basis={bM.basis_min} color="#F59E0B" sub="Abaixo disso, preço está ruim"/>
        <RegCard label="Preço Justo" brl={pJusto} usd={pJustoU} basis={bM.medio} color="#22C55E" hl sub="Região ideal para negociar"/>
        <RegCard label="Preço Agressivo" brl={pMax} usd={pMaxU} basis={bM.basis_max} color="#10B981" sub="Oportunidade excepcional, raro"/>
      </div>

      {/* Oferta */}
      <div style={{background:"#0D1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"18px",marginBottom:20}}>
        <div style={{color:"#F1F5F9",fontSize:13,fontWeight:600,marginBottom:3}}>Análise de oferta recebida</div>
        <div style={{color:"#6B7280",fontSize:10,marginBottom:14}}>Informe o preço que te ofereceram e veja onde se posiciona</div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end",marginBottom:16}}>
          <div>
            <label style={{fontSize:9,color:"#6B7280",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:3}}>Recebi oferta de</label>
            <div style={{display:"flex",alignItems:"center"}}>
              <span style={{background:"#1F2937",border:"1px solid rgba(255,255,255,0.08)",borderRight:"none",borderRadius:"7px 0 0 7px",padding:"9px 10px",color:"#6B7280",fontSize:12}}>R$</span>
              <input type="number" value={offer||""} onChange={e=>setOffer(parseFloat(e.target.value)||0)} placeholder="0,00" style={{background:"#111827",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"0 7px 7px 0",color:"#F1F5F9",padding:"9px 10px",fontSize:15,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,outline:"none",width:130}}/>
              <span style={{color:"#4B5563",fontSize:11,marginLeft:6}}>/saca</span>
            </div>
          </div>
          {offer>0&&<div style={{background:`${oC}11`,border:`1px solid ${oC}33`,borderRadius:7,padding:"9px 14px",flex:1}}><div style={{color:oC,fontSize:12,fontWeight:600}}>{oL}</div></div>}
        </div>
        {offer>0&&<>
          <div style={{position:"relative",height:36,marginBottom:2}}>
            <div style={{display:"flex",height:10,borderRadius:5,overflow:"hidden",marginTop:13}}>
              <div style={{flex:1,background:"#F59E0B33"}}/><div style={{flex:1,background:"#22C55E33"}}/><div style={{flex:1,background:"#10B98133"}}/>
            </div>
            <div style={{position:"absolute",top:0,left:`${Math.max(2,Math.min(98,oP*100))}%`,transform:"translateX(-50%)",transition:"left 0.3s"}}>
              <div style={{width:2,height:34,background:"#F1F5F9",borderRadius:1,margin:"0 auto"}}/>
              <div style={{background:"#F1F5F9",color:"#080A0F",fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:3,marginTop:3,whiteSpace:"nowrap",fontFamily:"'JetBrains Mono',monospace",textAlign:"center"}}>R$ {fmt(offer)}</div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#4B5563",marginTop:22}}>
            <span>Mín: R$ {fmt(pMin)}</span><span>Justo: R$ {fmt(pJusto)}</span><span>Agr: R$ {fmt(pMax)}</span>
          </div>
        </>}
      </div>

      {/* Sazonalidade Abr/26 → Abr/27 */}
      <div style={{background:"#0D1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{color:"#F1F5F9",fontSize:13,fontWeight:600}}>Sazonalidade de preço — Abr/26 a Abr/27</div>
            <div style={{color:"#6B7280",fontSize:10,marginTop:2}}>Preço Justo por mês (Chicago ref. + basis 5 anos × dólar projetado ao mês)</div>
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <Legend color="#457B9D22" border="#457B9D44" text="Faixa min–max (R$/sc)"/>
            <Legend color="#457B9D" text="Preço justo" dot/>
            <Legend color="#37415133" border="#37415166" text="Sem cotação (basis c/bu)"/>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:barH+60,paddingTop:20,position:"relative"}}>
          {season.map(s=>{
            if(s.has){
              const bBot=((s.pMin-sMin)/sR)*barH+16;
              const bTop=((s.pMax-sMin)/sR)*barH+16;
              const jP=((s.pJusto-sMin)/sR)*barH+16;
              return <div key={s.idx} style={{flex:1,position:"relative",height:"100%"}}>
                <div style={{position:"absolute",bottom:bTop+6,left:"50%",transform:"translateX(-50%)",fontSize:7,fontFamily:"'JetBrains Mono',monospace",color:"#9CA3AF",fontWeight:500,whiteSpace:"nowrap"}}>{fmt(s.pJusto,0)}</div>
                <div style={{position:"absolute",bottom:bBot+20,left:"15%",right:"15%",height:bTop-bBot,background:"rgba(69,123,157,0.1)",border:"1px solid rgba(69,123,157,0.15)",borderRadius:3}}/>
                <div style={{position:"absolute",bottom:jP+20-3,left:"50%",transform:"translateX(-50%)",width:6,height:6,borderRadius:"50%",background:"#457B9D"}}/>
                <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",fontSize:7,fontWeight:500,color:"#9CA3AF",whiteSpace:"nowrap"}}>{s.label}</div>
              </div>;
            } else {
              const bH=(Math.abs(s.basis)/bAbsMax)*60+12;
              return <div key={s.idx} style={{flex:1,position:"relative",height:"100%"}}>
                <div style={{position:"absolute",bottom:bH+26,left:"50%",transform:"translateX(-50%)",fontSize:7,fontFamily:"'JetBrains Mono',monospace",color:"#4B5563",fontWeight:400,whiteSpace:"nowrap"}}>{fmt(s.basis,0)}</div>
                <div style={{position:"absolute",bottom:20,left:"22%",right:"22%",height:bH,background:"rgba(55,65,81,0.15)",border:"1px dashed rgba(55,65,81,0.3)",borderRadius:3}}/>
                <div style={{position:"absolute",bottom:bH+14,left:"50%",transform:"translateX(-50%)",fontSize:6,color:"#374151",whiteSpace:"nowrap"}}>c/bu</div>
                <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",fontSize:7,fontWeight:400,color:"#4B5563",whiteSpace:"nowrap"}}>{s.label}</div>
              </div>;
            }
          })}
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.04)",marginTop:10,paddingTop:8,display:"flex",justifyContent:"space-between",color:"#374151",fontSize:9}}>
          <span>Meses tracejados: sem contrato — exibem apenas basis histórico (c/bu)</span><span>R$/saca</span>
        </div>
      </div>
    </div>
  );
}

function MktCard({label,value,unit,sym,ch,chp,color,fb,fd=2}) {
  return <div style={{background:"#0D1117",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"14px 18px",flex:1,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:0.5}}/>
    <div style={{color:"#6B7280",fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{label}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:5,marginBottom:3}}>
      <span style={{fontSize:22,fontWeight:700,color:"#F1F5F9",fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
      {unit&&<span style={{color:"#4B5563",fontSize:10}}>{unit}</span>}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{color:ch>=0?"#22C55E":"#EF4444",fontSize:10,fontWeight:500}}>{ch>=0?"▲":"▼"} {ch>=0?"+":""}{fmt(ch,fd)} ({chp>=0?"+":""}{fmt(chp)}%)</span>
      <span style={{color:"#374151",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{sym}</span>
    </div>
    {fb&&<div style={{color:"#F59E0B",fontSize:8,marginTop:4,fontStyle:"italic"}}>Usando contrato mais próximo</div>}
  </div>;
}

function RegCard({label,brl,usd,basis,color,hl,sub}) {
  return <div style={{background:hl?`${color}0D`:"#0D1117",border:`1px solid ${hl?`${color}33`:"rgba(255,255,255,0.06)"}`,borderRadius:10,padding:hl?"22px 18px":"18px",flex:1,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}}/>
    {hl&&<div style={{position:"absolute",top:10,right:10,background:`${color}22`,color,fontSize:8,fontWeight:700,padding:"2px 7px",borderRadius:3,textTransform:"uppercase",letterSpacing:"0.1em"}}>Região ideal</div>}
    <div style={{color:"#9CA3AF",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>{label}</div>
    <div style={{fontSize:hl?28:22,fontWeight:800,color:"#F1F5F9",fontFamily:"'JetBrains Mono',monospace",lineHeight:1,marginBottom:5}}>R$ {fmt(brl)}</div>
    <div style={{fontSize:12,color:"#9CA3AF",marginBottom:6,fontFamily:"'JetBrains Mono',monospace"}}>US$ {fmt(usd)}/sc</div>
    <div style={{fontSize:10,color:"#4B5563"}}>Basis: {fmt(basis,0)} c/bu</div>
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

function PremiosPortoPage() {
  const [premios, setPremios] = useState(PREMIOS_ATUAIS_INIT);
  const [showAdmin, setShowAdmin] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newP, setNewP] = useState({ mesIdx: 4, yr: 2026, contrato: "", venda: "", varDia: "" });

  // Sort by date
  const sorted = [...premios].sort((a, b) => (a.yr * 12 + a.mesIdx) - (b.yr * 12 + b.mesIdx));

  function addPremio() {
    if (!newP.contrato || newP.venda === "") return;
    setPremios(prev => [...prev, { ...newP, id: Date.now(), venda: parseFloat(newP.venda), varDia: parseFloat(newP.varDia) || 0 }]);
    setNewP({ mesIdx: 4, yr: 2026, contrato: "", venda: "", varDia: "" });
  }

  function removePremio(id) { setPremios(prev => prev.filter(p => p.id !== id)); }

  function updatePremio(id, field, val) {
    setPremios(prev => prev.map(p => p.id === id ? { ...p, [field]: field === "contrato" ? val : parseFloat(val) || 0 } : p));
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Toggle admin */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: "#E63946", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Prêmios de Soja — Paranaguá</span>
          <span style={{ color: "#4B5563", fontSize: 11 }}>Venda • cents/bushel</span>
        </div>
        <div onClick={() => setShowAdmin(!showAdmin)} style={{
          background: showAdmin ? "rgba(230,57,70,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${showAdmin ? "rgba(230,57,70,0.3)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 6, padding: "6px 14px", cursor: "pointer",
          color: showAdmin ? "#E63946" : "#6B7280", fontSize: 11, fontWeight: 500,
        }}>
          {showAdmin ? "✕ Fechar Admin" : "⚙ Admin"}
        </div>
      </div>

      {/* ─── ADMIN PANEL ─── */}
      {showAdmin && (
        <div style={{ background: "#0D1117", border: "1px solid rgba(230,57,70,0.2)", borderRadius: 10, padding: "18px", marginBottom: 20 }}>
          <div style={{ color: "#E63946", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Painel do fundador — Atualizar prêmios</div>

          {/* Add new */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
            <Sel label="Mês embarque" value={`${newP.mesIdx}-${newP.yr}`} onChange={v => { const [m, y] = v.split("-"); setNewP(p => ({ ...p, mesIdx: +m, yr: +y })); }} w={140}>
              {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
            </Sel>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Contrato ref.</label>
              <input value={newP.contrato} onChange={e => setNewP(p => ({ ...p, contrato: e.target.value }))} placeholder="SK6"
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#F1F5F9", padding: "9px 10px", fontSize: 12, outline: "none", width: 70 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Venda (c/bu)</label>
              <input type="number" value={newP.venda} onChange={e => setNewP(p => ({ ...p, venda: e.target.value }))} placeholder="0.0"
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#F1F5F9", padding: "9px 10px", fontSize: 12, outline: "none", width: 80, fontFamily: "'JetBrains Mono',monospace" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Var. dia</label>
              <input type="number" value={newP.varDia} onChange={e => setNewP(p => ({ ...p, varDia: e.target.value }))} placeholder="0.0"
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#F1F5F9", padding: "9px 10px", fontSize: 12, outline: "none", width: 70, fontFamily: "'JetBrains Mono',monospace" }} />
            </div>
            <div onClick={addPremio} style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 7,
              padding: "9px 16px", cursor: "pointer", color: "#22C55E", fontSize: 12, fontWeight: 600,
            }}>+ Adicionar</div>
          </div>

          {/* Existing editable list */}
          <div style={{ fontSize: 10, color: "#4B5563", marginBottom: 8 }}>Prêmios cadastrados — clique no valor para editar</div>
          <div style={{ display: "grid", gridTemplateColumns: "130px 70px 90px 70px 40px", gap: 0, fontSize: 11 }}>
            {["Embarque", "Contrato", "Venda (c/bu)", "Var.", ""].map(h => (
              <div key={h} style={{ padding: "6px 8px", color: "#4B5563", fontWeight: 600, textTransform: "uppercase", fontSize: 9, letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</div>
            ))}
            {sorted.map(p => (
              <React.Fragment key={p.id}>
                <div style={{ padding: "8px 8px", color: "#9CA3AF", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {MESES_SHORT[p.mesIdx]}/{String(p.yr).slice(-2)}
                </div>
                <div style={{ padding: "8px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <input value={p.contrato} onChange={e => updatePremio(p.id, "contrato", e.target.value)}
                    style={{ background: "transparent", border: "none", color: "#6B7280", fontSize: 11, width: 50, outline: "none", fontFamily: "'JetBrains Mono',monospace" }} />
                </div>
                <div style={{ padding: "8px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <input type="number" value={p.venda} onChange={e => updatePremio(p.id, "venda", e.target.value)}
                    style={{ background: "transparent", border: "none", color: "#F1F5F9", fontSize: 12, width: 65, outline: "none", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }} />
                </div>
                <div style={{ padding: "8px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <input type="number" value={p.varDia} onChange={e => updatePremio(p.id, "varDia", e.target.value)}
                    style={{ background: "transparent", border: "none", color: "#6B7280", fontSize: 11, width: 45, outline: "none", fontFamily: "'JetBrains Mono',monospace" }} />
                </div>
                <div onClick={() => removePremio(p.id)} style={{ padding: "8px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#EF4444", cursor: "pointer", textAlign: "center", fontSize: 13 }}>✕</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ─── PRODUTOR VIEW — TABLE ─── */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 80px 100px 100px 1fr 100px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["Embarque", "Contrato", "Prêmio atual", "Histórico 5a", "Termômetro", "Var. dia"].map(h => (
            <div key={h} style={{ color: "#4B5563", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
          ))}
        </div>
        {sorted.map(p => {
          const hist = PREMIOS_HIST[p.mesIdx] || 30;
          const diff = p.venda - hist;
          const diffPct = hist !== 0 ? (diff / Math.abs(hist)) * 100 : 0;
          const isAbove = diff >= 0;
          const color = isAbove ? "#22C55E" : "#EF4444";
          const barMax = 60;
          const absDiff = Math.abs(diff);
          const barW = Math.min(absDiff / Math.max(Math.abs(hist), 1) * barMax, barMax);

          return (
            <div key={p.id} style={{
              display: "grid", gridTemplateColumns: "140px 80px 100px 100px 1fr 100px",
              padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
              alignItems: "center",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

              {/* Embarque */}
              <div>
                <span style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>{MESES[p.mesIdx]} {p.yr}</span>
              </div>

              {/* Contrato */}
              <span style={{ color: "#6B7280", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{p.contrato}</span>

              {/* Prêmio atual */}
              <span style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                {p.venda >= 0 ? "+" : ""}{fmt(p.venda, 1)}
              </span>

              {/* Histórico */}
              <span style={{ color: "#6B7280", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                +{fmt(hist, 1)}
              </span>

              {/* Termômetro */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", width: barMax * 2 + 2, height: 14, display: "flex", alignItems: "center" }}>
                  {/* Center line */}
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.1)" }} />
                  {/* Background */}
                  <div style={{ position: "absolute", left: 0, right: 0, top: 3, bottom: 3, background: "rgba(255,255,255,0.03)", borderRadius: 3 }} />
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
              <span style={{ color: p.varDia >= 0 ? "#22C55E" : "#EF4444", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                {p.varDia >= 0 ? "+" : ""}{fmt(p.varDia, 1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ─── RESUMO VISUAL ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {(() => {
          const above = sorted.filter(p => p.venda >= (PREMIOS_HIST[p.mesIdx] || 30));
          const below = sorted.filter(p => p.venda < (PREMIOS_HIST[p.mesIdx] || 30));
          const avgDiff = sorted.length ? sorted.reduce((s, p) => s + (p.venda - (PREMIOS_HIST[p.mesIdx] || 30)), 0) / sorted.length : 0;
          return [
            { label: "Acima do histórico", value: above.length, total: sorted.length, color: "#22C55E" },
            { label: "Abaixo do histórico", value: below.length, total: sorted.length, color: "#EF4444" },
            { label: "Diferença média", value: `${avgDiff >= 0 ? "+" : ""}${fmt(avgDiff, 1)} c/bu`, color: avgDiff >= 0 ? "#22C55E" : "#EF4444" },
          ].map((c, i) => (
            <div key={i} style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontFamily: "'JetBrains Mono',monospace" }}>
                {typeof c.value === "number" ? `${c.value}/${c.total}` : c.value}
              </div>
              {typeof c.value === "number" && (
                <div style={{ marginTop: 6, height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
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
      { valor: 1239, tipo: "intensificar", label: "Intensificar negócios", color: "#15803D", desc: "Topo do canal — oportunidade rara" },
      { valor: 1207, tipo: "forte", label: "Zona forte", color: "#22C55E", desc: "Resistência importante — bom momento para negociar" },
      { valor: 1176, tipo: "buscar", label: "Buscar negócios", color: "#86EFAC", desc: "Início da região de interesse — começar a olhar" },
      { valor: 1146, tipo: "segurar", label: "Segurar", color: "#F59E0B", desc: "Suporte — abaixo disso, preço está ruim" },
    ],
    imageUrl: null, // fundador faz upload via admin
  },
  "CBOT:ZSN2026": {
    updatedAt: "11/04/2026",
    leitura: "Contrato de julho segue correlacionado ao K. Spread K/N estável. Mesmas referências de canal se aplicam com ajuste de +16 c/bu em média.",
    faixas: [
      { valor: 1255, tipo: "intensificar", label: "Intensificar negócios", color: "#15803D", desc: "Topo do canal" },
      { valor: 1223, tipo: "forte", label: "Zona forte", color: "#22C55E", desc: "Resistência forte" },
      { valor: 1192, tipo: "buscar", label: "Buscar negócios", color: "#86EFAC", desc: "Início região de interesse" },
      { valor: 1162, tipo: "segurar", label: "Segurar", color: "#F59E0B", desc: "Suporte principal" },
    ],
    imageUrl: null,
  },
};

function AnaliseTecnicaPage({COTACOES}) {
  const [selSym, setSelSym] = useState("CBOT:ZSK2026");

  const contrato = ANALISE_CONTRATOS.find(c => c.sym === selSym);
  const cotacao = COTACOES[selSym];
  const preco = cotacao ? cotacao.lp : 0;
  const ch = cotacao?.ch || 0;
  const chp = cotacao?.chp || 0;
  const analise = ANALISE_DATA[selSym];

  // Determine which zone the current price is in
  let zonaAtual = null;
  let zonaColor = "#6B7280";
  let zonaLabel = "Fora das regiões mapeadas";
  if (analise) {
    const sorted = [...analise.faixas].sort((a, b) => a.valor - b.valor);
    if (preco < sorted[0].valor) {
      zonaAtual = "abaixo";
      zonaColor = "#EF4444";
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
            {ANALISE_CONTRATOS.filter(c => c.produto === "Soja").map(c => <option key={c.sym} value={c.sym}>{c.label}</option>)}
          </optgroup>
          <optgroup label="Milho CBOT">
            {ANALISE_CONTRATOS.filter(c => c.produto === "Milho").map(c => <option key={c.sym} value={c.sym}>{c.label}</option>)}
          </optgroup>
        </Sel>
        {analise && <span style={{ color: "#374151", fontSize: 10, paddingBottom: 10 }}>Atualizado em {analise.updatedAt}</span>}
      </div>

      {!analise ? (
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "40px", textAlign: "center" }}>
          <div style={{ color: "#4B5563", fontSize: 14 }}>Análise técnica ainda não publicada para este contrato</div>
          <div style={{ color: "#374151", fontSize: 11, marginTop: 4 }}>O fundador publica semanalmente via painel admin</div>
        </div>
      ) : (
        <>
          {/* Cotação atual + zona */}
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            {/* Preço atual */}
            <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", flex: 1, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: zonaColor }} />
              <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                {contrato?.label}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(preco, 2)}</span>
                <span style={{ color: "#4B5563", fontSize: 12 }}>c/bu</span>
              </div>
              <Chg ch={ch} chp={chp} />
            </div>

            {/* Zona atual */}
            <div style={{ background: `${zonaColor}0D`, border: `1px solid ${zonaColor}33`, borderRadius: 10, padding: "18px 22px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Zona atual do preço</div>
              <div style={{ color: zonaColor, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{zonaLabel}</div>
              <div style={{ color: "#6B7280", fontSize: 11 }}>
                {zonaAtual === "segurar" && "Não é momento — aguardar melhora"}
                {zonaAtual === "buscar" && "Começar a olhar oportunidades"}
                {zonaAtual === "forte" && "Bom momento para negociar"}
                {zonaAtual === "intensificar" && "Oportunidade rara — agir com urgência"}
                {zonaAtual === "abaixo" && "Preço abaixo do suporte — segurar posição"}
              </div>
            </div>
          </div>

          {/* Gauge visual — preço na régua das faixas */}
          <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
            <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Mapa de regiões de preço</div>

            <div style={{ position: "relative", height: 60, marginBottom: 8 }}>
              {/* Background bar */}
              <div style={{ position: "absolute", left: 0, right: 0, top: 24, height: 12, background: "rgba(255,255,255,0.03)", borderRadius: 6 }} />

              {/* Zone segments */}
              {(() => {
                const sorted = [...analise.faixas].sort((a, b) => a.valor - b.valor);
                const segments = [];
                // Below first faixa
                const firstPct = ((sorted[0].valor - faixaMin) / faixaRange) * 100;
                segments.push(<div key="below" style={{ position: "absolute", left: 0, top: 24, height: 12, width: `${firstPct}%`, background: "#EF444422", borderRadius: "6px 0 0 6px" }} />);
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
                <div style={{ background: "#F1F5F9", color: "#080A0F", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace", textAlign: "center" }}>
                  {fmt(preco, 0)}
                </div>
                <div style={{ width: 2, height: 16, background: "#F1F5F9", margin: "2px auto 0", borderRadius: 1 }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F1F5F9", margin: "-1px auto 0", boxShadow: "0 0 8px rgba(255,255,255,0.4)" }} />
              </div>
            </div>

            {/* Faixas legend */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
              {[...analise.faixas].sort((a, b) => b.valor - a.valor).map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: `${f.color}0D`, border: `1px solid ${f.color}22`, borderRadius: 6, padding: "6px 12px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: f.color }} />
                  <span style={{ color: f.color, fontSize: 10, fontWeight: 600 }}>{fmt(f.valor, 0)}</span>
                  <span style={{ color: "#9CA3AF", fontSize: 10 }}>{f.label}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 6, padding: "6px 12px" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#EF4444" }} />
                <span style={{ color: "#EF4444", fontSize: 10, fontWeight: 600 }}>{"<"}{fmt(analise.faixas.find(f => f.tipo === "segurar")?.valor || 0, 0)}</span>
                <span style={{ color: "#9CA3AF", fontSize: 10 }}>Preço desfavorável</span>
              </div>
            </div>
          </div>

          {/* Leitura do fundador */}
          <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>Leitura do mercado</div>
              <span style={{ color: "#374151", fontSize: 9 }}>Atualizado {analise.updatedAt}</span>
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 1.7 }}>{analise.leitura}</div>
          </div>

          {/* Imagem do gráfico */}
          <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px" }}>
            <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Gráfico técnico</div>
            {analise.imageUrl ? (
              <img src={analise.imageUrl} alt="Análise técnica" style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }} />
            ) : (
              <div style={{ height: 300, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <span style={{ color: "#374151", fontSize: 32 }}>△</span>
                <span style={{ color: "#4B5563", fontSize: 12 }}>Imagem do gráfico será publicada pelo fundador via Admin</span>
                <span style={{ color: "#374151", fontSize: 10 }}>Upload semanal com a análise atualizada</span>
              </div>
            )}
          </div>

          {/* Tabela de pontos */}
          <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", marginTop: 20 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>Pontos de referência — {contrato?.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 160px 80px", padding: "8px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Preço (c/bu)", "Região", "Ação", "Distância"].map(h => (
                <span key={h} style={{ color: "#4B5563", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>
            {[...analise.faixas].sort((a, b) => b.valor - a.valor).map((f, i) => {
              const dist = preco - f.valor;
              const isAtOrAbove = preco >= f.valor;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 160px 80px", padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: f.color }}>{fmt(f.valor, 0)}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: f.color }} />
                      <span style={{ color: "#F1F5F9", fontSize: 12, fontWeight: 500 }}>{f.label}</span>
                    </div>
                    <span style={{ color: "#4B5563", fontSize: 10, marginLeft: 14 }}>{f.desc}</span>
                  </div>
                  <span style={{ color: "#6B7280", fontSize: 11 }}>
                    {f.tipo === "segurar" && "Segurar posição"}
                    {f.tipo === "buscar" && "Começar a buscar"}
                    {f.tipo === "forte" && "Negociar ativamente"}
                    {f.tipo === "intensificar" && "Intensificar — raro"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: isAtOrAbove ? "#22C55E" : "#EF4444" }}>
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

function FundamentosPage() {
  const [produto, setProduto] = useState("soja");
  const d = USDA_DATA[produto];

  const estoqueNivel = d.relEstoqueUso < 20 ? "apertado" : d.relEstoqueUso < 30 ? "equilibrado" : "folgado";
  const estoqueColor = estoqueNivel === "apertado" ? "#EF4444" : estoqueNivel === "equilibrado" ? "#F59E0B" : "#22C55E";
  const estoqueIcon = estoqueNivel === "apertado" ? "▲ Altista" : estoqueNivel === "equilibrado" ? "◉ Neutro" : "▼ Baixista";

  const varPct = (at, ant) => ant ? (((at - ant) / ant) * 100) : 0;
  const varArrow = (at, ant) => at >= ant ? "▲" : "▼";
  const varColor = (at, ant, invert) => {
    const up = at >= ant;
    if (invert) return up ? "#EF4444" : "#22C55E"; // more stock = bearish for price
    return up ? "#22C55E" : "#EF4444";
  };

  function StatCard({ label, valor, anterior, unit, invert }) {
    const v = varPct(valor, anterior);
    const c = varColor(valor, anterior, invert);
    return (
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(valor, 1)}</span>
          <span style={{ color: "#4B5563", fontSize: 9 }}>{unit}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: c, fontSize: 10, fontWeight: 500 }}>
            {varArrow(valor, anterior)} {v >= 0 ? "+" : ""}{fmt(v, 1)}%
          </span>
          <span style={{ color: "#374151", fontSize: 9 }}>ant: {fmt(anterior, 1)}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Seletor + título */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: "#E63946", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Fundamentos — USDA/WASDE</span>
          <span style={{ color: "#4B5563", fontSize: 11 }}>Safra {d.safraAtual}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["soja", "milho"].map(p => (
            <div key={p} onClick={() => setProduto(p)} style={{
              padding: "7px 18px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: produto === p ? "rgba(230,57,70,0.1)" : "rgba(255,255,255,0.03)",
              color: produto === p ? "#E63946" : "#6B7280",
              border: `1px solid ${produto === p ? "rgba(230,57,70,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}>{p === "soja" ? "Soja" : "Milho"}</div>
          ))}
        </div>
      </div>

      {/* Termômetro principal */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <div style={{ background: `${estoqueColor}0D`, border: `1px solid ${estoqueColor}33`, borderRadius: 10, padding: "20px 24px", flex: 1 }}>
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Estoque mundial — sentimento</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: estoqueColor, fontFamily: "'JetBrains Mono',monospace" }}>{estoqueIcon}</div>
            <div>
              <div style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 600 }}>Estoque {estoqueNivel}</div>
              <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>
                Relação estoque/uso: {fmt(d.relEstoqueUso, 1)}% (anterior: {fmt(d.relEstoqueUsoAnt, 1)}%)
              </div>
            </div>
          </div>
          {/* Gauge bar */}
          <div style={{ marginTop: 14, position: "relative", height: 10, borderRadius: 5, overflow: "hidden", display: "flex" }}>
            <div style={{ flex: 20, background: "#EF444444" }} />
            <div style={{ flex: 10, background: "#F59E0B44" }} />
            <div style={{ flex: 20, background: "#22C55E44" }} />
          </div>
          <div style={{ position: "relative", marginTop: -14, height: 14 }}>
            <div style={{ position: "absolute", left: `${Math.min(95, Math.max(5, (d.relEstoqueUso / 50) * 100))}%`, transform: "translateX(-50%)", top: 0 }}>
              <div style={{ width: 3, height: 14, background: "#F1F5F9", borderRadius: 1, margin: "0 auto" }} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#4B5563", marginTop: 4 }}>
            <span>Apertado {"(<20%)"}</span><span>Equilibrado</span><span>Folgado {"(>30%)"}</span>
          </div>
        </div>

        {/* Estoque final card */}
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "20px 24px", minWidth: 200 }}>
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Estoque final mundial</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(d.mundo.estoqueFinal.atual, 1)}</span>
            <span style={{ color: "#4B5563", fontSize: 10 }}>mi ton</span>
          </div>
          <span style={{ color: varColor(d.mundo.estoqueFinal.atual, d.mundo.estoqueFinal.anterior, true), fontSize: 11, fontWeight: 500 }}>
            {varArrow(d.mundo.estoqueFinal.atual, d.mundo.estoqueFinal.anterior)} {fmt(varPct(d.mundo.estoqueFinal.atual, d.mundo.estoqueFinal.anterior), 1)}% vs safra anterior
          </span>
        </div>
      </div>

      {/* Números mundiais */}
      <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Balanço mundial — {produto === "soja" ? "Soja" : "Milho"} ({d.safraAtual})</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Produção mundial" valor={d.mundo.producao.atual} anterior={d.mundo.producao.anterior} unit="mi ton" />
        <StatCard label="Consumo mundial" valor={d.mundo.consumo.atual} anterior={d.mundo.consumo.anterior} unit="mi ton" />
        <StatCard label="Exportação mundial" valor={d.mundo.exportacao.atual} anterior={d.mundo.exportacao.anterior} unit="mi ton" />
        <StatCard label="Estoque final" valor={d.mundo.estoqueFinal.atual} anterior={d.mundo.estoqueFinal.anterior} unit="mi ton" invert />
      </div>

      {/* Por país */}
      <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Principais países</div>
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px repeat(4,1fr)", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["País", "Produção", "Var.", "Exportação", "Var."].map(h => (
            <span key={h} style={{ color: "#4B5563", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
          ))}
        </div>
        {d.paises.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px repeat(4,1fr)", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>{p.nome}</span>
            <span style={{ color: "#F1F5F9", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(p.prod, 1)}</span>
            <span style={{ color: varColor(p.prod, p.prodAnt, false), fontSize: 10, fontWeight: 500 }}>
              {varArrow(p.prod, p.prodAnt)} {fmt(varPct(p.prod, p.prodAnt), 1)}%
            </span>
            <span style={{ color: "#F1F5F9", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{fmt(p.exp, 1)}</span>
            <span style={{ color: varColor(p.exp, p.expAnt, false), fontSize: 10, fontWeight: 500 }}>
              {varArrow(p.exp, p.expAnt)} {fmt(varPct(p.exp, p.expAnt), 1)}%
            </span>
          </div>
        ))}
        <div style={{ padding: "8px 16px", color: "#374151", fontSize: 9 }}>Valores em milhões de toneladas</div>
      </div>

      {/* China destaque */}
      {d.paises.find(p => p.nome === "China") && (() => {
        const cn = d.paises.find(p => p.nome === "China");
        return (
          <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px", marginBottom: 24 }}>
            <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>China — maior importador mundial</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {cn.importacao != null && <StatCard label="Importação" valor={cn.importacao} anterior={cn.impAnt} unit="mi ton" />}
              {cn.consumo != null && <StatCard label="Consumo interno" valor={cn.consumo} anterior={cn.consumoAnt} unit="mi ton" />}
              <StatCard label="Produção" valor={cn.prod} anterior={cn.prodAnt} unit="mi ton" />
            </div>
          </div>
        );
      })()}

      {/* Leitura do fundador */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>Análise dos números</div>
          <span style={{ color: "#374151", fontSize: 9 }}>Atualizado {USDA_DATA.leituraDate}</span>
        </div>
        <div style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 1.7 }}>{USDA_DATA.leitura}</div>
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

function PosicaoFundosPage() {
  const [produto, setProduto] = useState("soja");
  const d = FUNDOS_DATA[produto];

  const isLong = d.posAtual >= 0;
  const sentimento = isLong ? (d.posAtual > 100000 ? "Fortemente comprado" : "Comprado") : (d.posAtual < -100000 ? "Fortemente vendido" : "Vendido");
  const sentColor = isLong ? "#22C55E" : "#EF4444";
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
          <div style={{ width: 3, height: 18, background: "#E63946", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Posição dos fundos — CBOT</span>
          <span style={{ color: "#4B5563", fontSize: 11 }}>Managed Money (CFTC COT)</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["soja", "milho"].map(p => (
            <div key={p} onClick={() => setProduto(p)} style={{
              padding: "7px 18px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: produto === p ? "rgba(230,57,70,0.1)" : "rgba(255,255,255,0.03)",
              color: produto === p ? "#E63946" : "#6B7280",
              border: `1px solid ${produto === p ? "rgba(230,57,70,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}>{p === "soja" ? "Soja" : "Milho"}</div>
          ))}
        </div>
      </div>

      {/* Posição atual + sentimento */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {/* Posição atual */}
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "20px 24px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: sentColor }} />
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Posição líquida atual</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: sentColor, fontFamily: "'JetBrains Mono',monospace" }}>
              {d.posAtual >= 0 ? "+" : ""}{(d.posAtual / 1000).toFixed(1)}k
            </span>
            <span style={{ color: "#4B5563", fontSize: 11 }}>contratos</span>
          </div>
          <div style={{ color: "#6B7280", fontSize: 11 }}>{d.posAtual >= 0 ? "Comprado (long)" : "Vendido (short)"} — {fmt(Math.abs(d.posAtual), 0)} contratos</div>
        </div>

        {/* Sentimento */}
        <div style={{ background: `${sentColor}0D`, border: `1px solid ${sentColor}33`, borderRadius: 10, padding: "20px 24px", flex: 1 }}>
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sentimento</div>
          <div style={{ color: sentColor, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{sentIcon} {sentimento}</div>
          <div style={{ color: "#9CA3AF", fontSize: 11 }}>{sentDesc}</div>
        </div>

        {/* Variação semanal */}
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "20px 24px", minWidth: 180 }}>
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Variação semanal</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: varSemanal >= 0 ? "#22C55E" : "#EF4444", fontFamily: "'JetBrains Mono',monospace" }}>
              {varSemanal >= 0 ? "+" : ""}{(varSemanal / 1000).toFixed(1)}k
            </span>
          </div>
          <span style={{ color: varPct >= 0 ? "#22C55E" : "#EF4444", fontSize: 10, fontWeight: 500 }}>
            {varPct >= 0 ? "▲" : "▼"} {varPct >= 0 ? "+" : ""}{fmt(varPct, 1)}%
          </span>
        </div>
      </div>

      {/* Gauge: onde estamos no range de 12 meses */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Posição no range de 12 meses</div>
        <div style={{ position: "relative", height: 24, marginBottom: 6 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 8, height: 8, borderRadius: 4, overflow: "hidden", display: "flex" }}>
            <div style={{ flex: 1, background: "#EF444433" }} />
            <div style={{ flex: 1, background: "#F59E0B33" }} />
            <div style={{ flex: 1, background: "#22C55E33" }} />
          </div>
          <div style={{ position: "absolute", left: `${gaugePct}%`, top: 0, transform: "translateX(-50%)" }}>
            <div style={{ width: 3, height: 24, background: "#F1F5F9", borderRadius: 1, margin: "0 auto" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#4B5563" }}>
          <span>Máx. vendido: {(d.min12m / 1000).toFixed(0)}k</span>
          <span>Neutro: 0</span>
          <span>Máx. comprado: {(d.max12m / 1000).toFixed(0)}k</span>
        </div>
      </div>

      {/* Gráfico de evolução */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Evolução — últimas {hist.length} semanas</div>
        <div style={{ color: "#6B7280", fontSize: 10, marginBottom: 14 }}>Posição líquida Managed Money — contratos</div>

        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow: "visible" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = padT + f * plotH;
            const val = maxP - f * range;
            return <g key={f}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              <text x={padL - 8} y={y + 3} fill="#4B5563" fontSize="9" textAnchor="end" fontFamily="'JetBrains Mono',monospace">{(val / 1000).toFixed(0)}k</text>
            </g>;
          })}
          {/* Zero line */}
          {minP < 0 && <line x1={padL} y1={zeroY} x2={chartW - padR} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 3" />}
          {/* Area fill */}
          <path d={areaD} fill={isLong ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"} />
          {/* Line */}
          <path d={pathD} fill="none" stroke={sentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Points */}
          {hist.map((h, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(h.pos)} r={i === hist.length - 1 ? 5 : 3} fill={sentColor} opacity={i === hist.length - 1 ? 1 : 0.6} />
              {/* Date labels */}
              <text x={toX(i)} y={chartH - 5} fill="#4B5563" fontSize="9" textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{h.data}</text>
              {/* Value on last point */}
              {i === hist.length - 1 && (
                <text x={toX(i)} y={toY(h.pos) - 10} fill="#F1F5F9" fontSize="10" textAnchor="middle" fontWeight="600" fontFamily="'JetBrains Mono',monospace">
                  {(h.pos / 1000).toFixed(1)}k
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Leitura do fundador */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>Leitura do posicionamento</div>
          <span style={{ color: "#374151", fontSize: 9 }}>Atualizado {FUNDOS_DATA.leituraDate}</span>
        </div>
        <div style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 1.7 }}>{FUNDOS_DATA.leitura}</div>
        <div style={{ color: "#374151", fontSize: 9, marginTop: 10 }}>Fonte: {FUNDOS_DATA.fonte}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CÂMBIO PROJETADO PAGE
// ═══════════════════════════════════════════════════════════════

const DOL_CONTRACTS = [
  { sym: "BMFBOVESPA:DOLK2026", mo: "Mai/26", mes: "Maio 2026" },
  { sym: "BMFBOVESPA:DOLM2026", mo: "Jun/26", mes: "Junho 2026" },
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
  { sym: "BMFBOVESPA:DOLN2027", mo: "Jul/27", mes: "Julho 2027" },
  { sym: "BMFBOVESPA:DOLQ2027", mo: "Ago/27", mes: "Agosto 2027" },
  { sym: "BMFBOVESPA:DOLV2027", mo: "Out/27", mes: "Outubro 2027" },
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
  const curveColor = isUp ? "#EF4444" : "#22C55E";

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 18, background: "#E63946", borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Câmbio projetado</span>
        <span style={{ color: "#4B5563", fontSize: 11 }}>Dólar futuro B3 — {contracts.length} vencimentos</span>
      </div>

      {/* Ptax + Dólar comercial */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#F59E0B" }} />
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Ptax — dia anterior (BCB)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ color: "#9CA3AF", fontSize: 9, marginBottom: 2 }}>Compra</div>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {ptax ? fmt(ptax.compra, 4) : "—"}</span>
            </div>
            <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.06)" }} />
            <div>
              <div style={{ color: "#9CA3AF", fontSize: 9, marginBottom: 2 }}>Venda</div>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {ptax ? fmt(ptax.venda, 4) : "—"}</span>
            </div>
          </div>
          <div style={{ color: "#374151", fontSize: 9, marginTop: 6 }}>{ptax ? `Ref: ${ptax.data_ref.split("-").reverse().join("/")}` : "Sem dados"} — Fonte: Banco Central do Brasil</div>
        </div>

        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#457B9D" }} />
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dólar comercial — hoje</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(spot, 4)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Chg ch={contracts[0]?.ch || 0} chp={contracts[0]?.chp || 0} />
            <span style={{ color: "#374151", fontSize: 9 }}>Ref: DOL B3 1º venc. ({contracts[0]?.mo})</span>
          </div>
        </div>
      </div>

      {/* Spot + resumo */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#457B9D" }} />
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dólar 1º vencimento (spot ref.)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(spot, 4)}</span>
          </div>
          <div style={{ marginTop: 4 }}><Chg ch={contracts[0]?.ch || 0} chp={contracts[0]?.chp || 0} /></div>
          <div style={{ color: "#374151", fontSize: 9, marginTop: 4 }}>{contracts[0]?.sym.replace("BMFBOVESPA:", "")}</div>
        </div>

        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", minWidth: 180 }}>
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Último vencimento</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(contracts[contracts.length - 1].rate, 4)}</span>
          </div>
          <div style={{ color: "#374151", fontSize: 10, marginTop: 4 }}>{contracts[contracts.length - 1].mo}</div>
        </div>

        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", minWidth: 180 }}>
          <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Variação na curva</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: isUp ? "#EF4444" : "#22C55E", fontFamily: "'JetBrains Mono',monospace" }}>
              {isUp ? "+" : ""}{fmt(contracts[contracts.length - 1].rate - spot, 4)}
            </span>
          </div>
          <div style={{ color: isUp ? "#EF4444" : "#22C55E", fontSize: 10, marginTop: 4 }}>
            {isUp ? "▲ Curva ascendente — mercado projeta dólar subindo" : "▼ Curva descendente — mercado projeta dólar caindo"}
          </div>
        </div>
      </div>

      {/* Curva gráfica */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Curva de dólar futuro</div>
        <div style={{ color: "#6B7280", fontSize: 10, marginBottom: 14 }}>Projeção do mercado para o câmbio nos próximos meses</div>

        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow: "visible" }}>
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = padT + f * plotH;
            const val = (maxR + 0.02) - f * (rangeR + 0.04);
            return <g key={f}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              <text x={padL - 8} y={y + 3} fill="#4B5563" fontSize="9" textAnchor="end" fontFamily="'JetBrains Mono',monospace">{val.toFixed(2)}</text>
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
              <text x={toX(i)} y={chartH - 5} fill="#4B5563" fontSize="8" textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{c.mo}</text>
              {(i === 0 || i === contracts.length - 1 || i % 3 === 0) && (
                <text x={toX(i)} y={toY(c.rate) - 8} fill="#9CA3AF" fontSize="8" textAnchor="middle" fontWeight="500" fontFamily="'JetBrains Mono',monospace">{c.rate.toFixed(3)}</text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Tabela de vencimentos */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>Todos os vencimentos</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px 100px", padding: "8px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["Vencimento", "Cotação (R$)", "Var. dia", "Vs. spot"].map(h => (
            <span key={h} style={{ color: "#4B5563", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
          ))}
        </div>
        {contracts.map((c, i) => {
          const vSpot = c.rate - spot;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px 100px", padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div>
                <span style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>{c.mes}</span>
                <span style={{ color: "#374151", fontSize: 9, marginLeft: 8 }}>{c.sym.replace("BMFBOVESPA:", "")}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(c.rate, 4)}</span>
              <Chg ch={c.ch} chp={c.chp} />
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: vSpot >= 0 ? "#EF4444" : "#22C55E" }}>
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
  const [plano, setPlano] = useState("pro");
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

  const planos = [
    { id: "basico", label: "Básico" },
    { id: "pro", label: "Profissional" },
    { id: "premium", label: "Premium" },
  ];

  function CustoRow({ label, valor, unit, dim, highlight }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ color: dim ? "#374151" : highlight ? highlight : "#9CA3AF", fontSize: 12 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ color: dim ? "#4B5563" : highlight ? highlight : "#F1F5F9", fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(valor, 2)}</span>
          <span style={{ color: "#4B5563", fontSize: 9 }}>{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>

      {/* Header + plano */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 18, background: "#E63946", borderRadius: 2 }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Paridade de exportação</span>
          <span style={{ color: "#4B5563", fontSize: 11 }}>Preço máximo que a trading consegue pagar</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {planos.map(p => (
            <div key={p.id} onClick={() => setPlano(p.id)} style={{
              padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
              background: plano === p.id ? "rgba(230,57,70,0.1)" : "rgba(255,255,255,0.03)",
              color: plano === p.id ? "#E63946" : "#6B7280",
              border: `1px solid ${plano === p.id ? "rgba(230,57,70,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}>{p.label}</div>
          ))}
        </div>
      </div>

      {/* Seletores */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Sel label="Mês de entrega" value={entK} onChange={setEntK} w={165}>
          {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
        </Sel>
        <Sel label="Data de pagamento" value={pagK} onChange={setPagK} w={165}>
          {OPTS.map(o => <option key={`${o.mi}-${o.yr}`} value={`${o.mi}-${o.yr}`}>{o.label}</option>)}
        </Sel>
        <div style={{ display: "flex", gap: 16, marginLeft: "auto", alignItems: "center", fontSize: 10, color: "#4B5563" }}>
          <span>Chicago: {cLabel} ({fmt(chicagoCbu, 0)} c/bu)</span>
          <span>Dólar: {dShort} (R$ {fmt(cambio, 4)})</span>
          <span>Prêmio: {fmt(premioBrasil, 1)} c/bu</span>
        </div>
      </div>

      {/* Resultado principal */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "24px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#22C55E" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Preço no porto — Paranaguá — {MESES[eMi]} {eYr}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: "#22C55E", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(custoPortoBRL)}</span>
              <span style={{ color: "#4B5563", fontSize: 13 }}>/saca</span>
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>US$ {fmt(custoLiqSaca)}/saca</div>
          </div>
          <div style={{ textAlign: "right", color: "#374151", fontSize: 9, lineHeight: 1.6 }}>
            <div>Preço máximo que uma trading</div>
            <div>de exportação consegue pagar</div>
            <div style={{ marginTop: 4 }}>Diferença porto→praça = frete do comprador</div>
          </div>
        </div>
      </div>

      {/* Frete */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Desconte seu frete</div>
        <div style={{ color: "#6B7280", fontSize: 10, marginBottom: 14 }}>Informe o frete da sua região até o porto para ver o preço na sua praça</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Frete até o porto</label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ background: "#1F2937", border: "1px solid rgba(255,255,255,0.08)", borderRight: "none", borderRadius: "7px 0 0 7px", padding: "9px 10px", color: "#6B7280", fontSize: 12 }}>R$</span>
              <input type="number" value={freteRton} onChange={e => setFreteRton(parseFloat(e.target.value) || 0)}
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0 7px 7px 0", color: "#F1F5F9", padding: "9px 10px", fontSize: 15, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, outline: "none", width: 100 }} />
              <span style={{ color: "#4B5563", fontSize: 11, marginLeft: 6 }}>/ton</span>
              <span style={{ color: "#374151", fontSize: 10, marginLeft: 12 }}>= R$ {fmt(freteSaca)}/saca</span>
            </div>
          </div>
          <div style={{ background: "rgba(69,123,157,0.08)", border: "1px solid rgba(69,123,157,0.2)", borderRadius: 8, padding: "12px 20px" }}>
            <div style={{ color: "#6B7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Preço na sua praça</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(precoPraca)}</span>
            <span style={{ color: "#4B5563", fontSize: 11, marginLeft: 6 }}>/saca</span>
          </div>
        </div>
      </div>

      {/* PRO — Componentes */}
      {(plano === "pro" || plano === "premium") && (
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
          <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Componentes do preço</div>
          <CustoRow label={`Chicago CBOT (${cLabel})`} valor={chicagoCbu} unit="c/bu" />
          <CustoRow label={`Prêmio Brasil — ${MESES[eMi]} ${eYr}`} valor={premioBrasil} unit="c/bu" />
          <CustoRow label="FOB Brasil" valor={custoFobBR} unit="USD/ton" />
          <CustoRow label="Custos internos (total)" valor={ttlCustos} unit="USD/ton" />
          <CustoRow label="Custo líquido porto" valor={custoLiqTon} unit="USD/ton" />
          <CustoRow label="Custo líquido porto" valor={custoLiqSaca} unit="USD/sc" />
          <CustoRow label={`Câmbio ${MESES[pMi]} ${pYr} (R$ ${fmt(cambio, 4)})`} valor={custoPortoBRL} unit="R$/sc" />
          <div style={{ marginTop: 10, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#22C55E", fontSize: 13, fontWeight: 600 }}>Preço no porto</span>
            <span style={{ color: "#22C55E", fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(custoPortoBRL)}/sc</span>
          </div>
        </div>
      )}

      {/* PREMIUM — Custos internos */}
      {plano === "premium" && (
        <div style={{ background: "#0D1117", border: "1px solid rgba(230,57,70,0.15)", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>Custos internos da trading</div>
            <span style={{ fontSize: 8, color: "#E63946", background: "rgba(230,57,70,0.1)", padding: "2px 8px", borderRadius: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Premium</span>
          </div>
          <CustoRow label="Despesas portuárias" valor={despPortuarias} unit="USD/ton" />
          <CustoRow label="ICMS" valor={icms} unit="USD/ton" dim />
          <CustoRow label="Quebra (0,25%)" valor={quebra} unit="USD/ton" />
          <CustoRow label="Corretagem cambial (0,19%)" valor={corretagem} unit="USD/ton" />
          <CustoRow label="PIS" valor={pis} unit="USD/ton" dim />
          <CustoRow label="Comissões e taxas" valor={comissoes} unit="USD/ton" />
          <div style={{ marginTop: 10, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#F59E0B", fontSize: 12, fontWeight: 600 }}>Total custos internos</span>
            <span style={{ color: "#F59E0B", fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(ttlCustos)} USD/ton</span>
          </div>
          <div style={{ color: "#374151", fontSize: 9, marginTop: 8 }}>Quanto menor os custos internos, mais a trading consegue pagar. Revisados mensalmente.</div>
        </div>
      )}

      {/* Premissas */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ color: "#4B5563", fontSize: 10, fontWeight: 600, marginBottom: 8 }}>Premissas utilizadas</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 10, color: "#374151" }}>
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
  const [dtEntrega, setDtEntrega] = useState("2026-05-01");
  const [dtPagto, setDtPagto] = useState("2026-05-05");
  const [dtEntregaFut, setDtEntregaFut] = useState("2026-12-01");
  const [dtPagtoFut, setDtPagtoFut] = useState("2026-12-05");
  const [volume, setVolume] = useState(10000);
  const [precoInput, setPrecoInput] = useState(110);
  const [moeda, setMoeda] = useState("BRL");
  const [armMes, setArmMes] = useState(0.35);
  const [quebraAm, setQuebraAm] = useState(0.30);
  const [finAm, setFinAm] = useState(1.25);
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
        <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>{label}</label>
        <div style={{ display: "flex", alignItems: "center" }}>
          <input type={type} step={step} value={value} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
            style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#F1F5F9", padding: "8px 10px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: "none", width: "100%" }} />
          {unit && <span style={{ color: "#4B5563", fontSize: 10, marginLeft: 6, whiteSpace: "nowrap" }}>{unit}</span>}
        </div>
      </div>
    );
  }

  function AutoCard({ label, value, unit, sym, color }) {
    return (
      <div style={{ background: "#111827", borderRadius: 7, padding: "10px 14px", flex: 1 }}>
        <div style={{ color: "#4B5563", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: color || "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>{value}</span>
          <span style={{ color: "#4B5563", fontSize: 9 }}>{unit}</span>
        </div>
        <div style={{ color: "#374151", fontSize: 8, marginTop: 2 }}>{sym} (auto)</div>
      </div>
    );
  }

  // Wrap calculator as renderCalc
  const renderCalc = (
    <>
      {/* Praça */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.2)", borderRadius: 6, padding: "9px 14px", fontSize: 12, fontWeight: 600, color: "#E63946" }}>Soja</div>
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
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Datas e volume</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Inp label="Data entrega atual" value={dtEntrega} onChange={setDtEntrega} type="date" />
            <Inp label="Data pagamento atual" value={dtPagto} onChange={setDtPagto} type="date" />
            <Inp label="Data entrega futura" value={dtEntregaFut} onChange={setDtEntregaFut} type="date" />
            <Inp label="Data pagamento futuro" value={dtPagtoFut} onChange={setDtPagtoFut} type="date" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ background: "#111827", borderRadius: 7, padding: "10px 14px", flex: 1 }}>
              <div style={{ color: "#4B5563", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Meses de carrego</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(meses, 1)}</div>
            </div>
            <Inp label="Volume (sacas)" value={volume} onChange={setVolume} step="500" />
          </div>
        </div>

        {/* Preço + dados automáticos */}
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Preço ofertado</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Preço informado</label>
              <div style={{ display: "flex", alignItems: "center" }}>
                <input type="number" step="0.5" value={precoInput} onChange={e => setPrecoInput(parseFloat(e.target.value) || 0)}
                  style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px 0 0 7px", color: "#F1F5F9", padding: "8px 10px", fontSize: 16, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, outline: "none", width: 120 }} />
                <div style={{ display: "flex" }}>
                  {["BRL", "USD"].map(m => (
                    <div key={m} onClick={() => setMoeda(m)} style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                      background: moeda === m ? "#457B9D" : "#1F2937",
                      color: moeda === m ? "#fff" : "#6B7280",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: m === "USD" ? "0 7px 7px 0" : 0,
                    }}>{m === "BRL" ? "R$/sc" : "US$/sc"}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Dual display */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "#111827", borderRadius: 7, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: "#4B5563", fontSize: 8 }}>Em reais</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(preco)}/sc</span>
            </div>
            <div style={{ background: "#111827", borderRadius: 7, padding: "8px 12px", flex: 1 }}>
              <div style={{ color: "#4B5563", fontSize: 8 }}>Em dólar</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>US$ {fmt(precoUSD)}/sc</span>
            </div>
          </div>

          <div style={{ color: "#4B5563", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dados automáticos (da API)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <AutoCard label="Chicago atual" value={fmt(chicagoAtual, 2)} unit="US$/bu" sym={cCurShort} color="#22C55E" />
            <AutoCard label="Câmbio atual" value={`R$ ${fmt(cambioAtual, 4)}`} unit="" sym={dCurShort} color="#457B9D" />
            <AutoCard label="Chicago futuro" value={fmt(chicagoFut, 2)} unit="US$/bu" sym={cFutShort} />
            <AutoCard label="Câmbio futuro" value={`R$ ${fmt(cambioFut, 4)}`} unit="" sym={dFutShort} />
          </div>
        </div>
      </div>

      {/* Custos de carrego + Basis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Custos de carrego</div>
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
              <div key={i} style={{ background: c.hl ? "rgba(245,158,11,0.08)" : "#111827", border: c.hl ? "1px solid rgba(245,158,11,0.2)" : "none", borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ color: c.hl ? "#F59E0B" : "#4B5563", fontSize: 8, fontWeight: 600 }}>{c.l}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.hl ? "#F59E0B" : "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(c.v)}</div>
                <div style={{ color: "#374151", fontSize: 8 }}>por saca</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Cálculo do basis atual</div>
          {[
            ["Preço atual", `R$ ${fmt(preco)}`, "R$/sc"],
            ["÷ Câmbio atual", fmt(cambioAtual, 4), "BRL/USD"],
            ["= Preço em US$/sc", fmt(precoUsdSc, 4), "US$/sc"],
            ["÷ Fator conversão", "2,20462", "sc→bu"],
            ["= Preço em US$/bu", fmt(precoUsdBu, 4), "US$/bu"],
            ["- Chicago atual", fmt(chicagoAtual, 4), "US$/bu"],
          ].map(([l, v, u], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
              <span style={{ color: "#9CA3AF" }}>{l}</span>
              <span style={{ color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>{v} <span style={{ color: "#4B5563", fontSize: 9 }}>{u}</span></span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4 }}>
            <span style={{ color: "#F59E0B", fontSize: 13, fontWeight: 600 }}>= BASIS ATUAL</span>
            <span style={{ color: "#F59E0B", fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(basisAtual, 4)} US$/bu</span>
          </div>
        </div>
      </div>

      {/* Ponto de equilíbrio 0x0 */}
      <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "18px 22px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#F59E0B", fontSize: 13, fontWeight: 700 }}>Ponto de equilíbrio (0×0)</div>
          <div style={{ color: "#F59E0B", fontSize: 10, opacity: 0.7, marginTop: 2 }}>Preço atual (R$ {fmt(preco)}) + custos de carrego (R$ {fmt(custoTotal)}) = preço mínimo para não perder</div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#F59E0B", fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(precoViab)}/sc</div>
      </div>

      {/* Tabela de ganho */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 14 }}>
        <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Se vender acima do equilíbrio</div>
        <div style={{ color: "#6B7280", fontSize: 10, marginBottom: 12 }}>Quanto rende cada real acima do 0×0 ({volume.toLocaleString("pt-BR")} sacas)</div>

        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 1fr", gap: 0, fontSize: 12 }}>
          {["Acima", "Preço venda", "Ganho/sc", "Ganho total"].map(h => (
            <div key={h} style={{ padding: "6px 10px", color: "#4B5563", fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</div>
          ))}
          {ganhoTable.map((g, i) => (
            <React.Fragment key={i}>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: i === 0 ? "#F59E0B" : "#9CA3AF", fontWeight: i === 0 ? 600 : 400 }}>
                {i === 0 ? "0×0" : `+R$ ${i}`}
              </div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: i === 0 ? "#F59E0B" : "#F1F5F9" }}>
                R$ {fmt(g.precoVenda)}
              </div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "'JetBrains Mono',monospace", color: i === 0 ? "#F59E0B" : "#22C55E" }}>
                {i === 0 ? "—" : `+R$ ${fmt(g.ganhaSc)}`}
              </div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "'JetBrains Mono',monospace", color: i === 0 ? "#F59E0B" : "#22C55E" }}>
                {i === 0 ? "—" : `+R$ ${g.ganhaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Projeção: o mercado consegue pagar? */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 14 }}>
        <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>O mercado consegue pagar?</div>
        <div style={{ color: "#6B7280", fontSize: 10, marginBottom: 14 }}>Projeção de preço em {MESES[fut.mi]} {fut.yr} usando basis histórico 5 anos + Chicago ({cFutShort}) + câmbio projetado (R$ {fmt(cambioFut, 4)})</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { label: "Pior cenário", sub: `Basis mín: ${fmt(basisMinFut, 0)} c/bu`, valor: precoFutPior, viavel: piorViavel, color: "#EF4444" },
            { label: "Cenário médio", sub: `Basis médio: ${fmt(basisMedFut, 0)} c/bu`, valor: precoFutMedio, viavel: medioViavel, color: "#F59E0B" },
            { label: "Melhor cenário", sub: `Basis máx: ${fmt(basisMaxFut, 0)} c/bu`, valor: precoFutMelhor, viavel: melhorViavel, color: "#22C55E" },
          ].map((c, i) => (
            <div key={i} style={{ background: `${c.viavel ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)"}`, border: `1px solid ${c.viavel ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ color: c.color, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>R$ {fmt(c.valor)}</div>
              <div style={{ color: "#6B7280", fontSize: 9, marginBottom: 6 }}>{c.sub}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.viavel ? "#22C55E" : "#EF4444" }} />
                <span style={{ color: c.viavel ? "#22C55E" : "#EF4444", fontSize: 10, fontWeight: 600 }}>
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
              <div style={{ position: "absolute", left: 0, right: 0, top: 12, height: 8, background: "rgba(255,255,255,0.03)", borderRadius: 4 }} />
              {/* 0x0 marker */}
              <div style={{ position: "absolute", left: `${toPct(precoViab)}%`, top: 4, transform: "translateX(-50%)", zIndex: 2 }}>
                <div style={{ background: "#F59E0B", color: "#080A0F", fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" }}>0×0: {fmt(precoViab, 0)}</div>
                <div style={{ width: 2, height: 10, background: "#F59E0B", margin: "1px auto 0", borderRadius: 1 }} />
              </div>
              {/* Scenario markers */}
              {[
                { v: precoFutPior, c: "#EF4444", l: "Pior" },
                { v: precoFutMedio, c: "#F59E0B", l: "Médio" },
                { v: precoFutMelhor, c: "#22C55E", l: "Melhor" },
              ].map((s, i) => (
                <div key={i} style={{ position: "absolute", left: `${toPct(s.v)}%`, top: 26, transform: "translateX(-50%)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.c, margin: "0 auto" }} />
                </div>
              ))}
            </>;
          })()}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#374151", marginTop: 8 }}>
          <span>Pior: R$ {fmt(precoFutPior, 0)}</span>
          <span style={{ color: "#F59E0B" }}>0×0: R$ {fmt(precoViab, 0)}</span>
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
          <div style={{ color: "#22C55E", fontSize: 13, fontWeight: 700 }}>Travar posição e acompanhar</div>
          <div style={{ color: "#22C55E", fontSize: 10, opacity: 0.7, marginTop: 2 }}>Salva os dados e permite acompanhar até a venda</div>
        </div>
        <div style={{ color: "#22C55E", fontSize: 20 }}>+</div>
      </div>
    </>
  );

  // ─── POSIÇÕES ───
  const renderPosicoes = () => (
    <div>
      {posicoes.length === 0 ? (
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "40px", textAlign: "center" }}>
          <div style={{ color: "#4B5563", fontSize: 14 }}>Nenhuma posição travada</div>
          <div style={{ color: "#374151", fontSize: 11, marginTop: 4 }}>Use a calculadora, simule e clique "Travar posição"</div>
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
          <div key={pos.id} style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 22px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <span style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 700 }}>{pos.praca}</span>
                <span style={{ color: "#6B7280", fontSize: 10, marginLeft: 10 }}>Aberta {pos.dataAbertura} — {pos.volume.toLocaleString("pt-BR")} sc</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ background: "rgba(34,197,94,0.1)", borderRadius: 5, padding: "3px 10px", fontSize: 9, fontWeight: 600, color: "#22C55E" }}>Aberta</div>
                <div onClick={() => setPosicoes(prev => prev.filter(p => p.id !== pos.id))} style={{ color: "#374151", fontSize: 11, cursor: "pointer", padding: "3px 6px" }}>✕</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Dados travados */}
              <div>
                <div style={{ color: "#4B5563", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dados travados</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {[
                    ["Preço entrada", `R$ ${fmt(pos.precoEntrada)}`],
                    ["0×0 (equilíbrio)", `R$ ${fmt(pos.precoViab)}`],
                    ["Chicago entrada", `${fmt(pos.chicagoEntrada, 0)} c/bu`],
                    ["Câmbio entrada", `R$ ${fmt(pos.cambioEntrada, 4)}`],
                    ["Custo carrego", `R$ ${fmt(pos.custoTotal)}/sc`],
                    ["Entrega futura", pos.dtEntregaFut],
                  ].map(([l, v], i) => (
                    <div key={i} style={{ background: "#111827", borderRadius: 5, padding: "6px 8px" }}>
                      <div style={{ color: "#374151", fontSize: 7 }}>{l}</div>
                      <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mercado hoje */}
              <div>
                <div style={{ color: "#4B5563", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Mercado hoje</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
                  {[
                    { l: `Chicago ${pos.cFutShort}`, v: `${fmt(chiHj, 0)} c/bu`, d: chiHj - pos.chicagoEntrada },
                    { l: `Câmbio ${pos.dFutShort}`, v: `R$ ${fmt(camHj, 4)}`, d: camHj - pos.cambioEntrada },
                  ].map((d, i) => (
                    <div key={i} style={{ background: "#111827", borderRadius: 5, padding: "6px 8px" }}>
                      <div style={{ color: "#374151", fontSize: 7 }}>{d.l}</div>
                      <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{d.v}</div>
                      <div style={{ color: d.d >= 0 ? "#22C55E" : "#EF4444", fontSize: 8 }}>{d.d >= 0 ? "▲" : "▼"} {d.d >= 0 ? "+" : ""}{fmt(d.d, i === 0 ? 0 : 4)} vs entrada</div>
                    </div>
                  ))}
                </div>

                {/* Preço teórico com variação vs entrada */}
                <div style={{ color: "#4B5563", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Preço teórico {MESES[pos.mesFutIdx]} {pos.mesFutYr}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                  {[
                    { l: "Pior", v: ptMinHj, var: varMin, ent: pos.ptEntradaMin },
                    { l: "Médio", v: ptMedHj, var: varMed, ent: pos.ptEntradaMed },
                    { l: "Melhor", v: ptMaxHj, var: varMax, ent: pos.ptEntradaMax },
                  ].map((s, i) => (
                    <div key={i} style={{ background: "#111827", borderRadius: 5, padding: "6px 8px", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ color: "#4B5563", fontSize: 7 }}>{s.l}</div>
                      <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>R$ {fmt(s.v)}</div>
                      <div style={{ color: s.var >= 0 ? "#22C55E" : "#EF4444", fontSize: 8, marginTop: 2 }}>
                        {s.var >= 0 ? "▲" : "▼"} {s.var >= 0 ? "+" : ""}{fmt(s.var)} vs entrada
                      </div>
                      <div style={{ color: "#374151", fontSize: 7, marginTop: 1 }}>Entrada: R$ {fmt(s.ent || s.v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ color: "#374151", fontSize: 9, lineHeight: 1.5 }}>
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
        <div style={{ width: 3, height: 18, background: "#E63946", borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Custo de carrego</span>
        {posicoes.length > 0 && <div style={{ background: "rgba(34,197,94,0.1)", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#22C55E" }}>{posicoes.length} aberta{posicoes.length > 1 ? "s" : ""}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ id: "calc", label: "Calculadora" }, { id: "posicoes", label: `Minhas posições (${posicoes.length})` }].map(t => (
          <div key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: subTab === t.id ? "rgba(230,57,70,0.1)" : "rgba(255,255,255,0.03)",
            color: subTab === t.id ? "#E63946" : "#6B7280",
            border: `1px solid ${subTab === t.id ? "rgba(230,57,70,0.3)" : "rgba(255,255,255,0.06)"}`,
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
        <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>{label}</label>
        <input type={type} value={value} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)} placeholder={placeholder}
          style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#F1F5F9", padding: "9px 10px", fontSize: 13, fontFamily: type === "number" ? "'JetBrains Mono',monospace" : "'Outfit',sans-serif", outline: "none", width: "100%", boxSizing: "border-box" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 28px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 3, height: 18, background: "#E63946", borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Ofertas firmes</span>
        <span style={{ color: "#4B5563", fontSize: 11 }}>Gere sua oferta e envie via WhatsApp</span>
      </div>

      {/* Mercado */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 18px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <Sel label="Produto / Mercado" value={mercadoOf} onChange={setMercadoOf} w={200}>
          <option value="Soja Exportação">Soja Exportação</option>
          <option value="Milho Exportação">Milho Exportação</option>
          <option value="Milho Interno (B3)">Milho Interno (B3)</option>
        </Sel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Dados do produtor */}
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Dados do produtor</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Inp2 label="Nome / Empresa" value={nome} onChange={setNome} placeholder="João Silva" />
            <Inp2 label="Fazenda" value={fazenda} onChange={setFazenda} placeholder="Fazenda Boa Vista" />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Volume</label>
              <div style={{ display: "flex" }}>
                <input type="number" value={volQtd} onChange={e => setVolQtd(parseFloat(e.target.value) || 0)}
                  style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px 0 0 7px", color: "#F1F5F9", padding: "9px 10px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", outline: "none", width: 100 }} />
                {["sacas", "toneladas"].map(u => (
                  <div key={u} onClick={() => setVolUnit(u)} style={{
                    padding: "9px 10px", cursor: "pointer", fontSize: 10, fontWeight: 600,
                    background: volUnit === u ? "#457B9D" : "#1F2937", color: volUnit === u ? "#fff" : "#6B7280",
                    border: "1px solid rgba(255,255,255,0.08)", borderLeft: "none",
                    borderRadius: u === "toneladas" ? "0 7px 7px 0" : 0,
                  }}>{u === "sacas" ? "Sacas" : "Ton"}</div>
                ))}
              </div>
              <div style={{ color: "#374151", fontSize: 9, marginTop: 3 }}>
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
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Condições comerciais</div>
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
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Modalidade</label>
              <div style={{ display: "flex" }}>
                {["FOB", "CIF"].map(m => (
                  <div key={m} onClick={() => setModalidade(m)} style={{
                    padding: "9px 16px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: modalidade === m ? "#457B9D" : "#1F2937", color: modalidade === m ? "#fff" : "#6B7280",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: m === "FOB" ? "7px 0 0 7px" : "0 7px 7px 0",
                  }}>{m}</div>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Funrural</label>
              <div style={{ display: "flex" }}>
                {[{ id: "descontado", l: "Descontado" }, { id: "folha", l: "Em folha" }].map(f => (
                  <div key={f.id} onClick={() => setFunrural(f.id)} style={{
                    padding: "9px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                    background: funrural === f.id ? "#457B9D" : "#1F2937", color: funrural === f.id ? "#fff" : "#6B7280",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: f.id === "descontado" ? "7px 0 0 7px" : "0 7px 7px 0",
                  }}>{f.l}</div>
                ))}
              </div>
            </div>
          </div>
          {/* Coordenadas FOB */}
          {modalidade === "FOB" && (
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Localização da fazenda (FOB)</label>
              <input value={coordenadas} onChange={e => setCoordenadas(e.target.value)} placeholder="Cole o link do Google Maps ou lat, lng"
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#F1F5F9", padding: "9px 10px", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
              <div style={{ color: "#374151", fontSize: 8, marginTop: 3 }}>Ex: -17.7969, -49.3197 ou link do Google Maps</div>
            </div>
          )}
        </div>
      </div>

      {/* Preço da oferta */}
      <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          Preço da oferta — {pLabel} — {MESES[eMi]} {eYr}
        </div>

        {/* Moeda primeiro */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#6B7280", fontSize: 9, marginBottom: 6 }}>Sua oferta será em:</div>
          <div style={{ display: "flex", gap: 0 }}>
            {["BRL", "USD"].map(m => (
              <div key={m} onClick={() => { setMoedaOferta(m); setPrecoOferta(0); }} style={{
                padding: "10px 24px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                background: moedaOferta === m ? "#457B9D" : "#1F2937",
                color: moedaOferta === m ? "#fff" : "#6B7280",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: m === "BRL" ? "8px 0 0 8px" : "0 8px 8px 0",
              }}>{m === "BRL" ? "R$ / saca" : "US$ / saca"}</div>
            ))}
          </div>
        </div>

        {/* Regiões na moeda selecionada */}
        <div style={{ color: "#6B7280", fontSize: 9, marginBottom: 8 }}>Clique em uma região para preencher, ou digite seu preço:</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { l: "Mínimo", brl: pMin, usd: pMinU, c: "#F59E0B" },
            { l: "Justo", brl: pJusto, usd: pJustoU, c: "#22C55E" },
            { l: "Agressivo", brl: pMax, usd: pMaxU, c: "#10B981" },
          ].map((r, i) => {
            const val = moedaOferta === "BRL" ? r.brl : r.usd;
            const isSelected = Math.abs(precoOferta - val) < 0.01 && precoOferta > 0;
            const simbolo = moedaOferta === "BRL" ? "R$" : "US$";
            return (
              <div key={i} onClick={() => setPrecoOferta(Math.round(val * 100) / 100)} style={{
                flex: 1, cursor: "pointer", borderRadius: 8, padding: "14px 16px",
                background: isSelected ? `${r.c}15` : "#111827",
                border: `1px solid ${isSelected ? `${r.c}44` : "rgba(255,255,255,0.06)"}`,
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = `${r.c}33`; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = isSelected ? `${r.c}44` : "rgba(255,255,255,0.06)"; }}>
                <div style={{ color: r.c, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{r.l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", fontFamily: "'JetBrains Mono',monospace" }}>{simbolo} {fmt(val)}</div>
                <div style={{ fontSize: 10, color: "#4B5563", marginTop: 2 }}>por saca</div>
              </div>
            );
          })}
        </div>

        {/* Input de preço */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 3 }}>Preço da oferta ({moedaOferta === "BRL" ? "R$/sc" : "US$/sc"})</label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ background: "#1F2937", border: "1px solid rgba(255,255,255,0.08)", borderRight: "none", borderRadius: "7px 0 0 7px", padding: "10px 12px", color: "#6B7280", fontSize: 13 }}>
                {moedaOferta === "BRL" ? "R$" : "US$"}
              </span>
              <input type="number" step="0.01" value={precoOferta || ""} onChange={e => setPrecoOferta(parseFloat(e.target.value) || 0)}
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0 7px 7px 0", color: "#22C55E", padding: "10px 12px", fontSize: 22, fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, outline: "none", width: 140 }} />
              <span style={{ color: "#4B5563", fontSize: 11, marginLeft: 6 }}>/saca</span>
            </div>
          </div>
          {precoOferta > 0 && (
            <div style={{ paddingBottom: 12 }}>
              <div style={{ color: "#374151", fontSize: 10 }}>
                Total: {moedaOferta === "BRL" ? "R$" : "US$"} {(precoOferta * volSacas).toLocaleString("pt-BR", { minimumFractionDigits: 0 })} ({volSacas.toLocaleString("pt-BR")} sc)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview + botão copiar — sempre visível quando tem preço */}
      {precoOferta > 0 && (
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Preview da oferta</div>
          <div style={{ background: "#111827", borderRadius: 8, padding: "14px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#9CA3AF", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 12 }}>
            {gerarTexto()}
          </div>
          <div onClick={copiarOferta} style={{
            background: copied ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)",
            border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.3)"}`,
            borderRadius: 8, padding: "12px 20px", cursor: "pointer",
            display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
            transition: "all 0.2s",
          }}>
            <span style={{ color: "#22C55E", fontSize: 14, fontWeight: 700 }}>
              {copied ? "Copiado! Cole no WhatsApp" : "Copiar oferta para WhatsApp"}
            </span>
          </div>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#6B7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Ofertas enviadas ({historico.length})
            </div>
            <div style={{ color: "#374151", fontSize: 9 }}>Cotações se atualizam diariamente</div>
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
                <div key={o.id} style={{ background: "#111827", borderRadius: 8, padding: "14px 16px" }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#22C55E", fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{simb} {fmt(o.preco)}/sc</span>
                      <span style={{ color: "#F1F5F9", fontSize: 11, fontWeight: 500 }}>{o.fazenda || o.nome}</span>
                      {o.mercado && <span style={{ color: "#374151", fontSize: 9 }}>{o.mercado}</span>}
                    </div>
                    <span style={{ color: "#4B5563", fontSize: 9 }}>{o.data}</span>
                  </div>
                  {/* Info */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: "#6B7280", marginBottom: 10 }}>
                    <span>{o.praca}</span>
                    <span>{o.volume.toLocaleString("pt-BR")} sc</span>
                    <span>Entrega: {o.entrega}</span>
                    <span>{o.modalidade}</span>
                    <span style={{ color: "#4B5563", fontFamily: "'JetBrains Mono',monospace" }}>Chi: {fmt(chiHj, 0)} c/bu</span>
                    <span style={{ color: "#4B5563", fontFamily: "'JetBrains Mono',monospace" }}>Dol: R$ {fmt(dolHj, 4)}</span>
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
                      borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#457B9D",
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
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#6B7280",
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
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function ProSafraApp() {
  const [page,setPage]=useState("dashboard");
  const [sbOpen,setSbOpen]=useState(true);
  const [time,setTime]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),60000);return()=>clearInterval(t);},[]);
  const greeting=time.getHours()<12?"Bom dia":time.getHours()<18?"Boa tarde":"Boa noite";
  const dateStr=time.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  // ─── SUPABASE DATA HOOK ───
  const { cotacoes, contractsDash, pracas, basisData, defaultBasis, ptax, loading, lastUpdate, isLive } = useSupabaseData();

  // Dólar header — read from cotacoes (DOL 1º venc or FX:USDBRL)
  const dolFirst = contractsDash.dolarB3[0];
  const fxSpot = cotacoes["FX:USDBRL"];
  const headerDol = dolFirst ? dolFirst.lp / 1000 : (fxSpot ? fxSpot.lp : 5.008);
  const headerDolStr = fmt(headerDol, 4);

  // Shorthand props for pages that need all data
  const dataProps = { PRACAS: pracas, COTACOES: cotacoes, BASIS_DATA: basisData, DEFAULT_BASIS: defaultBasis };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#080A0F",fontFamily:"'Outfit',sans-serif",color:"#F1F5F9"}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Sidebar */}
      <div style={{width:sbOpen?220:0,minHeight:"100vh",background:"#0B0E14",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",overflow:"hidden",transition:"width 0.3s cubic-bezier(0.4,0,0.2,1)",flexShrink:0}}>
        <div style={{padding:"20px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:30,height:30,borderRadius:7,background:"linear-gradient(135deg,#E63946,#C62828)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>PS</div>
            <div><div style={{fontSize:15,fontWeight:700,letterSpacing:"-0.02em"}}>ProSafra</div><div style={{fontSize:9,color:"#6B7280",marginTop:-2}}>O que realmente vale seu grão</div></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"10px 6px",overflowY:"auto"}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>setPage(n.id)} style={{
              display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:7,cursor:"pointer",
              background:page===n.id?"rgba(230,57,70,0.1)":"transparent",
              color:page===n.id?"#E63946":"#9CA3AF",fontSize:12,fontWeight:page===n.id?600:400,marginBottom:1,transition:"all 0.15s",whiteSpace:"nowrap",
            }} onMouseEnter={e=>{if(page!==n.id)e.currentTarget.style.background="rgba(255,255,255,0.03)";}}
               onMouseLeave={e=>{if(page!==n.id)e.currentTarget.style.background="transparent";}}>
              <span style={{fontSize:13,width:18,textAlign:"center",opacity:0.7}}>{n.icon}</span>{n.label}
            </div>
          ))}
        </nav>
        <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"#1E293B",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:"#457B9D"}}>PR</div>
            <div><div style={{fontSize:11,fontWeight:500,color:"#E2E8F0"}}>Produtor</div>
              <div style={{fontSize:9,color:"#457B9D",background:"rgba(69,123,157,0.12)",padding:"1px 5px",borderRadius:3,display:"inline-block",marginTop:1}}>Plano Básico</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{padding:"12px 28px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10,background:"rgba(8,10,15,0.88)",backdropFilter:"blur(12px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <button onClick={()=>setSbOpen(!sbOpen)} style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",color:"#9CA3AF",cursor:"pointer",borderRadius:5,padding:"5px 7px",fontSize:13,lineHeight:1}}>☰</button>
            <div>
              <span style={{fontSize:16,fontWeight:700}}>{page==="dashboard"?greeting:NAV.find(n=>n.id===page)?.label||""}</span>
              {page==="dashboard"&&<span style={{color:"#4B5563",fontSize:11,marginLeft:10}}>{dateStr}</span>}
              {page==="preco-justo"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Regiões de preço para negociação</span>}
              {page==="premios"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Prêmios de exportação — Base Paranaguá</span>}
              {page==="analise"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Regiões de preço em Chicago — Análise semanal</span>}
              {page==="fundamentos"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Oferta e demanda mundial — Dados USDA/WASDE</span>}
              {page==="fundos"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Managed Money — CFTC Commitments of Traders</span>}
              {page==="cambio"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Dólar futuro B3 — Projeção do mercado</span>}
              {page==="paridade"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Preço máximo no porto — Como a trading calcula</span>}
              {page==="carrego"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Vale a pena carregar ou vender agora?</span>}
              {page==="ofertas"&&<span style={{color:"#374151",fontSize:11,marginLeft:8}}>Gere sua oferta e envie via WhatsApp</span>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{background:"rgba(69,123,157,0.1)",border:"1px solid rgba(69,123,157,0.2)",borderRadius:7,padding:"7px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{color:"#457B9D",fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em"}}>USD/BRL</span>
              <span style={{color:"#F1F5F9",fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>R$ {headerDolStr}</span>
            </div>
            <div style={{width:7,height:7,borderRadius:"50%",background:isLive?"#22C55E":"#F59E0B",boxShadow:isLive?"0 0 6px #22C55E44":"0 0 6px #F59E0B44"}}/>
            <span style={{color:"#6B7280",fontSize:10}}>{loading?"Carregando…":isLive?"Dados ao vivo":"Dados offline"}</span>
          </div>
        </div>

        {page==="dashboard"&&<DashboardPage goTo={setPage} contractsDash={contractsDash}/>}
        {page==="preco-justo"&&<PrecoJustoPage {...dataProps}/>}
        {page==="premios"&&<PremiosPortoPage/>}
        {page==="analise"&&<AnaliseTecnicaPage COTACOES={cotacoes}/>}
        {page==="fundamentos"&&<FundamentosPage/>}
        {page==="fundos"&&<PosicaoFundosPage/>}
        {page==="cambio"&&<CambioPage COTACOES={cotacoes} ptax={ptax}/>}
        {page==="paridade"&&<ParidadePage COTACOES={cotacoes}/>}
        {page==="carrego"&&<CustoCarregoPage {...dataProps}/>}
        {page==="ofertas"&&<OfertasFirmesPage {...dataProps}/>}
        {!["dashboard","preco-justo","premios","analise","fundamentos","fundos","cambio","paridade","carrego","ofertas"].includes(page)&&(
          <div style={{padding:"60px 28px",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:16,opacity:0.3}}>{NAV.find(n=>n.id===page)?.icon}</div>
            <div style={{color:"#4B5563",fontSize:14}}>{NAV.find(n=>n.id===page)?.label} — Em construção</div>
          </div>
        )}

        <div style={{borderTop:"1px solid rgba(255,255,255,0.04)",margin:"0 28px",paddingTop:14,paddingBottom:20,display:"flex",justifyContent:"space-between",color:"#374151",fontSize:9}}>
          <span>Fonte: TradingView Data via RapidAPI • Supabase{isLive?" ✓":""} • {lastUpdate ? `Atualizado: ${new Date(lastUpdate).toLocaleTimeString("pt-BR")}` : "Dados com delay 10-15min"}</span>
          <span>ProSafra © 2026 — O que realmente vale seu grão</span>
        </div>
      </div>
    </div>
  );
}
