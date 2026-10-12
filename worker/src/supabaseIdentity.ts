import {supabaseServerHeaders,SupabaseError} from './supabase';
import type {RuntimeEnv} from './relationalRuntime';
type D=Record<string,any>;
export async function relationalIdentity(env:RuntimeEnv,action:'create'|'update'|'delete'|'lookup',body:D):Promise<D>{
 const root=env.SUPABASE_URL!.replace(/\/$/,'')+'/auth/v1/admin/users';
 const call=async(url:string,method='GET',data?:D)=>{
  const r=await fetch(url,{method,headers:supabaseServerHeaders(env),...(data?{body:JSON.stringify(data)}:{})});
  if(r.status===404)return undefined;
  if(!r.ok)throw new SupabaseError(r.status,'AUTH_ADMIN_REQUEST_FAILED');
  return r.json<D>();
 };
 if(action==='lookup'){
  if(body.localId?.[0]){const user=await call(root+'/'+encodeURIComponent(body.localId[0]));return {users:user?[{...user,localId:user.id}]:[]};}
  for(let page=1;page<=10;page++){const result=await call(root+'?page='+page+'&per_page=1000');const users=result?.users||[];const match=users.find((u:D)=>body.email?.includes(u.email));if(match)return {users:[{...match,localId:match.id}]};if(users.length<1000)return {users:[]};}
  throw new SupabaseError(503,'AUTH_PAGINATION_REQUIRED');
 }
 if(action==='create'){
  const user=await call(root,'POST',{email:body.email,password:body.password,email_confirm:true,user_metadata:{displayName:body.displayName},app_metadata:{runtime_password_pending:true},...(body.disabled?{ban_duration:'876000h'}:{})});
  if(!user?.id)throw new SupabaseError(502,'AUTH_USER_ID_MISSING');
  env.RELATIONAL_RUNTIME?.newAuthIds.push(user.id);return {...user,localId:user.id};
 }
 const uid=String(body.localId||'');
 if(action==='delete'){
  if(env.RELATIONAL_RUNTIME?.committed)return {};
  // Solo compensación de cuentas recién creadas, nunca usuarios históricos.
  if(!env.RELATIONAL_RUNTIME?.newAuthIds.includes(uid))throw new SupabaseError(403,'FORBIDDEN');
  await call(root+'/'+encodeURIComponent(uid),'PUT',{ban_duration:'876000h'});return {};
 }
 const profile=await env.RELATIONAL_RUNTIME?.get('users/'+uid);
 if(!profile&&!env.RELATIONAL_RUNTIME?.newAuthIds.includes(uid))throw new SupabaseError(403,'FORBIDDEN');
 const patch:D={...(body.email?{email:body.email}:{}),...(body.displayName?{user_metadata:{displayName:body.displayName}}:{}),...(body.disabled!==undefined?{ban_duration:body.disabled?'876000h':'none'}:{})};
 if(body.password){patch.password=body.password;patch.app_metadata={runtime_password_pending:true};patch.ban_duration=profile?.status==='ACTIVO'&&profile?.enabled!==false?'none':'876000h';env.RELATIONAL_RUNTIME?.markPasswordReset(uid);}
 // Primero persiste estado/permisos y bloqueo en SQL. Si Auth falla no concede acceso.
 env.RELATIONAL_RUNTIME!.deferAuth(async()=>{await call(root+'/'+encodeURIComponent(uid),'PUT',patch);});
 return {localId:uid};
}
