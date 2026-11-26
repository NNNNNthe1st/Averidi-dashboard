'use client';
import {dashboardAuthenticatedFetch} from '../../lib/dashboard-authenticated-fetch';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import styles from './WorkspaceNavigation.module.css';
import {basePermissions,type WorkspacePermission} from '../../features/permissions/catalog';

export default function WorkspaceNavigation({workspaceId,role,permissions}:{workspaceId:string;role:string;permissions?:WorkspacePermission[]}) {
 const pathname=usePathname();
 const isFinishedView=/\/workspaces\/[^/]+\/views\/[^/]+\/?$/.test(pathname??'');
 const allowed=permissions??basePermissions(role);
 const has=(permission:WorkspacePermission)=>allowed.includes(permission);
 const canReadMonitoring=has('monitoring.read'),[unread,setUnread]=useState<number|null>(null);
 useEffect(()=>{const controller=new AbortController();let active=true,pending=false;setUnread(null);
  async function load(){if(pending)return;pending=true;try{const r=await dashboardAuthenticatedFetch('/dashboard/app/api/workspaces/'+encodeURIComponent(workspaceId)+'/monitoring/summary',{cache:'no-store',credentials:'same-origin',signal:controller.signal});const value=await r.json();if(active)setUnread(r.ok&&Number.isSafeInteger(value.open)&&value.open>=0?value.open:null);}catch{if(active)setUnread(null);}finally{pending=false;}}
  const changed=()=>void load();if(canReadMonitoring){void load();window.addEventListener('dashboard-monitoring-changed',changed);}const timer=canReadMonitoring?setInterval(()=>void load(),30000):undefined;return()=>{active=false;controller.abort();window.removeEventListener('dashboard-monitoring-changed',changed);if(timer)clearInterval(timer);};
 },[workspaceId,canReadMonitoring]);
 const root='/workspaces/'+encodeURIComponent(workspaceId);
 const advanced=has('analysis.read')||has('datasets.read')||has('connectors.read')||has('jobs.read')||role==='OWNER';
 if(isFinishedView)return null;
 const here=(path:string)=>pathname?.endsWith(root+path)||(path===''&&/\/workspaces\/[^/]+\/?$/.test(pathname??''));
 const item=(path:string,label:string,extra?:React.ReactNode)=><Link className={here(path)?styles.active:undefined} aria-current={here(path)?'page':undefined} href={root+path}>{label}{extra}</Link>;
 return <nav aria-label="Workspace navigation" className={styles.navigation}>
   <Link href={root} className={styles.brand} aria-label="Averidi home"><img src="/dashboard/app/brand/averidi-logo.png" alt="Averidi" width={110} height={21}/></Link>
   <div className={styles.links}>
    {item('','Dashboards')}
    {has('datasets.read')?item('/data','Data'):null}
    {has('connectors.read')?item('/connectors','Connections'):null}
    {has('reports.read')?item('/reports','Reports'):null}
    {has('monitoring.read')?item('/monitoring','Alerts',unread?<span id="workspace-alert-count" role="status" aria-live="polite" className={styles.badge}>{unread}</span>:null):null}
   </div>
   <div className={styles.right}>
    {has('analysis.read')?<Link className={styles.create} href={root+'/studio?create=1'}>+ New dashboard</Link>:null}
    <details className={styles.menu}>
     <summary>Settings</summary>
     <div className={styles.panel}>
      <p className={styles.group}>Workspace</p>
      <Link href={root+'/settings'}>Workspace settings</Link>
      {role==='OWNER'?<><Link href={root+'/members'}>Members</Link><Link href={root+'/billing'}>Billing</Link></>:null}
      <Link href={root+'/usage'}>Plan usage</Link>
      {has('views.read')?<Link href={root+'/sharing'}>Dashboard sharing</Link>:null}
      <p className={styles.group}>Account</p>
      <Link href="/settings">Account settings</Link>
      <Link href="/workspaces?choose=1">Switch workspace</Link>
      {has('support.read')?<Link href={root+'/support'}>Help and support</Link>:null}
      {advanced?<details className={styles.advanced}><summary>Advanced tools</summary>
       {has('analysis.read')?<Link href={root+'/metrics'}>Custom metrics</Link>:null}
       {has('datasets.read')?<Link href={root+'/relationships'}>Data relationships</Link>:null}
       {has('connectors.read')?<Link href={root+'/custom-sources'}>API sources and webhooks</Link>:null}
       {has('jobs.read')?<Link href={root+'/jobs'}>Jobs and schedules</Link>:null}
       {has('teams.read')?<Link href={root+'/teams'}>Teams</Link>:null}
       {role==='OWNER'?<><Link href={root+'/roles'}>Roles and permissions</Link><Link href={root+'/activity'}>Workspace activity</Link></>:null}
       <Link href="/organizations">Organizations</Link>
      </details>:null}
     </div>
    </details>
   </div>
 </nav>;
}
