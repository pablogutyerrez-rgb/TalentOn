begin;
-- El actor UUID debe provenir de la sesión verificada en el Worker, nunca del body.
-- No conceder estas funciones a authenticated/anon.
create function talent_private.actor_profile(p_auth uuid,p_company text) returns talent.profiles
language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles;
begin
 select * into actor from talent.profiles where auth_user_id=p_auth and company_id=p_company and status='ACTIVO' and enabled and archived_at is null;
 if not found then raise insufficient_privilege using message='TALENT_ACTOR_FORBIDDEN'; end if;
 return actor;
end $$;
create function talent_private.require_campaign(p_auth uuid,p_company text,p_campaign text,p_module text) returns text
language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles;
begin
 actor:=talent_private.actor_profile(p_auth,p_company);
 if not exists(select 1 from talent.campaigns where company_id=p_company and id=p_campaign) then raise exception 'TALENT_CAMPAIGN_NOT_FOUND'; end if;
 if actor.role='ADMIN' then return actor.id; end if;
 if not exists(select 1 from talent.user_modules where company_id=p_company and user_id=actor.id and module=p_module and archived_at is null) then raise insufficient_privilege using message='TALENT_MODULE_FORBIDDEN'; end if;
 if (p_module='SELECCION' and actor.role='JEFE_SELECCION') or (p_module='FORMACION' and actor.role='JEFE_FORMACION') or (p_module='TALENTO' and actor.role='JEFE_TALENTO') then return actor.id; end if;
 if (p_module='SELECCION' and actor.role in ('ANALISTA_SELECCION','RECLUTADOR')) or (p_module='FORMACION' and actor.role='COORDINADOR_FORMACION') or (p_module='TALENTO' and actor.role='ANALISTA_TALENTO') then
  if exists(select 1 from talent.campaign_assignments where company_id=p_company and campaign_id=p_campaign and user_id=actor.id and archived_at is null) then return actor.id; end if;
 end if;
 raise insufficient_privilege using message='TALENT_CAMPAIGN_FORBIDDEN';
end $$;
-- Lectura acotada con cursor estable. Formadores se autorizan por grupo, no por campaña.
create function public.talent_group_page(p_actor uuid,p_company text,p_after text default '',p_limit integer default 50)
returns setof talent.training_groups language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles;
begin
 if p_limit is null or p_limit<1 or p_limit>100 or p_after is null then raise exception 'TALENT_INVALID_PAGE'; end if;
 actor:=talent_private.actor_profile(p_actor,p_company);
 if actor.role<>'ADMIN' and (actor.role not in ('JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR') or not exists(select 1 from talent.user_modules where company_id=p_company and user_id=actor.id and module='FORMACION' and archived_at is null)) then raise insufficient_privilege; end if;
 return query select g.* from talent.training_groups g where g.company_id=p_company and g.id>p_after and g.archived_at is null
 and (actor.role in ('ADMIN','JEFE_FORMACION') or (actor.role='FORMADOR' and (g.trainer_id=actor.id or g.ojt_trainer_id=actor.id)) or (actor.role='COORDINADOR_FORMACION' and (g.coordinator_id=actor.id or exists(select 1 from talent.campaign_assignments a where a.company_id=p_company and a.campaign_id=g.campaign_id and a.user_id=actor.id and a.archived_at is null))))
 order by g.id limit p_limit;
end $$;
create function talent_private.request_guard() returns trigger language plpgsql
set search_path=pg_catalog,talent as $$
begin
 if tg_op='INSERT' and new.status<>'BORRADOR' then raise exception 'TALENT_REQUEST_MUST_START_DRAFT'; end if;
 if tg_op='UPDATE' and new.status is distinct from old.status and current_setting('talent.rq_transition',true) is distinct from new.id then raise exception 'TALENT_USE_REQUEST_RPC'; end if;
 return new;
