// Integración relacional de sesión. No activar proveedor operativo parcialmente.
import { supabaseServerHeaders, SupabaseError, type SupabaseEnv } from './supabase';

export interface SessionProfile {
 id: string; authUserId: string; companyId: string; username: string; name: string;
 role: string; status: string; mustChangePassword: boolean; version: number;
 allowedModules: string[];
}
function base(env: SupabaseEnv) {
 const url = new URL(env.SUPABASE_URL || '');
 if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new SupabaseError(503,'SUPABASE_INVALID_URL');
 return url.origin;
}
async function rpc<T>(env: SupabaseEnv, name: string, body: object): Promise<T> {
 const result = await fetch(base(env)+'/rest/v1/rpc/'+name,{method:'POST',headers:supabaseServerHeaders(env),body:JSON.stringify(body)});
 if (!result.ok) throw new SupabaseError(result.status,'SUPABASE_REQUEST_FAILED');
 return result.json<T>();
}
export async function relationalSession(request: Request, env: SupabaseEnv, allowPasswordChange=false): Promise<SessionProfile> {
 const authorization=request.headers.get('authorization');
 if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) throw new SupabaseError(401,'UNAUTHENTICATED');
 const result=await fetch(base(env)+'/auth/v1/user',{headers:{...supabaseServerHeaders(env),Authorization:authorization}});
 if (!result.ok) throw new SupabaseError(401,'INVALID_TOKEN');
 const user=await result.json<{id?:string;banned_until?:string;app_metadata?:{runtime_password_pending?:boolean}}>();
 if (!user.id || (user.banned_until && Date.parse(user.banned_until)>Date.now())) throw new SupabaseError(401,'INVALID_TOKEN');
 const profile=await rpc<SessionProfile|null>(env,'talent_session_profile',{p_auth:user.id});
 if (!profile || profile.authUserId!==user.id || profile.status!=='ACTIVO') throw new SupabaseError(403,'ACCOUNT_DISABLED');
 profile.mustChangePassword=profile.mustChangePassword||user.app_metadata?.runtime_password_pending===true;
 if (profile.mustChangePassword && !allowPasswordChange) throw new SupabaseError(403,'PASSWORD_CHANGE_REQUIRED');
 return profile;
}
export async function changeFirstPassword(request: Request, env: SupabaseEnv): Promise<void> {
 const profile=await relationalSession(request,env,true);
 const body=await request.json<{password?:unknown}>();
 if (typeof body.password!=='string' || body.password.length<12 || body.password.length>128) throw new SupabaseError(400,'PASSWORD_MIN_12');
 // Actualiza solo al actor verificado. UID del body no interviene.
 const changed=await fetch(base(env)+'/auth/v1/admin/users/'+encodeURIComponent(profile.authUserId),{method:'PUT',headers:supabaseServerHeaders(env),body:JSON.stringify({password:body.password,app_metadata:{runtime_password_pending:false}})});
 if (!changed.ok) throw new SupabaseError(changed.status,'SUPABASE_PASSWORD_UPDATE_FAILED');
 const account=await changed.json<{id?:string}>();
 if (account.id!==profile.authUserId) throw new SupabaseError(502,'SUPABASE_INVALID_USER_RESPONSE');
 // Si falla el CAS se mantiene el bloqueo; nunca habilitar antes de éxito en Auth.
 await rpc(env,'talent_password_change_complete',{p_auth:profile.authUserId,p_expected:profile.version});
}
