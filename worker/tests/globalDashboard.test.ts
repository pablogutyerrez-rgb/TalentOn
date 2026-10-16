import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const actor='71000000-0000-4000-8000-000000000001',other='71000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 db=new PGlite();await db.exec(readFileSync(resolve('../supabase/tests/bootstrap.sql'),'utf8'));
 for(const f of readdirSync(resolve('../supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(resolve('../supabase/migrations',f),'utf8'));
 await db.exec(`insert into auth.users values('${actor}'),('${other}');insert into talent.companies(id,name) values('home-ci','Home');
 insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,must_change_password) values ('home-ci','admin','${actor}','global.test','Global','ADMIN','ACTIVO',false),('home-ci','other','${other}','local.test','Local','ADMIN','ACTIVO',false);
 insert into talent_org.global_admins(id,auth_user_id) values('global','${actor}');`);
 for(const [company,n] of [['talent-up',1],['techcenter',3]] as const){
  await db.query("select public.talent_org_member_save($1,$1,$2,'ADMIN',true,true,'{}',null)",[actor,company]);
  await db.query("insert into talent.campaigns(company_id,id,code,title,status,vacancies,company_campaign_id) values($1,'call','CALL','Test','EN_PROCESO',5,$1||':bitel-portabilidad')",[company]);
  await db.query("insert into talent.training_groups(company_id,id,campaign_id,code,name,start_date,theory_end_date,theory_days,schedule,modality,status) values($1,'group','call','G','Test','2026-10-01','2026-10-05',5,'09:00-16:00','PRESENCIAL','EN_CAPACITACION')",[company]);
  for(let i=0;i<n;i++){
   await db.query("insert into talent.persons(company_id,id,full_name) values($1,$2,'Private name')",[company,'p'+i]);
   await db.query("insert into talent.applications(company_id,id,person_id,campaign_id,recruiter_id,status,stage,application_date) values($1,$2,$2,'call','admin','ACTIVA','CAPACITACION','2026-10-01')",[company,'p'+i]);
   await db.query("insert into talent.participants(company_id,id,group_id,application_id,status,joined_at,day1_at) values($1,$2,'group',$2,'ACTIVO','2026-10-01','2026-10-01')",[company,'p'+i]);
  }
  for(let i=0;i<2;i++)await db.query("insert into talent.dropouts(company_id,id,participant_id,occurred_on,phase,category,observation,recorded_by) values($1,$2,'p0','2026-10-02','CAPACITACION_TEORICA','OTRO','Test','admin')",[company,'d'+i]);
 }
},30000);
afterAll(async()=>{await db?.close()});
it('global deserción usa 2/4=50%, no promedio 66.67% ni 4 eventos',async()=>{
 const {rows}=await db.query<{data:any}>('select public.talent_org_dashboard($1) data',[actor]);
 expect(rows[0].data.totals).toMatchObject({started:4,dropouts:2,dropout_rate:50,applications:4});
 expect(rows[0].data.funnel).toEqual({postulantes:4,contactados:4,entrevistados:4,verificacion:4,evaluados:4,aptos:4});
 expect(rows[0].data.companies).toHaveLength(3);expect(JSON.stringify(rows)).not.toContain('Private name');
});
it('filtros empresa, campaña y período consultan datos originales',async()=>{
 const one=(await db.query<{data:any}>('select public.talent_org_dashboard($1,$2) data',[actor,'talent-up'])).rows[0].data;
 expect(one.totals).toMatchObject({started:1,dropouts:1,dropout_rate:100});
 expect(one.funnel.postulantes).toBe(1);
 for(const args of [[null,'win-internet',null,null],[null,null,'2026-11-01','2026-11-30']]){
  const empty=(await db.query<{data:any}>('select public.talent_org_dashboard($1,$2,$3,$4,$5) data',[actor,...args])).rows[0].data;
  expect(empty.totals.started).toBe(0);expect(empty.totals.dropout_rate).toBeNull();
  expect(empty.funnel.postulantes).toBe(0);
 }
});
it('ADMIN sin registro global no consulta consolidado ni directorio de personas',async()=>{
 await expect(db.query('select public.talent_org_dashboard($1)',[other])).rejects.toThrow();
 await expect(db.query('select public.talent_org_users($1)',[other])).rejects.toThrow();
});
it('embudo usa etapas alcanzadas, conserva historial y no revela nombres',async()=>{
 await db.query("insert into talent.persons(company_id,id,full_name) values('talent-up','pending','Nombre reservado'),('talent-up','historical','Nombre reservado')");
 await db.query("insert into talent.applications(company_id,id,person_id,campaign_id,recruiter_id,status,stage,application_date) values('talent-up','pending','pending','call','admin','ACTIVA','NUEVO','2026-10-01'),('talent-up','historical','historical','call','admin','CERRADA','NO_APTO','2026-10-01')");
 await db.query("insert into talent.contract_events(company_id,id,application_id,stream,occurred_at,new_state) values('talent-up','history-test','historical','selection',now(),'ENTREVISTA')");
 const result=(await db.query<{data:any}>('select public.talent_org_dashboard($1,$2) data',[actor,'talent-up'])).rows[0].data;
 expect(result.funnel).toEqual({postulantes:3,contactados:2,entrevistados:2,verificacion:1,evaluados:1,aptos:1});
 expect(JSON.stringify(result)).not.toContain('Nombre reservado');
});
