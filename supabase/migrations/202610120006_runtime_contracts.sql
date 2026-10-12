-- Extensiones relacionales para los contratos vigentes. No almacena documentos completos.
begin;
alter table talent.profiles add column avatar_url text;
alter table talent.persons add column owner_id text;
alter table talent.persons add column current_stage text not null default 'SELECCION';
alter table talent.persons add column current_process text not null default 'SELECCION';
alter table talent.persons add column capture_only boolean not null default false;
alter table talent.persons add column document_type text not null default 'DNI';
alter table talent.persons add column document_number text;
alter table talent.persons add column age integer;
alter table talent.persons add column source_name text;
alter table talent.persons add column cv_url text;
alter table talent.persons add column general_observations text;
alter table talent.persons add column current_application_id text;
alter table talent.persons add column avatar_url text;
alter table talent.persons add foreign key(company_id,owner_id) references talent.profiles(company_id,id);
alter table talent.persons add foreign key(company_id,current_application_id) references talent.applications(company_id,id) deferrable initially deferred;
alter table talent.applications add column selection_status text not null default 'ACTIVO';
alter table talent.applications add column process_snapshot jsonb;
alter table talent.applications add column process_checks jsonb not null default '{}';
alter table talent.participants add column ojt_status text not null default 'NO_INICIADO';
alter table talent.participants add column training_approved boolean not null default false;
alter table talent.training_groups add column observations text;
alter table talent.training_groups add column trainer_assignment_notes text;
alter table talent.training_groups add column trainer_assigned_at timestamptz;
alter table talent.training_groups add column trainer_assigned_by text;
alter table talent.hiring add column documents_validated boolean not null default false;
alter table talent.person_documents add column storage_status text not null default 'PENDING';
alter table talent.captures add column applicant_name text;
alter table talent.captures add column applicant_phone text;
alter table talent.captures add column applicant_email text;
alter table talent.captures add column applicant_document_type text;
alter table talent.captures add column applicant_document_number text;
alter table talent.captures add column applicant_district text;
create table talent.selection_scores(
 company_id text not null references talent.companies(id),id text not null,
 application_id text not null,psychometric numeric not null default 0,
 diction numeric not null default 0,wpm numeric not null default 0,roleplay numeric not null default 0,overall numeric not null default 0,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 primary key(company_id,id),unique(company_id,application_id),foreign key(company_id,application_id) references talent.applications(company_id,id)
);
create table talent.contract_events(
 company_id text not null references talent.companies(id),id text not null,
 application_id text,participant_id text,group_id text,campaign_id text,capture_id text,link_id text,user_id text,
 stream text not null,actor_id text,occurred_at timestamptz not null,
 action text,previous_state text,new_state text,description text,event_metadata jsonb not null default '{}',
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 primary key(company_id,id),
 foreign key(company_id,application_id) references talent.applications(company_id,id),
 foreign key(company_id,participant_id) references talent.participants(company_id,id),
 foreign key(company_id,group_id) references talent.training_groups(company_id,id),
 foreign key(company_id,campaign_id) references talent.campaigns(company_id,id),
 foreign key(company_id,capture_id) references talent.captures(company_id,id),
 foreign key(company_id,link_id) references talent.capture_links(company_id,id),
 foreign key(company_id,user_id) references talent.profiles(company_id,id),
 foreign key(company_id,actor_id) references talent.profiles(company_id,id)
);
create table talent.capture_runtime(
 company_id text not null references talent.companies(id),id text not null,
 kind text not null check(kind in ('IDENTITY','REQUEST','RATE')),candidate_id text,fingerprint text,
 request_count integer,expires_at timestamptz,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 primary key(company_id,id),foreign key(company_id,candidate_id) references talent.persons(company_id,id)
);
create table talent.tenant_revisions(company_id text primary key references talent.companies(id),revision bigint not null default 0);
insert into talent.tenant_revisions(company_id) select id from talent.companies;
-- Solo atributos complementarios y snapshots de configuración; claves y hechos en columnas/FK.
do $$ declare t text; begin
 foreach t in array array['profiles','campaigns','persons','applications','training_groups','participants','attendance','attendance_unlocks','dropouts','ojt_metrics','ojt_skills','feedback','files','person_documents','evaluation_definitions','evaluation_items','evaluation_options','evaluations','evaluation_answers','hiring','salary_accounts','capture_links','captures','process_templates','process_stages','interviews','technical_verifications','message_templates','messages','contacts','observations','capture_runtime','selection_scores'] loop
  execute format('alter table talent.%I add column annotations jsonb not null default ''{}'' check(jsonb_typeof(annotations)=''object'')',t);
 end loop;
 -- Orden lógico padre/hijo dentro de la misma transacción.
 for t in select format('alter table %s alter constraint %I deferrable initially immediate',conrelid::regclass,conname) from pg_constraint where connamespace='talent'::regnamespace and contype='f' loop execute t; end loop;
 foreach t in array array['selection_scores','contract_events','capture_runtime','tenant_revisions'] loop
  execute format('alter table talent.%I enable row level security',t);
  execute format('revoke all on talent.%I from public,anon,authenticated,service_role',t);
 end loop;
 foreach t in array array['selection_scores','contract_events','capture_runtime'] loop
  execute format('create trigger runtime_guard before update or delete on talent.%I for each row execute function talent_private.guard_relational()',t);
  execute format('create trigger runtime_audit after insert or update on talent.%I for each row execute function talent_private.audit_relational()',t);
 end loop;
