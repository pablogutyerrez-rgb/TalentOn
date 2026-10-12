begin;
alter table talent.profiles add unique(company_id,id,auth_user_id);
alter table talent.auth_mappings add foreign key(company_id,profile_id,supabase_auth_id) references talent.profiles(company_id,id,auth_user_id);
create table talent.lifecycle_events(
 company_id text not null references talent.companies(id),id text not null default gen_random_uuid()::text,
 person_id text not null,application_id text,participant_id text,actor_id text not null,
 previous_stage text,new_stage text not null,reason text,occurred_at timestamptz not null,
 primary key(company_id,id),foreign key(company_id,person_id) references talent.persons(company_id,id),
 foreign key(company_id,application_id) references talent.applications(company_id,id),
 foreign key(company_id,participant_id) references talent.participants(company_id,id),
 foreign key(company_id,actor_id) references talent.profiles(company_id,id)
);
create table talent.ojt_skills(
 company_id text not null references talent.companies(id),id text not null default gen_random_uuid()::text,
 participant_id text not null,assessed_by text not null,assessed_at timestamptz not null,
 manejo_objeciones integer not null check(manejo_objeciones between 1 and 5),
 diccion_modulacion integer not null check(diccion_modulacion between 1 and 5),
 velocidad_sistemas integer not null check(velocidad_sistemas between 1 and 5),
 empatia_escucha integer not null check(empatia_escucha between 1 and 5),
 tecnica_cierre integer not null check(tecnica_cierre between 1 and 5),
 cumplimiento_procesos integer not null check(cumplimiento_procesos between 1 and 5),
 primary key(company_id,id),foreign key(company_id,participant_id) references talent.participants(company_id,id),
 foreign key(company_id,assessed_by) references talent.profiles(company_id,id)
);
alter table talent.lifecycle_events enable row level security;
alter table talent.ojt_skills enable row level security;
revoke all on talent.lifecycle_events,talent.ojt_skills from public,anon,authenticated,service_role;
create index lifecycle_person_date on talent.lifecycle_events(company_id,person_id,occurred_at,id);
create index ojt_skills_participant_date on talent.ojt_skills(company_id,participant_id,assessed_at,id);
create trigger lifecycle_append_only before update or delete on talent.lifecycle_events for each row execute function talent_private.prevent_history_change();
create trigger skills_append_only before update or delete on talent.ojt_skills for each row execute function talent_private.prevent_history_change();
-- La comprobación usa clock_timestamp(), no hora enviada por el navegador.
create function talent_private.attendance_window() returns trigger language plpgsql set search_path=pg_catalog,talent as $$
declare starts timestamptz; timestamp_now timestamptz:=clock_timestamp();
begin
 select starts_at into starts from talent.training_days where company_id=new.company_id and group_id=new.group_id and day_date=new.day_date;
 if starts is null then raise exception 'TALENT_DAY_NOT_FOUND'; end if;
 if not (timestamp_now between starts and starts+interval '30 minutes') and not exists(
  select 1 from talent.attendance_unlocks where company_id=new.company_id and group_id=new.group_id and day_date=new.day_date and status='APROBADA' and decided_at<=timestamp_now and expires_at>timestamp_now
 ) then raise exception 'TALENT_ATTENDANCE_LOCKED'; end if;
 new.marked_at:=timestamp_now;
 return new;
end $$;
create trigger attendance_window_guard before insert or update on talent.attendance for each row execute function talent_private.attendance_window();
create function talent_private.unlock_guard() returns trigger language plpgsql set search_path=pg_catalog,talent as $$
begin
 if tg_op='INSERT' and new.status<>'PENDIENTE' then raise exception 'TALENT_UNLOCK_MUST_START_PENDING'; end if;
 if tg_op='UPDATE' then
  if new.group_id is distinct from old.group_id or new.day_date is distinct from old.day_date or new.requested_by is distinct from old.requested_by then raise exception 'TALENT_UNLOCK_SCOPE_IMMUTABLE'; end if;
  if new.status is distinct from old.status and (old.status<>'PENDIENTE' or new.status not in ('APROBADA','RECHAZADA') or current_setting('talent.unlock_transition',true) is distinct from new.id) then raise exception 'TALENT_USE_UNLOCK_RPC'; end if;
 end if;
 if new.status='APROBADA' and (new.expires_at is null or new.decided_at is null or new.decided_by is null or new.expires_at<=new.decided_at) then raise exception 'TALENT_UNLOCK_EXPIRY_REQUIRED'; end if;
 return new;
