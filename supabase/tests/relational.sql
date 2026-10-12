-- Solo entorno desechable. Fixtures ficticios nunca se aplican a Supabase real.
begin;
create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
 begin execute sql;
 exception when others then
  if sqlstate=code then return; end if;
  raise exception 'EXPECTED %, GOT %: %',code,sqlstate,sqlerrm;
 end;
 raise exception 'EXPECTED_REJECTION: %',sql;
end $$;
insert into auth.users values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'),
 ('10000000-0000-4000-8000-000000000004');
insert into talent.companies(id,name) values ('a','CI A'),('b','CI B');
insert into talent.sites(company_id,id,name) values ('a','site','CI');
insert into talent.areas(company_id,id,name) values ('a','area','CI');
insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status) values
 ('a','head','10000000-0000-4000-8000-000000000001','ci.head','CI','JEFE_SELECCION','ACTIVO'),
 ('a','trainer','10000000-0000-4000-8000-000000000002','ci.trainer','CI','FORMADOR','ACTIVO'),
 ('a','recruiter','10000000-0000-4000-8000-000000000003','ci.recruiter','CI','RECLUTADOR','ACTIVO'),
 ('b','other','10000000-0000-4000-8000-000000000004','ci.other','CI','FORMADOR','ACTIVO');
insert into talent.campaigns(company_id,id,code,title,status,vacancies,site_id,area_id) values
 ('a','c1','C1','CI','EN_PROCESO',2,'site','area'),('a','c2','C2','CI','EN_PROCESO',2,null,null),('b','cb','CB','CI','EN_PROCESO',1,null,null);
insert into talent.user_modules(company_id,user_id,module) values ('a','head','SELECCION'),('a','trainer','FORMACION'),('a','recruiter','SELECCION'),('b','other','FORMACION');
insert into talent.campaign_assignments(company_id,campaign_id,user_id,assignment_kind) values ('a','c1','recruiter','RECLUTADOR');
insert into talent.supervision(company_id,supervisor_id,subordinate_id) values ('a','head','recruiter');
insert into talent.persons(company_id,id,full_name) values ('a','p','CI'),('a','p2','CI'),('b','pb','CI');
insert into talent.person_identifiers(company_id,person_id,kind,normalized_value,verified) values ('a','p','DNI','CI-ID',true);
insert into talent.identity_conflicts(company_id,person_id,other_person_id,reason,status) values ('a','p','p2','CI','PENDIENTE');
insert into talent.recruitment_sources(company_id,id,name) values ('a','source','Facebook');
insert into talent.capture_links(company_id,id,owner_id,source_id,token_hash) values ('a','link','recruiter','source','ci-hash-not-real-token');
insert into talent.captures(company_id,id,person_id,link_id,owner_id,source_id,status,received_at) values
 ('a','capture','p','link','recruiter','source','Nuevo',now()),('a','capture2','p','link','recruiter','source','Nuevo',now());
insert into talent.process_templates(company_id,id,campaign_id,family_id,revision,name) values ('a','template','c1','family',1,'CI');
insert into talent.process_stages(company_id,template_id,stage,ordinal) values ('a','template','NUEVO',1);
insert into talent.template_responsibles(company_id,template_id,user_id) values ('a','template','recruiter');
insert into talent.applications(company_id,id,person_id,campaign_id,recruiter_id,template_id,status,stage,application_date) values
 ('a','app','p','c1','recruiter','template','ACTIVA','NUEVO',current_date),
 ('a','app2','p','c2','recruiter',null,'ACTIVA','NUEVO',current_date),
 ('a','historical','p','c1','recruiter',null,'CERRADA','NO_APTO',current_date);