end $$;
create index contract_events_targets on talent.contract_events(company_id,stream,occurred_at,id);
create index capture_runtime_expiry on talent.capture_runtime(company_id,kind,expires_at);
-- Reemplazo de triggers, no eliminación de datos: contexto comprobado al cierre del lote.
drop trigger participant_context on talent.participants;
drop trigger evaluation_context on talent.evaluations;
drop trigger answer_context on talent.evaluation_answers;
drop trigger hiring_context on talent.hiring;
drop trigger application_context on talent.applications;
create constraint trigger participant_context after insert or update on talent.participants deferrable initially immediate for each row execute function talent_private.context_guard();
create constraint trigger evaluation_context after insert or update on talent.evaluations deferrable initially immediate for each row execute function talent_private.context_guard();
create constraint trigger answer_context after insert or update on talent.evaluation_answers deferrable initially immediate for each row execute function talent_private.context_guard();
create constraint trigger hiring_context after insert or update on talent.hiring deferrable initially immediate for each row execute function talent_private.context_guard();
create constraint trigger application_context after insert or update on talent.applications deferrable initially immediate for each row execute function talent_private.application_context();
create function public.talent_runtime_snapshot(p_actor uuid default null,p_public_hash text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles; tenant text; t record; rows jsonb; result jsonb:='{}'; n integer; revision bigint;
begin
 if p_actor is not null then
  select * into actor from talent.profiles where auth_user_id=p_actor and status='ACTIVO' and enabled and archived_at is null;
  if not found then raise insufficient_privilege; end if;
  perform talent_private.actor_profile(p_actor,actor.company_id);tenant:=actor.company_id;
 else
  select l.company_id into tenant from talent.capture_links l join talent.profiles p on p.company_id=l.company_id and p.id=l.owner_id
   where l.token_hash=p_public_hash and l.active and l.archived_at is null and p.enabled and p.status='ACTIVO' and not p.must_change_password;
  if tenant is null then raise insufficient_privilege; end if;
 end if;
 -- Consistencia para todos los SELECT de esta solicitud y control de phantom en commit.
 perform pg_advisory_xact_lock_shared(hashtextextended('runtime:'||tenant,0));
 select r.revision into revision from talent.tenant_revisions r where company_id=tenant;
 for t in select tablename from pg_tables where schemaname='talent' and tablename not in ('roles','modules','role_permissions','audit_events','access_events','tenant_revisions','migration_runs','migration_mappings','auth_mappings') loop
  if t.tablename='companies' then
   select jsonb_agg(to_jsonb(c)) into rows from talent.companies c where id=tenant;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(page)),''[]''::jsonb) from (select * from talent.%I where company_id=$1 limit 2002) page',t.tablename) into rows using tenant;
  end if;
  n:=jsonb_array_length(coalesce(rows,'[]'));
  if n>2001 then raise exception 'TALENT_PAGINATION_REQUIRED'; end if;
  result:=result||jsonb_build_object(t.tablename,coalesce(rows,'[]'));
 end loop;
 return jsonb_build_object('companyId',tenant,'revision',coalesce(revision,0),'tables',result);
