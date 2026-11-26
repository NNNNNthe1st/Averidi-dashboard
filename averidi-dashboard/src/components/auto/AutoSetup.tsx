'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {dashboardAuthenticatedFetch} from '../../lib/dashboard-authenticated-fetch';
import {useWorkspacePermission} from '../workspace/WorkspacePermissions';
import {salesRequestId} from '../../engines/sales/upload-intent';
import styles from './AutoDashboard.module.css';

export type AutoSetupCategory='MARKETING'|'FINANCE'|'OPERATIONS';
const COPY:Record<AutoSetupCategory,{title:string;template:'MARKETING'|'FINANCIAL'|'OPERATIONS';intro:string;columns:string}>={
 MARKETING:{title:'Marketing dashboard',template:'MARKETING',intro:'See spend, reach, clicks, conversions and return on ad spend by channel and campaign.',columns:'Date, Channel or Campaign, Spend, Impressions, Clicks, Conversions, Revenue'},
 FINANCE:{title:'Finance dashboard',template:'FINANCIAL',intro:'See revenue, costs, profit and margins over time and by segment, product or region.',columns:'Date, Segment or Category, Revenue (or Sales), Cost of sales, Expenses, Profit'},
 OPERATIONS:{title:'Operations dashboard',template:'OPERATIONS',intro:'See volumes, lead and delivery times, costs and defect rates by supplier, carrier or location.',columns:'Date, Supplier or Location, Quantity, Lead time, Shipping cost, Defect rate'},
};
type Dataset={id:string;name:string;status:string;latestVersionId:string|null;createdAt:string;fileName?:string|null;rowCount?:number|null};

async function json(url:string,init:RequestInit={}){const r=await dashboardAuthenticatedFetch(url,init);const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.message??(r.status===402?'An active subscription is required.':r.status===403?'You do not have permission to do this.':`This action could not finish (${r.status}). Try again.`));return b;}