insert into talent.interviews(company_id,application_id,interviewer_id,status) values ('a','app','head','Programada');
insert into talent.technical_verifications(company_id,application_id,evaluator_id,result,verified_at) values ('a','app','head','APRUEBA',now());
insert into talent.contacts(company_id,application_id,actor_id,contacted_at,channel,summary) values ('a','app','recruiter',now(),'WHATSAPP','CI');
insert into talent.message_templates(company_id,id,campaign_id,name,communication_type,body) values ('a','msgtemplate','c1','CI','Citación','CI');
insert into talent.messages(company_id,application_id,template_id,sender_id,body,status) values ('a','app','msgtemplate','recruiter','CI','REGISTRADO');
insert into talent.staff_requests(company_id,id,campaign_id,requester_id,required_headcount,requested_vacancies,priority,required_date) values ('a','rq','c1','recruiter',2,2,'MEDIA',current_date);
insert into talent.request_campaigns(company_id,request_id,campaign_id) values ('a','rq','c1');
insert into talent.training_groups(company_id,id,campaign_id,code,name,trainer_id,start_date,theory_end_date,theory_days,ojt_days,schedule,status,modality) values
 ('a','g','c1','G','CI','trainer',current_date,current_date+4,5,5,'09:00-16:00','EN_CAPACITACION','PRESENCIAL'),
 ('a','gother','c2','G2','CI',null,current_date,current_date+4,5,5,'09:00-16:00','PROGRAMADA','PRESENCIAL'),
 ('b','gb','cb','GB','CI','other',current_date,current_date+4,5,5,'09:00-16:00','PROGRAMADA','PRESENCIAL');
