// Adaptador DOCUMENTAL anterior, no conectado. No usar con schema talent relacional.
// La adaptación de contratos al nuevo modelo se hará en una fase posterior.
export interface SupabaseEnv { SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_ALLOW_LOCAL?: string;ORG_ENABLED?:string;ORG_COMPANY?:string;IDENTITY_HASH_SECRET?:string }
const secretKey = (env: SupabaseEnv) => env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
export function supabaseServerHeaders(env: SupabaseEnv): Record<string,string> { const key = secretKey(env); if (!key) throw new SupabaseError(503, 'SUPABASE_NOT_CONFIGURED'); return { apikey: key, ...(key.split('.').length === 3 ? { Authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json' }; }
export interface SupabaseDocument { path: string; data: Record<string, unknown>; version: number; updatedAt: string }
export class SupabaseError extends Error { constructor(public status: number, public code: string) { super(code); } }
function endpoint(env: SupabaseEnv) {
  if (!env.SUPABASE_URL || !secretKey(env)) throw new SupabaseError(503, 'SUPABASE_NOT_CONFIGURED');
  const url = new URL(env.SUPABASE_URL);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(env.SUPABASE_ALLOW_LOCAL === 'true' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new SupabaseError(503, 'SUPABASE_INVALID_URL');
  return url.origin;
}
export class SupabaseRepository {
  constructor(private env: SupabaseEnv) {}
  private async rpc<T>(name: string, input: object): Promise<T> {
    const r = await fetch(`${endpoint(this.env)}/rest/v1/rpc/${name}`, { method: 'POST', headers: supabaseServerHeaders(this.env), body: JSON.stringify(input) });
    if (!r.ok) { const data = await r.json<{ code?: string }>().catch(() => ({} as { code?: string })); throw new SupabaseError(data.code === 'PT409' || data.code === '23505' ? 409 : r.status, data.code === 'PT409' || data.code === '23505' ? 'SUPABASE_CONFLICT' : 'SUPABASE_REQUEST_FAILED'); }
    return r.json<T>();
  }
  get(path: string) { return this.rpc<SupabaseDocument | null>('talent_get', { p_path: path }); }
  list(collection: string, filter: Record<string, unknown> = {}, after = '', limit = 100) { return this.rpc<{ items: SupabaseDocument[]; collectionVersion: number; nextCursor: string | null }>('talent_list', { p_collection: collection, p_filter: filter, p_after: after, p_limit: limit }); }
  commit(writes: { path: string; data: Record<string, unknown>; mode: 'create' | 'replace' | 'merge' }[], expected: Record<string, number | null>, collections: Record<string, number> = {}) {
    return this.rpc<{ writes: { path: string; version: number }[] }>('talent_commit', { p_writes: writes, p_expected: expected, p_collections: collections });
  }
}
export async function verifySupabaseSession(request: Request, env: SupabaseEnv): Promise<string> {
  const token = request.headers.get('authorization'); if (!token?.match(/^Bearer\s+\S+$/i)) throw new SupabaseError(401, 'UNAUTHENTICATED');
  const r = await fetch(`${endpoint(env)}/auth/v1/user`, { headers: { ...supabaseServerHeaders(env), Authorization: token } });
  if (!r.ok) throw new SupabaseError(401, 'INVALID_TOKEN');
  const user = await r.json<{ id?: string; banned_until?: string }>();
  if (!user.id || (user.banned_until && Date.parse(user.banned_until) > Date.now())) throw new SupabaseError(401, 'INVALID_TOKEN');
  const profile = await new SupabaseRepository(env).get(`users/${user.id}`);
  if (!profile || profile.data.enabled === false || profile.data.status !== 'ACTIVO' || profile.data.uid !== user.id) throw new SupabaseError(403, 'ACCOUNT_DISABLED_OR_PROFILE_MISSING');
  return user.id;
}
export async function supabaseAdminUser(env: SupabaseEnv, input: { username: string; password: string; displayName: string }) {
  if (!/^[a-z0-9][a-z0-9._-]{2,47}$/.test(input.username) || input.password.length < 12) throw new SupabaseError(400, 'INVALID_USER_OR_PASSWORD');
  const r = await fetch(`${endpoint(env)}/auth/v1/admin/users`, { method: 'POST', headers: supabaseServerHeaders(env), body: JSON.stringify({ email: `${input.username}@auth.talentcc.invalid`, password: input.password, email_confirm: true, user_metadata: { displayName: input.displayName } }) });
  if (!r.ok) throw new SupabaseError(r.status, 'SUPABASE_USER_CREATE_FAILED');
  const account = await r.json<{ id: string }>(); if (!/^[a-f0-9-]{36}$/i.test(account.id || '')) throw new SupabaseError(502, 'SUPABASE_INVALID_USER_RESPONSE'); return account;
}
export async function supabaseAdminPassword(env: SupabaseEnv, uid: string, password: string) {
  if (!/^[a-f0-9-]{36}$/.test(uid) || password.length < 12) throw new SupabaseError(400, 'INVALID_PASSWORD_REQUEST');
  const r = await fetch(`${endpoint(env)}/auth/v1/admin/users/${uid}`, { method: 'PUT', headers: supabaseServerHeaders(env), body: JSON.stringify({ password }) });
  if (!r.ok) throw new SupabaseError(r.status, 'SUPABASE_PASSWORD_UPDATE_FAILED');
}