end $$;
create trigger unlock_transition_guard before insert or update on talent.attendance_unlocks for each row execute function talent_private.unlock_guard();
create function public.talent_unlock_decide(p_actor uuid,p_company text,p_unlock text,p_expected bigint,p_approve boolean,p_reason text,p_expires timestamptz)
returns bigint language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles; req talent.attendance_unlocks; grp talent.training_groups; revision bigint;
begin
 actor:=talent_private.actor_profile(p_actor,p_company);
 if actor.role not in ('ADMIN','JEFE_FORMACION','COORDINADOR_FORMACION') then raise insufficient_privilege; end if;
 select * into req from talent.attendance_unlocks where company_id=p_company and id=p_unlock for update;
 if not found then raise exception 'TALENT_UNLOCK_NOT_FOUND'; end if;
 select * into grp from talent.training_groups where company_id=p_company and id=req.group_id;
 if actor.role='COORDINADOR_FORMACION' and grp.coordinator_id=actor.id then
  if not exists(select 1 from talent.user_modules where company_id=p_company and user_id=actor.id and module='FORMACION' and archived_at is null) then raise insufficient_privilege; end if;
 else perform talent_private.require_campaign(p_actor,p_company,grp.campaign_id,'FORMACION'); end if;
 if p_expected is null or req.version<>p_expected or req.status<>'PENDIENTE' then raise sqlstate 'PT409' using message='TALENT_UNLOCK_CONFLICT'; end if;
 if p_approve is null or p_reason is null or length(btrim(p_reason))=0 or (p_approve and (p_expires is null or p_expires<=clock_timestamp())) then raise exception 'TALENT_INVALID_UNLOCK_DECISION'; end if;
 perform set_config('talent.actor_id',actor.id,true);
 perform set_config('talent.unlock_transition',req.id,true);
 update talent.attendance_unlocks set status=case when p_approve then 'APROBADA' else 'RECHAZADA' end,decided_by=actor.id,decided_at=clock_timestamp(),decision_reason=p_reason,expires_at=case when p_approve then p_expires else null end where company_id=p_company and id=p_unlock returning version into revision;
 perform set_config('talent.unlock_transition','',true); perform set_config('talent.actor_id','',true);
 return revision;
end $$;
revoke all on function public.talent_unlock_decide(uuid,text,text,bigint,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.talent_unlock_decide(uuid,text,text,bigint,boolean,text,timestamptz) to service_role;
revoke all on all functions in schema talent_private from public,anon,authenticated,service_role;
-- Sin defaults de 5+5: se conserva duración de cada grupo y calendario explícito.
create function talent_private.application_context() returns trigger language plpgsql
set search_path=pg_catalog,talent as $$
begin
 if new.capture_id is not null and not exists(select 1 from talent.captures where company_id=new.company_id and id=new.capture_id and person_id=new.person_id) then raise exception 'TALENT_CAPTURE_PERSON_MISMATCH'; end if;
 if new.template_id is not null and not exists(select 1 from talent.process_templates where company_id=new.company_id and id=new.template_id and campaign_id=new.campaign_id) then raise exception 'TALENT_TEMPLATE_CAMPAIGN_MISMATCH'; end if;
 return new;
end $$;
create trigger application_context before insert or update on talent.applications for each row execute function talent_private.application_context();
create function talent_private.definition_history_guard() returns trigger language plpgsql
set search_path=pg_catalog,talent as $$
declare definition text; published boolean;
begin
 if tg_table_name='evaluation_definitions' then
  if old.published or exists(select 1 from talent.evaluations where company_id=old.company_id and definition_id=old.id) then raise exception 'TALENT_CREATE_NEW_DEFINITION_VERSION'; end if;
 elsif tg_table_name='evaluation_items' then
  if tg_op='UPDATE' and new.definition_id is distinct from old.definition_id then raise exception 'TALENT_DEFINITION_PARENT_IMMUTABLE'; end if;
  definition:=case when tg_op='INSERT' then new.definition_id else old.definition_id end;
 else
  if tg_op='UPDATE' and new.item_id is distinct from old.item_id then raise exception 'TALENT_DEFINITION_PARENT_IMMUTABLE'; end if;
  select definition_id into definition from talent.evaluation_items where company_id=coalesce(new.company_id,old.company_id) and id=case when tg_op='INSERT' then new.item_id else old.item_id end;
 end if;
 if definition is not null then
  select d.published into published from talent.evaluation_definitions d where d.company_id=coalesce(new.company_id,old.company_id) and d.id=definition;
  if published or exists(select 1 from talent.evaluations where company_id=coalesce(new.company_id,old.company_id) and definition_id=definition) then raise exception 'TALENT_CREATE_NEW_DEFINITION_VERSION'; end if;
 end if;
 return new;
end $$;
create trigger definition_history before update on talent.evaluation_definitions for each row execute function talent_private.definition_history_guard();
create trigger item_history before insert or update on talent.evaluation_items for each row execute function talent_private.definition_history_guard();
create trigger option_history before insert or update on talent.evaluation_options for each row execute function talent_private.definition_history_guard();
revoke all on all functions in schema talent_private from public,anon,authenticated,service_role;
create or replace function public.talent_schema_status() returns jsonb language sql security definer
set search_path=pg_catalog,talent as $$
 select jsonb_build_object('model','relational','revision','202610120004','tables',
 (select count(*) from pg_tables where schemaname='talent'));
$$;
commit;