insert into talent.participants(company_id,id,group_id,application_id,status,joined_at) values ('a','part','g','app','EN_CAPACITACION',now());
insert into talent.training_days(company_id,group_id,day_date,phase,day_number,starts_at) values ('a','g',current_date,'TEORIA',1,now());
insert into talent.attendance(company_id,id,group_id,participant_id,day_date,status,marked_by) values ('a','att','g','part',current_date,'PRESENTE','trainer');
insert into talent.attendance_unlocks(company_id,id,group_id,day_date,requested_by,reason,status) values ('a','unlock','g',current_date,'trainer','CI','PENDIENTE');
insert into talent.dropouts(company_id,participant_id,occurred_on,phase,category,observation,recorded_by) values ('a','part',current_date,'CAPACITACION_TEORICA','PERSONAL','CI','trainer');
insert into talent.ojt_metrics(company_id,participant_id,day_date,day_number,hours_worked,sales) values ('a','part',current_date,1,4,2);
insert into talent.feedback(company_id,id,person_id,participant_id,author_id,strong_points) values ('a','fb','p','part','trainer','CI');
insert into talent.files(company_id,id,object_key,original_name,mime_type,size_bytes,uploaded_by,state) values ('a','file','ci/a/private','CI.pdf','application/pdf',1,'trainer','AVAILABLE');
insert into talent.person_documents(company_id,id,person_id,file_id,document_type,status) values ('a','doc','p','file','CV','CARGADO');
insert into talent.evaluation_definitions(company_id,id,name,domain,revision,family_id,max_score,min_score,group_id) values ('a','def','CI','FORMACION',1,'d',20,12,'g');
insert into talent.evaluation_items(company_id,id,definition_id,label,item_type,points,ordinal) values ('a','item','def','CI','CLOSED',20,1);
insert into talent.evaluation_options(company_id,id,item_id,label,is_correct,ordinal) values ('a','option','item','CI',true,1);
insert into talent.evaluations(company_id,id,definition_id,person_id,participant_id,evaluator_id,evaluated_at,score,result) values ('a','eval','def','p','part','trainer',now(),20,'APTO');
insert into talent.evaluation_answers(company_id,evaluation_id,item_id,option_id,points) values ('a','eval','item','option',20);
insert into talent.evidence(company_id,file_id,evaluation_id) values ('a','file','eval');
insert into talent.hiring(company_id,id,application_id,participant_id,status,official_start) values ('a','hire','app','part','CONTRATADO',current_date);
insert into talent.salary_accounts(company_id,person_id,has_account,bank,currency) values ('a','p',true,'BCP','PEN');
insert into talent.action_plans(company_id,evaluation_id,responsible_id,action,status) values ('a','eval','trainer','CI','PENDIENTE');
insert into talent.calibrations(company_id,id,definition_id,facilitator_id,held_at) values ('a','cal','def','head',now());
insert into talent.calibration_results(company_id,calibration_id,evaluation_id,reviewer_id,score) values ('a','cal','eval','trainer',20);
insert into talent.courses(company_id,id,name) values ('a','course','CI');
insert into talent.course_materials(company_id,course_id,file_id,ordinal) values ('a','course','file',1);
insert into talent.learning_paths(company_id,id,name) values ('a','path','CI');
insert into talent.path_courses(company_id,path_id,course_id,ordinal) values ('a','path','course',1);
insert into talent.course_participations(company_id,id,person_id,course_id,status) values ('a','cp','p','course','EN_CURSO');
insert into talent.learning_evaluations(company_id,participation_id,evaluation_id) values ('a','cp','eval');
insert into talent.observations(company_id,person_id,author_id,body) values ('a','p','head','CI');
insert into talent.system_settings(company_id,name,configuration) values ('a','thresholds','{"minPassGrade":12}');
insert into talent.migration_runs(company_id,id,source,state) values ('a','run','FIREBASE','PREPARADO');
insert into talent.migration_mappings(company_id,run_id,source_path,target_table,target_id,source_hash) values ('a','run','candidates/legacy','persons','p','ci');
insert into talent.auth_mappings(company_id,firebase_uid,profile_id,supabase_auth_id) values ('a','ci-firebase-uid','head','10000000-0000-4000-8000-000000000001');
insert into talent.access_events(company_id,actor_id,action,allowed) values ('a','head','CI',true);
insert into talent.lifecycle_events(company_id,person_id,application_id,actor_id,new_stage,occurred_at) values ('a','p','app','head','SELECCION',now());
insert into talent.ojt_skills(company_id,participant_id,assessed_by,assessed_at,manejo_objeciones,diccion_modulacion,velocidad_sistemas,empatia_escucha,tecnica_cierre,cumplimiento_procesos) values ('a','part','trainer',now(),3,3,3,3,3,3);
-- Ventana cerrada y solicitud exclusiva para grupo+fecha.
update talent.training_days set starts_at=now()-interval '2 hours' where company_id='a';
select pg_temp.expect_error($q$update talent.attendance set status='TARDANZA' where company_id='a' and id='att'$q$,'P0001');
-- FK tenant, doble captación permitida, doble convocatoria permitida, mismo par activo prohibido.
select pg_temp.expect_error($q$insert into talent.applications(company_id,person_id,campaign_id,recruiter_id,status,stage,application_date) values ('a','p','c1','recruiter','ACTIVA','NUEVO',current_date)$q$,'23505');
select pg_temp.expect_error($q$insert into talent.applications(company_id,person_id,campaign_id,recruiter_id,status,stage,application_date) values ('a','pb','c1','recruiter','ACTIVA','NUEVO',current_date)$q$,'23503');
select pg_temp.expect_error($q$insert into talent.person_identifiers(company_id,person_id,kind,normalized_value,verified) values ('a','p2','DNI','CI-ID',true)$q$,'23505');
select pg_temp.expect_error($q$update talent.capture_links set owner_id='head' where company_id='a' and id='link'$q$,'P0001');
select pg_temp.expect_error($q$delete from talent.persons where company_id='a' and id='p'$q$,'P0001');
select pg_temp.expect_error($q$update talent.staff_requests set status='APROBADO' where company_id='a' and id='rq'$q$,'P0001');
select pg_temp.expect_error($q$insert into talent.participants(company_id,group_id,application_id,status,joined_at) values ('a','gother','app','EN_CAPACITACION',now())$q$,'P0001');
select pg_temp.expect_error($q$update talent.evaluations set score=21 where company_id='a' and id='eval'$q$,'P0001');
select pg_temp.expect_error($q$update talent.evaluations set person_id='p2' where company_id='a' and id='eval'$q$,'P0001');
select pg_temp.expect_error($q$update talent.evaluation_definitions set max_score=100 where company_id='a' and id='def'$q$,'P0001');
select pg_temp.expect_error($q$update talent.evaluation_items set points=100 where company_id='a' and id='item'$q$,'P0001');
select pg_temp.expect_error($q$update talent.applications set template_id='template' where company_id='a' and id='app2'$q$,'P0001');
select pg_temp.expect_error($q$insert into talent.operational_admissions(company_id,hiring_id,request_id,confirmed_by,confirmed_at) values ('a','hire','rq','head',now())$q$,'P0001');
-- No hay privilegios directos de datos, incluso para clave del servidor.
set local role anon;
select pg_temp.expect_error('select * from talent.persons','42501');
select pg_temp.expect_error('select public.talent_schema_status()','42501');
reset role;
set local role authenticated;
select pg_temp.expect_error('select * from talent.persons','42501');
select pg_temp.expect_error('select public.talent_group_page(''10000000-0000-4000-8000-000000000002'',''a'')','42501');
reset role;
set local role service_role;
select pg_temp.expect_error('select * from talent.persons','42501');
select public.talent_schema_status();
do $$ begin
 if (select count(*) from public.talent_group_page('10000000-0000-4000-8000-000000000002','a'))<>1 then raise exception 'TRAINER_LEAK'; end if;
