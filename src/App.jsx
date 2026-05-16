import { useState, useCallback, useEffect } from "react";

const WHATSAPP_NUMBER = "5511953840934";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;
const TAXA_LIMPEZA = 150;
const API_URL = "/api"; // Proxy seguro via Netlify Function — URL real fica no servidor
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_PT   = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const ULTIMA_DATA_COM_PRECO = "2027-01-31"; // bloqueia datas após essa data

const FERIADOS_2026 = new Set([
  "2026-01-01","2026-01-25","2026-02-16","2026-02-17","2026-02-18",
  "2026-04-03","2026-04-05","2026-04-21","2026-05-01","2026-06-11",
  "2026-07-09","2026-09-07","2026-10-12","2026-11-02","2026-11-15",
  "2026-11-20","2026-12-25","2026-12-31"
]);
const DATAS_ESPECIAIS = new Set(["2026-02-16","2026-02-17","2026-02-18","2026-12-25","2026-12-31"]);
const NOMES_FERIADOS  = {
  "2026-01-01":"Ano Novo","2026-01-25":"Aniversário SP",
  "2026-02-16":"Carnaval","2026-02-17":"Carnaval","2026-02-18":"Carnaval",
  "2026-04-03":"Sexta-feira Santa","2026-04-05":"Páscoa",
  "2026-04-21":"Tiradentes","2026-05-01":"Dia do Trabalho",
  "2026-06-11":"Corpus Christi","2026-07-09":"Revolução Constitucionalista",
  "2026-09-07":"Independência","2026-10-12":"N.S. Aparecida",
  "2026-11-02":"Finados","2026-11-15":"Proclamação da República",
  "2026-11-20":"Consciência Negra","2026-12-25":"Natal","2026-12-31":"Réveillon"
};

// Horários padrão (Sáb/Dom/Fer)
// Horários fallback (usados só se API não retornar período)
const HOR_FDS_FALLBACK = [
  { label:"08h às 17h" }, { label:"10h às 20h" },
  { label:"12h às 22h" }, { label:"09h às 00h" },
];
const HOR_SEG_FALLBACK = [{ label:"09h às 18h" }];
const HOR_FDS_ESP = [{ label:"08h às 17h" }, { label:"09h às 02h" }];
const HOR_SEG_ESP = [{ label:"09h às 00h" }];

const TABELA_PADRAO = [
  {pessoas:20,  fds_0817:700,  fds_1020:800,  fds_1222:900,  semana_0918:500},
  {pessoas:30,  fds_0817:800,  fds_1020:900,  fds_1222:1000, semana_0918:600},
  {pessoas:40,  fds_0817:900,  fds_1020:1000, fds_1222:1200, semana_0918:700},
  {pessoas:50,  fds_0817:1000, fds_1020:1200, fds_1222:1400, semana_0918:800},
  {pessoas:60,  fds_0817:1200, fds_1020:1400, fds_1222:1600, semana_0918:900},
  {pessoas:70,  fds_0817:1400, fds_1020:1600, fds_1222:1800, semana_0918:1000},
  {pessoas:80,  fds_0817:1600, fds_1020:1800, fds_1222:2000, semana_0918:1100},
  {pessoas:100, fds_0817:1800, fds_1020:2000, fds_1222:2200, semana_0918:1200},
  {pessoas:120, fds_0817:2200, fds_1020:2400, fds_1222:2600, semana_0918:1500},
  {pessoas:150, fds_0817:2500, fds_1020:2800, fds_1222:3000, semana_0918:2000},
];
const TABELA_ESPECIAL = [
  {pessoas:50,  fds_0817:2000, fds_0902:3500,  semana_0900:1500},
  {pessoas:60,  fds_0817:2300, fds_0902:4000,  semana_0900:1800},
  {pessoas:70,  fds_0817:2600, fds_0902:4500,  semana_0900:2100},
  {pessoas:80,  fds_0817:3000, fds_0902:5000,  semana_0900:2400},
  {pessoas:90,  fds_0817:3400, fds_0902:5500,  semana_0900:2700},
  {pessoas:100, fds_0817:4000, fds_0902:6000,  semana_0900:3000},
  {pessoas:120, fds_0817:4800, fds_0902:6500,  semana_0900:3600},
  {pessoas:150, fds_0817:5600, fds_0902:7500,  semana_0900:4200},
  {pessoas:200, fds_0817:7000, fds_0902:10000, semana_0900:5500},
];

const TIPOS_EVENTO = [
  { value:"social",      label:"Evento Social / Aniversário",   tabela:"padrao"    },
  { value:"corporativo", label:"Evento Corporativo",             tabela:"padrao"    },
  { value:"churrasco",   label:"Churrasco / Confraternização",  tabela:"padrao"    },
  { value:"casamento",   label:"Casamento",                      tabela:"casamento" },
  { value:"debutante",   label:"Debutante",                      tabela:"debutante" },
  { value:"outro",       label:"Outro",                          tabela:"padrao"    },
];

const toStr     = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fromStr   = s => { const [y,m,d]=s.split("-"); return new Date(+y,+m-1,+d); };
const fmtShort  = s => fromStr(s).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"});

function getTipoDia(ds) {
  if (DATAS_ESPECIAIS.has(ds)) return "especial";
  if (FERIADOS_2026.has(ds))   return "feriado";
  const dow = fromStr(ds).getDay();
  if (dow===0||dow===6) return "fds";
  return "semana";
}

function lookupPreco(tabela, nPessoas, horIdx, isSemana) {
  if (!tabela || !tabela.length) return 0;
  const row = tabela.find(r => r.pessoas >= nPessoas) || tabela[tabela.length-1];
  if (!row) return 0;
  // Novo formato: { pessoas, fds: [...], semana }
  if (Array.isArray(row.fds)) {
    if (isSemana) return row.semana || 0;
    return row.fds[horIdx] || row.fds[0] || 0;
  }
  // Formato antigo (fallback): { pessoas, fds_0817, ... }
  return 0;
}

