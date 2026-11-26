'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {dashboardAuthenticatedFetch} from '../../lib/dashboard-authenticated-fetch';
import {useWorkspacePermission} from '../workspace/WorkspacePermissions';
import type {AutoFormat,AutoResult,AutoSettings} from '../../engines/auto/auto-dashboards';
import styles from './AutoDashboard.module.css';

type Definition={schemaVersion:1;template:string;templateVersion:number;name:string;widgets:unknown[];sectionTitles?:Record<string,string>;auto:AutoSettings&{engine:'AUTO';category:'MARKETING'|'FINANCE'|'OPERATIONS'}};
type Payload={view:{id:string;name:string;datasetId:string;updatedAt:string;definition:Definition};dataset:{id:string;name:string;version:number;updatedAt:string};result:AutoResult};

// Validated categorical order (light surface): blue, teal, orange, pink, purple, dark blue. "Other" is neutral gray.
const SERIES=['#2e85f6','#17a383','#e07b00','#e0245e','#7b61ff','#0f5fa8'];
const OTHER='#9aa7b8';

export function formatAuto(value:number|null|undefined,format:AutoFormat,currency:string,compact=false,threshold=100000){
 if(value==null||!Number.isFinite(value))return '–';
 const big=compact&&Math.abs(value)>=threshold;
 switch(format){
  case 'CURRENCY':return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:big?1:Math.abs(value)<100?2:0,...(big?{notation:'compact'}:{})}).format(value);
  case 'PERCENT':return new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:1}).format(value);
  case 'MULTIPLE':return value.toFixed(2)+'x';
  case 'DAYS':return value.toFixed(1)+' days';
  case 'HOURS':return value.toFixed(1)+' hrs';
  default:return new Intl.NumberFormat('en-US',{maximumFractionDigits:big?1:Math.abs(value)<10?2:0,...(big?{notation:'compact'}:{})}).format(value);
 }
}

const DAY=86400000;
const iso=(d:Date)=>d.toISOString().slice(0,10);
function presetRange(preset:string,latest:string|null):{start:string;end:string}|null{
 if(!latest||preset==='ALL'||preset==='CUSTOM')return null;
 const end=new Date(latest+'T00:00:00Z');
 if(preset==='30')return {start:iso(new Date(end.getTime()-29*DAY)),end:latest};
 if(preset==='90')return {start:iso(new Date(end.getTime()-89*DAY)),end:latest};
 if(preset==='365')return {start:iso(new Date(end.getTime()-364*DAY)),end:latest};
 if(preset==='YEAR')return {start:`${end.getUTCFullYear()}-01-01`,end:latest};
 return null;
}