end $$;
select pg_temp.expect_error('select public.talent_group_page(''10000000-0000-4000-8000-000000000002'',''b'')','42501');
select public.talent_request_transition('10000000-0000-4000-8000-000000000003','a','rq',1,'ENVIADO','CI','send');
select pg_temp.expect_error('select public.talent_request_transition(''10000000-0000-4000-8000-000000000003'',''a'',''rq'',2,''APROBADO'',''CI'',''deny'')','42501');
select public.talent_request_transition('10000000-0000-4000-8000-000000000001','a','rq',2,'EN_REVISION','CI','review');
select public.talent_request_transition('10000000-0000-4000-8000-000000000001','a','rq',3,'APROBADO','CI','approve');
-- Reintento idempotente devuelve exactamente el mismo resultado.
do $$ begin
 if public.talent_request_transition('10000000-0000-4000-8000-000000000001','a','rq',3,'APROBADO','CI','approve')->>'version'<>'4' then raise exception 'IDEMPOTENCY_FAILED'; end if;
end $$;
select pg_temp.expect_error('select public.talent_request_transition(''10000000-0000-4000-8000-000000000001'',''a'',''rq'',3,''APROBADO'',''different'',''approve'')','PT409');
select pg_temp.expect_error('select public.talent_request_transition(''10000000-0000-4000-8000-000000000001'',''a'',''rq'',3,''EN_ATENCION'',''CI'',''stale'')','PT409');
select public.talent_request_transition('10000000-0000-4000-8000-000000000001','a','rq',4,'EN_ATENCION','CI','attend');
select pg_temp.expect_error('select public.talent_request_transition(''10000000-0000-4000-8000-000000000001'',''a'',''rq'',5,''CUBIERTO'',''CI'',''notcovered'')','P0001');
reset role;
insert into talent.operational_admissions(company_id,hiring_id,request_id,confirmed_by,confirmed_at) values ('a','hire','rq','head',now());
select pg_temp.expect_error($q$insert into talent.operational_admissions(company_id,hiring_id,request_id,confirmed_by,confirmed_at) values ('a','hire','rq','head',now())$q$,'23505');
do $$ declare t record; n bigint; begin
 if (select confirmed from talent.request_coverage where company_id='a' and id='rq')<>1 then raise exception 'COVERAGE_DOUBLE_COUNT'; end if;
 if (select count(*) from talent.request_decisions where company_id='a' and request_id='rq')<>4 then raise exception 'DECISION_HISTORY_FAILED'; end if;
 for t in select tablename from pg_tables where schemaname='talent' and tablename not in ('selection_scores','contract_events','capture_runtime','tenant_revisions') loop
  execute format('select count(*) from talent.%I',t.tablename) into n;
  if n=0 then raise exception 'ENTITY_WITHOUT_FIXTURE: %',t.tablename; end if;
 end loop;
end $$;
select pg_temp.expect_error('update talent.audit_events set operation=''CHANGED''','P0001');
update talent.profiles set role='JEFE_FORMACION' where company_id='a' and id='head';
insert into talent.user_modules(company_id,user_id,module) values ('a','head','FORMACION');
set local role service_role;
select pg_temp.expect_error('select public.talent_unlock_decide(''10000000-0000-4000-8000-000000000002'',''a'',''unlock'',1,true,''CI'',now()+interval ''10 minutes'')','42501');
select public.talent_unlock_decide('10000000-0000-4000-8000-000000000001','a','unlock',1,true,'CI',now()+interval '10 minutes');
select pg_temp.expect_error('select public.talent_unlock_decide(''10000000-0000-4000-8000-000000000001'',''a'',''unlock'',1,true,''CI'',now()+interval ''10 minutes'')','PT409');
reset role;
update talent.attendance set status='TARDANZA' where company_id='a' and id='att';
do $$ begin
 if (select version from talent.attendance where company_id='a' and id='att')<>2 then raise exception 'ATTENDANCE_REVISION_FAILED'; end if;
 if not exists(select 1 from talent.audit_events where company_id='a' and table_name='attendance_unlocks' and actor_id='head' and operation='UPDATE') then raise exception 'UNLOCK_AUDIT_FAILED'; end if;
end $$;
rollback;