end $$;
create function public.talent_runtime_commit(p_actor uuid,p_public_hash text,p_company text,p_revision bigint,p_rows jsonb,p_resets text[] default '{}')
returns void language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles; actual bigint; item jsonb; tbl text; cols text; vals text; upd text; rowdata jsonb; current_version bigint; requested_version bigint; key text; allowed text[]:=array['profiles','user_modules','campaign_assignments','supervision','campaigns','persons','applications','training_groups','participants','training_days','attendance','attendance_unlocks','dropouts','ojt_metrics','ojt_skills','feedback','files','person_documents','evidence','evaluation_definitions','evaluation_items','evaluation_options','evaluations','evaluation_answers','hiring','salary_accounts','capture_links','captures','process_templates','process_stages','template_responsibles','interviews','technical_verifications','person_identifiers','message_templates','messages','contacts','observations','capture_runtime','selection_scores','contract_events','recruitment_sources','system_settings'];
begin
 if p_actor is not null then actor:=talent_private.actor_profile(p_actor,p_company);
 else
  select p.* into actor from talent.capture_links l join talent.profiles p on p.company_id=l.company_id and p.id=l.owner_id where l.token_hash=p_public_hash and l.active and l.company_id=p_company and not p.must_change_password and p.enabled and p.status='ACTIVO';
  if not found then raise insufficient_privilege; end if;
 end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'TALENT_INVALID_BATCH'; end if;
 perform pg_advisory_xact_lock(hashtextextended('runtime:'||p_company,0));
 select revision into actual from talent.tenant_revisions where company_id=p_company for update;
 if coalesce(actual,0) is distinct from p_revision then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
 perform set_config('talent.actor_id',actor.id,true);
 set constraints all deferred;
 for item in select value from jsonb_array_elements(p_rows) loop
  tbl:=item->>'table';rowdata:=item->'row';
  if not(tbl=any(allowed)) or jsonb_typeof(rowdata)<>'object' or coalesce(rowdata->>'id','')='' or rowdata->>'company_id' is distinct from p_company then raise exception 'TALENT_INVALID_ROW'; end if;
  if p_actor is null and tbl not in ('persons','person_identifiers','captures','capture_runtime','contract_events') then raise insufficient_privilege; end if;
  if tbl in ('profiles','user_modules','supervision') and actor.role<>'ADMIN' then raise insufficient_privilege; end if;
  execute format('select version from talent.%I where company_id=$1 and id=$2',tbl) into current_version using p_company,rowdata->>'id';
  requested_version:=nullif(item->>'expected','')::bigint;
  if current_version is distinct from requested_version then raise sqlstate 'PT409' using message='TALENT_ROW_VERSION_CONFLICT'; end if;
  if tbl='profiles' then
   if current_version is null then rowdata:=rowdata||jsonb_build_object('must_change_password',true); else rowdata:=rowdata-'must_change_password'-'password_changed_at'; end if;
  end if;
  if tbl='attendance_unlocks' then perform set_config('talent.unlock_transition',rowdata->>'id',true); end if;
  select string_agg(format('%I',a.attname),',' order by a.attnum),
   string_agg(format('r.%I',a.attname),',' order by a.attnum),
   string_agg(format('%I=excluded.%I',a.attname,a.attname),',' order by a.attnum) filter(where a.attname not in ('company_id','id'))
  into cols,vals,upd from pg_attribute a where a.attrelid=format('talent.%I',tbl)::regclass and a.attnum>0 and not a.attisdropped and rowdata ? a.attname and a.attname not in ('version','created_at','updated_at');
  if exists(select 1 from jsonb_object_keys(rowdata) k where k not in ('version','created_at','updated_at') and not exists(select 1 from pg_attribute a where a.attrelid=format('talent.%I',tbl)::regclass and a.attname=k and a.attnum>0 and not a.attisdropped)) then raise exception 'TALENT_UNKNOWN_COLUMN'; end if;
  execute format('insert into talent.%I (%s) select %s from jsonb_populate_record(null::talent.%I,$1) r on conflict(company_id,id) do update set %s',tbl,cols,vals,tbl,upd) using rowdata;
 end loop;
 if cardinality(p_resets)>0 then
  if p_actor is null or actor.role<>'ADMIN' then raise insufficient_privilege; end if;
  foreach key in array p_resets loop
   update talent.profiles set must_change_password=true where company_id=p_company and auth_user_id::text=key;
   if not found then raise exception 'TALENT_RESET_PROFILE_NOT_FOUND'; end if;
  end loop;
 end if;
 insert into talent.tenant_revisions(company_id,revision) values(p_company,1) on conflict(company_id) do update set revision=tenant_revisions.revision+1;
 perform set_config('talent.actor_id','',true);perform set_config('talent.unlock_transition','',true);
 set constraints all immediate;
