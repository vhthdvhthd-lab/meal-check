import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STORAGE = {
  items: "rowoon_inventory_items_v1",
  weeks: "rowoon_inventory_weeks_v1",
  records: "rowoon_inventory_records_v1",
  incoming: "rowoon_inventory_incoming_v1",
  help: "rowoon_inventory_help_seen_v1"
};

const CATEGORIES = ["냉동식품", "냉장식품", "야채·채소", "부식자재"];
const UNITS = ["kg","g","개","봉지","통","쪽","단","망","알","기타"];
const STORAGE_METHODS = ["냉동","냉장","상온","기타"];
const DAYS = ["monday","tuesday","wednesday","thursday","friday"];
const DAY_LABELS = ["월","화","수","목","금"];

const initialItems = [
  ["떡갈비 1kg","냉동식품","봉지","냉동"],["떡갈비 1,200g","냉동식품","봉지","냉동"],
  ["간고등어","냉동식품","쪽","냉동"],["동그랑땡","냉동식품","봉지","냉동"],
  ["핫도그 375g","냉동식품","봉지","냉동"],["통등심돈까스","냉동식품","봉지","냉동"],
  ["함박스테이크 1kg","냉동식품","봉지","냉동"],["치킨너겟 500g","냉동식품","봉지","냉동"],
  ["바지락 400g","냉동식품","봉지","냉동"],
  ["계란 30구","냉장식품","알","냉장"],["참치액","냉장식품","g","냉장"],
  ["연유","냉장식품","g","냉장"],["연겨자","냉장식품","개","냉장"],
  ["마가린","냉장식품","g","냉장"],["버터","냉장식품","g","냉장"],
  ["어묵","냉장식품","1kg","냉장"],["우유 900ml","냉장식품","개","냉장"],
  ["동치미육수","냉장식품","개","냉장"],["닭가슴살","냉장식품","개","냉장"],
  ["비엔나소시지 1kg","냉장식품","봉지","냉장"],["크래미 144g+72g","냉장식품","개","냉장"],
  ["굴소스","냉장식품","g","냉장"],
  ["배추","야채·채소","통","냉장"],["파프리카","야채·채소","통","냉장"],
  ["청양고추","야채·채소","개","냉장"],["대파","야채·채소","단","냉장"],
  ["당근","야채·채소","개","냉장"],["양배추","야채·채소","통","냉장"],
  ["피클","야채·채소","g","냉장"],["파슬리","야채·채소","g","냉장"],
  ["양파","야채·채소","망(중)","상온"],["양파","야채·채소","개","상온"],
  ["건포도","야채·채소","g","상온"]
].map((x,i)=>({id:crypto.randomUUID(),name:x[0],category:x[1],unit:x[2],storage_method:x[3],
  expiration_type:x[1]==="야채·채소"?"납품일/소비기한":"유통기한",active:true,sort_order:i,
  created_at:new Date().toISOString(),updated_at:new Date().toISOString()}));

