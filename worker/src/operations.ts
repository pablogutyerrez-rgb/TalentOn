import { relationalSession } from './supabaseSession';
import { supabaseServerHeaders, SupabaseError, type SupabaseEnv } from './supabase';

type Env = SupabaseEnv & { CAPTURE_HASH_SECRET?: string; TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string; ALLOWED_ORIGIN?: string; PRODUCTION_ORIGIN?: string };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
async function rpc<T>(env: Env, name: string, data: object): Promise<T> {
  const result = await fetch(`${env.SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers: supabaseServerHeaders(env), body: JSON.stringify(data) });
  if (!result.ok) {
    const error = await result.json<{ code?: string; message?: string }>().catch((): { code?: string; message?: string } => ({}));
    const code = error.message === 'RATE_LIMITED' ? 'RATE_LIMITED' : error.code === '42501' ? 'FORBIDDEN' : error.code === '23505' ? 'DUPLICATE_RECORD' : error.message && /^(INVALID_|LINK_|LOOKUP_|RQ_|GERENCIA_|CAMPAIGN_)/.test(error.message) ? error.message : 'OPERATIONS_REQUEST_FAILED';
    throw new SupabaseError(code === 'RATE_LIMITED' ? 429 : code === 'FORBIDDEN' ? 403 : code === 'DUPLICATE_RECORD' ? 409 : 400, code);
  }
  return result.json<T>();
}
async function input(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new SupabaseError(400, 'INVALID_CONTENT_TYPE');
  const text = await request.text();
  if (text.length > 8192) throw new SupabaseError(413, 'INVALID_BODY');
  try { const value = JSON.parse(text); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch { /* handled below */ }
  throw new SupabaseError(400, 'INVALID_BODY');
}
function originAllowed(request: Request, env: Env) {
  const origin = request.headers.get('origin');
  return !origin || [env.ALLOWED_ORIGIN, env.PRODUCTION_ORIGIN].flatMap(value => (value || '').split(',')).map(value => value.trim()).includes(origin);
}
async function verifyChallenge(request: Request, env: Env, token: unknown) {
  if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY || !env.CAPTURE_HASH_SECRET) throw new SupabaseError(503, 'OPERATIONS_SECURITY_NOT_CONFIGURED');
  if (typeof token !== 'string' || token.length > 2048 || !token) throw new SupabaseError(403, 'CHALLENGE_REQUIRED');
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: request.headers.get('cf-connecting-ip') || '' }) });
  const verified = await result.json<{ success?: boolean; hostname?: string; action?: string }>();
  const hosts = [env.ALLOWED_ORIGIN, env.PRODUCTION_ORIGIN].flatMap(value => (value || '').split(',')).map(value => { try { return new URL(value.trim()).hostname; } catch { return ''; } });
  if (!result.ok || !verified.success || verified.action !== 'operations' || !hosts.includes(verified.hostname || '')) throw new SupabaseError(403, 'CHALLENGE_FAILED');
}
export async function handleOperations(request: Request, env: Env): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/operations/') && !path.startsWith('/api/public/operations/')) return;
  try {
    if (!originAllowed(request, env)) throw new SupabaseError(403, 'ORIGIN_NOT_ALLOWED');
    const pub = path.match(/^\/api\/public\/operations\/([a-f0-9]{48})(?:\/(lookup|submit))?$/);
    if (pub) {
      const hash = await digest(pub[1]);
      if (request.method === 'GET' && !pub[2]) {
        const config = await rpc<Record<string, unknown> | null>(env, 'talent_ops_public_config', { p_hash: hash });
        if (!config) throw new SupabaseError(404, 'LINK_NOT_FOUND');
        return reply({ ...config, turnstileSiteKey: env.TURNSTILE_SITE_KEY || '', securityReady: Boolean(env.CAPTURE_HASH_SECRET && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY) });
      }
      if (request.method !== 'POST' || !pub[2]) throw new SupabaseError(404, 'NOT_FOUND');
      const data = await input(request);
      const ip = await digest(`${env.CAPTURE_HASH_SECRET || 'unconfigured'}:${request.headers.get('cf-connecting-ip') || 'unknown'}`);
      if (pub[2] === 'lookup') {
        await verifyChallenge(request, env, data.turnstileToken);
        const found = await rpc<Record<string, unknown> | null>(env, 'talent_ops_public_lookup', { p_hash: hash, p_dni: data.dni, p_ip: ip });
        return reply(found || { found: false });
      }
      if (!env.CAPTURE_HASH_SECRET || !env.TURNSTILE_SECRET_KEY) throw new SupabaseError(503, 'OPERATIONS_SECURITY_NOT_CONFIGURED');
      if (typeof data.nonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.nonce)) throw new SupabaseError(400, 'LOOKUP_EXPIRED');
      const created = await rpc(env, 'talent_ops_public_submit', { p_hash: hash, p_nonce: data.nonce, p_ip: ip, p_data: data });
      return reply(created, 201);
    }
    const actor = await relationalSession(request, env);
    if (path === '/api/operations/admin' && request.method === 'GET') return reply(await rpc(env, 'talent_ops_admin', { p_actor: actor.authUserId }));
    if (path === '/api/operations/requests' && request.method === 'GET') return reply(await rpc(env, 'talent_ops_selection', { p_actor: actor.authUserId }));
    if (path === '/api/operations/gerencias' && request.method === 'POST') {
      const data = await input(request);
      return reply(await rpc(env, 'talent_ops_gerencia_save', { p_actor: actor.authUserId, p_company: data.companyId, p_name: data.name }), 201);
    }
    if (path === '/api/operations/links' && request.method === 'POST') {
      const data = await input(request);
      const token = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(byte => byte.toString(16).padStart(2, '0')).join('');
      const link = await rpc<Record<string, unknown>>(env, 'talent_ops_link_create', { p_actor: actor.authUserId, p_company: data.companyId, p_hash: await digest(token) });
      const appOrigin = request.headers.get('origin') || env.PRODUCTION_ORIGIN?.split(',')[0] || '';
      return reply({ ...link, url: `${appOrigin}/operaciones/rq/${token}`, token }, 201);
    }
    const revoke = path.match(/^\/api\/operations\/links\/([0-9a-f-]{36})\/revoke$/i);
    if (revoke && request.method === 'POST') return reply(await rpc(env, 'talent_ops_link_revoke', { p_actor: actor.authUserId, p_id: revoke[1] }));
    const link = path.match(/^\/api\/operations\/requests\/([0-9a-f-]{36})\/link$/i);
    if (link && request.method === 'POST') {
      const data = await input(request);
      return reply(await rpc(env, 'talent_ops_request_link', { p_actor: actor.authUserId, p_id: link[1], p_company: data.companyId, p_campaign: data.campaignId }));
    }
    throw new SupabaseError(404, 'NOT_FOUND');
  } catch (error) {
    const status = error instanceof SupabaseError ? error.status : 500;
    return reply({ message: error instanceof SupabaseError ? error.code : 'OPERATIONS_REQUEST_FAILED' }, status);
  }
}