export default function App() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = toStr(today);

  const [month,  setMonth]  = useState(today.getMonth());
  const [year,   setYear]   = useState(today.getFullYear());
  const [selSet, setSelSet] = useState(new Set());
  const [horMap, setHorMap] = useState({});
  const [nPessoas, setNPessoas]     = useState(40);
  const [tipoEvento, setTipoEvento] = useState("social");
  const [bookedDates, setBookedDates] = useState(new Set());
  const [precosCfg, setPrecosCfg]   = useState(null);
  const [periodoCfg, setPeriodoCfg] = useState(null);
  const [loading,   setLoading]     = useState(true);
  const [loadError, setLoadError]   = useState(false);

  const fetchDates = useCallback(() => {
    fetch(API_URL)
      .then(r=>r.json())
      .then(data => {
        setBookedDates(new Set(data.booked||[]));
        if (data.precos)  setPrecosCfg(data.precos);
        if (data.periodo) setPeriodoCfg(data.periodo);
        setLoading(false); setLoadError(false);
      })
      .catch(()=>{ setLoadError(true); setLoading(false); });
  },[]);

  useEffect(()=>{
    fetchDates();
    const iv = setInterval(fetchDates,60000);
    const onVis = ()=>{ if(document.visibilityState==="visible") fetchDates(); };
    document.addEventListener("visibilitychange",onVis);
    return ()=>{ clearInterval(iv); document.removeEventListener("visibilitychange",onVis); };
  },[fetchDates]);

  const prevMonth = ()=>{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = ()=>{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const toggleDate = useCallback((ds,isPast,isBooked)=>{
    if(isPast||isBooked||ds>ULTIMA_DATA_COM_PRECO) return;
    setSelSet(prev=>{
      const next=new Set(prev);
      if(next.has(ds)){ next.delete(ds); setHorMap(m=>{const n={...m};delete n[ds];return n;}); }
      else next.add(ds);
      return next;
    });
  },[]);

  // Derived
  const eventoAtual = TIPOS_EVENTO.find(t=>t.value===tipoEvento)||TIPOS_EVENTO[0];
  const isEspecial  = eventoAtual.tabela==="casamento"||eventoAtual.tabela==="debutante";
  const selDates    = Array.from(selSet).sort();

  const getTipoDiaCtx = ds => {
    const td  = getTipoDia(ds);
    const dow = fromStr(ds).getDay();
    if (td === "semana" && dow === 5 && sexta_e_fds) return "fds";
    return td;
  };

  // Horários dinâmicos do período atual (ou fallback)
  const getHorariosFds = () => {
    if (isEspecial) return HOR_FDS_ESP;
    return periodoCfg?.horarios_fds?.length ? periodoCfg.horarios_fds : HOR_FDS_FALLBACK;
  };
  const getHorarioSem = () => {
    if (isEspecial) return HOR_SEG_ESP[0];
    return periodoCfg?.horario_semana || HOR_SEG_FALLBACK[0];
  };
  const sexta_e_fds = isEspecial ? true : (periodoCfg?.sexta_e_fds || false);

  const getHorList = ds => {
    const dow = fromStr(ds).getDay();
    if (isEspecial) {
      const isSegQui = !FERIADOS_2026.has(ds) && dow >= 1 && dow <= 4;
      return isSegQui ? HOR_SEG_ESP : HOR_FDS_ESP;
    }
    const td = getTipoDia(ds);
    const isFdsDia = td === "fds" || td === "feriado" || (sexta_e_fds && dow === 5);
    return isFdsDia ? getHorariosFds() : [getHorarioSem()];
  };

  const getHor = ds => {
    const list=getHorList(ds);
    if(list.length===1) return list[0];
    return list[horMap[ds]??0]||list[0];
  };

  const setHor = (ds,idx) => setHorMap(prev=>({...prev,[ds]:idx}));

  const getTabela = () => {
    if (isEspecial) {
      // Para casamento/debutante: usa tabela_especial do período
      if (periodoCfg?.tabela_especial?.length) return periodoCfg.tabela_especial;
      if (precosCfg?.eventos_especiais?.[eventoAtual.tabela]?.length)
        return precosCfg.eventos_especiais[eventoAtual.tabela];
      return TABELA_ESPECIAL;
    }
    // Para eventos padrão: usa tabela do período
    if (periodoCfg?.tabela?.length) return periodoCfg.tabela;
    if (precosCfg?.tabela_padrao?.length) return precosCfg.tabela_padrao;
    return TABELA_PADRAO;
  };

  const calcDia = ds => {
    if (getTipoDiaCtx(ds) === "especial") return 0;
    const horList = getHorList(ds);
    const isSemana = horList.length === 1;
    const horIdx = isSemana ? 0 : (horMap[ds] ?? 0);
    const tab = getTabela();
    return lookupPreco(tab, nPessoas, horIdx, isSemana);
  };

  const temEspecial = selDates.some(d=>getTipoDia(d)==="especial");
  const precoBase   = !temEspecial ? selDates.reduce((s,d)=>s+calcDia(d),0) : null;
  const taxaLimp = isEspecial
    ? (precosCfg?.taxa_limpeza_especial ?? 300)
    : (periodoCfg?.taxa_limpeza ?? precosCfg?.taxa_limpeza ?? TAXA_LIMPEZA);
  const totalGeral  = precoBase!==null ? precoBase+taxaLimp : null;

  const labelDias = selDates.length===0 ? ""
    : selDates.length===1 ? fmtShort(selDates[0])
    : fmtShort(selDates[0])+" → "+fmtShort(selDates[selDates.length-1]);

  const subLabel = selDates.length===0 ? ""
    : selDates.length===1
      ? (getTipoDia(selDates[0])==="fds"      ? "Final de Semana (Sáb/Dom)"
        :getTipoDia(selDates[0])==="feriado"  ? "Feriado — "+(NOMES_FERIADOS[selDates[0]]||"")
        :getTipoDia(selDates[0])==="especial" ? "Consultar — "+(NOMES_FERIADOS[selDates[0]]||"")
        :"Segunda a Sexta")
      : selDates.length+" dia"+(selDates.length>1?"s":"")+" selecionado"+(selDates.length>1?"s":"");

  const sendWhatsapp = () => {
    if(!selDates.length) return;
    const periodo = selDates.length===1 ? fmtShort(selDates[0])
      : fmtShort(selDates[0])+" até "+fmtShort(selDates[selDates.length-1])+" ("+selDates.length+" dias)";
    const dets = selDates.map(d=>{
      const h=getHor(d);
      const td=getTipoDiaCtx(d);
      const lbl=td==="semana"?"Dia útil":td==="fds"?"Sáb/Dom/Sex":"Feriado";
      return "  • "+fmtShort(d)+" ("+lbl+") - "+h.label;
    }).join("\n");
    const val = temEspecial
      ? "Data especial - solicitar orçamento"
      : "R$ "+(precoBase||0).toLocaleString("pt-BR")+" + Taxa R$ "+taxaLimp+",00 = Total R$ "+(totalGeral||0).toLocaleString("pt-BR");
    const msg = encodeURIComponent(
      "Olá! Gostaria de reservar a Chácara dos Sonhos.\n\n"+
      "Tipo: "+eventoAtual.label+"\n"+
      "Período: "+periodo+"\n"+
      "Pessoas: "+nPessoas+"\n\n"+
      "Datas e horários:\n"+dets+"\n\n"+
      "Valor: "+val+"\n\nAguardo confirmação!"
    );
    window.open("https://wa.me/"+WHATSAPP_NUMBER+"?text="+msg,"_blank");
  };

  const firstDay    = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();

  const getDayClass = (ds,isPast,isBooked) => {
    if(isPast)                          return "past";
    if(isBooked)                        return "booked";
    if(ds > ULTIMA_DATA_COM_PRECO)      return "sem-periodo";
    if(selSet.has(ds))                  return "sel-day";
    const td=getTipoDia(ds);
    if(td==="especial") return "especial";
    if(td==="feriado")  return "feriado";
    return "available";
  };

  const PESSOAS_LIST = isEspecial
    ? [50,60,70,80,90,100,120,150,200]
    : [20,30,40,50,60,70,80,100,120,150];

  return (
    <div style={{fontFamily:"Segoe UI,Arial,sans-serif",minHeight:"100vh",background:"#faf8f8",display:"flex",flexDirection:"column"}}>
      <style>{`
        html,body,#root{margin:0;padding:0;width:100%;min-height:100vh;overflow-x:hidden}
        *{box-sizing:border-box;margin:0;padding:0}
        .site-header{background:#ffffff;color:#1a1a1a;box-shadow:0 2px 8px rgba(0,0,0,.08);border-bottom:1px solid #eee}
        .header-inner{max-width:900px;margin:0 auto;padding:1.25rem 1.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem}
        .logo-img{width:200px;height:auto;flex-shrink:0;display:block}
        .header-info{display:flex;gap:1.5rem;flex-wrap:wrap}
        .header-info-item{display:flex;align-items:center;gap:8px;font-size:13px;color:#555}
        .header-wa-btn{display:flex;align-items:center;gap:8px;background:#25D366;color:white;border:none;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap}
        .header-wa-btn:hover{background:#1ebe5d}
        .hero-banner{background:#000000;color:white;text-align:center;padding:2rem 1.5rem}
        .hero-banner h2{font-size:20px;font-weight:700;margin-bottom:6px}
        .hero-banner p{font-size:14px;opacity:.8}
        .hero-tags{display:flex;justify-content:center;gap:10px;margin-top:14px;flex-wrap:wrap}
        .hero-tag{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:5px 14px;font-size:12px}
        .main-content{max-width:720px;margin:0 auto;width:100%;padding:1.5rem 1rem 2rem;flex:1}
        .cal-card{background:white;border-radius:16px;box-shadow:0 2px 16px rgba(0,0,0,.07);padding:1.5rem}
        .day-cell{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:13px;cursor:pointer;position:relative;border:1.5px solid transparent;transition:all .1s;user-select:none;flex-direction:column;gap:2px;font-weight:500}
        .day-cell.available:hover{background:#fbeae8;border-color:#823122}
        .day-cell.booked{background:#f5f5f5;color:#ccc;cursor:not-allowed}
        .day-cell.past{color:#ddd;cursor:not-allowed}
        .day-cell.sel-day{background:#823122;color:white;font-weight:700}
        .day-cell.feriado{background:#fff3e0;color:#e65100;border-color:#ffcc80}
        .day-cell.feriado:hover{background:#ffe0b2;border-color:#e65100}
        .day-cell.especial{background:#fce4ec;color:#880e4f;border-color:#f48fb1}
        .day-cell.especial:hover{background:#f8bbd9;border-color:#880e4f}
        .day-cell.sem-periodo{background:#f9f9f9;color:#ccc;cursor:not-allowed}
        .day-cell.today-mark{border-color:#823122!important;font-weight:700}
        .day-dot{width:4px;height:4px;border-radius:50%;position:absolute;bottom:4px}
        .wa-btn{width:100%;padding:13px;background:#25D366;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
        .wa-btn:hover{background:#1ebe5d}
        .sel-input{width:100%;padding:9px 12px;border:1.5px solid #e0c8c5;border-radius:8px;font-size:14px;font-family:inherit;color:#1a1a1a;background:white;cursor:pointer}
        .sel-input:focus{outline:none;border-color:#823122}
        .site-footer{background:#000;color:rgba(255,255,255,.75);padding:2.5rem 1.5rem 1.5rem;margin-top:auto}
        .footer-inner{max-width:900px;margin:0 auto}
        .footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:2rem;margin-bottom:2rem}
        .footer-brand h3{color:white;font-size:18px;font-weight:800;margin-bottom:6px}
        .footer-col h4{color:white;font-size:12px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;opacity:.5}
        .footer-col ul{list-style:none;display:flex;flex-direction:column;gap:8px}
        .footer-col ul li{font-size:13px;display:flex;align-items:flex-start;gap:7px}
        .footer-divider{border:none;border-top:1px solid rgba(255,255,255,.08);margin-bottom:1.25rem}
        .footer-bottom{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;opacity:.4}
        .wa-float{display:none;position:fixed;top:16px;right:16px;z-index:999;width:52px;height:52px;background:#25D366;border-radius:50%;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(37,211,102,.5);text-decoration:none;transition:transform .2s}
        .wa-float:hover{transform:scale(1.08)}
        .wa-float-pulse{position:absolute;width:52px;height:52px;border-radius:50%;background:#25D366;opacity:.4;animation:pulse 2s infinite}
        @keyframes pulse{0%{transform:scale(1);opacity:.4}70%{transform:scale(1.5);opacity:0}100%{transform:scale(1.5);opacity:0}}
        @media(max-width:600px){.footer-grid{grid-template-columns:1fr;gap:1.5rem}.header-info{display:none}.header-wa-btn{display:none}.logo-img{width:140px}.wa-float{display:flex}}
      `}</style>

      {/* HEADER */}
      <header className="site-header">
        <div className="header-inner">
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyMy4wLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCINCgkgdmlld0JveD0iMCAwIDU5MC40IDI0MS4xIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1OTAuNCAyNDEuMTsiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4NCgkuc3Qwe2ZpbGw6I0U2QUMzMzt9DQoJLnN0MXtjbGlwLXBhdGg6dXJsKCNTVkdJRF8xXyk7fQ0KCS5zdDJ7ZmlsbDojMzAyQTNFO30NCgkuc3Qze2ZpbGw6IzgyMzEyMjt9DQoJLnN0NHtjbGlwLXBhdGg6dXJsKCNTVkdJRF80Xyk7fQ0KCS5zdDV7Y2xpcC1wYXRoOnVybCgjU1ZHSURfNl8pO2ZpbGw6bm9uZTt9DQoJLnN0NntjbGlwLXBhdGg6dXJsKCNTVkdJRF82Xyk7fQ0KPC9zdHlsZT4NCjxnIGlkPSJDYW1hZGFfMSI+DQoJPGc+DQoJCTxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0yNTguNSw3My4zYzguMywwLDEyLjMsNC45LDEyLjMsOWMwLDMuNi0zLDUuNi01LjgsNS42Yy0yLjMsMC00LjQtMS40LTQuNC00LjRjMi4yLDAuMiwzLjUtMS40LDMuNS0zLjUNCgkJCWMwLTIuNC0xLjgtNi4xLTUuNS02LjFjLTguOSwwLTkuNiwyNi43LDMsMjYuN2MzLjQsMCw2LjktMi40LDguMS02LjRoMC42Yy0wLjgsNy02LjEsMTAuNy0xMS44LDEwLjcNCgkJCUMyNDAsMTA0LjksMjM4LjcsNzMuMywyNTguNSw3My4zeiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMjg1LjIsNjEuMWgwLjZ2MTUuNWMxLjgtMi40LDQuOS0zLjMsNy42LTMuM2M1LjUsMCwxMC40LDMuNCwxMC40LDEwYzAsMTQtMywzNy4zLDE4LjQsMzcuMw0KCQkJYzEyLjEsMCwxNy4xLTEwLjEsMjguNy0xMC4xYzYuOCwwLDkuOCw0LjMsOS44LDguM2MwLDQuMy0yLjcsNi43LTYuNSw2LjdjLTEsMC0yLjItMC4yLTMuNC0wLjZjMS42LTQuNywxLjgtOC42LTUuNi04LjYNCgkJCWMtNi40LDAtMTQuOCw1LjUtMjQuNSw1LjVjLTI2LjgsMC0yNC44LTE5LjktMjQuOC00MC4xYzAtMi45LTAuOC03LjQtNC42LTcuNGMtMS41LDAtNC4xLDEtNS41LDMuNnYxMy40YzAsOS44LDAuNCwxMi40LDAuOSwxMy4xDQoJCQljLTEuMy0wLjYtMy4xLTAuOS00LjctMC45Yy0xLjksMC0zLjgsMC40LTQuOSwwLjlIMjc3YzAuNS0wLjcsMC45LTMuMywwLjktMTMuMVY3MS4xYzAtNC43LTAuOC01LjYtMC45LTYuMQ0KCQkJQzI3OCw2NSwyODEuNiw2NC4zLDI4NS4yLDYxLjF6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zMjcuOCw4MC43YzAtNC44LTIuNC02LjgtNC44LTYuOGMtMi43LDAtNS41LDIuNC01LjUsNi4xYzAsMi4xLDEuMywzLjgsMy41LDMuNWMwLDMtMi4xLDQuNC00LjQsNC40DQoJCQljLTIuOCwwLTUuOC0xLjktNS44LTUuNmMwLTYuNCw3LjMtOSwxMi42LTljMTAuNCwwLDEyLjMsNi44LDEyLjMsMTIuNHYxMC45YzAsNCwwLjQsNi42LDEuOSw2LjZjMC40LDAsMC45LTAuMSwxLjUtMC41djAuMw0KCQkJYy0xLjIsMS4zLTIuOSwxLjktNC42LDEuOWMtMy45LDAtNS42LTIuMS02LjItNC45Yy0yLjcsMy40LTYuMiw0LjktOS40LDQuOWMtNC40LDAtOC42LTIuOC04LjYtNy41DQoJCQlDMzEwLjMsODYuOSwzMjcuOCw4OS42LDMyNy44LDgwLjd6IE0zMjMuNiwxMDEuMmMxLjYsMCwzLjItMC42LDQuNS0xLjljLTAuNC0xLjgtMC40LTMuNy0wLjQtNS42bDAuMS0xMC4zDQoJCQljLTAuOSwzLjEtOS43LDUuOS05LjcsMTEuOUMzMTguMSw5OSwzMjAuNywxMDEuMiwzMjMuNiwxMDEuMnogTTMyMS43LDYzLjFoNS45TDMyMCw3MmgtMUwzMjEuNyw2My4xeiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMzU3LjYsNzMuM2M4LjMsMCwxMi4zLDQuOSwxMi4zLDljMCwzLjYtMyw1LjYtNS44LDUuNmMtMi4zLDAtNC40LTEuNC00LjQtNC40YzIuMiwwLjIsMy41LTEuNCwzLjUtMy41DQoJCQljMC0yLjQtMS44LTYuMS01LjUtNi4xYy04LjksMC05LjYsMjYuNywzLDI2LjdjMy40LDAsNi45LTIuNCw4LjEtNi40aDAuNmMtMC44LDctNi4xLDEwLjctMTEuOCwxMC43DQoJCQlDMzM5LjEsMTA0LjksMzM3LjgsNzMuMywzNTcuNiw3My4zeiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMzkzLjMsODAuN2MwLTQuOC0yLjQtNi44LTQuOC02LjhjLTIuNywwLTUuNSwyLjQtNS41LDYuMWMwLDIuMSwxLjMsMy44LDMuNSwzLjVjMCwzLTIuMSw0LjQtNC40LDQuNA0KCQkJYy0yLjgsMC01LjgtMS45LTUuOC01LjZjMC02LjQsNy4zLTksMTIuNi05YzEwLjQsMCwxMi4zLDYuOCwxMi4zLDEyLjR2MTAuOWMwLDQsMC40LDYuNiwxLjksNi42YzAuNCwwLDAuOS0wLjEsMS41LTAuNXYwLjMNCgkJCWMtMS4yLDEuMy0yLjksMS45LTQuNiwxLjljLTMuOSwwLTUuNi0yLjEtNi4yLTQuOWMtMi43LDMuNC02LjIsNC45LTkuNCw0LjljLTQuNCwwLTguNi0yLjgtOC42LTcuNQ0KCQkJQzM3NS44LDg2LjksMzkzLjMsODkuNiwzOTMuMyw4MC43eiBNMzg5LjEsMTAxLjJjMS42LDAsMy4yLTAuNiw0LjUtMS45Yy0wLjQtMS44LTAuNC0zLjctMC40LTUuNmwwLjEtMTAuMw0KCQkJYy0wLjksMy4xLTkuNyw1LjktOS43LDExLjlDMzgzLjYsOTksMzg2LjIsMTAxLjIsMzg5LjEsMTAxLjJ6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik00MTAuMiwxMDQuM2MwLjUtMC43LDAuOS0zLjMsMC45LTEzLjF2LTcuM2MwLTQuNy0wLjgtNS42LTAuOS02LjFjMSwwLDQuNi0wLjcsOC4yLTMuOGgwLjZ2MTEuNw0KCQkJYzMuMy02LjQsMTIuNC0yMS40LDIzLjEtMjEuNGM4LjgsMCwxMS44LDcuMyw2LjcsMTEuNGMtMC40LTMuOS0zLjctNS44LTcuOS01LjhjLTguNywwLTIxLjYsOC4yLTIyLDIzLjljMC4xLDcuOCwwLjQsMTAsMC45LDEwLjYNCgkJCWMtMS4zLTAuNi0zLjEtMC45LTQuNy0wLjljLTEuOSwwLTMuOCwwLjQtNC45LDAuOUg0MTAuMnoiLz4NCgkJPHBhdGggY2xhc3M9InN0MyIgZD0iTTQ0My45LDgwLjdjMC00LjgtMi40LTYuOC00LjgtNi44Yy0yLjcsMC01LjUsMi40LTUuNSw2LjFjMCwyLjEsMS4zLDMuOCwzLjUsMy41YzAsMy0yLjEsNC40LTQuNCw0LjQNCgkJCWMtMi44LDAtNS44LTEuOS01LjgtNS42YzAtNi40LDcuMy05LDEyLjYtOWMxMC40LDAsMTIuMyw2LjgsMTIuMywxMi40djEwLjljMCw0LDAuNCw2LjYsMS45LDYuNmMwLjQsMCwwLjktMC4xLDEuNS0wLjV2MC4zDQoJCQljLTEuMiwxLjMtMi45LDEuOS00LjYsMS45Yy0zLjksMC01LjYtMi4xLTYuMi00LjljLTIuNywzLjQtNi4yLDQuOS05LjQsNC45Yy00LjQsMC04LjYtMi44LTguNi03LjUNCgkJCUM0MjYuNCw4Ni45LDQ0My45LDg5LjYsNDQzLjksODAuN3ogTTQzOS43LDEwMS4yYzEuNiwwLDMuMi0wLjYsNC41LTEuOWMtMC40LTEuOC0wLjQtMy43LTAuNC01LjZsMC4xLTEwLjMNCgkJCWMtMC45LDMuMS05LjcsNS45LTkuNywxMS45QzQzNC4yLDk5LDQzNi44LDEwMS4yLDQzOS43LDEwMS4yeiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNNDg4LjYsNzMuM2M0LjgsMCw2LjYsMi4yLDcuNywzLjJ2LTUuM2MwLTQuNy0wLjctNS42LTAuOS02LjFjMSwwLDQuNi0wLjcsOC4yLTMuOGgwLjZ2MzAuMQ0KCQkJYzAsOS44LDAuNCwxMi40LDAuOSwxMy4xYy0xLjMtMC42LTIuOS0wLjktNC40LTAuOWMtMS44LDAtMy40LDAuNC00LjQsMC45di01LjdjLTEuOCw0LjQtNS4xLDYuMy04LjYsNi4zDQoJCQljLTguOSwwLTEzLjEtNi44LTEzLjEtMTQuOUM0NzQuNSw4MC43LDQ3OS44LDczLjMsNDg4LjYsNzMuM3ogTTQ4Mi40LDg5LjhjMCw0LjEsMS4yLDEzLjgsNywxMy44YzMuNCwwLDYuOC00LDYuOC04LjVWODEuNQ0KCQkJYzAtMS42LTEuNC03LjUtNi03LjVDNDg1LjIsNzQsNDgyLjQsODIuMSw0ODIuNCw4OS44eiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNNTI2LDczLjNjMTkuOSwwLDE5LjksMzEuNiwwLDMxLjZDNTA2LjUsMTA0LjksNTA2LjUsNzMuMyw1MjYsNzMuM3ogTTUyNy4xLDEwNC4zYzguNy0wLjUsNy43LTMwLjgtMS44LTMwLjMNCgkJCUM1MTUuNyw3NC41LDUxOC4zLDEwNC44LDUyNy4xLDEwNC4zeiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNNTQ2LjksOTcuMWMwLTMuMiwyLjYtNC44LDUuNS00LjhjMi41LDAsNS4xLDEuMyw1LjEsMy43Yy0yLjctMC4zLTQuNiwxLjItNC42LDMuNmMwLDIuOSwyLjMsNC40LDQuOSw0LjQNCgkJCWMyLjgsMCw1LjctMS44LDUuNy01LjVjMC03LjYtMTYuNi02LjEtMTYuNi0xNy4xYzAtNS42LDYuMS04LjEsMTItOC4xYzUuMiwwLDEwLjMsMi4xLDEwLjMsNmMwLDIuMy0xLjksNC40LTUuMiw0LjQNCgkJCWMtMi4yLDAtNC4yLTEuNS00LjItMy45YzMuMiwwLDQuMi01LjgtMS01LjhjLTIuMywwLTQuOSwxLjQtNC45LDQuN2MwLDcuOCwxNi43LDYuNCwxNi43LDE3LjFjMCw2LTYuNSw5LjItMTIuNyw5LjINCgkJCUM1NTAuNSwxMDQuOSw1NDYuOSwxMDAuNiw1NDYuOSw5Ny4xeiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNMjQ1LjEsMTc0LjJjMC01LjQsNC4zLTguMSw5LjItOC4xYzQuMywwLDguNiwyLjMsOC42LDYuM2MtNC41LTAuNS03LjcsMS45LTcuNyw2YzAsNC44LDMuOSw3LjQsOC4zLDcuNA0KCQkJYzQuNywwLDkuNi0zLjEsOS42LTkuMmMwLTEyLjgtMjguMS0xMC4yLTI4LjEtMjguOGMwLTkuNCwxMC40LTEzLjcsMjAuMi0xMy43YzguOCwwLDE3LjMsMy41LDE3LjMsMTBjMCwzLjktMy4yLDcuNS04LjgsNy41DQoJCQljLTMuNywwLTcuMS0yLjUtNy4xLTYuN2M1LjQsMCw3LjEtOS43LTEuNi05LjhjLTMuOSwwLTguMiwyLjQtOC4yLDhjMCwxMy4xLDI4LjIsMTAuOSwyOC4yLDI4LjhjMCwxMC4xLTExLDE1LjUtMjEuNCwxNS41DQoJCQlDMjUxLjIsMTg3LjMsMjQ1LjEsMTgwLjEsMjQ1LjEsMTc0LjJ6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zMTguOCwxMzRjMzMuNSwwLDMzLjUsNTMuMywwLDUzLjNDMjg1LjksMTg3LjMsMjg1LjksMTM0LDMxOC44LDEzNHogTTMyMC41LDE4Ni4yDQoJCQljMTQuOC0wLjksMTIuOS01Mi0zLjEtNTEuMUMzMDEuMywxMzYsMzA1LjgsMTg3LjIsMzIwLjUsMTg2LjJ6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik0zNTQuNSwxODYuMmMwLjktMS4xLDEuNS01LjUsMS41LTIyVjEzNWgxYzIuNiwxLjcsNS42LDQuMiw4LjksNC4yYzQuOSwwLDYuNS01LjIsMTYuMS01LjINCgkJCWM5LjMsMCwxNy40LDUuNywxNy40LDE2Ljh2MTMuNGMwLDE2LjUsMC42LDIwLjksMS41LDIyYy0yLjMtMS01LjItMS40LTgtMS40Yy0zLjMsMC02LjUsMC42LTguMiwxLjRoLTAuMmMwLjktMS4xLDEuNS01LjUsMS41LTIyDQoJCQlWMTQ4YzAtOS4yLTMuOC0xMi40LTcuOC0xMi40Yy00LjQsMC05LDMuOC05LDcuNHYyMS4yYzAsMTYuNSwwLjYsMjAuOSwxLjUsMjJjLTIuMy0xLTUuMi0xLjQtOC0xLjRjLTMuMywwLTYuNSwwLjYtOC4yLDEuNEgzNTQuNQ0KCQkJeiIvPg0KCQk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNNDI1LjksMTEzLjVoMXYyNi4xYzMuMS00LjEsOC4yLTUuNiwxMi44LTUuNmM5LjMsMCwxNy41LDUuNywxNy41LDE2LjhjMCwyMy43LTUsNjIuOSwzMS4xLDYyLjkNCgkJCWMyMC41LDAsMjguOC0xNy4xLDQ4LjUtMTcuMWMxMS41LDAsMTYuNiw3LjMsMTYuNiwxMy45YzAsNy4yLTQuNiwxMS4zLTExLDExLjNjLTEuNywwLTMuNy0wLjMtNS43LTFjMi44LTgsMy4xLTE0LjUtOS41LTE0LjUNCgkJCWMtMTAuOCwwLTI0LjksOS4zLTQxLjMsOS4zYy00NS4yLDAtNDEuOS0zMy42LTQxLjktNjcuNmMwLTQuOS0xLjMtMTIuNS03LjgtMTIuNWMtMi42LDAtNi45LDEuNy05LjIsNnYyMi43DQoJCQljMCwxNi41LDAuNiwyMC45LDEuNSwyMmMtMi4zLTEtNS4yLTEuNC04LTEuNGMtMy4zLDAtNi41LDAuNi04LjIsMS40aC0wLjJjMC45LTEuMSwxLjUtNS41LDEuNS0yMnYtMzMuOWMwLTcuOS0xLjMtOS41LTEuNS0xMC40DQoJCQlDNDEzLjgsMTE5LjksNDE5LjksMTE4LjgsNDI1LjksMTEzLjV6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik00OTMsMTM0YzMzLjUsMCwzMy41LDUzLjMsMCw1My4zQzQ2MC4xLDE4Ny4zLDQ2MC4xLDEzNCw0OTMsMTM0eiBNNDk0LjgsMTg2LjJjMTQuOC0wLjksMTIuOS01Mi0zLjEtNTEuMQ0KCQkJQzQ3NS41LDEzNiw0ODAsMTg3LjIsNDk0LjgsMTg2LjJ6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik01MjguMiwxNzQuMmMwLTUuNCw0LjMtOC4xLDkuMi04LjFjNC4zLDAsOC42LDIuMyw4LjYsNi4zYy00LjUtMC41LTcuNywxLjktNy43LDZjMCw0LjgsMy45LDcuNCw4LjMsNy40DQoJCQljNC43LDAsOS42LTMuMSw5LjYtOS4yYzAtMTIuOC0yOC4xLTEwLjItMjguMS0yOC44YzAtOS40LDEwLjQtMTMuNywyMC4yLTEzLjdjOC44LDAsMTcuMywzLjUsMTcuMywxMGMwLDMuOS0zLjIsNy41LTguOCw3LjUNCgkJCWMtMy43LDAtNy4xLTIuNS03LjEtNi43YzUuNCwwLDcuMS05LjctMS42LTkuOGMtMy45LDAtOC4yLDIuNC04LjIsOGMwLDEzLjEsMjguMiwxMC45LDI4LjIsMjguOGMwLDEwLjEtMTEsMTUuNS0yMS40LDE1LjUNCgkJCUM1MzQuMywxODcuMyw1MjguMiwxODAuMSw1MjguMiwxNzQuMnoiLz4NCgk8L2c+DQoJPGc+DQoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMTcuNyw3Mi42Yy0yLjQsMTctMTguMSwyOC44LTM1LjEsMjYuNGMtMTctMi40LTI4LjgtMTguMS0yNi40LTM1LjFjMi40LTE3LDE4LjEtMjguOCwzNS4xLTI2LjQNCgkJCUMxMDguMywzOS45LDEyMC4xLDU1LjYsMTE3LjcsNzIuNnoiLz4NCgkJPGc+DQoJCQk8ZGVmcz4NCgkJCQk8cmVjdCBpZD0iU1ZHSURfMl8iIHg9IjE4LjUiIHk9IjYyLjciIHdpZHRoPSIyMDAuMSIgaGVpZ2h0PSIxMzMuNyIvPg0KCQkJPC9kZWZzPg0KCQkJPGNsaXBQYXRoIGlkPSJTVkdJRF8xXyI+DQoJCQkJPHVzZSB4bGluazpocmVmPSIjU1ZHSURfMl8iICBzdHlsZT0ib3ZlcmZsb3c6dmlzaWJsZTsiLz4NCgkJCTwvY2xpcFBhdGg+DQoJCQk8ZyBjbGFzcz0ic3QxIj4NCgkJCQk8Zz4NCgkJCQkJPHBhdGggY2xhc3M9InN0MiIgZD0iTTQyLjgsMTgwLjJjLTcuNi0wLjEtMTUuMi0wLjgtMjIuNi0yLjJjLTAuOS0wLjItMS41LTEtMS4zLTEuOWMwLjItMC45LDEtMS41LDEuOS0xLjMNCgkJCQkJCWM3LjIsMS40LDE0LjcsMi4xLDIyLDIuMmM2LjksMC4xLDEyLjQsMC4xLDE5LjYtMS40YzUuMi0xLjEsOC41LTIuNCwxMS40LTMuNWMzLjktMS41LDcuMi0yLjksMTMuMi0zLjENCgkJCQkJCWM0LjQtMC4yLDkuMSwwLjMsMTMuOSwxLjRjMy40LDAuOCw2LjIsMS44LDguOSwyLjdjNS42LDIsMTAuOCwzLjksMjEuNiwzLjljMTAuOCwwLDE2LTEuOSwyMS42LTMuOWM1LjYtMiwxMS4zLTQuMSwyMi43LTQuMQ0KCQkJCQkJYzQuMywwLDkuMiwwLjUsMTMuOCwxLjRjNC42LDAuOSw5LjEsMi4yLDEzLjQsMy44YzAuOCwwLjMsMS4zLDEuMywwLjksMi4xYy0wLjMsMC44LTEuMywxLjMtMi4xLDAuOQ0KCQkJCQkJYy00LjItMS42LTguNS0yLjgtMTIuOS0zLjdjLTUuOS0xLjEtMTAuOC0xLjMtMTMuMi0xLjNjLTEwLjgsMC0xNiwxLjktMjEuNiwzLjljLTUuNiwyLTExLjMsNC4xLTIyLjcsNC4xDQoJCQkJCQljLTExLjQsMC0xNy4xLTIuMS0yMi43LTQuMWMtMi43LTEtNS4zLTEuOS04LjUtMi42Yy00LjUtMS04LjktMS40LTEzLTEuM2MtNS41LDAuMi04LjQsMS40LTEyLjIsMi45Yy0zLDEuMi02LjUsMi42LTEyLDMuNw0KCQkJCQkJYy02LDEuMi0xMSwxLjQtMTYuMywxLjRDNDUuNCwxODAuMyw0NC4xLDE4MC4zLDQyLjgsMTgwLjJ6IE0yMDIuOSwxOTEuMWMtNS45LTIuMi0xMi0zLjktMTguMS00LjljLTQuNi0wLjgtNy45LTEuMy0xMi4zLTEuMw0KCQkJCQkJYy0xMC4zLDAtMTUuNSwyLjEtMjAuNiw0LjFjLTUsMi05LjcsMy45LTE5LjQsMy45Yy05LjcsMC0xNC40LTEuOS0xOS40LTMuOWMtNS4xLTItMTAuMy00LjEtMjAuNi00LjFTNzcsMTg2LjksNzIsMTg4LjkNCgkJCQkJCWMtNSwyLTkuNywzLjktMTkuNCwzLjljLTEwLjIsMC0xNS0wLjgtMTkuNy0yLjFjLTAuOS0wLjItMS44LDAuMi0yLDEuMWMtMC4yLDAuOSwwLjMsMS44LDEuMSwyYzUsMS40LDEwLDIuMywyMC42LDIuMw0KCQkJCQkJYzEwLjMsMCwxNS41LTIuMSwyMC42LTQuMWM1LTIsOS43LTMuOSwxOS40LTMuOWM5LjcsMCwxNC40LDEuOSwxOS40LDMuOWM1LjEsMiwxMC4zLDQuMSwyMC42LDQuMXMxNS41LTIuMSwyMC42LTQuMQ0KCQkJCQkJYzUtMiw5LjctMy45LDE5LjQtMy45YzQuMSwwLDcuMywwLjUsMTEuNywxLjNjNiwxLDExLjksMi42LDE3LjUsNC44YzAuOCwwLjMsMS44LTAuMSwyLjEtMQ0KCQkJCQkJQzIwNC4yLDE5Mi4zLDIwMy43LDE5MS40LDIwMi45LDE5MS4xeiBNMjE4LjEsMTEzLjNjLTAuMywwLjUtMC44LDAuOC0xLjQsMC44Yy0wLjMsMC0wLjYtMC4xLTAuOS0wLjNsLTEyLTcuN3Y1NC42DQoJCQkJCQljMCwwLDAsMCwwLDBzMCwwLDAsMGMwLDAuMSwwLDAuMiwwLDAuM2MwLDAuMSwwLDAuMi0wLjEsMC4zYzAsMCwwLDAsMCwwYzAsMC4xLTAuMSwwLjItMC4xLDAuM2MwLDAuMS0wLjEsMC4xLTAuMSwwLjENCgkJCQkJCWMwLDAtMC4xLDAuMS0wLjEsMC4xYzAsMC0wLjEsMC4xLTAuMiwwLjFjMCwwLTAuMSwwLTAuMSwwLjFjLTAuMSwwLTAuMSwwLjEtMC4yLDAuMWMwLDAtMC4xLDAtMC4xLDAuMWMtMC4xLDAtMC4xLDAuMS0wLjIsMC4xDQoJCQkJCQljMCwwLTAuMSwwLTAuMSwwYy0wLjEsMC0wLjIsMC0wLjMsMGMwLDAsMCwwLDAsMGMtMC4xLDAtMC4yLDAtMC4zLDBjLTAuMSwwLTAuMiwwLTAuMy0wLjFjMCwwLDAsMCwwLDBjMCwwLDAsMCwwLDANCgkJCQkJCWMtNC4zLTEuOC04LjgtMy4xLTEzLjMtNGMtNC4zLTAuOC04LjYtMS4zLTEyLjYtMS4zYy0xMC40LDAtMTUuNSwxLjktMjAuOCwzLjljLTUuNCwyLTExLDQuMS0yMiw0LjFzLTE2LjYtMi4xLTIyLTQuMQ0KCQkJCQkJYy01LjQtMi0xMC40LTMuOS0yMC44LTMuOXMtMTUuNSwxLjktMjAuOCwzLjljLTUuNCwyLTExLDQuMS0yMiw0LjFjLTExLjMsMC0xNi42LTAuOC0yMi0yLjNjMCwwLTAuMSwwLTAuMSwwDQoJCQkJCQljLTAuMSwwLTAuMSwwLTAuMi0wLjFjMCwwLTAuMS0wLjEtMC4xLTAuMWMwLDAtMC4xLDAtMC4xLTAuMWMtMC4xLDAtMC4xLTAuMS0wLjItMC4xYzAsMC0wLjEsMC0wLjEtMC4xYzAsMCwwLDAsMCwwDQoJCQkJCQljMCwwLTAuMS0wLjEtMC4xLTAuMmMwLDAtMC4xLTAuMS0wLjEtMC4xYzAsMCwwLTAuMS0wLjEtMC4xYzAsMCwwLTAuMS0wLjEtMC4xYzAsMCwwLTAuMSwwLTAuMWMwLTAuMSwwLTAuMSwwLTAuMg0KCQkJCQkJYzAsMCwwLTAuMSwwLTAuMmMwLTAuMSwwLTAuMSwwLTAuMmMwLDAsMC0wLjEsMC0wLjFjMC0wLjEsMC0wLjEsMC0wLjJjMCwwLDAsMCwwLDBjMCwwLDAtMC4xLDAtMC4xYzAtMC4xLDAtMC4xLDAuMS0wLjINCgkJCQkJCXMwLjEtMC4xLDAuMS0wLjFjMCwwLDAuMS0wLjEsMC4xLTAuMWMwLTAuMSwwLjEtMC4xLDAuMS0wLjFjMCwwLDAtMC4xLDAuMS0wLjFjNy42LTcuMiwxNS45LTEzLjQsMjQuOC0xOC41di0zOQ0KCQkJCQkJYy0wLjgsMC4xLTEuNywwLjMtMi43LDAuOGMtMS43LDAuOC0yLjcsMi4xLTMuMiwzYy0wLjMsMC41LTAuOCwwLjgtMS40LDAuOGMtMC4zLDAtMC42LTAuMS0wLjktMC4yYy0wLjgtMC41LTEtMS41LTAuNS0yLjINCgkJCQkJCWMwLjgtMS4yLDIuMi0zLDQuNS00LjJjMC44LTAuNCwxLjYtMC43LDIuMy0wLjljLTAuNS0wLjQtMS0wLjctMS42LTFjLTEuMy0wLjYtMi43LTAuOS00LjEtMWMtMC45LDAtMS42LTAuOC0xLjYtMS43DQoJCQkJCQljMC0wLjksMC44LTEuNiwxLjctMS42YzEuOSwwLDMuNywwLjUsNS40LDEuM2MwLjYsMC4zLDEuMiwwLjYsMS43LDFjMC0wLjgsMC0xLjYsMC4yLTIuM2MwLjItMS4yLDAuNS0yLjMsMS0zLjQNCgkJCQkJCWMwLjQtMC44LDEuMy0xLjIsMi4yLTAuOGMwLjgsMC40LDEuMiwxLjMsMC44LDIuMmMtMC40LDAuOC0wLjYsMS43LTAuOCwyLjZjLTAuMSwwLjctMC4xLDEuMy0wLjEsMmMwLjgtMC42LDEuNy0xLjEsMi42LTEuNA0KCQkJCQkJYzEuNi0wLjYsMy4zLTAuOSw1LTAuOGMwLjksMCwxLjYsMC44LDEuNSwxLjdjLTAuMSwwLjktMC44LDEuNi0xLjcsMS41Yy0xLjItMC4xLTIuNSwwLjEtMy42LDAuNmMtMC45LDAuMy0xLjYsMC44LTIuMiwxLjMNCgkJCQkJCWMxLjMsMC41LDIuNSwxLjEsMy42LDEuOWMxLjIsMC45LDIuMywyLDMuMiwzLjJjMC41LDAuNywwLjQsMS44LTAuNCwyLjNjLTAuMywwLjItMC42LDAuMy0wLjksMC4zYy0wLjUsMC0xLTAuMi0xLjMtMC43DQoJCQkJCQljLTAuNy0xLTEuNS0xLjgtMi40LTIuNWMtMC45LTAuNy0xLjktMS4yLTMtMS41djM3YzYuNS0zLjYsMTMuMy02LjYsMjAuNC05LjFjMS42LTAuNSwzLjEtMS4xLDQuNy0xLjZjMCwwLDAsMCwwLTAuMVY3OS4xDQoJCQkJCQljLTEuMSwwLjEtMi41LDAuNC0zLjksMS4xYy0yLjIsMS4xLTMuNSwyLjctNC4yLDMuOGMtMC4zLDAuNS0wLjgsMC44LTEuNCwwLjhjLTAuMywwLTAuNi0wLjEtMC44LTAuMmMtMC44LTAuNS0xLTEuNS0wLjUtMi4yDQoJCQkJCQljMC45LTEuNSwyLjYtMy42LDUuNS01YzEuMi0wLjYsMi41LTEsMy42LTEuMmMtMC44LTAuNy0xLjctMS4zLTIuNy0xLjhjLTEuNi0wLjgtMy40LTEuMi01LjItMS4zYy0wLjksMC0xLjYtMC44LTEuNi0xLjcNCgkJCQkJCWMwLTAuOSwwLjgtMS42LDEuNy0xLjZjMi4zLDAuMSw0LjUsMC42LDYuNiwxLjZjMSwwLjUsMS45LDEsMi44LDEuN2MtMC4xLTEuMiwwLTIuNCwwLjItMy43YzAuMi0xLjQsMC42LTIuOCwxLjItNC4yDQoJCQkJCQljMC40LTAuOCwxLjMtMS4yLDIuMi0wLjhjMC44LDAuNCwxLjIsMS4zLDAuOCwyLjJjLTAuNSwxLjEtMC44LDIuMi0xLDMuNGMtMC4yLDEuMS0wLjIsMi4yLTAuMSwzLjNjMS4xLTAuOSwyLjQtMS43LDMuOC0yLjINCgkJCQkJCWMxLjktMC43LDQtMS4xLDYtMC45YzAuOSwwLjEsMS42LDAuOCwxLjUsMS43Yy0wLjEsMC45LTAuOCwxLjYtMS43LDEuNWMtMS42LTAuMS0zLjIsMC4yLTQuNywwLjdjLTEuNCwwLjYtMi42LDEuMy0zLjQsMi4xDQoJCQkJCQljMS44LDAuNiwzLjUsMS40LDUuMSwyLjVjMS41LDEuMSwyLjgsMi40LDMuOCwzLjljMC41LDAuNywwLjQsMS44LTAuNCwyLjNjLTAuMywwLjItMC42LDAuMy0wLjksMC4zYy0wLjUsMC0xLTAuMi0xLjMtMC43DQoJCQkJCQljLTAuOS0xLjItMS45LTIuMy0zLjEtMy4yYy0xLjMtMS0yLjgtMS43LTQuNC0yLjF2NDguOGM4LjQtMi40LDE3LjEtMy45LDI1LjktNC42di0xNy41bC0xMi41LDhjLTAuOCwwLjUtMS44LDAuMy0yLjMtMC41DQoJCQkJCQljLTAuNS0wLjgtMC4zLTEuOCwwLjUtMi4zbDYxLjUtMzkuNGMwLjUtMC4zLDEuMi0wLjMsMS44LDBsNjEuNSwzOS40QzIxOC40LDExMS41LDIxOC42LDExMi42LDIxOC4xLDExMy4zeiBNOTAsMTUzLjcNCgkJCQkJCWM3LjcsMCwxMi44LDEsMTcsMi4zdi0yOS40Yy0xMS4yLDAuOS0yMi4yLDMuMy0zMi44LDdjLTE2LjcsNS44LTMxLjgsMTQuOC00NS4xLDI2LjdjNC4zLDAuOSw5LjMsMS40LDE4LjIsMS40DQoJCQkJCQljMTAuNCwwLDE1LjUtMS45LDIwLjgtMy45QzczLjUsMTU1LjgsNzkuMSwxNTMuNyw5MCwxNTMuN3ogTTIwMC41LDEwNGwtNDUuMy0yOS4xbC00NC45LDI4Ljh2NTMuNGMwLjYsMC4yLDEuMiwwLjQsMS43LDAuNg0KCQkJCQkJYzUuNCwyLDEwLjQsMy45LDIwLjgsMy45czE1LjUtMS45LDIwLjgtMy45YzUuNC0yLDExLTQuMSwyMi00LjFjNC4yLDAsOC44LDAuNSwxMy4zLDEuM2M0LDAuOCw3LjksMS45LDExLjcsMy4zVjEwNHoNCgkJCQkJCSBNMTU3LjksMTI1LjJWMTE3YzAtMC45LDAuNy0xLjYsMS42LTEuNmgxMi44YzAuOSwwLDEuNiwwLjcsMS42LDEuNnY4LjFjMCwwLjktMC43LDEuNi0xLjYsMS42aC0xMi44DQoJCQkJCQlDMTU4LjYsMTI2LjgsMTU3LjksMTI2LjEsMTU3LjksMTI1LjJ6IE0xNjEuMSwxMjMuNWg5LjV2LTQuOWgtOS41VjEyMy41eiBNMTUyLjUsMTE3LjF2OC4yYzAsMC45LTAuNywxLjYtMS42LDEuNmgtMTIuOA0KCQkJCQkJYy0wLjksMC0xLjYtMC43LTEuNi0xLjZ2LTguMmMwLTAuOSwwLjctMS42LDEuNi0xLjZoMTIuOEMxNTEuOCwxMTUuNCwxNTIuNSwxMTYuMiwxNTIuNSwxMTcuMXogTTE0OS4yLDExOC43aC05LjV2NC45aDkuNQ0KCQkJCQkJVjExOC43eiBNMTU3LjksMTQzdi04LjFjMC0wLjksMC43LTEuNiwxLjYtMS42aDEyLjhjMC45LDAsMS42LDAuNywxLjYsMS42djguMWMwLDAuOS0wLjcsMS42LTEuNiwxLjZoLTEyLjgNCgkJCQkJCUMxNTguNiwxNDQuNiwxNTcuOSwxNDMuOSwxNTcuOSwxNDN6IE0xNjEuMSwxNDEuNGg5LjV2LTQuOWgtOS41VjE0MS40eiBNMTUyLjUsMTM0Ljl2OC4yYzAsMC45LTAuNywxLjYtMS42LDEuNmgtMTIuOA0KCQkJCQkJYy0wLjksMC0xLjYtMC43LTEuNi0xLjZ2LTguMmMwLTAuOSwwLjctMS42LDEuNi0xLjZoMTIuOEMxNTEuOCwxMzMuMywxNTIuNSwxMzQsMTUyLjUsMTM0Ljl6IE0xNDkuMiwxMzYuNWgtOS41djQuOWg5LjVWMTM2LjUNCgkJCQkJCXoiLz4NCgkJCQk8L2c+DQoJCQk8L2c+DQoJCTwvZz4NCgk8L2c+DQo8L2c+DQo8ZyBpZD0iQ2FtYWRhXzIiPg0KPC9nPg0KPC9zdmc+DQo=" alt="Chácara dos Sonhos" className="logo-img" />
          </div>
          
          <a className="header-wa-btn" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M5.077 19.965l-.098-.578C4.12 17.13 4.487 14.87 5.57 12.98 6.625 11.147 8.49 9.732 10.715 9.21c2.225-.52 4.563-.122 6.44 1.099 1.877 1.22 3.122 3.12 3.47 5.21.348 2.09-.26 4.24-1.647 5.88-1.387 1.64-3.37 2.62-5.513 2.701-1.4.053-2.776-.27-4.008-.94l-4.38 1.148 1-4.343z"/></svg>
            Fale conosco
          </a>
        </div>
      </header>

      {/* BANNER */}
      <div className="hero-banner">
        <h2>Verifique a disponibilidade de datas</h2>
        <p>Selecione as datas desejadas e solicite sua reserva direto pelo WhatsApp</p>
        <div className="hero-tags">
          <span className="hero-tag">Área verde completa</span>
          <span className="hero-tag">Piscina</span>
          <span className="hero-tag">Churrasqueira</span>
          <span className="hero-tag">Day use</span>
          <span className="hero-tag">Proibido som automotivo</span>
        </div>
      </div>

      {/* MAIN */}
      <main className="main-content">
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:"0.75rem",fontSize:12,color:"#555"}}>
          {[["#639922","Disponível"],["#E24B4A","Reservado"],["#823122","Selecionado"],["#e65100","Feriado"],["#880e4f","Consultar"],["#e0e0e0","Indisponível"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:c}}/>{l}
            </div>
          ))}
        </div>

        <div className="cal-card">
          {loading && (
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
                <div style={{width:36,height:36,borderRadius:8,background:"#f0f0f0"}}/>
                <div style={{width:140,height:20,borderRadius:6,background:"#f0f0f0"}}/>
                <div style={{width:36,height:36,borderRadius:8,background:"#f0f0f0"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
                {["D","S","T","Q","Q","S","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"#ccc",padding:"4px 0"}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                {Array.from({length:35},(_,i)=>(
                  <div key={i} style={{aspectRatio:"1",borderRadius:8,background:i%7===0||i%7===6?"#f5f0f0":"#f5f5f5"}}/>
                ))}
              </div>
              <div style={{textAlign:"center",color:"#bbb",fontSize:13,marginTop:"1rem"}}>Verificando disponibilidade...</div>
            </div>
          )}
          {loadError && <div style={{textAlign:"center",padding:"1rem",background:"#FCEBEB",borderRadius:8,color:"#A32D2D",fontSize:13,marginBottom:"1rem"}}>Não foi possível carregar as datas. Recarregue a página.</div>}

          {!loading && (
            <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
                <button onClick={prevMonth} style={{width:36,height:36,borderRadius:8,border:"1px solid #eee",background:"white",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>&#8249;</button>
                <span style={{fontWeight:700,fontSize:16,color:"#823122"}}>{MONTHS_PT[month]} {year}</span>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={fetchDates} title="Atualizar" style={{width:36,height:36,borderRadius:8,border:"1px solid #eee",background:"white",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#666"}}>&#8635;</button>
                  <button onClick={nextMonth} style={{width:36,height:36,borderRadius:8,border:"1px solid #eee",background:"white",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>&#8250;</button>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
                {DAYS_PT.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"#aaa",padding:"4px 0",textTransform:"uppercase",letterSpacing:"0.04em"}}>{d}</div>)}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                {Array.from({length:firstDay},(_,i)=><div key={"e"+i}/>)}
                {Array.from({length:daysInMonth},(_,i)=>{
                  const day=i+1, date=new Date(year,month,day), ds=toStr(date);
                  const isPast=date<today, isBooked=bookedDates.has(ds);
                  const cls=getDayClass(ds,isPast,isBooked), isToday=ds===todayStr;
                  return (
                    <div key={ds} className={"day-cell "+cls+(isToday?" today-mark":"")} onClick={()=>toggleDate(ds,isPast,isBooked)}>
                      {day}
                      {!isPast && !isBooked && (
                        <div className="day-dot" style={{background:
                          cls==="sel-day"?"white":
                          cls==="especial"?"#880e4f":
                          cls==="feriado"?"#e65100":
                          cls==="sem-periodo"?"#e0e0e0":"#639922"
                        }}/>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{display:"flex",gap:16,marginTop:"1rem",flexWrap:"wrap"}}>
                {[["#639922","Disponível"],["#E24B4A","Reservado"],["#823122","Selecionado"]].map(([c,l])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#666"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:c}}/>{l}
                  </div>
                ))}
              </div>
            </>
          )}

          {periodoCfg?.blocked && !loading && (
            <div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"1rem",marginTop:"1rem",textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#880e4f",marginBottom:6}}>📅 Período sem preços cadastrados</div>
              <div style={{fontSize:13,color:"#880e4f"}}>Entre em contato para solicitar orçamento para as datas desejadas.</div>
            </div>
          )}
          {!periodoCfg?.blocked && selDates.length===0 && !loading && (
            <div style={{textAlign:"center",color:"#aaa",fontSize:13,marginTop:"1.25rem"}}>
              Clique nas datas desejadas — múltiplas datas e não consecutivas são permitidas
            </div>
          )}

          {selDates.length>0 && (
            <div style={{marginTop:"1.25rem",background:"#fffafa",border:"1.5px solid #e8c4be",borderRadius:12,padding:"1.25rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#823122" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#823122"}}>{labelDias}</div>
                  <div style={{fontSize:12,color:"#999",marginTop:1}}>{subLabel}</div>
                </div>
              </div>

              {/* Tipo de evento */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:"#823122",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Tipo de evento</div>
                <select className="sel-input"
                  value={TIPOS_EVENTO.findIndex(t=>t.value===tipoEvento)}
                  onChange={e=>{
                    const t=TIPOS_EVENTO[+e.target.value];
                    setTipoEvento(t.value);
                    setHorMap({});
                    const esp=t.tabela==="casamento"||t.tabela==="debutante";
                    setNPessoas(esp?50:40);
                  }}>
                  {TIPOS_EVENTO.map((t,i)=>(
                    <option key={t.value} value={i}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Número de pessoas */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:"#823122",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Número de pessoas</div>
                <select className="sel-input" value={nPessoas} onChange={e=>setNPessoas(+e.target.value)}>
                  {PESSOAS_LIST.map((n,i)=>(
                    <option key={n} value={n}>{isEspecial&&i===0?"até "+n+" pessoas":n+" pessoas"}</option>
                  ))}
                </select>
              </div>

              {temEspecial ? (
                <div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:8,padding:"1rem",marginBottom:12,textAlign:"center"}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#880e4f",marginBottom:4}}>Data com tarifa especial</div>
                  <div style={{fontSize:13,color:"#880e4f"}}>Carnaval, Natal e Réveillon têm valores personalizados. Entre em contato para orçamento.</div>
                </div>
              ) : (
                <div style={{borderTop:"1px solid #e8c4be",paddingTop:14,marginTop:4}}>

                  {/* HORÁRIOS — estilo screenshot */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#823122",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#823122" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Horários
                    </div>
                    {selDates.map(d=>{
                      const td=getTipoDiaCtx(d);
                      const isSemana=td==="semana";
                      const horList=getHorList(d);
                      const curIdx=horMap[d]??0;
                      const dayLbl=td==="fds"?(isEspecial?"Sex/Sáb/Dom/Fer":"Sáb/Dom"):td==="feriado"?"Feriado":"Dia útil";
                      return (
                        <div key={d} style={{background:"#fdf5f4",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                          <div style={{fontSize:12,color:"#823122",fontWeight:600,marginBottom:isSemana?0:8}}>
                            {fmtShort(d)}
                            <span style={{fontWeight:400,color:"#aaa",marginLeft:6,fontSize:11}}>{dayLbl}</span>
                          </div>
                          {isSemana ? (
                            <div style={{fontSize:13,color:"#888",marginTop:2}}>
                              <span style={{display:"inline-block",padding:"5px 14px",borderRadius:6,background:"#823122",color:"white",fontWeight:600,fontSize:13}}>{getHor(d).label}</span>
                              <span style={{fontSize:11,color:"#bbb",marginLeft:8}}>(horário fixo)</span>
                            </div>
                          ) : (
                            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                              {horList.map((h,i)=>(
                                <button key={i} onClick={()=>setHor(d,i)}
                                  style={{flex:1,padding:"8px 10px",borderRadius:6,border:"1.5px solid "+(curIdx===i?"#823122":"#d9c5c2"),background:curIdx===i?"#823122":"white",color:curIdx===i?"white":"#666",fontSize:13,fontWeight:curIdx===i?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all 0.1s"}}>
                                  {h.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* VALORES */}
                  <div style={{borderTop:"1px solid #f0e0de",paddingTop:12}}>
                    {selDates.map(d=>(
                      <div key={d} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5e6e4",fontSize:13}}>
                        <span style={{color:"#888"}}>{fmtShort(d)}</span>
                        <span style={{fontWeight:600}}>R$ {calcDia(d).toLocaleString("pt-BR")}</span>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f5e6e4",fontSize:14}}>
                      <span style={{color:"#888"}}>Taxa de limpeza</span>
                      <span style={{fontWeight:600}}>R$ {taxaLimp.toLocaleString("pt-BR")},00</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:15}}>
                      <span style={{fontWeight:700,color:"#823122"}}>Total</span>
                      <span style={{fontWeight:800,color:"#823122",fontSize:17}}>R$ {(totalGeral||0).toLocaleString("pt-BR")}</span>
                    </div>
                    <div style={{fontSize:11,color:"#aaa",marginBottom:12}}>Sinal de 50% na assinatura do contrato · Saldo até 15 dias antes</div>
                  </div>
                </div>
              )}

              <button className="wa-btn" onClick={sendWhatsapp}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M5.077 19.965l-.098-.578C4.12 17.13 4.487 14.87 5.57 12.98 6.625 11.147 8.49 9.732 10.715 9.21c2.225-.52 4.563-.122 6.44 1.099 1.877 1.22 3.122 3.12 3.47 5.21.348 2.09-.26 4.24-1.647 5.88-1.387 1.64-3.37 2.62-5.513 2.701-1.4.053-2.776-.27-4.008-.94l-4.38 1.148 1-4.343z"/></svg>
                {temEspecial ? "Solicitar orçamento pelo WhatsApp" : "Confirmar reserva pelo WhatsApp"}
              </button>
              <button onClick={()=>{setSelSet(new Set());setHorMap({});}} style={{width:"100%",marginTop:8,padding:"9px",background:"transparent",border:"1px solid #e8c4be",borderRadius:8,fontSize:13,color:"#888",cursor:"pointer"}}>
                Limpar seleção
              </button>
            </div>
          )}
        </div>
      </main>

      {/* BOTÃO FLUTUANTE WHATSAPP — mobile */}
      <a className="wa-float" href={WHATSAPP_LINK} target="_blank" rel="noreferrer" aria-label="Fale conosco pelo WhatsApp">
        <div className="wa-float-pulse"/>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M5.077 19.965l-.098-.578C4.12 17.13 4.487 14.87 5.57 12.98 6.625 11.147 8.49 9.732 10.715 9.21c2.225-.52 4.563-.122 6.44 1.099 1.877 1.22 3.122 3.12 3.47 5.21.348 2.09-.26 4.24-1.647 5.88-1.387 1.64-3.37 2.62-5.513 2.701-1.4.053-2.776-.27-4.008-.94l-4.38 1.148 1-4.343z"/></svg>
      </a>

      {/* RODAPÉ */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>Chácara <span>dos Sonhos</span></h3>
              <p style={{marginTop:8}}>O espaço perfeito para celebrar momentos especiais com a família, amigos e colegas de trabalho. Natureza, conforto e estrutura completa.</p>
            </div>
            <div className="footer-col">
              <h4>Contato</h4>
              <ul>
                <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.49 12 19.79 19.79 0 011.42 3.38 2 2 0 013.4 1.21h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9a16 16 0 006.29 6.29l1.86-1.65a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>(11) 9 9999-9999</li>
                <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>chacaradossonhosembu@gmail.com</li>
                <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>São Paulo, SP</li>
                <li>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  <a href="https://instagram.com/chacaradossonhosembu" target="_blank" rel="noreferrer" style={{color:"rgba(255,255,255,0.75)",textDecoration:"none"}}>@chacaradossonhosembu</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Funcionamento</h4>
              <ul>
                <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Seg–Sex: 08h às 18h</li>
                <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Sáb–Dom: 08h às 20h</li>
                <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>Reservas com antecedência</li>
              </ul>
            </div>
          </div>
          <hr className="footer-divider"/>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Chácara dos Sonhos. Todos os direitos reservados.</span>
            <span>Desenvolvido com 💚</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
