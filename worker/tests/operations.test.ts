import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const admin = '80000000-0000-4000-8000-000000000001';
const requester = '80000000-0000-4000-8000-000000000002';
const outsider = '80000000-0000-4000-8000-000000000003';
const operationsBoss = '80000000-0000-4000-8000-000000000004';
const operationsCoordinator = '80000000-0000-4000-8000-000000000005';
let db: PGlite;
let linkId = '';
let gerenciaId = '';
const tokenHash = 'a'.repeat(64);

describe('RQ público de Operaciones', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync(resolve('../supabase/tests/bootstrap.sql'), 'utf8'));
    for (const file of readdirSync(resolve('../supabase/migrations')).filter(file => file.endsWith('.sql')).sort()) await db.exec(readFileSync(resolve('../supabase/migrations', file), 'utf8'));
    await db.exec(`insert into auth.users values ('${admin}'),('${requester}'),('${outsider}');
      insert into talent.profiles(company_id,id,auth_user_id,username,display_name,document_number,role,status,must_change_password) values
      ('techcenter','rq-admin','${admin}','rq.admin','RQ Admin','81000001','ADMIN','ACTIVO',false),
      ('techcenter','rq-requester','${requester}','rq.requester','Solicitante Real','81000002','FORMADOR','ACTIVO',false),
      ('konectados','rq-outsider','${outsider}','rq.outsider','Ajeno','81000003','FORMADOR','ACTIVO',false);`);
  }, 30000);
  afterAll(async () => { await db?.close(); });
  it('exige gerencia, crea enlace por empresa y evita consultar DNI ajeno', async () => {
    await expect(db.query('select public.talent_ops_link_create($1,$2,$3)', [admin, 'techcenter', tokenHash])).rejects.toThrow('GERENCIA_REQUIRED');
    const g = await db.query<{ result: { id: string } }>('select public.talent_ops_gerencia_save($1,$2,$3) result', [admin, 'techcenter', 'Gerencia de Operaciones']);
    gerenciaId = g.rows[0].result.id;
    const l = await db.query<{ result: { id: string } }>('select public.talent_ops_link_create($1,$2,$3) result', [admin, 'techcenter', tokenHash]);
    linkId = l.rows[0].result.id;
    const config = await db.query<{ result: { companyId: string; gerencias: unknown[] } }>('select public.talent_ops_public_config($1) result', [tokenHash]);
    expect(config.rows[0].result.companyId).toBe('techcenter');
    expect(config.rows[0].result.gerencias).toHaveLength(1);
    const foreign = await db.query<{ result: { found: boolean } }>('select public.talent_ops_public_lookup($1,$2,$3) result', [tokenHash, '81000003', 'ip-a']);
    expect(foreign.rows[0].result.found).toBe(false);
    const missing = await db.query<{ result: { found: boolean } }>('select public.talent_ops_public_lookup($1,$2,$3) result', [tokenHash, '99999999', 'ip-a']);
    expect(missing.rows[0].result.found).toBe(false);
  });
  it('admite un perfil activo con cambio de contraseña pendiente en el enlace sin sesión', async () => {
    await db.query('update talent.profiles set must_change_password=true where auth_user_id=$1', [requester]);
    const found = await db.query<{ result: { found: boolean; name: string; nonce: string } }>('select public.talent_ops_public_lookup($1,$2,$3) result', [tokenHash, '81000002', 'ip-pending']);
    expect(found.rows[0].result).toMatchObject({ found: true, name: 'Solicitante Real' });
    expect(found.rows[0].result.nonce).toBeTruthy();
    await db.query('update talent.profiles set must_change_password=false where auth_user_id=$1', [requester]);
  });
  it('registra RQ solo tras consultar DNI y permite vincular la convocatoria existente', async () => {
    const found = await db.query<{ result: { found: boolean; name: string; nonce: string } }>('select public.talent_ops_public_lookup($1,$2,$3) result', [tokenHash, '81000002', 'ip-a']);
    expect(found.rows[0].result).toMatchObject({ found: true, name: 'Solicitante Real' });
    const data = { gerenciaId, dni: '81000002', kind: 'MASIVA', companyCampaignId: 'techcenter:bitel-portabilidad', profileRequired: 'Teleoperador de Ventas', fts: 10, salary: 1500, variableBonus: 250, mobilityBonus: 80, expectedStart: '2026-11-01', criticality: 'ALTA', schedule: 'Lunes a sábado', modality: 'PRESENCIAL', observations: 'Prueba' };
    await expect(db.query('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb)', [tokenHash, found.rows[0].result.nonce, 'ip-a', JSON.stringify({ ...data, profileRequired: 'Otro' })])).rejects.toThrow('INVALID_RQ_DETAILS');
    await expect(db.query('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb)', [tokenHash, found.rows[0].result.nonce, 'ip-a', JSON.stringify({ ...data, modality: 'HIBRIDA' })])).rejects.toThrow('INVALID_RQ_DETAILS');
    await expect(db.query('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb)', [tokenHash, found.rows[0].result.nonce, 'ip-a', JSON.stringify({ ...data, variableBonus: -1 })])).rejects.toThrow('INVALID_BONUS');
    const saved = await db.query<{ result: { id: string } }>('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb) result', [tokenHash, found.rows[0].result.nonce, 'ip-a', JSON.stringify(data)]);
    const rqId = saved.rows[0].result.id;
    const retried = await db.query<{ result: { id: string } }>('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb) result', [tokenHash, found.rows[0].result.nonce, 'ip-a', JSON.stringify(data)]);
    expect(retried.rows[0].result.id).toBe(rqId);
    const list = await db.query<{ result: { id: string; variableBonus: number; mobilityBonus: number; modality: string; location: string | null }[] }>('select public.talent_ops_selection($1) result', [admin]);
    expect(list.rows[0].result.find(item => item.id === rqId)).toMatchObject({ variableBonus: 250, mobilityBonus: 80, modality: 'PRESENCIAL', location: null });
    await expect(db.query('select public.talent_ops_selection($1)', [outsider])).rejects.toThrow();
    await db.query(`insert into talent.campaigns(company_id,id,company_campaign_id,code,title,status,vacancies,salary_base,annotations) values('techcenter','rq-campaign','techcenter:bitel-portabilidad','RQ-CI','Asesor de ventas','EN_PROCESO',10,1500,$1::jsonb)`, [JSON.stringify({ sourceRqId: rqId })]);
    const linked = await db.query<{ result: { ok: boolean } }>('select public.talent_ops_request_link($1,$2,$3,$4) result', [admin, rqId, 'techcenter', 'rq-campaign']);
    expect(linked.rows[0].result).toEqual({ ok: true });
    await expect(db.query('select public.talent_ops_request_link($1,$2,$3,$4)', [outsider, rqId, 'techcenter', 'rq-campaign'])).rejects.toThrow();
    const staffLookup = await db.query<{ result: { nonce: string } }>('select public.talent_ops_public_lookup($1,$2,$3) result', [tokenHash, '81000002', 'ip-a']);
    const staff = await db.query<{ result: { id: string } }>('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb) result', [tokenHash, staffLookup.rows[0].result.nonce, 'ip-a', JSON.stringify({ ...data, kind: 'STAFF', companyCampaignId: null, profileRequired: 'Live Commerce', modality: 'REMOTA' })]);
    const stored = await db.query<{ company_campaign_id: string | null }>('select company_campaign_id from talent_ops.requests where id=$1', [staff.rows[0].result.id]);
    expect(stored.rows[0].company_campaign_id).toBeNull();
  });
  it('revocar enlace corta la consulta pública', async () => {
    await db.query('select public.talent_ops_link_revoke($1,$2)', [admin, linkId]);
    const config = await db.query<{ result: unknown }>('select public.talent_ops_public_config($1) result', [tokenHash]);
    expect(config.rows[0].result).toBeNull();
  });
  it('limita Jefe y Coordinador de Operaciones a su módulo y empresa', async () => {
    await db.exec(`insert into auth.users values ('${operationsBoss}'),('${operationsCoordinator}');
      insert into talent.profiles(company_id,id,auth_user_id,username,display_name,document_number,role,status,must_change_password) values
      ('techcenter','ops-boss','${operationsBoss}','ops.boss','Jefe Operaciones','81000004','JEFE_OPERACIONES','ACTIVO',false),
      ('konectados','ops-coordinator','${operationsCoordinator}','ops.coordinator','Coordinador Operaciones','81000005','COORDINADOR_OPERACIONES','ACTIVO',false);
      insert into talent.user_modules(company_id,user_id,module) values
      ('techcenter','ops-boss','OPERACIONES'),('konectados','ops-coordinator','OPERACIONES');`);
    for (const actor of [operationsBoss, operationsCoordinator]) {
      const context = await db.query<{ result: { allowedModules: string[] } }>('select public.talent_org_context($1,null) result', [actor]);
      expect(context.rows[0].result.allowedModules).toEqual(['OPERACIONES']);
      const view = await db.query<{ result: { companies: { id: string }[]; requests: unknown[] } }>('select public.talent_ops_admin($1) result', [actor]);
      expect(view.rows[0].result.companies).toHaveLength(1);
      expect(view.rows[0].result.requests).toBeDefined();
      await expect(db.query('select public.talent_ops_selection($1)', [actor])).rejects.toThrow();
      await expect(db.query('select public.talent_ops_request_link($1,$2,$3,$4)', [actor, '00000000-0000-4000-8000-000000000000', 'techcenter', 'rq-campaign'])).rejects.toThrow();
    }
    expect((await db.query<{ result: { companies: { id: string }[] } }>('select public.talent_ops_admin($1) result', [operationsBoss])).rows[0].result.companies.map(c => c.id)).toEqual(['techcenter']);
    await expect(db.query("insert into talent_org.user_companies(company_id,auth_user_id,role,enabled) values('konectados',$1,'ANALISTA_SELECCION',true)", [operationsBoss])).rejects.toThrow('OPERATIONS_ROLE_ONLY');
    await expect(db.query("update talent_org.user_companies set all_campaigns=true where auth_user_id=$1", [operationsBoss])).rejects.toThrow('OPERATIONS_CAMPAIGN_SCOPE_FORBIDDEN');
    await db.query("insert into talent_org.global_admins(id,auth_user_id) values('rq-admin',$1)", [admin]);
    await db.query("select public.talent_org_member_save($1,$2,'konectados','JEFE_OPERACIONES',true,false,array[]::text[],null)", [admin, operationsBoss]);
    const secondContext = await db.query<{ result: { allowedModules: string[] } }>("select public.talent_org_context($1,'konectados') result", [operationsBoss]);
    expect(secondContext.rows[0].result.allowedModules).toEqual(['OPERACIONES']);
    await expect(db.query("select public.talent_org_member_save($1,$2,'konectados','JEFE_OPERACIONES',true,true,array[]::text[],null)", [admin, operationsCoordinator])).rejects.toThrow('OPERATIONS_CAMPAIGN_SCOPE_FORBIDDEN');
  });
});