end $$;
create trigger request_transition_guard before insert or update on talent.staff_requests for each row execute function talent_private.request_guard();
create function public.talent_request_transition(p_actor uuid,p_company text,p_request text,p_expected bigint,p_target text,p_reason text,p_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles; req talent.staff_requests; idem talent.idempotency; fingerprint text; result jsonb; previous text;
begin
 actor:=talent_private.actor_profile(p_actor,p_company);
 if p_key is null or length(p_key) not between 1 and 128 or p_reason is null or length(btrim(p_reason))=0 or p_expected is null or p_target is null then raise exception 'TALENT_INVALID_TRANSITION'; end if;
 fingerprint:=md5(jsonb_build_array(p_request,p_expected,p_target,p_reason)::text);
 -- Serializa solo misma empresa/actor/operación/key, no todas las escrituras.
 perform pg_advisory_xact_lock(hashtextextended(p_company||':'||actor.id||':rq:'||p_key,0));
 select * into idem from talent.idempotency where company_id=p_company and actor_id=actor.id and operation='rq_transition' and request_key=p_key;
 if found then
  if idem.payload_hash<>fingerprint then raise sqlstate 'PT409' using message='TALENT_IDEMPOTENCY_MISMATCH'; end if;
  return idem.response_metadata;
 end if;
 select * into req from talent.staff_requests where company_id=p_company and id=p_request for update;
 if not found then raise exception 'TALENT_REQUEST_NOT_FOUND'; end if;
 if req.version<>p_expected then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
 if p_target in ('EN_REVISION','APROBADO','OBSERVADO','RECHAZADO','EN_ATENCION','COBERTURA_PARCIAL','CUBIERTO') then
  -- Autoridad funcional exclusiva, incluso ADMIN no aprueba RQ.
  if actor.role<>'JEFE_SELECCION' then raise insufficient_privilege using message='TALENT_SELECTION_HEAD_REQUIRED'; end if;
  perform talent_private.require_campaign(p_actor,p_company,req.campaign_id,'SELECCION');
 elsif req.requester_id<>actor.id then raise insufficient_privilege; end if;
 if not ((req.status in ('BORRADOR','OBSERVADO') and p_target='ENVIADO') or (req.status='ENVIADO' and p_target='EN_REVISION') or (req.status='EN_REVISION' and p_target in ('APROBADO','OBSERVADO','RECHAZADO')) or (req.status='APROBADO' and p_target='EN_ATENCION') or (req.status in ('EN_ATENCION','COBERTURA_PARCIAL') and p_target in ('COBERTURA_PARCIAL','CUBIERTO') and req.status<>p_target)) then raise exception 'TALENT_INVALID_STATE_TRANSITION'; end if;
 if p_target in ('COBERTURA_PARCIAL','CUBIERTO') then
  if not exists(select 1 from talent.request_coverage where company_id=p_company and id=p_request and ((p_target='CUBIERTO' and pending=0) or (p_target='COBERTURA_PARCIAL' and confirmed>0 and pending>0))) then raise exception 'TALENT_COVERAGE_NOT_CONFIRMED'; end if;
 end if;
 perform set_config('talent.actor_id',actor.id,true);
 perform set_config('talent.rq_transition',req.id,true);
 previous:=req.status;
 update talent.staff_requests set status=p_target where company_id=p_company and id=p_request returning * into req;
 insert into talent.request_decisions(company_id,request_id,actor_id,previous_status,new_status,reason,request_version)
 values(p_company,p_request,actor.id,previous,p_target,p_reason,req.version);
 -- previous_status lo toma la auditoría de decisión, no información del cliente.
 result:=jsonb_build_object('id',req.id,'version',req.version,'status',req.status);
 insert into talent.idempotency(company_id,actor_id,operation,request_key,payload_hash,response_metadata,completed_at)
 values(p_company,actor.id,'rq_transition',p_key,fingerprint,result,clock_timestamp());
 perform set_config('talent.rq_transition','',true);
 perform set_config('talent.actor_id','',true);
 return result;
end $$;
create function talent_private.admission_guard() returns trigger language plpgsql
set search_path=pg_catalog,talent as $$
declare hired talent.hiring; app talent.applications; req talent.staff_requests;
begin
 select * into hired from talent.hiring where company_id=new.company_id and id=new.hiring_id;
 if hired.status is distinct from 'CONTRATADO' or hired.official_start is null then raise exception 'TALENT_CONFIRMED_HIRING_REQUIRED'; end if;
 select * into app from talent.applications where company_id=new.company_id and id=hired.application_id;
 select * into req from talent.staff_requests where company_id=new.company_id and id=new.request_id;
 if req.status not in ('APROBADO','EN_ATENCION','COBERTURA_PARCIAL') or req.status is null then raise exception 'TALENT_APPROVED_REQUEST_REQUIRED'; end if;
 if app.campaign_id<>req.campaign_id and not exists(select 1 from talent.request_campaigns where company_id=new.company_id and request_id=req.id and campaign_id=app.campaign_id) then raise exception 'TALENT_REQUEST_CAMPAIGN_MISMATCH'; end if;
 return new;
end $$;
create trigger admission_integrity before insert or update on talent.operational_admissions for each row execute function talent_private.admission_guard();
create function talent_private.context_guard() returns trigger language plpgsql
set search_path=pg_catalog,talent as $$
declare app talent.applications; part talent.participants; grp talent.training_groups; def talent.evaluation_definitions; item talent.evaluation_items; ev talent.evaluations;
begin
 if tg_table_name='participants' then
  select * into app from talent.applications where company_id=new.company_id and id=new.application_id;
  select * into grp from talent.training_groups where company_id=new.company_id and id=new.group_id;
  if app.campaign_id is distinct from grp.campaign_id then raise exception 'TALENT_GROUP_CAMPAIGN_MISMATCH'; end if;
 elsif tg_table_name='evaluations' then
  select * into def from talent.evaluation_definitions where company_id=new.company_id and id=new.definition_id;
  if new.score>def.max_score then raise exception 'TALENT_SCORE_OUT_OF_RANGE'; end if;
  if new.application_id is not null then
   select * into app from talent.applications where company_id=new.company_id and id=new.application_id;
   if app.person_id is distinct from new.person_id then raise exception 'TALENT_EVALUATION_PERSON_MISMATCH'; end if;
  end if;
  if new.participant_id is not null then
   select * into part from talent.participants where company_id=new.company_id and id=new.participant_id;
   select * into app from talent.applications where company_id=new.company_id and id=part.application_id;
   if app.person_id is distinct from new.person_id or (new.application_id is not null and part.application_id<>new.application_id) or (def.group_id is not null and def.group_id<>part.group_id) then raise exception 'TALENT_EVALUATION_CONTEXT_MISMATCH'; end if;
  end if;
 elsif tg_table_name='evaluation_answers' then
  select * into ev from talent.evaluations where company_id=new.company_id and id=new.evaluation_id;
  select * into item from talent.evaluation_items where company_id=new.company_id and id=new.item_id;
  if item.definition_id is distinct from ev.definition_id or new.points>item.points then raise exception 'TALENT_ANSWER_DEFINITION_MISMATCH'; end if;
  if new.option_id is not null and not exists(select 1 from talent.evaluation_options where company_id=new.company_id and id=new.option_id and item_id=new.item_id) then raise exception 'TALENT_ANSWER_OPTION_MISMATCH'; end if;
 elsif tg_table_name='hiring' and new.participant_id is not null then
  select * into part from talent.participants where company_id=new.company_id and id=new.participant_id;
  if part.application_id is distinct from new.application_id then raise exception 'TALENT_HIRING_APPLICATION_MISMATCH'; end if;
 end if;
 return new;
end $$;
create trigger participant_context before insert or update on talent.participants for each row execute function talent_private.context_guard();
create trigger evaluation_context before insert or update on talent.evaluations for each row execute function talent_private.context_guard();
create trigger answer_context before insert or update on talent.evaluation_answers for each row execute function talent_private.context_guard();
create trigger hiring_context before insert or update on talent.hiring for each row execute function talent_private.context_guard();
-- Dueño de captación inmutable; reasignaciones futuras exigen contrato/auditoría específico.
create function talent_private.capture_owner_guard() returns trigger language plpgsql as $$
begin if new.owner_id is distinct from old.owner_id or new.source_id is distinct from old.source_id then raise exception 'TALENT_CAPTURE_OWNER_IMMUTABLE'; end if; return new; end $$;
create trigger capture_owner_immutable before update on talent.capture_links for each row execute function talent_private.capture_owner_guard();
create trigger capture_event_owner_immutable before update on talent.captures for each row execute function talent_private.capture_owner_guard();
revoke all on all functions in schema talent_private from public,anon,authenticated,service_role;
revoke all on function public.talent_group_page(uuid,text,text,integer),public.talent_request_transition(uuid,text,text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.talent_group_page(uuid,text,text,integer),public.talent_request_transition(uuid,text,text,bigint,text,text,text) to service_role;
commit;
