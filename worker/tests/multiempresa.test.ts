import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
let db:PGlite;
const actor='70000000-0000-4000-8000-000000000001';
const stranger='70000000-0000-4000-8000-000000000002';
describe('Multiempresa preparada: SQL real y RLS',()=>{
 beforeAll(async()=>{
  db=new PGlite();await db.exec(readFileSync(resolve('../supabase/tests/bootstrap.sql'),'utf8'));
  for(const f of readdirSync(resolve('../supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(resolve('../supabase/migrations',f),'utf8'));
  await db.exec(`insert into auth.users values('${actor}'),('${stranger}');
   insert into talent.companies(id,name) values('legacy-ci','CI');
   insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,must_change_password) values
    ('legacy-ci','actor','${actor}','org.actor','CI','ADMIN','ACTIVO',false),('legacy-ci','stranger','${stranger}','org.other','CI','ADMIN','ACTIVO',false);
   insert into talent_org.user_companies(company_id,id,auth_user_id,role) values('talent-up','membership','${actor}','JEFE_SELECCION');
   insert into talent_org.user_campaigns(company_id,id,auth_user_id,company_campaign_id) values('talent-up','scope','${actor}','talent-up:bitel-portabilidad');`);
 },30000);
 afterAll(async()=>{await db?.close()});
 it('rechaza colisiones de ID entre identidades canónicas de distintas empresas',async()=>{
  await db.exec('begin');
  try {
   await db.exec(`insert into auth.users values('70000000-0000-4000-8000-000000000099');
    insert into talent.companies(id,name) values('collision-ci','Collision');
    insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,must_change_password)
    values('collision-ci','actor','70000000-0000-4000-8000-000000000099','collision.actor','Collision','ADMIN','ACTIVO',false)`);
   await expect(db.query("insert into talent_org.user_companies(company_id,id,auth_user_id,role) values('techcenter','collision-member',$1,'ADMIN')",[actor])).rejects.toThrow('TALENT_PROFILE_ID_COLLISION');
  } finally {await db.exec('rollback')}
 });
 it('tres empresas, cuatro definiciones únicas y ocho asociaciones',async()=>{
  expect((await db.query<{n:number}>('select count(*)::int as n from talent_org.global_campaigns')).rows[0].n).toBe(4);
  expect((await db.query<{n:number}>('select count(*)::int as n from talent_org.company_campaigns')).rows[0].n).toBe(8);
 });
 it('ADMIN antiguo no adquiere acceso global ni a otra empresa',async()=>{
  const r=await db.query('select talent_private.org_global_admin($1) as global,talent_private.org_company_access($1,$2) as access',[stranger,'techcenter']);
  expect(r.rows[0]).toEqual({global:false,access:false});
 });
 it('RLS permite solo campaña explícita, sin exposición de PII',async()=>{
  await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${actor}',true);`);
  try{
   const rows=(await db.query('select company_id,id from talent_org.company_campaigns')).rows;
   expect(rows).toEqual([{company_id:'talent-up',id:'talent-up:bitel-portabilidad'}]);
   expect((await db.query('select name from talent_org.global_campaigns')).rows).toEqual([{name:'Portabilidad Bitel'}]);
   await expect(db.query('select * from talent_org.identity_registry')).rejects.toThrow();
  }finally{await db.exec('rollback')}
 });
 it('rechaza asociación cruzada y convocatoria sin campaña autorizada',async()=>{
  await expect(db.exec(`insert into talent_org.user_campaigns(company_id,id,auth_user_id,company_campaign_id) values('talent-up','bad','${actor}','techcenter:bitel-portabilidad')`)).rejects.toThrow();
  await expect(db.exec("insert into talent.campaigns(company_id,id,code,title,status,vacancies) values('talent-up','bad','BAD','CI','EN_PROCESO',1)")).rejects.toThrow('TALENT_COMPANY_CAMPAIGN_REQUIRED');
  await db.exec("insert into talent.campaigns(company_id,id,code,title,status,vacancies,company_campaign_id) values('talent-up','valid','VALID','CI','EN_PROCESO',1,'talent-up:bitel-portabilidad')");
  await expect(db.exec("update talent.campaigns set company_campaign_id='talent-up:bitel-migraciones' where id='valid'")).rejects.toThrow('TALENT_TRANSFER_PROCEDURE_REQUIRED');
 });
 it('RPC administrativa deniega no autorizado y aplica CAS al global explícito',async()=>{
  await expect(db.query('select public.talent_org_catalog_save($1,null,$2,$3,null,null) ',[stranger,'new','CI'])).rejects.toThrow();
  await db.exec(`insert into talent_org.global_admins(id,auth_user_id) values('global','${stranger}')`);
  await db.query('select public.talent_org_catalog_save($1,null,$2,$3,null,null)',[stranger,'new','CI']);
  await expect(db.query('select public.talent_org_catalog_save($1,null,$2,$3,null,null)',[stranger,'new','Changed'])).rejects.toThrow('TALENT_VERSION_CONFLICT');
  const result=await db.query<{data:{version:number}}>('select public.talent_org_catalog_save($1,null,$2,$3,null,1) as data',[stranger,'new','Changed']);
  expect((result.rows[0].data as any).version).toBe(2);
  expect((await db.query<{n:number}>("select count(*)::int as n from talent_org.audit_events where actor_auth_id=$1",[stranger])).rows[0].n).toBeGreaterThan(0);
 });
 it('analítica global rechaza ADMIN sin autorización global y no entrega PII',async()=>{
  await expect(db.query('select public.talent_org_summary($1)',[actor])).rejects.toThrow();
  const result=await db.query<{data:Record<string,number>}>('select public.talent_org_summary($1,$2,$3) as data',[actor,'talent-up','talent-up:bitel-portabilidad']);
  expect(result.rows[0].data).toEqual({persons:0,applications:0,hires:0,requests:0,campaigns:1});
  await expect(db.query('select public.talent_org_summary($1,$2,$3)',[actor,'techcenter','techcenter:bitel-portabilidad'])).rejects.toThrow();
 });
 it('permite pertenecer a dos empresas sin duplicar cuenta Auth',async()=>{
  await db.exec(`insert into talent_org.user_companies(company_id,id,auth_user_id,role) values('techcenter','second','${actor}','RECLUTADOR')`);
  expect((await db.query<{n:number}>('select count(*)::int as n from talent_org.user_companies where auth_user_id=$1',[actor])).rows[0].n).toBe(2);
  expect((await db.query<{access:boolean}>('select talent_private.org_campaign_access($1,$2,$3) as access',[actor,'techcenter','techcenter:bitel-portabilidad'])).rows[0].access).toBe(false);
 });
 it('protege la cuenta global y evita desactivar al último administrador global',async()=>{
  await expect(db.query('select public.talent_org_user_edit_guard($1,$2)',[actor,stranger])).rejects.toThrow();
  await expect(db.query('update talent.profiles set enabled=false where auth_user_id=$1',[stranger])).rejects.toThrow('TALENT_LAST_GLOBAL_ADMIN_REQUIRED');
  await expect(db.query("update talent.profiles set role='RECLUTADOR' where auth_user_id=$1",[stranger])).rejects.toThrow('TALENT_GLOBAL_ADMIN_ROLE_REQUIRED');
  await expect(db.query('update talent_org.global_admins set enabled=false where auth_user_id=$1',[stranger])).rejects.toThrow('TALENT_LAST_GLOBAL_ADMIN_REQUIRED');
 });
 it('hogar revocado conserva identidad Auth y selecciona solo empresas autorizadas',async()=>{
  const fresh='70000000-0000-4000-8000-000000000003';
  await db.exec(`insert into auth.users values('${fresh}');insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,must_change_password) values('talent-up','fresh','${fresh}','org.fresh','CI','RECLUTADOR','ACTIVO',false)`);
  await db.query("select public.talent_org_member_save($1,$2,'techcenter','RECLUTADOR',true,false,'{techcenter:bitel-portabilidad}',null)",[stranger,fresh]);
  await db.query("select public.talent_org_member_save($1,$2,'talent-up','RECLUTADOR',false,false,'{}',1)",[stranger,fresh]);
  const context=await db.query<{data:{companyId:string;companies:{id:string}[]}}>('select public.talent_org_context($1,null) as data',[fresh]);
  expect(context.rows[0].data.companyId).toBe('techcenter');expect(context.rows[0].data.companies.map(c=>c.id)).toEqual(['techcenter']);
 });
});
