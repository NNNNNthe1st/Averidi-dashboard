import {dashboardDb} from '../../server/db';
import {authorizedView} from '../sharing/access';
import {requireWorkspaceRole,type VerifiedDashboardActor} from '../../server/workspace-access';
import {assertCustomPermission} from '../permissions/policy';
import {salesAnalysisInput} from '../sales/preparation';
import {prepareAnalysisInput} from '../analysis/service';
import {definitionSchema} from '../views/validation';
import {computeAutoDashboard,detectAutoCurrency,type AutoQuery} from '../../engines/auto/auto-dashboards';
import {workspacePresentationSchema} from '../workspaces/presentation-contracts';

const text=(v:string|null,max=200)=>v&&v.trim()?v.trim().slice(0,max):null;
const isoDate=(v:string|null)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;

export function autoQueryFromUrl(url:URL):AutoQuery{
 return {start:isoDate(url.searchParams.get('start')),end:isoDate(url.searchParams.get('end')),
  filterField:text(url.searchParams.get('filterField')),filterValue:text(url.searchParams.get('filterValue'),500),breakdown:text(url.searchParams.get('breakdown'))};
}

/** Reads the view's dataset (same access rules as every saved dashboard) and computes the automatic dashboard. */
export async function autoDashboardData(actor:VerifiedDashboardActor,workspaceId:string,viewId:string,query:AutoQuery){
 if(!await requireWorkspaceRole(actor,workspaceId,'VIEWER'))throw Error('FORBIDDEN');
 await assertCustomPermission(actor,workspaceId,'views.read');
 const view=await authorizedView(actor,workspaceId,viewId,'VIEW');
 const definition=definitionSchema.safeParse(view.definition);
 if(!definition.success||!definition.data.auto)throw Error('NOT_AUTOMATIC');
 const base=await salesAnalysisInput(workspaceId,view.datasetId);
 const prepared=await prepareAnalysisInput(base);
 // Workspace currency is the fallback when the file shows no currency symbol.
 const workspace=await dashboardDb.dashboardWorkspace.findUnique({where:{id:workspaceId},select:{presentation:true}});
 const presentation=workspacePresentationSchema.safeParse(workspace?.presentation);
 const fallback=presentation.success?presentation.data.currency:'USD';
 // Filters only on real columns.
 const columnNames=new Set(prepared.columns.map(c=>c.name));
 const safe:AutoQuery={...query,filterField:query.filterField&&columnNames.has(query.filterField)?query.filterField:null,breakdown:query.breakdown&&columnNames.has(query.breakdown)?query.breakdown:null};
 const first=computeAutoDashboard({category:definition.data.auto.category,columns:prepared.columns,rows:prepared.rows,query:safe,settings:definition.data.auto});
 const moneyFields=first.metrics.filter(m=>m.format==='CURRENCY').map(m=>/"([^"]+)"/.exec(m.source)?.[1]).filter((f):f is string=>!!f);
 const currency=detectAutoCurrency(prepared.rawRows??prepared.rows,moneyFields,fallback);
 return {view:{id:view.id,name:view.name,datasetId:view.datasetId,updatedAt:view.updatedAt.toISOString(),definition:definition.data},
  dataset:{id:base.dataset.id,name:base.dataset.name,version:base.version.version,updatedAt:base.version.createdAt.toISOString()},
  result:{...first,currency}};
}
