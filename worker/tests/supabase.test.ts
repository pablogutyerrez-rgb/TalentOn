import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseRepository, verifySupabaseSession, supabaseAdminUser, supabaseAdminPassword } from '../src/supabase';
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-private-key' };
afterEach(() => vi.unstubAllGlobals());
describe('Adaptadores Supabase preparados', () => {
  it('falla cerrado sin configuración', async () => { await expect(new SupabaseRepository({}).get('users/u')).rejects.toMatchObject({ code: 'SUPABASE_NOT_CONFIGURED' }); });
  it('rechaza URL con credenciales o transporte HTTP remoto', async () => { await expect(new SupabaseRepository({ ...env, SUPABASE_URL: 'http://remote.example.com' }).get('users/u')).rejects.toMatchObject({ code: 'SUPABASE_INVALID_URL' }); });
  it('envía escrituras con versiones esperadas a la RPC atómica', async () => {
    const mock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ writes: [] })); vi.stubGlobal('fetch', mock);
    await new SupabaseRepository(env).commit([{ path: 'companies/new', mode: 'create', data: { name: 'Test' } }], { 'companies/new': null });
    expect(mock.mock.calls[0][0]).toBe('https://test.supabase.co/rest/v1/rpc/talent_commit');
    expect(JSON.parse((mock.mock.calls[0] as any)[1].body)).toMatchObject({ p_expected: { 'companies/new': null } });
  });
  it('conflicto SQL no se confunde con éxito', async () => { vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'PT409' }, { status: 409 }))); await expect(new SupabaseRepository(env).commit([],{})).rejects.toMatchObject({ status: 409, code: 'SUPABASE_CONFLICT' }); });
  it('paginación usa cursor y filtro exactos', async () => {
    const mock = vi.fn(async () => Response.json({ items: [], collectionVersion: 4, nextCursor: null })); vi.stubGlobal('fetch', mock);
    await new SupabaseRepository(env).list('captations',{ownerUid:'user'},'captations/previous',100);
    expect(JSON.parse((mock.mock.calls[0] as any)[1].body)).toMatchObject({p_collection:'captations',p_filter:{ownerUid:'user'},p_after:'captations/previous'});
  });
  it('no permite sesión sin Bearer', async () => { await expect(verifySupabaseSession(new Request('https://worker.test'),env)).rejects.toMatchObject({status:401}); });
  it('Auth válido sin perfil autorizado no concede acceso a la app', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/auth/') ? Response.json({ id:'00000000-0000-4000-8000-000000000001' }) : Response.json(null)));
    await expect(verifySupabaseSession(new Request('https://worker.test',{headers:{Authorization:'Bearer test-token'}}),env)).rejects.toMatchObject({status:403});
  });
  it('rechaza tokens inválidos y perfiles desactivados', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({}, {status:401}))); await expect(verifySupabaseSession(new Request('https://worker.test',{headers:{Authorization:'Bearer invalid'}}),env)).rejects.toMatchObject({status:401});
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('/auth/') ? Response.json({id:'00000000-0000-4000-8000-000000000001'}) : Response.json({data:{uid:'00000000-0000-4000-8000-000000000001',status:'INACTIVO'}})));
    await expect(verifySupabaseSession(new Request('https://worker.test',{headers:{Authorization:'Bearer test'}}),env)).rejects.toMatchObject({status:403});
  });
  it('un usuario activo devuelve únicamente el UID verificado', async () => {
    const id='00000000-0000-4000-8000-000000000001'; vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('/auth/') ? Response.json({id}) : Response.json({data:{uid:id,status:'ACTIVO',enabled:true}})));
    expect(await verifySupabaseSession(new Request('https://worker.test',{headers:{Authorization:'Bearer test'}}),env)).toBe(id);
  });
  it('operaciones Auth administrativas rechazan contraseñas insuficientes sin HTTP', async () => {
    const mock=vi.fn();vi.stubGlobal('fetch',mock);
    await expect(supabaseAdminUser(env,{username:'admin',password:'short',displayName:'Test'})).rejects.toMatchObject({status:400});
    await expect(supabaseAdminPassword(env,'00000000-0000-4000-8000-000000000001','short')).rejects.toMatchObject({status:400});expect(mock).not.toHaveBeenCalled();
  });
});