export default function AutoDashboard({workspaceId,viewId}:{workspaceId:string;viewId:string}){
 const api='/dashboard/app/api/workspaces/'+encodeURIComponent(workspaceId)+'/views/'+encodeURIComponent(viewId);
 const root='/dashboard/app/workspaces/'+encodeURIComponent(workspaceId);
 const canEdit=useWorkspacePermission('views.manage');
 const [data,setData]=useState<Payload|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 const [preset,setPreset]=useState('ALL');const [custom,setCustom]=useState({start:'',end:''});
 const [filterField,setFilterField]=useState('');const [filterValue,setFilterValue]=useState('');
 const [breakdown,setBreakdown]=useState('');
 const [customising,setCustomising]=useState(false);const [draft,setDraft]=useState<AutoSettings|null>(null);const [saving,setSaving]=useState(false);const [saved,setSaved]=useState('');
 const latest=useRef<string|null>(null);

 const range=useMemo(()=>preset==='CUSTOM'?(custom.start||custom.end?{start:custom.start,end:custom.end}:null):presetRange(preset,latest.current),[preset,custom]);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  const q=new URLSearchParams();
  if(range?.start)q.set('start',range.start);if(range?.end)q.set('end',range.end);
  if(filterField&&filterValue){q.set('filterField',filterField);q.set('filterValue',filterValue);}
  if(breakdown)q.set('breakdown',breakdown);
  try{
   const response=await dashboardAuthenticatedFetch(api+'/auto?'+q.toString(),{credentials:'same-origin',cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.message??(response.status===404?'This dashboard is unavailable or you do not have access.':response.status===402?'An active subscription is required.':'Unable to load this dashboard. Try again.'));
   setData(body as Payload);latest.current=(body as Payload).result.dateRange?.end??null;
  }catch(e){setError(e instanceof Error?e.message:'Unable to load this dashboard.');}
  finally{setLoading(false);}
 },[api,range,filterField,filterValue,breakdown]);
 useEffect(()=>{void load();},[load]);

 const result=data?.result;const settings=data?.view.definition.auto;
 const hidden=new Set((customising?draft?.hidden:settings?.hidden)??[]);
 const visibleMetrics=(result?.metrics??[]).filter(m=>!hidden.has(m.key));
 const currency=result?.currency??'USD';
 const filterOptions=result?.dimensions.find(d=>d.field===filterField)?.values??[];

 async function save(){
  if(!data||!draft)return;setSaving(true);setSaved('');
  try{
   const definition={...data.view.definition,auto:{...data.view.definition.auto,...draft}};
   const response=await dashboardAuthenticatedFetch(api,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({definition,expectedUpdatedAt:data.view.updatedAt})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error==='INVALID_VERSION'||response.status===409?'Someone else changed this dashboard. Reload and try again.':'Your layout could not be saved. Try again.');
   setCustomising(false);setDraft(null);setSaved('Layout saved.');await load();
  }catch(e){setSaved(e instanceof Error?e.message:'Your layout could not be saved.');}
  finally{setSaving(false);}
 }
 function startCustomising(){if(!result||!settings)return;setDraft({hidden:settings.hidden??[],order:result.metrics.map(m=>m.key),breakdown:settings.breakdown??result.breakdown?.field??null,shareChart:settings.shareChart??'DONUT'});setCustomising(true);setSaved('');}
 function move(key:string,step:-1|1){setDraft(d=>{if(!d)return d;const order=[...(d.order??[])];const i=order.indexOf(key),j=i+step;if(i<0||j<0||j>=order.length)return d;[order[i],order[j]]=[order[j],order[i]];return {...d,order};});}
 function exportCsv(){
  if(!result)return;const lines:string[][]=[['Metric','Value','Previous period','Change','How it is calculated']];
  for(const m of visibleMetrics)lines.push([m.label,String(m.value),m.previous==null?'':String(m.previous),m.change==null?'':(m.change*100).toFixed(1)+'%',m.source]);
  if(result.table){lines.push([]);lines.push([result.table.field,...result.table.columns.map(c=>c.label)]);for(const r of result.table.rows)lines.push([r.label,...r.values.map(v=>v==null?'':String(v))]);}
  const csv=lines.map(l=>l.map(c=>/[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=(data?.view.name??'dashboard').replace(/[^\w -]+/g,'')+'.csv';a.click();URL.revokeObjectURL(a.href);
 }

 if(loading&&!data)return <div className={styles.page}><p role="status" className={styles.status}>Loading your dashboard…</p></div>;
 if(error&&!data)return <div className={styles.page}><section role="alert" className={styles.alert}><p>{error}</p><button type="button" onClick={()=>void load()}>Try again</button> <Link href={root}>All dashboards</Link></section></div>;
 if(!data||!result)return null;
 const shareChart=(customising?draft?.shareChart:settings?.shareChart)??'DONUT';

 return <div className={styles.page}>
  <header className={styles.header}>
   <div>
    <p className={styles.eyebrow}><Link href={root}>My dashboards</Link> / {result.title}</p>
    <h1>{data.view.name}</h1>
    <p className={styles.sub}>{result.description} Data: <strong>{data.dataset.name}</strong>{result.dateRange?<> · {fmtDate(result.dateRange.start)} to {fmtDate(result.dateRange.end)}</>:null} · {result.filteredRows.toLocaleString()} of {result.rowCount.toLocaleString()} rows</p>
   </div>
   <div className={styles.actions}>
    <button type="button" onClick={exportCsv}>Download CSV</button>
    {canEdit&&!customising?<button type="button" className={styles.primary} onClick={startCustomising}>Customise</button>:null}
   </div>
  </header>

  <section className={styles.filters} aria-label="Filters">
   {result.dateField?<label>Period<select value={preset} onChange={e=>setPreset(e.target.value)}>
    <option value="ALL">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="YEAR">Year to date</option><option value="CUSTOM">Custom dates</option>
   </select></label>:null}
   {preset==='CUSTOM'?<><label>From<input type="date" value={custom.start} onChange={e=>setCustom(c=>({...c,start:e.target.value}))}/></label><label>To<input type="date" value={custom.end} onChange={e=>setCustom(c=>({...c,end:e.target.value}))}/></label></>:null}
   {result.dimensions.length?<label>Filter by<select value={filterField} onChange={e=>{setFilterField(e.target.value);setFilterValue('');}}><option value="">Everything</option>{result.dimensions.map(d=><option key={d.field} value={d.field}>{d.field}</option>)}</select></label>:null}
   {filterField?<label>{filterField}<select value={filterValue} onChange={e=>setFilterValue(e.target.value)}><option value="">All</option>{filterOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></label>:null}
   {(preset!=='ALL'||filterField)?<button type="button" className={styles.link} onClick={()=>{setPreset('ALL');setCustom({start:'',end:''});setFilterField('');setFilterValue('');}}>Reset</button>:null}
   {loading?<span role="status" className={styles.updating}>Updating…</span>:null}
   {result.comparison?<span className={styles.compare}>Compared with {fmtDate(result.comparison.start)} to {fmtDate(result.comparison.end)}</span>:null}
  </section>
  {error?<p role="alert" className={styles.alert}>{error}</p>:null}
  {saved?<p role="status" className={styles.saved}>{saved}</p>:null}

  {customising&&draft?<section className={styles.customise} aria-label="Customise dashboard">
   <h2>Customise this dashboard</h2>
   <p>Choose which numbers to show and their order. Changes are saved for everyone who views this dashboard.</p>
   <ol className={styles.cardList}>{(draft.order??[]).map((key,i)=>{const m=result.metrics.find(x=>x.key===key);if(!m)return null;return <li key={key}>
    <label><input type="checkbox" checked={!(draft.hidden??[]).includes(key)} onChange={e=>setDraft(d=>d?{...d,hidden:e.target.checked?(d.hidden??[]).filter(k=>k!==key):[...(d.hidden??[]),key]}:d)}/> {m.label}</label>
    <span><button type="button" aria-label={`Move ${m.label} up`} disabled={i===0} onClick={()=>move(key,-1)}>↑</button><button type="button" aria-label={`Move ${m.label} down`} disabled={i===(draft.order??[]).length-1} onClick={()=>move(key,1)}>↓</button></span>
   </li>;})}</ol>
   <div className={styles.customRow}>
    {result.dimensions.length?<label>Break down by<select value={draft.breakdown??''} onChange={e=>setDraft(d=>d?{...d,breakdown:e.target.value||null}:d)}>{result.dimensions.map(d=><option key={d.field} value={d.field}>{d.field}</option>)}</select></label>:null}
    <label>Share chart<select value={draft.shareChart??'DONUT'} onChange={e=>setDraft(d=>d?{...d,shareChart:e.target.value as 'DONUT'|'BAR'}:d)}><option value="DONUT">Donut</option><option value="BAR">Bars</option></select></label>
   </div>
   <div className={styles.actions}><button type="button" className={styles.primary} disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Save layout'}</button><button type="button" onClick={()=>{setCustomising(false);setDraft(null);}}>Cancel</button></div>
  </section>:null}

  {result.metrics.length===0?<section className={styles.empty}><h2>We couldn't build this dashboard from this file</h2>{result.notes.map(n=><p key={n}>{n}</p>)}<Link href={root+'/studio?create=1'}>Try another file</Link></section>:<>
  <section className={styles.kpis} aria-label="Key numbers">
   {(customising&&draft?(draft.order??[]).map(k=>result.metrics.find(m=>m.key===k)!).filter(m=>m&&!hidden.has(m.key)):visibleMetrics).map(m=>{
    const good=m.change==null?null:(m.change>=0)===(m.better==='UP');
    return <article key={m.key} className={styles.kpi} title={m.source}>
     <h3>{m.label}</h3>
     <p className={styles.kpiValue}>{formatAuto(m.value,m.format,currency,true)}</p>
     {m.change!=null?<p className={good?styles.good:styles.bad}><span aria-hidden="true">{m.change>=0?'▲':'▼'}</span> {Math.abs(m.change*100).toFixed(1)}% <span className={styles.muted}>vs previous period ({good?'better':'worse'})</span></p>:<p className={styles.muted}>{m.source}</p>}
    </article>;
   })}
  </section>

  <div className={styles.grid}>
   {result.trend?result.trend.metrics.map((metric,index)=><section key={metric.key} className={styles.panel+' '+(result.trend!.metrics.length===1?styles.wide:'')}>
    <h2>{metric.label} over time</h2>
    <LineChart points={result.trend!.points.map(p=>({label:p.label,value:p.values[index]}))} color={SERIES[index]} format={v=>formatAuto(v,metric.format,currency)} axisFormat={v=>formatAuto(v,metric.format,currency,true,1000)} wide={result.trend!.metrics.length===1}/>
   </section>):null}
   {result.breakdown?<section className={styles.panel+' '+(!(result.share&&result.share.items.length>1)?styles.wide:'')}>
    <h2>{result.breakdown.metric.label} by {result.breakdown.field}</h2>
    <BarList items={result.breakdown.items} format={v=>formatAuto(v,result.breakdown!.metric.format,currency,true)} color={SERIES[0]}/>
   </section>:null}
   {result.share&&result.share.items.length>1?<section className={styles.panel+' '+(!result.breakdown?styles.wide:'')}>
    <h2>Share of {result.share.metric.label.toLowerCase()} by {result.share.field}</h2>
    {shareChart==='BAR'?<BarList items={result.share.items} format={v=>formatAuto(v,result.share!.metric.format,currency,true)} color={SERIES[1]} percent/>:<Donut items={result.share.items} format={v=>formatAuto(v,result.share!.metric.format,currency,true)}/>}
   </section>:null}
  </div>

  {result.table&&result.table.rows.length?<section className={styles.panel+' '+styles.tablePanel}>
   <h2>{result.table.field} details</h2>
   <div className={styles.tableWrap}><table><thead><tr><th scope="col">{result.table.field}</th>{result.table.columns.map(c=><th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
    <tbody>{result.table.rows.map(r=><tr key={r.label}><th scope="row">{r.label}</th>{r.values.map((v,i)=><td key={i}>{formatAuto(v,result.table!.columns[i].format,currency)}</td>)}</tr>)}</tbody></table></div>
  </section>:null}

  <details className={styles.details}>
   <summary>How these numbers are calculated</summary>
   <ul>{result.metrics.map(m=><li key={m.key}><strong>{m.label}:</strong> {m.source}</li>)}</ul>
   {result.missing.length?<p>Not shown because the file has no matching column: {result.missing.map(m=>m.label).join(', ')}. Add a column for these to see them.</p>:null}
   {result.notes.map(n=><p key={n}>{n}</p>)}
   <p>Currency: {currency}. {result.dateField?`Dates come from the "${result.dateField}" column.`:''}</p>
  </details>
  </>}
 </div>;
}

function fmtDate(isoDate:string){return new Date(isoDate+'T00:00:00Z').toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}

/** Top of the axis so that each of the 4 gridline steps is a round number (1, 2, 2.5 or 5 × 10^n). */
function niceMax(v:number){if(v<=0)return 1;const raw=v/4,p=Math.pow(10,Math.floor(Math.log10(raw)));const n=raw/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p*4;}

/** Single-measure line chart with a crosshair tooltip. */
function LineChart({points,color,format,axisFormat,wide}:{points:{label:string;value:number|null}[];color:string;format:(v:number)=>string;axisFormat:(v:number)=>string;wide?:boolean}){
 const [hover,setHover]=useState<number|null>(null);
 // A full-width chart gets a wider canvas so text stays the same size instead of scaling up.
 const W=wide?1160:560,H=220,L=56,R=12,T=12,B=28;
 const values=points.map(p=>p.value??0);const min=Math.min(0,...values),max=niceMax(Math.max(...values));
 const x=(i:number)=>L+(points.length<=1?0:(i*(W-L-R))/(points.length-1));const y=(v:number)=>T+(H-T-B)*(1-(v-min)/(max-min||1));
 const path=points.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.value??0).toFixed(1)}`).join('');
 const ticks=[0,0.25,0.5,0.75,1].map(t=>min+(max-min)*t);
 const step=Math.max(1,Math.ceil(points.length/(wide?12:7)));
 const showLabel=(i:number)=>i%step===0||(i===points.length-1&&(points.length-1)%step>step/2);
 return <div className={styles.chart}>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Line chart, ${points.length} periods`} onMouseLeave={()=>setHover(null)}
   onMouseMove={e=>{const r=(e.currentTarget as SVGSVGElement).getBoundingClientRect();const px=(e.clientX-r.left)*W/r.width;const i=Math.round((px-L)/((W-L-R)/Math.max(1,points.length-1)));setHover(Math.max(0,Math.min(points.length-1,i)));}}>
   {ticks.map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} className={styles.grid1}/><text x={L-6} y={y(t)+4} textAnchor="end" className={styles.axis}>{axisFormat(t)}</text></g>)}
   {points.map((p,i)=>showLabel(i)?<text key={i} x={x(i)} y={H-8} textAnchor={i===0?'start':i===points.length-1?'end':'middle'} className={styles.axis}>{p.label.replace(/^Wk of /,'')}</text>:null)}
   <path d={`${path}L${x(points.length-1)},${y(min)}L${x(0)},${y(min)}Z`} fill={color} opacity={0.08}/>
   <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round"/>
   {hover!=null?<g><line x1={x(hover)} x2={x(hover)} y1={T} y2={H-B} className={styles.crosshair}/><circle cx={x(hover)} cy={y(points[hover].value??0)} r={4.5} fill={color} stroke="#fff" strokeWidth={2}/></g>:null}
  </svg>
  {hover!=null?<div className={styles.tooltip} style={{left:`${(x(hover)/W)*100}%`}}><strong>{points[hover].label}</strong><span>{points[hover].value==null?'No data':format(points[hover].value!)}</span></div>:null}
 </div>;
}