/** Upload or pick data, then create the dashboard in one step. Column recognition happens automatically. */
export default function AutoSetup({workspaceId,category,onExit}:{workspaceId:string;category:AutoSetupCategory;onExit:()=>void}){
 const copy=COPY[category];const router=useRouter();
 const api='/dashboard/app/api/workspaces/'+encodeURIComponent(workspaceId);
 const canUpload=useWorkspacePermission('datasets.write'),canCreate=useWorkspacePermission('views.manage'),canRead=useWorkspacePermission('datasets.read');
 const [datasets,setDatasets]=useState<Dataset[]>([]);const [existing,setExisting]=useState('');
 const [file,setFile]=useState<File|null>(null);const [name,setName]=useState('');
 const [stage,setStage]=useState<'idle'|'uploading'|'processing'|'creating'>('idle');const [progress,setProgress]=useState<number|null>(null);const [error,setError]=useState('');
 const requestId=useRef(salesRequestId());
 useEffect(()=>{if(!canRead)return;json(api+'/sales-sources').then(b=>setDatasets((b.datasets as Dataset[]).filter(d=>d.status==='READY'))).catch(()=>{});},[api,canRead]);

 async function createView(datasetId:string,label:string){
  setStage('creating');
  const definition={schemaVersion:1,template:copy.template,templateVersion:1,name:`${label} ${copy.title.toLowerCase()}`.slice(0,120),widgets:[],auto:{engine:'AUTO',category}};
  const body=await json(api+'/views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({datasetId,definition})});
  router.push(`/workspaces/${encodeURIComponent(workspaceId)}/views/${encodeURIComponent(body.view.id)}`);
 }
 async function waitUntilReady(datasetId:string,versionId:string){
  const started=Date.now();
  for(;;){
   const body=await json(api+'/datasets/'+encodeURIComponent(datasetId)+'/versions');
   const v=(body.versions as {id:string;status:string}[]).find(x=>x.id===versionId);
   if(v?.status==='READY')return;
   if(v&&['FAILED','REJECTED','CANCELLED'].includes(v.status))throw Error('We could not read this file. Check that it is a CSV or Excel file with a header row, then try again.');
   if(Date.now()-started>5*60000)throw Error('Processing is taking longer than usual. Your file is saved; open it later from "Use data you already added".');
   await new Promise(r=>setTimeout(r,2000));
  }
 }
 async function uploadAndCreate(){
  if(!file)return;setError('');setStage('uploading');setProgress(0);
  try{
   const label=name.trim()||file.name.replace(/\.[^.]+$/,'');
   const created=await json(api+'/sales-sources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:label.slice(0,120),requestId:requestId.current})});
   const datasetId=created.dataset.id as string;
   const form=new FormData();form.set('file',file);
   const uploaded=await new Promise<{version:{id:string}}>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',api+'/datasets/'+encodeURIComponent(datasetId)+'/sales-upload');xhr.withCredentials=true;xhr.setRequestHeader('X-Sales-File-Name',encodeURIComponent(file.name));xhr.timeout=180000;
    xhr.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(100*e.loaded/e.total));};
    xhr.onerror=()=>reject(Error('Upload interrupted. Check your connection and try again.'));xhr.ontimeout=()=>reject(Error('The upload timed out. Try again.'));
    xhr.onload=()=>{let body;try{body=JSON.parse(xhr.responseText);}catch{reject(Error('The upload could not be confirmed. Try again.'));return;}if(xhr.status>=400||!body.version?.id){reject(Error(body.message??'The file could not be uploaded. Check the file and try again.'));return;}resolve(body);};
    xhr.send(form);
   });
   setStage('processing');setProgress(null);
   await waitUntilReady(datasetId,uploaded.version.id);
   await createView(datasetId,label);
   requestId.current=salesRequestId();
  }catch(e){setStage('idle');setError(e instanceof Error?e.message:'Something went wrong. Try again.');}
 }
 async function useExisting(){
  const dataset=datasets.find(d=>d.id===existing);if(!dataset)return;setError('');
  try{await createView(dataset.id,dataset.name);}catch(e){setStage('idle');setError(e instanceof Error?e.message:'Unable to create the dashboard.');}
 }
 const busy=stage!=='idle';
 return <div className={styles.page}>
  <header className={styles.header}><div>
   <p className={styles.eyebrow}><button type="button" className={styles.backLink} onClick={onExit}>← Dashboard types</button></p>
   <h1>Create a {copy.title.toLowerCase()}</h1>
   <p className={styles.sub}>{copy.intro}</p>
  </div></header>
  {error?<p role="alert" className={styles.alert}>{error}</p>:null}
  <div className={styles.grid}>
   <section className={styles.panel}>
    <h2>Upload a file</h2>
    <p className={styles.muted}>CSV or Excel. Helpful columns: {copy.columns}. Column names don't need to match exactly; we recognise common names.</p>
    <div className={styles.setupFields}>
     <label>File<input type="file" accept=".csv,.xlsx,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy||!canUpload} onChange={e=>{setFile(e.target.files?.[0]??null);setError('');}}/></label>
     <label>Name (optional)<input type="text" value={name} maxLength={120} placeholder={file?file.name.replace(/\.[^.]+$/,''):'e.g. Q3 campaigns'} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
    </div>
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={!file||busy||!canUpload||!canCreate} onClick={()=>void uploadAndCreate()}>
     {stage==='uploading'?`Uploading${progress!=null?` ${progress}%`:''}…`:stage==='processing'?'Reading your data…':stage==='creating'?'Building your dashboard…':'Upload and create dashboard'}</button></div>
    {!canUpload?<p className={styles.muted}>You need permission to add data. Ask a workspace owner.</p>:null}
   </section>
   <section className={styles.panel}>
    <h2>Use data you already added</h2>
    <p className={styles.muted}>Includes files you uploaded and Google Sheets or Shopify data you imported.</p>
    {datasets.length?<><div className={styles.setupFields}><label>Data<select value={existing} disabled={busy} onChange={e=>setExisting(e.target.value)}><option value="">Choose data</option>{datasets.map(d=><option key={d.id} value={d.id}>{d.name}{d.rowCount?` (${d.rowCount.toLocaleString()} rows)`:''}</option>)}</select></label></div>
     <div className={styles.actions}><button type="button" className={styles.primary} disabled={!existing||busy||!canCreate} onClick={()=>void useExisting()}>{stage==='creating'?'Building your dashboard…':'Create dashboard'}</button></div></>
    :<p>No data yet. Upload a file, or <a href={`/dashboard/app/workspaces/${encodeURIComponent(workspaceId)}/connectors`}>connect Google Sheets or Shopify</a>.</p>}
   </section>
  </div>
 </div>;
}