function load(key, fallback) {
  try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function uid(){return crypto.randomUUID();}
function isoDate(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseLocal(s){const [y,m,day]=s.split("-").map(Number); return new Date(y,m-1,day)}
function mondayOf(date){
  const d=new Date(date); d.setHours(0,0,0,0);
  const n=d.getDay(); const diff=n===0?-6:1-n; d.setDate(d.getDate()+diff); return d;
}
function weekInfo(date){
  const s=mondayOf(date), e=new Date(s); e.setDate(e.getDate()+4);
  return {start:isoDate(s),end:isoDate(e),startDate:s,endDate:e};
}
function fmtDate(s){if(!s)return ""; const d=parseLocal(s); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`}
function fmtRange(w){return `${w.startDate.getFullYear()}년 ${w.startDate.getMonth()+1}월 ${w.startDate.getDate()}일 ~ ${w.endDate.getMonth()+1}월 ${w.endDate.getDate()}일`}
function displayNum(v){ if(v==null||v==="")return ""; const n=Number(v); return Number.isFinite(n)?String(Number(n.toFixed(4))):String(v)}
function numeric(v){
  if(v==null||v==="") return 0;
  if(typeof v==="number") return v;
  const s=String(v).trim().replace(/,/g,"");
  if(/^[-+]?\d*\.?\d+$/.test(s)) return Number(s);
  const frac=s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if(frac) return Number(frac[1])/Number(frac[2]);
  const unit=s.match(/^(-?\d*\.?\d+)\s*(g|kg|개|알|봉지|통|쪽|단|망|ml)?$/i);
  return unit?Number(unit[1]):null;
}
function stockCalc(r,incomingOverride=null){
  const incomingValue=incomingOverride==null?r.incoming_quantity:incomingOverride;
  const vals=[r.opening_stock,incomingValue,...DAYS.map(d=>r[d+"_usage"])];
  if(vals.some(v=>v!=="" && v!=null && numeric(v)===null)) return null;
  return numeric(r.opening_stock)+numeric(incomingValue)-DAYS.reduce((a,d)=>a+numeric(r[d+"_usage"]),0);
}
function makeRecord(item, weekStart, opening=""){
  return {id:uid(),weekly_record_id:weekStart,item_id:item.id,opening_stock:opening,incoming_quantity:0,
    monday_usage:"",tuesday_usage:"",wednesday_usage:"",thursday_usage:"",friday_usage:"",
    current_stock:"",manual_stock:"",expiration_date:"",delivery_date:"",consumption_date:"",
    storage_method:item.storage_method,note:"",updated_at:new Date().toISOString()};
}
function App(){
  const [items,setItems]=useState(()=>{
    const saved=load(STORAGE.items,null);
    return (saved||initialItems).map(i=>i.category==="야채/채소"?{...i,category:"야채·채소"}:i);
  });
  const [weeks,setWeeks]=useState(()=>load(STORAGE.weeks,[]));
  const [records,setRecords]=useState(()=>load(STORAGE.records,[]));
  const [incoming,setIncoming]=useState(()=>load(STORAGE.incoming,[]));
  const [date,setDate]=useState(()=>isoDate(mondayOf(new Date())));
  const [calendarDate,setCalendarDate]=useState(()=>isoDate(new Date()));
  const [category,setCategory]=useState(CATEGORIES[0]);
  const [filter,setFilter]=useState("전체");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState("weekly");
  const [modal,setModal]=useState(null);
  const [editing,setEditing]=useState(null);
  const [saveState,setSaveState]=useState("저장됨");
  const [help,setHelp]=useState(()=>!load(STORAGE.help,false));

  useEffect(()=>save(STORAGE.items,items),[items]);
  useEffect(()=>save(STORAGE.weeks,weeks),[weeks]);
  useEffect(()=>save(STORAGE.records,records),[records]);
  useEffect(()=>save(STORAGE.incoming,incoming),[incoming]);

  const week=weekInfo(parseLocal(date));
  const activeItems=useMemo(()=>items.filter(i=>i.active).sort((a,b)=>a.sort_order-b.sort_order),[items]);

  useEffect(()=>{
    if(!weeks.some(w=>w.start===week.start)){
      setWeeks(prev=>[...prev,{id:uid(),start:week.start,end:week.end,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]);
    }
    setRecords(prev=>{
      let changed=false, next=[...prev];
      activeItems.forEach(item=>{
        const currentIndex=next.findIndex(r=>r.weekly_record_id===week.start&&r.item_id===item.id);
        const prior=next.find(r=>r.weekly_record_id===previousWeek(week.start)&&r.item_id===item.id);
        const priorEntry=prior?incoming.find(x=>x.weekly_record_id===prior.weekly_record_id&&x.item_id===prior.item_id):null;
        const priorIncoming=priorEntry?(numeric(priorEntry.quantity)??0):0;
        const carried=prior ? (prior.manual_stock!==""?prior.manual_stock:(stockCalc(prior,priorIncoming)??prior.current_stock??"")) : "";
        const opening=prior&&numeric(carried)===0?"":carried;
        if(currentIndex<0){
          const created=makeRecord(item,week.start,opening);
          next.push(prior?{...created,
            expiration_date:prior.expiration_date||"",
            delivery_date:prior.delivery_date||"",
            consumption_date:prior.consumption_date||"",
            storage_method:prior.storage_method||item.storage_method,
            note:prior.note||""
          }:created);
          changed=true;
        }
      });
      return changed?next:prev;
    });
    setIncoming(prev=>{
      let changed=false, next=[...prev];
      activeItems.forEach(item=>{
        const prior=prev.find(x=>x.weekly_record_id===previousWeek(week.start)&&x.item_id===item.id&&x.incoming_date);
        if(!prior)return;
        const current=next.find(x=>x.weekly_record_id===week.start&&x.item_id===item.id);
        if(!current){
          next.push({id:uid(),weekly_record_id:week.start,item_id:item.id,incoming_date:prior.incoming_date,quantity:"",created_at:new Date().toISOString()});
          changed=true;
        }else if(!current.incoming_date){
          next=next.map(x=>x.id===current.id?{...x,incoming_date:prior.incoming_date}:x);
          changed=true;
        }
      });
      return changed?next:prev;
    });
  },[week.start,activeItems.length]);

  function previousWeek(s){const d=parseLocal(s);d.setDate(d.getDate()-7);return isoDate(d)}
  function patchRecord(itemId,patch){
    setSaveState("저장 중...");
    setRecords(prev=>{const next=prev.map(r=>r.weekly_record_id===week.start&&r.item_id===itemId?
      {...r,...patch,updated_at:new Date().toISOString()}:r);save(STORAGE.records,next);return next});
    setTimeout(()=>setSaveState("저장됨"),350);
  }
  function getIncoming(itemId){
    return incoming.filter(x=>x.weekly_record_id===week.start&&x.item_id===itemId);
  }
  function totalIncoming(itemId){const first=getIncoming(itemId)[0];return first?(numeric(first.quantity)??0):0}
  function recordFor(item){return records.find(r=>r.weekly_record_id===week.start&&r.item_id===item.id)||makeRecord(item,week.start)}
  function effectiveStock(r){return r.manual_stock!==""&&r.manual_stock!=null?r.manual_stock:stockCalc(r,totalIncoming(r.item_id))}
  function expirationFor(item,r){return item.category==="야채·채소"?(r.consumption_date||""):(r.expiration_date||"")}
  function expiryStatus(s){
    if(!s)return "";
    const diff=Math.ceil((parseLocal(s)-new Date(new Date().toDateString()))/86400000);
    if(diff<0)return "기한 지남"; if(diff<=7)return "임박"; return "정상";
  }

  const visible=useMemo(()=>activeItems.filter(i=>{
    if(filter!=="기한 임박"&&category!=="전체"&&i.category!==category)return false;
    if(search&&!i.name.toLowerCase().includes(search.toLowerCase()))return false;
    const r=recordFor(i), st=effectiveStock(r), inc=totalIncoming(i.id);
    if(filter==="이번 주 입고"&&inc<=0)return false;
    if(filter==="재고 없음"&&numeric(st)!==0)return false;
    if(filter==="재고 확인"&&!(numeric(st)<0))return false;
    if(filter==="기한 임박"&&expiryStatus(expirationFor(i,r))!=="임박")return false;
    return true;
  }),[activeItems,category,search,filter,records,incoming,week.start]);

  const summary=useMemo(()=>{
    let no=0,check=0,near=0;
    activeItems.forEach(i=>{const r=recordFor(i),s=numeric(effectiveStock(r)); if(s===0)no++; if(s<0)check++; if(expiryStatus(expirationFor(i,r))==="임박")near++;});
    return {total:activeItems.length,no,check,near};
  },[activeItems,records,incoming,week.start]);

  function addItem(data){
    const item={...data,id:uid(),active:true,sort_order:items.length,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    setItems(prev=>{const next=[...prev,item];save(STORAGE.items,next);return next}); setModal(null);
  }
  function updateItem(data){
    setItems(prev=>{const next=prev.map(i=>i.id===data.id?{...i,...data,updated_at:new Date().toISOString()}:i);save(STORAGE.items,next);return next});setModal(null);
  }
  function patchItem(id,patch){
    setItems(prev=>{const next=prev.map(i=>i.id===id?{...i,...patch,updated_at:new Date().toISOString()}:i);save(STORAGE.items,next);return next});
  }
  function disableItem(id){setItems(prev=>prev.map(i=>i.id===id?{...i,active:false}:i));}
  function setItemActive(id,active){setItems(prev=>prev.map(i=>i.id===id?{...i,active,updated_at:new Date().toISOString()}:i));}
  function deleteItem(item){
    if(!confirm(`'${item.name}' 품목을 삭제할까요?\n해당 품목의 입력 내역도 함께 삭제됩니다.`)) return;
    setItems(prev=>prev.filter(i=>i.id!==item.id));
    setRecords(prev=>prev.filter(r=>r.item_id!==item.id));
    setIncoming(prev=>prev.filter(x=>x.item_id!==item.id));
  }
  function reorder(id,dir){
    const arr=[...items].sort((a,b)=>a.sort_order-b.sort_order),idx=arr.findIndex(i=>i.id===id),to=idx+dir;
    if(to<0||to>=arr.length)return;
    [arr[idx],arr[to]]=[arr[to],arr[idx]];
    setItems(arr.map((i,n)=>({...i,sort_order:n})));
  }
  function patchIncoming(itemId,patch){
    setIncoming(prev=>{
      const found=prev.find(x=>x.weekly_record_id===week.start&&x.item_id===itemId);
      const next=found?prev.map(x=>x.id===found.id?{...x,...patch}:x):[...prev,{id:uid(),weekly_record_id:week.start,item_id:itemId,incoming_date:"",quantity:"",created_at:new Date().toISOString(),...patch}];
      save(STORAGE.incoming,next);return next;
    });
  }
  function copyLastWeek(){
    const prevStart=previousWeek(week.start);
    setRecords(rs=>rs.map(r=>{
      if(r.weekly_record_id!==week.start)return r;
      const p=rs.find(x=>x.weekly_record_id===prevStart&&x.item_id===r.item_id);
      if(!p)return r;
      const priorEntry=incoming.find(x=>x.weekly_record_id===prevStart&&x.item_id===p.item_id);
      const priorIncoming=priorEntry?(numeric(priorEntry.quantity)??0):0;
      const calculated=p.manual_stock!==""&&p.manual_stock!=null?p.manual_stock:(stockCalc(p,priorIncoming)??p.current_stock??"");
      const v=numeric(calculated)===0?"":calculated;
      return {...r,opening_stock:v,updated_at:new Date().toISOString()};
    }));
    setIncoming(prev=>{
      let next=[...prev];
      activeItems.forEach(item=>{
        const prior=prev.find(x=>x.weekly_record_id===prevStart&&x.item_id===item.id&&x.incoming_date);
        if(!prior)return;
        const current=next.find(x=>x.weekly_record_id===week.start&&x.item_id===item.id);
        if(current) next=next.map(x=>x.id===current.id?{...x,incoming_date:prior.incoming_date}:x);
        else next.push({id:uid(),weekly_record_id:week.start,item_id:item.id,incoming_date:prior.incoming_date,quantity:"",created_at:new Date().toISOString()});
      });
      return next;
    });
    setSaveState("지난주 내용 불러옴");
    setTimeout(()=>setSaveState("저장됨"),1200);
  }
  function printNow(){window.print()}

  if(page==="items") return <><ItemPage items={items} onBack={()=>setPage("weekly")} onAdd={()=>setModal({type:"item",data:null})}
    onEdit={i=>setModal({type:"item",data:i})} onToggle={setItemActive} onDelete={deleteItem} onReorder={reorder}/>
    {modal?.type==="item"&&<ItemModal data={modal.data} defaults={modal.defaults} onClose={()=>setModal(null)} onSave={modal.data?updateItem:addItem}/>}</>;
  if(page==="history") return <HistoryPage weeks={weeks} onBack={()=>setPage("weekly")} onOpen={s=>{setDate(s);setCalendarDate(s);setPage("weekly")}}/>;

  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="star">✦</div><div><div className="brand-name">로운주간이용센터</div><div className="brand-sub">주간 식자재 수불대장</div></div></div>
      <div className="header-actions"><span className="save-state">● {saveState}</span><button className="ghost" onClick={()=>setHelp(true)}>?</button><button className="ghost" onClick={()=>setPage("history")}>주간 기록</button><button className="ghost" onClick={()=>setPage("items")}>품목 관리</button></div>
    </header>

    <main className="container">
      <section className="title-row">
        <div><h1>이번 주 식자재 수불대장</h1><div className="range">{fmtRange(week)}</div><div className="print-category">{category}</div></div>
        <div className="title-right-stack"><div className="title-utility"><button onClick={printNow}>🖨 인쇄 / PDF 저장</button><input className="title-date" aria-label="날짜 선택" type="date" value={calendarDate} onChange={e=>{if(!e.target.value)return;setCalendarDate(e.target.value);setDate(isoDate(mondayOf(parseLocal(e.target.value))))}}/></div><div className="filters"><div className="search">⌕<input placeholder="품목 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div>{["전체","이번 주 입고","재고 없음","재고 확인"].map(f=><button className={filter===f?"filter active-filter":"filter"} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div></div>
        <section className="print-approval" aria-label="결재란">
          <div className="approval-title">결<br/><br/>재</div>
          {['담 당','팀 장','국 장','센 터 장'].map(role=><div className="approval-cell" key={role}><span>{role}</span><i></i></div>)}
        </section>
      </section>

      <div className="summary">
        <Summary title="전체 품목" value={summary.total} icon="▦" active={filter==="전체"} onClick={()=>setFilter("전체")}/>
        <Summary title="재고 없음" value={summary.no} icon="○" active={filter==="재고 없음"} onClick={()=>setFilter("재고 없음")}/>
        <Summary title="재고 확인" value={summary.check} icon="!" active={filter==="재고 확인"} onClick={()=>setFilter("재고 확인")}/>
        <Summary title="기한 임박" value={summary.near} icon="◷" emphasis="expiry" active={filter==="기한 임박"} onClick={()=>setFilter("기한 임박")}/>
      </div>

      <section className="control-panel">
        <div className="tabs">{CATEGORIES.map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div>
        <div className="main-actions" aria-label="주요 기능">
          <button onClick={()=>shiftWeek(-1)}>← 이전 주</button>
          <button className="today" onClick={()=>{setDate(isoDate(mondayOf(new Date())));setCalendarDate(isoDate(new Date()))}}>이번 주</button>
          <button onClick={()=>shiftWeek(1)}>다음 주 →</button>
          <button onClick={copyLastWeek}>↻ 지난주 재고 불러오기</button>
          <button className="primary" onClick={()=>setModal({type:"item",data:null,defaults:{category}})}>＋ 품목 추가</button>
        </div>
      </section>

      {filter==="기한 임박"&&<div className="expiry-filter-note">전체 카테고리의 기한 임박 품목을 표시 중입니다.</div>}

      <InventoryTable items={visible} records={records} incoming={incoming} week={week} patchRecord={patchRecord} patchItem={patchItem}
        getIncoming={getIncoming} totalIncoming={totalIncoming} patchIncoming={patchIncoming}
        expirationFor={expirationFor} expiryStatus={expiryStatus} effectiveStock={effectiveStock} onDelete={deleteItem} showCategory={filter==="기한 임박"}/>

      <div className="print-logo"><img src="/rowoon-center-logo.png" alt="사회적협동조합 로운주간이용센터"/></div>

      <div className="footer-note">입력 내용은 이 브라우저에 자동 저장됩니다. 실제 재고가 계산값과 다르면 <b>재고현황</b>을 직접 수정할 수 있습니다.</div>
    </main>

    {modal?.type==="item"&&<ItemModal data={modal.data} defaults={modal.defaults} onClose={()=>setModal(null)} onSave={modal.data?updateItem:addItem}/>} 
    {help&&<Help onClose={()=>{setHelp(false);save(STORAGE.help,true)}}/>}
  </div>;

  function shiftWeek(n){
    const d=parseLocal(week.start);d.setDate(d.getDate()+n*7);const targetStart=isoDate(d);
    if(n>0){
      setRecords(prev=>{
        let next=[...prev];
        activeItems.forEach(item=>{
          const source=next.find(r=>r.weekly_record_id===week.start&&r.item_id===item.id);
          if(!source)return;
          const sourceIncoming=incoming.find(x=>x.weekly_record_id===week.start&&x.item_id===item.id);
          const incomingQty=sourceIncoming?(numeric(sourceIncoming.quantity)??0):0;
          const calculated=source.manual_stock!==""&&source.manual_stock!=null?source.manual_stock:(stockCalc(source,incomingQty)??source.current_stock??"");
          const opening=numeric(calculated)===0?"":calculated;
          const targetIndex=next.findIndex(r=>r.weekly_record_id===targetStart&&r.item_id===item.id);
          if(targetIndex>=0)next[targetIndex]={...next[targetIndex],opening_stock:opening,updated_at:new Date().toISOString()};
          else next.push({...makeRecord(item,targetStart,opening),expiration_date:source.expiration_date||"",delivery_date:source.delivery_date||"",consumption_date:source.consumption_date||"",storage_method:source.storage_method||item.storage_method,note:source.note||""});
        });
        save(STORAGE.records,next);return next;
      });
      setIncoming(prev=>{
        let next=[...prev];
        activeItems.forEach(item=>{
          const source=prev.find(x=>x.weekly_record_id===week.start&&x.item_id===item.id&&x.incoming_date);
          if(!source)return;
          const target=next.find(x=>x.weekly_record_id===targetStart&&x.item_id===item.id);
          if(target&&!target.incoming_date)next=next.map(x=>x.id===target.id?{...x,incoming_date:source.incoming_date}:x);
          else if(!target)next.push({id:uid(),weekly_record_id:targetStart,item_id:item.id,incoming_date:source.incoming_date,quantity:"",created_at:new Date().toISOString()});
        });
        save(STORAGE.incoming,next);return next;
      });
    }
    setDate(targetStart);
    const shown=parseLocal(calendarDate);shown.setDate(shown.getDate()+n*7);setCalendarDate(isoDate(shown));
  }
}

function Summary({title,value,icon,onClick,active,emphasis}){return <button className={`summary-card ${active?"summary-active":""} ${emphasis?`summary-${emphasis}`:""}`} onClick={onClick}><span className="summary-icon">{icon}</span><span><small>{title}</small><strong>{value}</strong></span></button>}

function InventoryTable({items,records,incoming,week,patchRecord,patchItem,getIncoming,totalIncoming,patchIncoming,expirationFor,expiryStatus,effectiveStock,onDelete,showCategory}){
  return <div className="table-wrap"><table className="inventory">
    <thead><tr>
      <th className="sticky-col item-col">품목명</th><th>단위</th><th>기초재고<br/>(전주이월)</th><th>입고일자</th><th>입고수량</th>
      {DAY_LABELS.map(d=><th key={d}>{d} 사용량</th>)}<th>재고현황</th><th>유통기한<br/>/ 소비기한</th><th>보관방법</th><th>비고</th><th className="delete-col">삭제</th>
    </tr></thead>
    <tbody>{items.map(item=>{
      const r=records.find(x=>x.weekly_record_id===week.start&&x.item_id===item.id)||{};
      const ins=getIncoming(item.id), total=totalIncoming(item.id), st=effectiveStock(r), status=expiryStatus(expirationFor(item,r));
      return <tr key={item.id}>
        <td className="sticky-col item-name"><b>{item.name}</b>{showCategory&&<span className="item-category-badge">{item.category}</span>}{ins.length>0&&<span className="mini-badge">입고 {ins.length}건</span>}</td>
        <td><input className="unit-input" value={item.unit||""} placeholder="단위" onChange={e=>patchItem(item.id,{unit:e.target.value})}/></td>
        <td><input className="num" value={r.opening_stock??""} onChange={e=>patchRecord(item.id,{opening_stock:e.target.value})}/></td>
        <td className={`incoming-date-cell ${ins[0]?.quantity&&!ins[0]?.incoming_date?"date-required":""}`}><input className="screen-date" aria-label={`${item.name} 입고일자`} title={ins[0]?.quantity&&!ins[0]?.incoming_date?"입고일자를 입력하세요":"입고일자"} type="date" required value={ins[0]?.incoming_date||""} onChange={e=>patchIncoming(item.id,{incoming_date:e.target.value})}/><span className="print-date">{ins[0]?.incoming_date?fmtDate(ins[0].incoming_date):""}</span></td>
        <td className="incoming-qty-cell"><input aria-label={`${item.name} 입고수량`} className="incoming-qty" value={ins[0]?.quantity||""} placeholder="수량" onChange={e=>patchIncoming(item.id,{quantity:e.target.value})}/></td>
        {DAYS.map(d=><td key={d}><input className="num" value={r[d+"_usage"]??""} onChange={e=>patchRecord(item.id,{[d+"_usage"]:e.target.value})}/></td>)}
        <td className="stock-cell"><input className={`stock ${numeric(st)<0?"negative":numeric(st)===0?"zero":""}`} value={r.manual_stock!==""&&r.manual_stock!=null?r.manual_stock:(st==null?"직접 확인":displayNum(st))}
          onChange={e=>patchRecord(item.id,{manual_stock:e.target.value})}/>
          {r.manual_stock!==""&&r.manual_stock!=null?<span className="manual">수동 수정</span>:null}
          {numeric(st)===0&&<span className="stock-badge zero-badge">재고 없음</span>}
          {numeric(st)<0&&<span className="stock-badge neg-badge">재고 확인</span>}
        </td>
        <td className="date-cell"><input className="screen-date" type="date" value={expirationFor(item,r)} onChange={e=>patchRecord(item.id,item.category==="야채·채소"?{consumption_date:e.target.value}:{expiration_date:e.target.value})}/><span className="print-date">{expirationFor(item,r)?fmtDate(expirationFor(item,r)):""}</span>
          {status&&<span className={"expiry "+(status==="임박"?"near":status==="기한 지남"?"passed":"ok")}>{status}</span>}
        </td>
        <td><select value={r.storage_method||item.storage_method} onChange={e=>patchRecord(item.id,{storage_method:e.target.value})}>{STORAGE_METHODS.map(x=><option key={x}>{x}</option>)}</select></td>
        <td><input className="note" value={r.note??""} placeholder="메모" onChange={e=>patchRecord(item.id,{note:e.target.value})}/></td>
        <td className="delete-cell"><button title={`${item.name} 삭제`} aria-label={`${item.name} 삭제`} onClick={()=>onDelete(item)}>삭제</button></td>
      </tr>
    })}</tbody>
  </table>{items.length===0&&<div className="empty">조건에 맞는 품목이 없습니다.</div>}</div>
}

function ItemModal({data,defaults,onClose,onSave}){
  const [form,setForm]=useState(data||{name:"",category:defaults?.category||"냉장식품",unit:"",storage_method:"냉장",expiration_type:"유통기한",active:true});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return <Modal title={data?"품목 수정":"품목 추가"} onClose={onClose}>
    <div className="form-grid"><label>품목명<input value={form.name} onChange={e=>set("name",e.target.value)}/></label>
    <label>카테고리<select value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>보관방법<select value={form.storage_method} onChange={e=>set("storage_method",e.target.value)}>{STORAGE_METHODS.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>기한 관리 방식<select value={form.expiration_type} onChange={e=>set("expiration_type",e.target.value)}><option>유통기한</option><option>납품일/소비기한</option></select></label>
    <label className="check"><input type="checkbox" checked={form.active!==false} onChange={e=>set("active",e.target.checked)}/> 사용 품목</label></div>
    <div className="modal-actions"><button onClick={onClose}>취소</button><button className="primary" disabled={!form.name.trim()} onClick={()=>onSave(form)}>저장</button></div>
  </Modal>
}
function IncomingModal({item,data,onClose,onSave}){const [form,setForm]=useState(data);return <Modal title={`${item?.name||""} · 입고 추가`} onClose={onClose}>
  <div className="form-grid"><label>입고일<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>입고수량<input autoFocus value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="예: 30"/></label></div>
  <div className="modal-actions"><button onClick={onClose}>취소</button><button className="primary" onClick={()=>onSave(form)}>입고 추가</button></div>
</Modal>}
function Modal({title,onClose,children}){return <div className="overlay"><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>}

function ItemPage({items,onBack,onAdd,onEdit,onToggle,onDelete,onReorder}){
  const [q,setQ]=useState(""),[cat,setCat]=useState("전체");
  const list=items.filter(i=>(cat==="전체"||i.category===cat)&&i.name.includes(q)).sort((a,b)=>a.sort_order-b.sort_order);
  return <div className="app"><header className="topbar"><div className="brand"><div className="star">✦</div><div><div className="brand-name">로운주간이용센터</div><div className="brand-sub">품목 관리</div></div></div><button className="ghost" onClick={onBack}>← 주간 수불대장</button></header>
  <main className="container"><div className="page-head"><div><h1>품목 관리</h1><p>품목은 한 번 등록하면 매주 자동으로 나타납니다.</p></div><button className="primary" onClick={onAdd}>＋ 품목 추가</button></div>
  <div className="toolbar simple"><div className="search">⌕<input placeholder="품목 검색" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="tabs">{["전체",...CATEGORIES].map(c=><button className={cat===c?"active":""} onClick={()=>setCat(c)} key={c}>{c}</button>)}</div></div>
  <div className="master-list">{list.map(i=><div className={`master-row ${i.active?"":"inactive-row"}`} key={i.id}><div className="order"><button title="위로" onClick={()=>onReorder(i.id,-1)}>↑</button><button title="아래로" onClick={()=>onReorder(i.id,1)}>↓</button></div><div className="master-name"><b>{i.name}</b><span>{i.category}</span></div><span className="master-unit">{i.unit||"단위 미입력"}</span><span>{i.storage_method}</span><span className={i.active?"status-on":"status-off"}>{i.active?"사용 중":"숨김"}</span><div className="master-actions"><button onClick={()=>onEdit(i)}>수정</button><button onClick={()=>onToggle(i.id,!i.active)}>{i.active?"숨기기":"다시 사용"}</button><button className="danger-text" onClick={()=>onDelete(i)}>삭제</button></div></div>)}{!list.length&&<div className="empty">조건에 맞는 품목이 없습니다.</div>}</div></main></div>
}
function HistoryPage({weeks,onBack,onOpen}){const list=[...weeks].sort((a,b)=>b.start.localeCompare(a.start));return <div className="app"><header className="topbar"><div className="brand"><div className="star">✦</div><div><div className="brand-name">로운주간이용센터</div><div className="brand-sub">주간 기록</div></div></div><button className="ghost" onClick={onBack}>← 주간 수불대장</button></header><main className="container"><div className="page-head"><div><h1>주간 기록</h1><p>작성했던 주간 수불대장을 다시 열 수 있습니다.</p></div></div><div className="history-list">{list.map(w=><button key={w.start} onClick={()=>onOpen(w.start)}><span>주간 수불대장</span><b>{fmtDate(w.start)} ~ {fmtDate(w.end)}</b><span>열기 →</span></button>)}{!list.length&&<div className="empty">아직 작성된 주간 기록이 없습니다.</div>}</div></main></div>}
function Help({onClose}){return <div className="overlay"><div className="help modal"><div className="modal-head"><h2>처음 사용하시나요?</h2><button onClick={onClose}>×</button></div><ol><li>품목은 한 번만 등록하면 됩니다.</li><li>주차를 열면 월~금이 자동으로 계산됩니다.</li><li>지난주 재고현황이 이번 주 기초재고로 자동 이월됩니다.</li><li>입고와 월~금 사용량을 입력하세요.</li><li>재고현황은 자동 계산되며 실제 재고와 다르면 직접 수정할 수 있습니다.</li><li>오른쪽 위 <b>인쇄 / PDF 저장</b>으로 A4 문서를 만들 수 있습니다.</li></ol><div className="modal-actions"><button className="primary" onClick={onClose}>확인</button></div></div></div>}

createRoot(document.getElementById("root")).render(<App />);