/** Horizontal bars, sorted, with direct value labels. */
function BarList({items,format,color,percent}:{items:{label:string;value:number}[];format:(v:number)=>string;color:string;percent?:boolean}){
 const max=Math.max(...items.map(i=>Math.abs(i.value)),1);const total=items.reduce((a,b)=>a+Math.max(0,b.value),0)||1;
 return <ul className={styles.bars}>{items.map(item=><li key={item.label} title={`${item.label}: ${format(item.value)}`}>
  <span className={styles.barLabel}>{item.label}</span>
  <span className={styles.barTrack}><span className={styles.barFill} style={{width:`${Math.max(1,(Math.abs(item.value)/max)*100)}%`,background:item.label==='Other'?OTHER:item.value<0?'#e0245e':color}}/></span>
  <span className={styles.barValue}>{format(item.value)}{percent?` (${((Math.max(0,item.value)/total)*100).toFixed(0)}%)`:''}</span>
 </li>)}</ul>;
}

/** Donut with a full legend (wraps instead of clipping) and percentages. */
function Donut({items,format}:{items:{label:string;value:number}[];format:(v:number)=>string}){
 const [hover,setHover]=useState<number|null>(null);
 const total=items.reduce((a,b)=>a+b.value,0)||1;let angle=-Math.PI/2;
 const R=70,r=44,C=90;
 const arcs=items.map((item,i)=>{const a=(item.value/total)*Math.PI*2,start=angle,end=angle+a-(items.length>1?0.02:0);angle+=a;const large=end-start>Math.PI?1:0;
  const p=(rad:number,rr:number)=>`${(C+rr*Math.cos(rad)).toFixed(2)},${(C+rr*Math.sin(rad)).toFixed(2)}`;
  return {d:`M${p(start,R)}A${R},${R} 0 ${large} 1 ${p(end,R)}L${p(end,r)}A${r},${r} 0 ${large} 0 ${p(start,r)}Z`,color:item.label==='Other'?OTHER:SERIES[i%SERIES.length],item,i};});
 const focus=hover!=null?items[hover]:null;
 return <div className={styles.donut}>
  <svg viewBox="0 0 180 180" role="img" aria-label={`Donut chart, ${items.length} groups`}>
   {arcs.map(a=><path key={a.item.label} d={a.d} fill={a.color} opacity={hover==null||hover===a.i?1:0.35} onMouseEnter={()=>setHover(a.i)} onMouseLeave={()=>setHover(null)}><title>{`${a.item.label}: ${format(a.item.value)} (${((a.item.value/total)*100).toFixed(1)}%)`}</title></path>)}
   <text x={C} y={C-4} textAnchor="middle" className={styles.donutValue}>{focus?((focus.value/total)*100).toFixed(0)+'%':format(total)}</text>
   <text x={C} y={C+14} textAnchor="middle" className={styles.axis}>{focus?focus.label.slice(0,16):'Total'}</text>
  </svg>
  <ul className={styles.legend}>{items.map((item,i)=><li key={item.label} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>
   <i style={{background:item.label==='Other'?OTHER:SERIES[i%SERIES.length]}}/><span className={styles.legendLabel}>{item.label}</span><span className={styles.legendValue}>{format(item.value)} · {((item.value/total)*100).toFixed(0)}%</span>
  </li>)}</ul>
 </div>;
}