end $$;
revoke all on function public.talent_runtime_snapshot(uuid,text),public.talent_runtime_commit(uuid,text,text,bigint,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.talent_runtime_snapshot(uuid,text),public.talent_runtime_commit(uuid,text,text,bigint,jsonb,text[]) to service_role;
-- Cambios de RPC de sesión y operaciones fuera del adaptador también invalidan snapshots.
create function talent_private.runtime_revision() returns trigger language plpgsql security definer set search_path=pg_catalog,talent as $$
begin
 insert into talent.tenant_revisions(company_id,revision) values(new.company_id,1) on conflict(company_id) do update set revision=tenant_revisions.revision+1;
 return new;
end $$;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='talent' and tablename not in ('companies','roles','modules','role_permissions','tenant_revisions','audit_events','access_events','migration_runs','migration_mappings','auth_mappings') loop
  execute format('create trigger revision_changed after insert or update on talent.%I for each row execute function talent_private.runtime_revision()',t);
 end loop;
end $$;
revoke all on function talent_private.runtime_revision() from public,anon,authenticated,service_role;
create or replace function public.talent_session_profile(p_auth uuid) returns jsonb
language sql security definer set search_path=pg_catalog,talent as $$
 select jsonb_build_object('id',p.id,'authUserId',p.auth_user_id,'companyId',p.company_id,
 'username',p.username,'name',p.display_name,'role',p.role,'nickname',p.nickname,'tagline',p.tagline,'avatarUrl',p.avatar_url,'jobTitle',p.job_title,'phone',p.phone,
 'status',p.status,'mustChangePassword',p.must_change_password,'version',p.version,
 'scope',coalesce((select jsonb_agg(a.campaign_id) from talent.campaign_assignments a where a.company_id=p.company_id and a.user_id=p.id and a.assignment_kind='SCOPE' and a.archived_at is null),'[]'::jsonb),
 'subordinateUserIds',coalesce((select jsonb_agg(s.subordinate_id) from talent.supervision s where s.company_id=p.company_id and s.supervisor_id=p.id and s.archived_at is null),'[]'::jsonb),
 'allowedModules',coalesce((select jsonb_agg(m.module order by m.module) from talent.user_modules m where m.company_id=p.company_id and m.user_id=p.id and m.archived_at is null),'[]'::jsonb))
 from talent.profiles p where auth_user_id=p_auth and status='ACTIVO' and enabled and archived_at is null;
$$;
commit;
