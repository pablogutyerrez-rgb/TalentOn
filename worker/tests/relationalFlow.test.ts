// Negocio real + SQL real PostgreSQL 17 aislado. Auth y R2 son dobles de prueba.
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import worker,{type Env} from '../src/index';
import {RelationalRuntime} from '../src/relationalRuntime';
import {techCenterSections,optionValue} from '../../shared/techCenterForm';
const admin='40000000-0000-4000-8000-000000000001';
const trainer='40000000-0000-4000-8000-000000000002';
const other='40000000-0000-4000-8000-000000000003';
let db:any,campaignId:string,personId:string,groupId:string;
const objects=new Map<string,Uint8Array>();
const registrationAnswers={adult:'Sí',contactCenterExperience:'No',workedAtTechCenter:'No',education:'Secundaria completa',workday:'Medio tiempo',availability:'Tarde',commitments:'No',modality:'Presencial',privacyAcknowledged:true};
const authUsers=new Map<string,any>();
const env={DATA_PROVIDER:'supabase',SUPABASE_URL:'https://sql-test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',ALLOWED_ORIGIN:'http://localhost:3000',PRODUCTION_ORIGIN:'https://example.test',MAX_UPLOAD_BYTES:'10485760',ATTENDANCE_TIME_ZONE_OFFSET:'-05:00',CAPTURE_HASH_SECRET:'test-only-key',DOCUMENTS:{put:async(k:string,v:any)=>{objects.set(k,new Uint8Array(await new Response(v).arrayBuffer()))},get:async(k:string)=>objects.has(k)?{body:objects.get(k),httpMetadata:{contentType:'application/pdf'}}:null,delete:async(k:string)=>{objects.delete(k)}}} as unknown as Env;
async function call(path:string,method='GET',body?:any,actor=admin,company?:string){
 const r=await worker.fetch(new Request('https://worker.test'+path,{method,headers:{Origin:'http://localhost:3000',Authorization:'Bearer '+actor,...(company?{'X-Talent-Company':company}:{}),...(!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})}),env);
 const data:any=await r.json().catch(()=>({}));
 if(!r.ok)console.log('FLOW ERROR',method,path,r.status,data);
 return {status:r.status,data};
}
describe('Transición relacional PostgreSQL 17',()=>{
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec(readFileSync(resolve('../supabase/tests/bootstrap.sql'),'utf8'));
  for(const f of readdirSync(resolve('../supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(resolve('../supabase/migrations',f),'utf8'));
  await db.exec(`insert into auth.users values ('${admin}'),('${trainer}'),('${other}');
   insert into talent.companies(id,name) values ('tenant','CI'),('other','CI');
   insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status) values
   ('tenant','${admin}','${admin}','ci.admin','CI Admin','ADMIN','ACTIVO'),
   ('tenant','${trainer}','${trainer}','ci.trainer','CI Trainer','FORMADOR','ACTIVO'),
   ('other','${other}','${other}','ci.other','CI Other','ADMIN','ACTIVO');
   insert into talent.user_modules(company_id,id,user_id,module) select 'tenant','${admin}:'||code,'${admin}',code from talent.modules;
   insert into talent.user_modules(company_id,id,user_id,module) values ('tenant','trainer-module','${trainer}','FORMACION');
   insert into talent.tenant_revisions(company_id) values ('tenant'),('other') on conflict(company_id) do nothing;`);
  authUsers.set(admin,{id:admin,email:'ci.admin@auth.talentcc.invalid'});authUsers.set(trainer,{id:trainer,email:'ci.trainer@auth.talentcc.invalid'});authUsers.set(other,{id:other,email:'ci.other@auth.talentcc.invalid'});
  vi.stubGlobal('fetch',vi.fn(async(input:any,init?:RequestInit)=>{
   const url=new URL(String(input));if(url.hostname==='challenges.cloudflare.com')return Response.json({success:true,hostname:'example.test',action:'capture'});if(url.hostname!=='sql-test.supabase.co')throw new Error('UNEXPECTED_PROVIDER '+url.hostname);
   const body=typeof init?.body==='string'?JSON.parse(init.body):{};
   if(url.pathname==='/auth/v1/user'){const uid=new Headers(init?.headers).get('Authorization')?.replace('Bearer ','');const user=authUsers.get(uid||'');return user?Response.json(user):Response.json({},{status:401});}
   if(url.pathname.startsWith('/auth/v1/admin/users')){
    const id=url.pathname.split('/')[5];
    if(!id&&(!init?.method||init.method==='GET'))return Response.json({users:Array.from(authUsers.values())});
    if(init?.method==='POST'){const uid=crypto.randomUUID();await db.query('insert into auth.users(id) values ($1)',[uid]);const user={id:uid,...body};authUsers.set(uid,user);return Response.json(user);}
    if(init?.method==='PUT'){const user={...authUsers.get(id),...body,id};authUsers.set(id,user);return Response.json(user);}
   }
   const fn=url.pathname.split('/').at(-1);
   try{
    await db.exec('begin; set local role service_role;');
    let result:any;
    if(fn==='talent_capture_catalog')result=await db.query('select public.talent_capture_catalog($1) as result',[body.p_hash]);
    else if(fn==='talent_session_profile')result=await db.query('select public.talent_session_profile($1::uuid) as result',[body.p_auth]);
    else if(fn==='talent_runtime_snapshot')result=await db.query('select public.talent_runtime_snapshot($1::uuid,$2) as result',[body.p_actor,body.p_public_hash]);
    else if(fn==='talent_runtime_commit')result=await db.query('select public.talent_runtime_commit($1::uuid,$2,$3,$4,$5::jsonb,$6::text[]) as result',[body.p_actor,body.p_public_hash,body.p_company,body.p_revision,JSON.stringify(body.p_rows),body.p_resets||[]]);
    else if(fn?.startsWith('talent_org_')){const keys=Object.keys(body);result=await db.query('select public.'+fn+'('+keys.map((k,i)=>k+'=> $'+(i+1)).join(',')+') as result',keys.map(k=>['p_rows','p_grants'].includes(k)?JSON.stringify(body[k]):Array.isArray(body[k])?'{'+body[k].join(',')+'}':body[k]&&typeof body[k]==='object'?JSON.stringify(body[k]):body[k]));}
    else throw new Error('UNKNOWN_RPC '+fn);
    await db.exec('commit');return fn==='talent_runtime_commit'?new Response(null,{status:204}):Response.json(result.rows[0].result??null);
   }catch(e:any){await db.exec('rollback');console.log('SQL ERROR',e.code,e.message);return Response.json({code:e.code,message:e.message},{status:e.code==='PT409'?409:400});}
  }));
 },30000);
 afterAll(async()=>{vi.unstubAllGlobals();await db?.close()});
 it('bootstrap lee datos reales de tenant sin usuarios ajenos',async()=>{const r=await call('/api/bootstrap');expect(r.status).toBe(200);expect(r.data.users).toHaveLength(2);expect(r.data.candidates).toEqual([])});
 it('crea y edita convocatoria con responsables y CAS',async()=>{
  const r=await call('/api/campaigns','POST',{code:'CI-CALL',title:'CI ventas',company:'CI',area:'Ventas',vacancies:2,status:'EN_PROCESO',responsibles:[{userId:admin,target:2}],sources:[],processType:'EXTERNO',managementType:'PRESENCIAL',location:'Lima',shift:'09:00-16:00'});
  expect(r.status).toBe(201);campaignId=r.data.id;
  expect((await call('/api/campaigns/'+campaignId,'PATCH',{title:'CI editado'})).status).toBe(200);
  expect((await call('/api/bootstrap')).data.campaigns[0].title).toBe('CI editado');
  expect((await call('/api/campaigns/'+campaignId,'PATCH',{code:'CI-CALL',company:'CI',client:'CI',title:'CI editado',area:'Operaciones Contact Center',serviceType:'VENTAS_OUTBOUND',salaryBase:1200,variableBonus:100,adminBonus:0,mobilityBonus:0,additionalConditions:'Editado',requestDate:'2026-10-12',processType:'EXTERNO',managementType:'PRESENCIAL',vacancies:2,location:'Lima',shift:'09:00-16:00',observations:'',status:'EN_PROCESO',assignedAnalystId:admin,assignedAnalystName:'CI Admin',requirements:['CI requisito']})).status).toBe(200);
 });
 it('edición inválida conserva convocatoria y explica cuotas, fechas e importes',async()=>{
  for(const [body,code] of [[{vacancies:1},'TARGET_EXCEEDS_VACANCIES'],[{vacancies:1.5},'INVALID_CAMPAIGN_AMOUNT'],[{salaryBase:-1},'INVALID_CAMPAIGN_AMOUNT'],[{startDate:'2026-10-12',endDate:'2026-10-11'},'INVALID_CAMPAIGN_DATES'],[{requestDate:'2026-02-30'},'INVALID_CAMPAIGN_DATES']] as const){
   const r=await call('/api/campaigns/'+campaignId,'PATCH',body);expect(r.status).toBe(400);expect(r.data.message).toBe(code);
  }
  const c=(await call('/api/bootstrap')).data.campaigns[0];expect(c.vacancies).toBe(2);expect(c.salaryBase).toBe(1200);
  expect((await call('/api/campaigns/'+campaignId,'PATCH',{salaryBase:0,observations:'Corrección administrativa'})).status).toBe(200);
  const edited=(await call('/api/bootstrap')).data.campaigns[0];expect(edited.salaryBase).toBe(0);expect(edited.title).toBe('CI editado');expect(edited.responsibles).toHaveLength(1);
 });
 it('crea candidato, datos personales y resultados de selección',async()=>{
  const r=await call('/api/candidates','POST',{dni:'99900001',fullName:'CI Persona',campaignId,recruiterId:admin,campaignName:'CI editado',phone:'999000001',source:'Otro',workModality:'Remoto',workSchedule:'Semifull',applicationDate:new Date().toISOString().slice(0,10)});
  expect(r.status).toBe(201);personId=r.data.id;
  expect((await call('/api/bootstrap')).data.candidates[0]).toMatchObject({workModality:'Remoto',workSchedule:'Semifull'});
  expect((await call('/api/candidates/'+personId+'/personal-data','PATCH',{fullName:'CI Persona editada',phone:'999000002',workModality:'Presencial',workSchedule:'Fulltime'})).status).toBe(200);
  expect((await call('/api/candidates/'+personId+'/personal-data','PATCH',{workSchedule:'INVALIDO'})).status).toBe(400);
  expect((await call('/api/bootstrap')).data.candidates[0]).toMatchObject({workModality:'Presencial',workSchedule:'Fulltime'});
  const r2=await call('/api/candidates/'+personId+'/selection-record','PATCH',{kind:'INTERVIEW',value:{status:'APTO',notes:'CI',date:new Date().toISOString().slice(0,10)}});
  expect(r2.status).toBe(200);
  const data=(await call('/api/bootstrap')).data.candidates[0];expect(data.fullName).toBe('CI Persona editada');expect(data.selection.interviewResult.status).toBe('APTO');
 });
 it('conflicto no sobrescribe datos: snapshots simultáneos',async()=>{
  const a=await new RelationalRuntime(env,admin).load(),b=await new RelationalRuntime(env,admin).load();
  await a.write('campaigns/'+campaignId,{title:'Ganador'});await b.write('campaigns/'+campaignId,{title:'Perdedor'});
  await a.commit();await expect(b.commit()).rejects.toMatchObject({status:409});
  expect((await call('/api/bootstrap')).data.campaigns[0].title).toBe('Ganador');
 });
 it('otro tenant no puede consultar ni modificar candidato',async()=>{
  const r=await call('/api/bootstrap','GET',undefined,other);expect(r.status).toBe(200);expect(r.data.candidates).toEqual([]);expect(r.data.campaigns).toEqual([]);
  expect((await call('/api/candidates/'+personId+'/personal-data','PATCH',{fullName:'Intruso'},other)).status).not.toBe(200);
 });
 it('configuración se guarda y vuelve a leer de SQL',async()=>{
  const config={companyName:'CI',minPassGrade:80,minAttendancePct:85,slaSelectionDays:5,ojtDurationDays:5};
  expect((await call('/api/settings','PATCH',config)).status).toBe(200);
  expect((await call('/api/settings')).data).toMatchObject(config);
 });
 it('pipeline completo crea grupo y asigna formador sin guardados parciales',async()=>{
  expect((await call('/api/candidates/'+personId+'/selection-record','PATCH',{kind:'TECHNICAL',value:{status:'APRUEBA',notes:'CI',date:new Date().toISOString().slice(0,10)}})).status).toBe(200);
  expect((await call('/api/candidates/'+personId+'/evaluations','POST',{title:'CI evaluación',score:100,maxScore:100,result:'APTO',passed:true,date:new Date().toISOString().slice(0,10),comments:'CI'})).status).toBe(201);
  for(const stage of ['CONTACTADO','ENTREVISTA','VERIFICACION_TECNICA','EVALUACIONES','APTO_CAPACITACION'])expect((await call('/api/candidates/'+personId+'/stage','POST',{stage})).status).toBe(200);
  const date=new Date().toISOString().slice(0,10);
  const r=await call('/api/trainings/from-selection','POST',{campaignId,candidateIds:[personId],name:'CI Grupo',code:'CI-GROUP',startDate:date,endDate:date,totalDays:5,modality:'PRESENCIAL',schedule:'09:00-16:00'});expect(r.status).toBe(201);groupId=r.data.id;
  expect((await call('/api/trainings/'+groupId+'/trainer','POST',{trainerId:trainer,notes:'CI'})).status).toBe(200);
  const bootstrap=await call('/api/bootstrap','GET',undefined,trainer);expect(bootstrap.status).toBe(200);expect(bootstrap.data.cohorts).toHaveLength(1);expect(bootstrap.data.candidates).toHaveLength(1);
  const denied=await call('/api/trainings/'+groupId+'/trainer','POST',{trainerId:other},other);expect(denied.status).not.toBe(200);
 });
 it('formación: estado, evaluación, OJT y resultado persisten en relaciones',async()=>{
  expect((await call('/api/trainings/'+groupId+'/management','PATCH',{operation:'STATUS',status:'EN_CAPACITACION'})).status).toBe(200);
  expect((await call('/api/trainings/'+groupId+'/participants/'+personId+'/status','POST',{status:'EN_CAPACITACION'},trainer)).status).toBe(201);
  const evaluated=await call('/api/trainings/'+groupId+'/participants/'+personId+'/evaluations','POST',{evaluationId:'ci-eval',name:'CI módulo',moduleName:'CI módulo',score:95,maxScore:100,minRequired:80,result:'APROBADO',date:new Date().toISOString().slice(0,10)},trainer);expect(evaluated.status).toBe(201);
  expect((await call('/api/trainings/'+groupId+'/participants/'+personId+'/ojt/start','POST',{reason:'CI'},trainer)).status).toBe(201);
  expect((await call('/api/trainings/'+groupId+'/participants/'+personId+'/ojt/daily','POST',{date:new Date().toISOString().slice(0,10),hoursManaged:4,sales:8,attendance:'PRESENTE'},trainer)).status).toBe(201);
  expect((await call('/api/trainings/'+groupId+'/participants/'+personId+'/ojt/result','POST',{status:'OJT_APROBADO'},trainer)).status).toBe(201);
  const candidate=(await call('/api/bootstrap')).data.candidates[0];expect(candidate.ojt.status).toBe('OJT_APROBADO');expect(candidate.ojt.dailyMetrics[0].sph).toBe(2);expect(candidate.training.evaluations[0].score).toBe(95);
  const pending=await call('/api/candidates/'+personId+'/alta','POST',{},trainer);expect(pending.status).toBe(409);
 });
 it('asistencia masiva es atómica y la ventana utiliza hora de servidor',async()=>{
  const day=new Date(Date.now()-5*3600000).toISOString().slice(0,10);
  const clock=new Date(Date.now()-5*3600000-5*60000).toISOString().slice(11,16);
  expect((await call('/api/trainings/'+groupId+'/management','PATCH',{operation:'DETAILS',schedule:clock+'-16:00'})).status).toBe(200);
  const body={candidateIds:[personId,'missing'],date:day,dayNumber:1,status:'PRESENTE',attendance:'PRESENTE'};
  const failed=await call('/api/trainings/'+groupId+'/attendance/bulk','POST',body,trainer);expect(failed.status).not.toBe(201);
  expect((await db.query('select count(*)::integer as n from talent.attendance')).rows[0].n).toBe(0);
  expect((await call('/api/trainings/'+groupId+'/attendance/bulk','POST',{...body,candidateIds:[personId]},trainer)).status).toBe(201);
  expect((await call('/api/bootstrap','GET',undefined,trainer)).data.candidates[0].training.attendance[0].status).toBe('PRESENTE');
 });
 it('documentos R2, validación, cuenta sueldo y pase a alta usan fuentes reales',async()=>{
  for(const type of ['DNI','CV','CUL_ANTECEDENTES','RECIBO_SERVICIOS']){
   const form=new FormData();form.append('file',new File(['CI fixture'],type+'.pdf',{type:'application/pdf'}));form.append('name',type);form.append('type',type);form.append('isMandatory','true');
   const uploaded=await call('/api/candidates/'+personId+'/documents','POST',form);expect(uploaded.status).toBe(201);
   expect((await call('/api/candidates/'+personId+'/documents/'+uploaded.data.id,'PATCH',{status:'VALIDATED'})).status).toBe(200);
  }
  expect(objects.size).toBe(4);
  expect((await call('/api/candidates/'+personId+'/salary-account','POST',{option:'HAS_ACCOUNT',hasAccount:true,bank:'BCP',accountNumber:'123456789',currency:'PEN'})).status).toBe(200);
  const eligible=await call('/api/candidates/'+personId+'/eligibility');expect(eligible.data.eligible).toBe(true);
  expect((await call('/api/candidates/'+personId+'/alta','POST',{},trainer)).status).toBe(200);
  expect((await call('/api/bootstrap')).data.candidates[0].currentStage).toBe('GESTION_TALENTO');
 });
 it('Talento: datos laborales, estados, registro contractual y firma declarada',async()=>{
  const labor={company:'CI',position:'CI cargo',campaignOrArea:'CI',plannedStartDate:new Date().toISOString().slice(0,10),modality:'PRESENCIAL',site:'CI',remuneration:1500};
  expect((await call('/api/talent/candidates/'+personId+'/labor-data','PATCH',labor)).status).toBe(200);
  expect((await call('/api/talent/candidates/'+personId+'/contract','POST',{})).status).toBe(201);
  expect((await call('/api/talent/candidates/'+personId+'/status','POST',{status:'PENDIENTE_FIRMA',reason:'CI'})).status).toBe(200);
  expect((await call('/api/talent/candidates/'+personId+'/contract/sign','POST',{signatureType:'FIRMADO_FISICO',reason:'CI'})).status).toBe(200);
  expect((await call('/api/bootstrap')).data.candidates[0].hiring.status).toBe('CONTRATADO');
 });
 it('usuarios creados en Auth + perfil obligatorio y bloqueo de primer acceso',async()=>{
  const r=await call('/api/users','POST',{username:'ci.newuser',password:'temporary123',displayName:'CI nuevo',role:'RECLUTADOR',status:'ACTIVO',module:['SELECCION']});expect(r.status).toBe(200);
  const users=(await call('/api/bootstrap')).data.users;const user=users.find((u:any)=>u.email==='ci.newuser');expect(user).toBeTruthy();
  expect((await call('/api/bootstrap','GET',undefined,user.id)).status).toBe(403);
 });
 it('reset reconcilia Auth con estado activo y conserva bloqueo de inactivos',async()=>{
  const user=Array.from(authUsers.values()).find((u:any)=>u.email==='ci.newuser@auth.talentcc.invalid')!;
  user.ban_duration='876000h';
  expect((await call('/api/users/'+user.id+'/reset-password','POST',{newPassword:'CI-password-reset-2026'})).status).toBe(200);
  expect(authUsers.get(user.id).ban_duration).toBe('none');
  await db.query("update talent.profiles set status='INACTIVO',enabled=false where id=$1",[user.id]);
  expect((await call('/api/users/'+user.id+'/reset-password','POST',{newPassword:'CI-password-reset-2027'})).status).toBe(200);
  expect(authUsers.get(user.id).ban_duration).toBe('876000h');
 });
 it('captación pública crea persona y evento atómicos, conserva origen y reintentos',async()=>{
  env.TURNSTILE_SECRET_KEY='test-only-secret';
  const link=await call('/api/capture/links','POST',{source:'Facebook'});expect(link.status).toBe(201);
  const publicRequest=async(body?:any)=>{const r=await worker.fetch(new Request('https://worker.test/api/public/capture/'+link.data.id,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json','cf-connecting-ip':'192.0.2.1'},...(body?{body:JSON.stringify(body)}:{})}),env);const result:any=await r.json();if(!r.ok)console.log('PUBLIC ERROR',r.status,result);return {status:r.status,data:result};};
  const info=await publicRequest();expect(info.status).toBe(200);expect(info.data.ownerUid).toBeUndefined();expect(info.data.source).toBeUndefined();
  expect(info.data.formId).toBe('company-capture-v1');
  expect(info.data.companyName).toBe('CI');
  expect(info.data.campaigns).toEqual([{id:campaignId,name:'Ganador'}]);
  const applicant={...registrationAnswers,preferredCampaign:campaignId,requestId:crypto.randomUUID(),fullName:'CI Captado',phone:'912345678',email:'fixture@example.test',documentType:'DNI',documentNumber:'99900003',district:'Lima',turnstileToken:'test-token'};
  expect((await publicRequest(applicant)).status).toBe(201);expect((await publicRequest(applicant)).status).toBe(201);
  const manager=await call('/api/capture/management');expect(manager.status).toBe(200);expect(manager.data.events).toHaveLength(1);expect(manager.data.events[0].applicant.fullName).toBe('CI Captado');
 });
 it('plantilla y vinculación de captura conservan versión y preguntas',async()=>{
  const stages=['NUEVO','CONTACTADO','ENTREVISTA','VERIFICACION_TECNICA','EVALUACIONES','APTO_CAPACITACION'].map(stage=>({stage,requirements:''}));
  const config={name:'CI Proceso',stages,responsibleIds:[admin],interviewFields:['Disponibilidad'],evaluations:[{id:'knowledge',name:'CI conocimientos',stage:'EVALUACIONES',minScore:10,questions:[{id:'q1',label:'CI pregunta',type:'CLOSED',points:10,options:['Sí','No'],correctIndex:0}]}],rules:{}};
  const template=await call('/api/selection/campaigns/'+campaignId,'POST',config);
  expect(template.status).toBe(201);
  const list=await call('/api/selection/campaigns/'+campaignId);expect(list.data.templates[0].interviewFields).toEqual(['Disponibilidad']);expect(list.data.templates[0].evaluations[0].questions[0].correctIndex).toBe(0);
  const event=(await call('/api/capture/management')).data.events[0];
  const linked=await call('/api/selection/link','POST',{eventId:event.id,campaignId,templateId:template.data.id});expect(linked.status).toBe(201);
  const history=await call('/api/selection/candidates/'+event.candidateId);expect(history.data.applications).toHaveLength(1);
 });
 it('runtime multiempresa: cambio de contexto, creación, aislamiento y revocación',async()=>{
  await db.exec(`insert into talent_org.global_admins(id,auth_user_id) values('ci-global','${admin}')`);
  for(const c of ['talent-up','techcenter'])await db.query('select public.talent_org_member_save($1,$1,$2,$3,true,true,$4,null)',[admin,c,'ADMIN','{}']);
  env.ORG_ENABLED='true';
  env.IDENTITY_HASH_SECRET='CI-isolated-only-identity-secret';
  try{
   const session=await call('/api/session','GET',undefined,admin,'talent-up');expect(session.status).toBe(200);expect(session.data.companyId).toBe('talent-up');
   const created=await call('/api/campaigns','POST',{code:'ORG-CALL',title:'CI multiempresa',vacancies:2,status:'EN_PROCESO',assignedAnalystId:admin,responsibles:[{userId:admin,target:2}],companyCampaignId:'talent-up:bitel-portabilidad'},admin,'talent-up');expect(created.status).toBe(201);
   expect((await call('/api/bootstrap','GET',undefined,admin,'talent-up')).data.campaigns).toHaveLength(1);
   expect((await call('/api/bootstrap','GET',undefined,admin,'techcenter')).data.campaigns).toHaveLength(0);
   expect((await call('/api/campaigns/'+created.data.id,'PATCH',{title:'Intrusión'},admin,'techcenter')).status).not.toBe(200);
   expect((await call('/api/bootstrap','GET',undefined,trainer,'talent-up')).status).toBe(403);
   const membership=await call('/api/org/memberships','POST',{companyId:'talent-up',userId:trainer,role:'FORMADOR',enabled:true,allCampaigns:false,scopes:['talent-up:bitel-portabilidad']},admin);expect(membership.status).toBe(200);
   expect((await call('/api/bootstrap','GET',undefined,trainer,'talent-up')).data.cohorts).toHaveLength(0);
   const edit=await call('/api/campaigns/'+created.data.id,'PATCH',{observations:'CI edición por empresa'},admin,'talent-up');expect(edit.status).toBe(200);
   const second=await call('/api/campaigns','POST',{code:'ORG-SECOND',title:'CI segunda empresa',vacancies:2,status:'EN_PROCESO',assignedAnalystId:admin,responsibles:[{userId:admin,target:2}],companyCampaignId:'techcenter:bitel-portabilidad'},admin,'techcenter');expect(second.status).toBe(201);
   for(const [company,campaignId]of [['talent-up',created.data.id],['techcenter',second.data.id]]){const candidate=await call('/api/candidates','POST',{dni:'98887776',fullName:'CI persona multiempresa',phone:'999000009',campaignId,recruiterId:admin,source:'Otro',applicationDate:'2026-10-12'},admin,company);expect(candidate.status).toBe(201);}
   const summary=await call('/api/org/summary','POST',{},admin);expect(summary.status).toBe(200);expect(summary.data.persons).toBe(1);expect(summary.data.applications).toBe(2);
   const rejected=await call('/api/org/memberships','POST',{companyId:'talent-up',userId:trainer,role:'ADMIN',enabled:true,allCampaigns:true,scopes:[]},trainer,'talent-up');expect(rejected.status).toBe(403);
   expect((await call('/api/org/memberships','POST',{companyId:'talent-up',userId:trainer,role:'FORMADOR',enabled:false,allCampaigns:false,scopes:[],version:membership.data.version},admin)).status).toBe(200);
   expect((await call('/api/bootstrap','GET',undefined,trainer,'talent-up')).status).toBe(403);
  }finally{env.ORG_ENABLED=undefined;}
 });
 it('TECH CENTER: formulario por empresa, guardado real y lectura de respuestas sin consentimiento inventado',async()=>{
  env.ORG_ENABLED='true';
  try {
   const link=await call('/api/capture/links','POST',{source:'Facebook',companyCampaignId:'techcenter:bitel-portabilidad'},admin,'techcenter');
   expect(link.status).toBe(201);
   const pub=async(body?:any)=>{const r=await worker.fetch(new Request('https://worker.test/api/public/capture/'+link.data.id,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json() as any}};
   const config=(await pub()).data;
   expect(config.formId).toBe('company-capture-v1');
   expect(config.companyName).toBe('Techcenter');
   expect(config.campaigns.every((c:any)=>c.id.startsWith('techcenter:'))).toBe(true);
   expect(config.campaigns.some((c:any)=>c.name==='Internet Win')).toBe(false);
   await db.exec('begin');
   try {
    await db.query("select set_config('talent.org_actor',$1,true)",[admin]);
    await db.exec("update talent_org.company_campaigns set status='INACTIVA' where id='techcenter:bitel-migraciones'");
    const hash=(await db.query('select token_hash from talent.capture_links where annotations->>\'publicToken\'=$1',[link.data.id])).rows[0].token_hash;
    const catalog=(await db.query('select public.talent_capture_catalog($1) as data',[hash])).rows[0].data;
    expect(catalog.campaigns.some((c:any)=>c.id==='techcenter:bitel-migraciones')).toBe(false);
    await db.exec("update talent_org.global_campaigns set status='INACTIVA' where id='movistar-portabilidad'");
    expect((await db.query('select public.talent_capture_catalog($1) as data',[hash])).rows[0].data.campaigns.some((c:any)=>c.id==='techcenter:movistar-portabilidad')).toBe(false);
   } finally {await db.exec('rollback');}
   const privileges=(await db.query("select has_function_privilege('anon','public.talent_capture_catalog(text)','EXECUTE') as anon, has_function_privilege('authenticated','public.talent_capture_catalog(text)','EXECUTE') as authenticated")).rows[0];
   expect(privileges).toEqual({anon:false,authenticated:false});
   expect((await pub({fullName:'Incomplete',formId:'capture-v1'})).status).toBe(400);
   const answers=Object.fromEntries(techCenterSections.flatMap(s=>s.fields).filter(f=>f.options).map(f=>[f.key,optionValue(f.options![0])]));
   const applicant={...answers,preferredCampaign:'techcenter:bitel-portabilidad',documentNumber:'99900999',fullName:'CI Techcenter',district:'Lima, Comas',phone:'912345679',email:'tech@example.test',experienceDetails:'Un año en ventas',adjustmentDetails:'Acceso sin escaleras',privacyAcknowledged:true,requestId:crypto.randomUUID(),turnstileToken:'test-only-token'};
   expect((await pub({...applicant,preferredCampaign:'talent-up:bitel-portabilidad',companyId:'talent-up',companyName:'Otra empresa'})).status).toBe(400);
   expect((await pub(applicant)).status).toBe(201);
   expect((await pub(applicant)).status).toBe(201);
   const events=(await call('/api/capture/management','GET',undefined,admin,'techcenter')).data.events;
   const event=events.find((e:any)=>e.applicant.documentNumber==='99900999');
   expect(event.applicant.techCenterAnswers).toMatchObject({preferredCampaign:'Portabilidad Bitel',preferredCampaignId:'techcenter:bitel-portabilidad',companyName:'Techcenter',experienceDetails:'Un año en ventas',conadis:'Sí, deseo declararlo',adjustmentDetails:'Acceso sin escaleras'});
   expect(event.applicant.techCenterAnswers.computer).toBeUndefined();
   expect(event.privacyAcknowledgement.version).toBe('company-capture-v1');
   expect(event.consent).toBeUndefined();
   expect(events.filter((e:any)=>e.applicant.documentNumber==='99900999')).toHaveLength(1);
   expect((await call('/api/capture/events/'+event.id,'PATCH',{status:'Contactado',note:'CI'},admin,'techcenter')).status).toBe(200);
   const dossier=(await call('/api/capture/candidates/'+event.candidateId,'GET',undefined,admin,'techcenter')).data;
   expect(dossier.events[0].applicant.techCenterAnswers.experienceDetails).toBe('Un año en ventas');
   expect((await call('/api/capture/candidates/'+event.candidateId,'GET',undefined,other)).status).not.toBe(200);
  } finally {env.ORG_ENABLED=undefined;}
 });
 it('creación y edición global guarda accesos de dos empresas con rollback y CAS',async()=>{
  env.ORG_ENABLED='true';
  try {
   const grants=['talent-up','techcenter'].map(companyId=>({companyId,role:'RECLUTADOR',enabled:true,allCampaigns:false,scopes:[companyId+':bitel-portabilidad'],version:null}));
   const created=await call('/api/users','POST',{username:'ci.twocompanies',password:'CI-password-2026',displayName:'Two companies',role:'RECLUTADOR',module:['SELECCION'],companyAccess:grants});
   expect(created.status).toBe(200);
   const u=(await call('/api/bootstrap')).data.users.find((u:any)=>u.email==='ci.twocompanies');expect(u).toBeTruthy();
   await db.query('update talent.profiles set must_change_password=false where auth_user_id=$1',[u.id]);authUsers.get(u.id).app_metadata={runtime_password_pending:false};
   const session=await call('/api/session','GET',undefined,u.id);expect(session.status).toBe(200);expect(session.data.companies.map((c:any)=>c.id).sort()).toEqual(['talent-up','techcenter']);
   expect((await call('/api/session','GET',undefined,u.id,'tenant')).status).toBe(403);
   expect((await call('/api/bootstrap','GET',undefined,u.id,'konectados')).status).toBe(403);
   expect((await call('/api/org/dashboard','POST',{},u.id)).status).toBe(403);
   const list=(await call('/api/org')).data.memberships.filter((m:any)=>m.auth_user_id===u.id);
   const edit=grants.map(g=>({...g,version:list.find((m:any)=>m.company_id===g.companyId).version,enabled:g.companyId==='talent-up'}));
   const before=(await db.query('select display_name from talent.profiles where auth_user_id=$1',[u.id])).rows[0].display_name;
   const failed=await call('/api/users/'+u.id+'/access','PATCH',{displayName:'Should rollback',role:'RECLUTADOR',status:'ACTIVO',module:['SELECCION'],companyAccess:edit.map(g=>g.companyId==='techcenter'?{...g,version:999}:g)});
   expect(failed.status).toBe(409);expect((await db.query('select display_name from talent.profiles where auth_user_id=$1',[u.id])).rows[0].display_name).toBe(before);
   expect((await call('/api/users/'+u.id+'/access','PATCH',{displayName:'One company',role:'RECLUTADOR',status:'ACTIVO',module:['SELECCION'],companyAccess:edit})).status).toBe(200);
   expect((await call('/api/session','GET',undefined,u.id)).data.companies.map((c:any)=>c.id)).toEqual(['talent-up']);
   expect((await call('/api/bootstrap','GET',undefined,u.id,'techcenter')).status).toBe(403);
   expect((await call('/api/users/'+u.id+'/access','PATCH',{role:'ADMIN',companyAccess:grants},u.id,'talent-up')).status).not.toBe(200);
   const homeCreate=await call('/api/users','POST',{username:'ci.companyhome',password:'CI-password-2026',displayName:'Company home',role:'RECLUTADOR',module:['SELECCION'],companyAccess:[grants[0]]},admin,'talent-up');expect(homeCreate.status).toBe(200);
   const crossUser=(await call('/api/bootstrap')).data.users.find((v:any)=>v.email==='ci.companyhome');expect(crossUser.companyId).toBe('talent-up');
   expect((await call('/api/users/'+crossUser.id+'/access','PATCH',{displayName:'Edited from Talent-On',role:'RECLUTADOR',status:'ACTIVO',module:['SELECCION']})).status).toBe(200);
  } finally {env.ORG_ENABLED=undefined;}
 });
});
