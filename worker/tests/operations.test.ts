import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const admin = '80000000-0000-4000-8000-000000000001';
const requester = '80000000-0000-4000-8000-000000000002';
const outsider = '80000000-0000-4000-8000-000000000003';
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
  it('registra RQ solo tras consultar DNI y permite vincular la convocatoria existente', async () => {
    const found = await db.query<{ result: { found: boolean; name: string; nonce: string } }>('select public.talent_ops_public_lookup($1,$2,$3) result', [tokenHash, '81000002', 'ip-a']);
    expect(found.rows[0].result).toMatchObject({ found: true, name: 'Solicitante Real' });
    const data = { gerenciaId, dni: '81000002', kind: 'MASIVA', companyCampaignId: 'techcenter:bitel-portabilidad', profileRequired: 'Asesor de ventas', fts: 10, salary: 1500, expectedStart: '2026-11-01', criticality: 'ALTA', schedule: 'Lunes a sábado', location: 'Lima', observations: 'Prueba' };
    const saved = await db.query<{ result: { id: string } }>('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb) result', [tokenHash, found.rows[0].result.nonce, 'ip-a', JSON.stringify(data)]);
    const rqId = saved.rows[0].result.id;
    const retried = await db.query<{ result: { id: string } }>('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb) result', [tokenHash, found.rows[0].result.nonce, 'ip-a', JSON.stringify(data)]);
    expect(retried.rows[0].result.id).toBe(rqId);
    const list = await db.query<{ result: { id: string }[] }>('select public.talent_ops_selection($1) result', [admin]);
    expect(list.rows[0].result.some(item => item.id === rqId)).toBe(true);
    await expect(db.query('select public.talent_ops_selection($1)', [outsider])).rejects.toThrow();
    await db.query(`insert into talent.campaigns(company_id,id,company_campaign_id,code,title,status,vacancies,salary_base,annotations) values('techcenter','rq-campaign','techcenter:bitel-portabilidad','RQ-CI','Asesor de ventas','EN_PROCESO',10,1500,$1::jsonb)`, [JSON.stringify({ sourceRqId: rqId })]);
    const linked = await db.query<{ result: { ok: boolean } }>('select public.talent_ops_request_link($1,$2,$3,$4) result', [admin, rqId, 'techcenter', 'rq-campaign']);
    expect(linked.rows[0].result).toEqual({ ok: true });
    await expect(db.query('select public.talent_ops_request_link($1,$2,$3,$4)', [outsider, rqId, 'techcenter', 'rq-campaign'])).rejects.toThrow();
    const staffLookup = await db.query<{ result: { nonce: string } }>('select public.talent_ops_public_lookup($1,$2,$3) result', [tokenHash, '81000002', 'ip-a']);
    const staff = await db.query<{ result: { id: string } }>('select public.talent_ops_public_submit($1,$2,$3,$4::jsonb) result', [tokenHash, staffLookup.rows[0].result.nonce, 'ip-a', JSON.stringify({ ...data, kind: 'STAFF', companyCampaignId: null, profileRequired: 'Coordinador de TI' })]);
    const stored = await db.query<{ company_campaign_id: string | null }>('select company_campaign_id from talent_ops.requests where id=$1', [staff.rows[0].result.id]);
    expect(stored.rows[0].company_campaign_id).toBeNull();
  });
  it('revocar enlace corta la consulta pública', async () => {
    await db.query('select public.talent_ops_link_revoke($1,$2)', [admin, linkId]);
    const config = await db.query<{ result: unknown }>('select public.talent_ops_public_config($1) result', [tokenHash]);
    expect(config.rows[0].result).toBeNull();
  });
});
