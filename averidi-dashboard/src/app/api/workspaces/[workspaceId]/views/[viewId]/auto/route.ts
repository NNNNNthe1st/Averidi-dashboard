import {NextResponse} from 'next/server';
import {enforceWorkspacePermission} from '../../../../../../../features/permissions/http';
import {getAuthenticatedDashboardActor} from '../../../../../../../server/auth-boundary';
import {requireDashboardEntitlement} from '../../../../../../../features/subscriptions/entitlements';
import {autoDashboardData,autoQueryFromUrl} from '../../../../../../../features/auto-dashboards/service';

type Context={params:Promise<{workspaceId:string;viewId:string}>};
const headers={'Cache-Control':'no-store'};

/** Data for an automatic Marketing, Finance or Operations dashboard. */
export async function GET(request:Request,context:Context){
 const denied=await enforceWorkspacePermission(request,context,'views.read');if(denied)return denied;
 const actor=await getAuthenticatedDashboardActor(request);
 if(!actor)return NextResponse.json({error:'UNAUTHORIZED'},{status:401,headers});
 const {workspaceId,viewId}=await context.params;
 if(!await requireDashboardEntitlement(actor,workspaceId))return NextResponse.json({error:'SUBSCRIPTION_REQUIRED'},{status:402,headers});
 try{
  return NextResponse.json(await autoDashboardData(actor,workspaceId,viewId,autoQueryFromUrl(new URL(request.url))),{headers});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  if(code==='FORBIDDEN'||code==='NOT_FOUND')return NextResponse.json({error:'NOT_FOUND'},{status:404,headers});
  if(code==='NOT_AUTOMATIC')return NextResponse.json({error:'NOT_AUTOMATIC'},{status:400,headers});
  if(code==='DATASET_UNAVAILABLE')return NextResponse.json({error:'DATASET_UNAVAILABLE',message:'This dashboard\'s data is not available. It may still be processing.'},{status:409,headers});
  throw error;
 }
}
