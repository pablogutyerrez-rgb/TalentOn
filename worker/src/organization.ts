import {supabaseServerHeaders,SupabaseError,type SupabaseEnv} from './supabase';
import type {SessionProfile} from './supabaseSession';
export async function organizationUserGuard(env:SupabaseEnv,actor:SessionProfile,userId:string){
 const r=await fetch(env.SUPABASE_URL!.replace(/\/$/,'')+'/rest/v1/rpc/talent_org_user_edit_guard',{method:'POST',headers:supabaseServerHeaders(env),body:JSON.stringify({p_actor:actor.authUserId,p_user:userId})});
 if(!r.ok)throw new SupabaseError(403,'FORBIDDEN');
}
export async function organizationRequest(request:Request,env:SupabaseEnv,actor:SessionProfile){
 const path=new URL(request.url).pathname;let name:string;let body:Record<string,unknown>={p_actor:actor.authUserId};
 if(path==='/api/org'&&request.method==='GET')name='talent_org_directory';
 else if(path==='/api/org/summary'&&request.method==='POST'){
  name='talent_org_summary';const input=await request.json<Record<string,unknown>>();body={...body,p_company:input.companyId||null,p_assignment:input.companyCampaignId||null};
 }else{
  if(!actor.globalAdmin)throw new SupabaseError(403,'FORBIDDEN');
  const input=await request.json<Record<string,unknown>>();
  if(path==='/api/org/catalog'&&request.method==='POST'){
   name='talent_org_catalog_save';body={...body,p_company:input.companyId||null,p_id:input.id,p_name:input.name||null,p_global_campaign:input.globalCampaignId||null,p_expected:input.version??null,p_configuration:input.configuration||{}};
  }else if(path==='/api/org/companies'&&request.method==='POST'){
   name='talent_org_company_save';body={...body,p_id:input.id,p_name:input.name,p_legal:input.legalName||null,p_tax:input.taxId||null,p_expected:input.version??null};
  }else if(path==='/api/org/memberships'&&request.method==='POST'){
   name='talent_org_member_save';body={...body,p_user:input.userId,p_company:input.companyId,p_role:input.role,p_enabled:input.enabled,p_all:input.allCampaigns,p_scopes:input.scopes,p_expected:input.version??null};
  }else throw new SupabaseError(404,'NOT_FOUND');
 }
 const r=await fetch(env.SUPABASE_URL!.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:supabaseServerHeaders(env),body:JSON.stringify(body)});
 if(!r.ok){const error=await r.json<{code?:string}>().catch(()=>({} as {code?:string}));throw new SupabaseError(error.code==='PT409'?409:error.code==='42501'?403:400,error.code==='PT409'?'CAPTURE_RETRY':error.code==='42501'?'FORBIDDEN':'ORG_VALIDATION_FAILED');}
 return r.json();
}
