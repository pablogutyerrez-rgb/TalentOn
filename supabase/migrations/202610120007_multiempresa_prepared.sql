-- PREPARACIÓN: aplicar primero en entorno aislado. Sin traslado de registros históricos.
begin;
create schema talent_org;
revoke all on schema talent_org from public,anon,authenticated,service_role;
alter table talent.companies add column legal_name text, add column tax_id text,
 add column administrative_metadata jsonb not null default '{}',
 add column catalog_managed boolean not null default false,
 add column status text not null default 'ACTIVA' check(status in ('ACTIVA','INACTIVA'));
create table talent_org.global_campaigns(
 id text primary key, name text not null unique, status text not null default 'ACTIVA' check(status in ('ACTIVA','INACTIVA')),
 metadata jsonb not null default '{}',version bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz);
create table talent_org.company_campaigns(
 company_id text not null references talent.companies(id),id text not null default gen_random_uuid()::text,
 global_campaign_id text not null references talent_org.global_campaigns(id),status text not null default 'ACTIVA' check(status in ('ACTIVA','INACTIVA')),
 configuration jsonb not null default '{}',version bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 primary key(company_id,id),unique(company_id,global_campaign_id));
create table talent_org.global_admins(
 id text primary key,auth_user_id uuid not null unique references talent.profiles(auth_user_id),enabled boolean not null default true,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz);
create table talent_org.user_companies(
 company_id text not null references talent.companies(id),id text not null default gen_random_uuid()::text,
 auth_user_id uuid not null references talent.profiles(auth_user_id),
 role text not null check(role in ('ADMIN','JEFE_SELECCION','ANALISTA_SELECCION','RECLUTADOR','JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR','JEFE_TALENTO','ANALISTA_TALENTO','COORDINADOR_OPERACIONES','CALIDAD')),
 enabled boolean not null default true,all_campaigns boolean not null default false,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 primary key(company_id,id),unique(company_id,auth_user_id));
create table talent_org.user_campaigns(
 company_id text not null,id text not null default gen_random_uuid()::text,auth_user_id uuid not null,company_campaign_id text not null,
 enabled boolean not null default true,version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 primary key(company_id,id),unique(company_id,auth_user_id,company_campaign_id),
 foreign key(company_id,auth_user_id) references talent_org.user_companies(company_id,auth_user_id),
 foreign key(company_id,company_campaign_id) references talent_org.company_campaigns(company_id,id));
-- Solo identificador HMAC calculado en servidor; nunca DNI/email/hash simple ni PII global.
create table talent_org.identity_registry(
 id text primary key default gen_random_uuid()::text,fingerprint text not null unique check(fingerprint ~ '^[a-f0-9]{64}$'),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz);
create table talent_org.quality_reviews(
 company_id text not null,id text not null default gen_random_uuid()::text,company_campaign_id text not null,application_id text not null,
 reviewer_auth_id uuid not null,reviewed_at timestamptz not null,score numeric check(score between 0 and 100),criteria jsonb not null default '{}',feedback text,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 primary key(company_id,id),foreign key(company_id,company_campaign_id) references talent_org.company_campaigns(company_id,id),
 foreign key(company_id,application_id) references talent.applications(company_id,id),foreign key(company_id,reviewer_auth_id) references talent_org.user_companies(company_id,auth_user_id));
create index org_quality_campaign_date on talent_org.quality_reviews(company_id,company_campaign_id,reviewed_at,id);
create function talent_private.org_quality_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not exists(select 1 from talent.applications a join talent.campaigns c on c.company_id=a.company_id and c.id=a.campaign_id where a.company_id=new.company_id and a.id=new.application_id and c.company_campaign_id=new.company_campaign_id) then raise exception 'TALENT_QUALITY_CONTEXT_MISMATCH'; end if;
 if not talent_private.org_campaign_access(new.reviewer_auth_id,new.company_id,new.company_campaign_id) or not exists(select 1 from talent_org.user_companies where company_id=new.company_id and auth_user_id=new.reviewer_auth_id and role='CALIDAD' and enabled and archived_at is null) then raise insufficient_privilege; end if;
 if tg_op='UPDATE' and new.application_id is distinct from old.application_id then raise exception 'TALENT_IDENTITY_IMMUTABLE'; end if;
 return new;
end $$;
-- La función resuelve org_campaign_access al ejecutarse, tras crear las funciones de permisos.
create trigger org_quality_context before insert or update on talent_org.quality_reviews for each row execute function talent_private.org_quality_guard();
create table talent_org.audit_events(
 id bigint generated always as identity primary key,actor_auth_id uuid references auth.users(id),company_id text references talent.companies(id),
 table_name text not null,entity_id text not null,action text not null,changed_columns text[] not null,occurred_at timestamptz not null default clock_timestamp());
create trigger append_only before update or delete on talent_org.audit_events for each row execute function talent_private.prevent_history_change();

alter table talent.campaigns add column company_campaign_id text,
 add constraint campaign_catalog_context foreign key(company_id,company_campaign_id) references talent_org.company_campaigns(company_id,id);
alter table talent.capture_links add column company_campaign_id text,
 add constraint capture_catalog_context foreign key(company_id,company_campaign_id) references talent_org.company_campaigns(company_id,id);
alter table talent.persons add column shared_identity_id text references talent_org.identity_registry(id);
create index org_user_company on talent_org.user_companies(auth_user_id,company_id) where enabled and archived_at is null;
create index org_user_campaign on talent_org.user_campaigns(auth_user_id,company_id,company_campaign_id) where enabled and archived_at is null;
create index org_campaign_global on talent_org.company_campaigns(global_campaign_id,company_id);
create index campaign_catalog_fk on talent.campaigns(company_id,company_campaign_id);
create index capture_catalog_fk on talent.capture_links(company_id,company_campaign_id);
create index person_shared_fk on talent.persons(shared_identity_id) where shared_identity_id is not null;
create index org_audit_company_date on talent_org.audit_events(company_id,occurred_at,id);

create function talent_private.org_live_actor(p_actor uuid) returns boolean language sql stable security definer
set search_path=pg_catalog,talent as $$
 select exists(select 1 from talent.profiles where auth_user_id=p_actor and enabled and status='ACTIVO' and not must_change_password and archived_at is null)
$$;
create function talent_private.org_global_admin(p_actor uuid) returns boolean language sql stable security definer
set search_path=pg_catalog,talent,talent_org as $$
 select talent_private.org_live_actor(p_actor) and exists(select 1 from talent_org.global_admins where auth_user_id=p_actor and enabled and archived_at is null)
$$;
create function talent_private.org_company_access(p_actor uuid,p_company text) returns boolean language sql stable security definer
set search_path=pg_catalog,talent,talent_org as $$
 select talent_private.org_live_actor(p_actor) and exists(select 1 from talent.companies where id=p_company and status='ACTIVA' and archived_at is null)
 and (talent_private.org_global_admin(p_actor) or exists(select 1 from talent_org.user_companies where company_id=p_company and auth_user_id=p_actor and enabled and archived_at is null))
$$;
create function talent_private.org_campaign_access(p_actor uuid,p_company text,p_assignment text) returns boolean language sql stable security definer
set search_path=pg_catalog,talent,talent_org as $$
 select talent_private.org_company_access(p_actor,p_company)
 and exists(select 1 from talent_org.company_campaigns a join talent_org.global_campaigns c on c.id=a.global_campaign_id where a.company_id=p_company and a.id=p_assignment and a.status='ACTIVA' and a.archived_at is null and c.status='ACTIVA' and c.archived_at is null)
 and (talent_private.org_global_admin(p_actor) or exists(select 1 from talent_org.user_companies m where m.company_id=p_company and m.auth_user_id=p_actor and m.enabled and m.archived_at is null and
 (m.all_campaigns or exists(select 1 from talent_org.user_campaigns u where u.company_id=p_company and u.auth_user_id=p_actor and u.company_campaign_id=p_assignment and u.enabled and u.archived_at is null))))
$$;

-- Catálogos con CAS administrables vía RPC de servidor; ningún permiso por role del frontend.
create function public.talent_org_catalog_save(p_actor uuid,p_company text,p_id text,p_name text,p_global_campaign text,p_expected bigint,p_configuration jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare current_version bigint; result jsonb;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 if p_id is null or length(btrim(p_id))=0 or p_configuration is null or jsonb_typeof(p_configuration)<>'object' then raise exception 'TALENT_INVALID_CATALOG'; end if;
 perform pg_advisory_xact_lock(hashtextextended('org:'||coalesce(p_company,'global')||':'||p_id,0));
 perform set_config('talent.org_actor',p_actor::text,true);
 if p_company is null then
  if p_name is null or length(btrim(p_name))=0 then raise exception 'TALENT_INVALID_CATALOG'; end if;
  select version into current_version from talent_org.global_campaigns where id=p_id for update;
  if current_version is distinct from p_expected then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
  insert into talent_org.global_campaigns(id,name,metadata) values(p_id,btrim(p_name),p_configuration)
   on conflict(id) do update set name=excluded.name,metadata=excluded.metadata returning to_jsonb(global_campaigns.*) into result;
 else
  if not exists(select 1 from talent.companies where id=p_company and status='ACTIVA' and archived_at is null) then raise insufficient_privilege; end if;
  select version into current_version from talent_org.company_campaigns where company_id=p_company and id=p_id for update;
  if current_version is distinct from p_expected then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
  insert into talent_org.company_campaigns(company_id,id,global_campaign_id,configuration) values(p_company,p_id,p_global_campaign,p_configuration)
   on conflict(company_id,id) do update set configuration=excluded.configuration returning to_jsonb(company_campaigns.*) into result;
 end if;
 perform set_config('talent.org_actor','',true);return result;
end $$;
revoke all on function public.talent_org_catalog_save(uuid,text,text,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.talent_org_catalog_save(uuid,text,text,text,text,bigint,jsonb) to service_role;

-- No convertir ADMIN existentes en administradores globales automáticamente.
-- El alta inicial de un global_admin requerirá autorización explícita y sesión verificada.
create function talent_private.org_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'TALENT_HISTORY_DELETE_FORBIDDEN'; end if;
 if new.id is distinct from old.id or (to_jsonb(new)->>'company_id') is distinct from (to_jsonb(old)->>'company_id')
 or (to_jsonb(new)->>'auth_user_id') is distinct from (to_jsonb(old)->>'auth_user_id')
 or (to_jsonb(new)->>'global_campaign_id') is distinct from (to_jsonb(old)->>'global_campaign_id')
 or (to_jsonb(new)->>'company_campaign_id') is distinct from (to_jsonb(old)->>'company_campaign_id')
 or (to_jsonb(new)->>'fingerprint') is distinct from (to_jsonb(old)->>'fingerprint') then raise exception 'TALENT_IDENTITY_IMMUTABLE'; end if;
 new.version=old.version+1;new.created_at=old.created_at;new.updated_at=clock_timestamp();return new;
end $$;
create function talent_private.org_audit() returns trigger language plpgsql security definer set search_path=pg_catalog,talent_org as $$
declare cols text[];
begin
 select array_agg(key order by key) into cols from jsonb_each(to_jsonb(new)) where tg_op='INSERT' or value is distinct from (to_jsonb(old)->key);
 insert into talent_org.audit_events(actor_auth_id,company_id,table_name,entity_id,action,changed_columns)
 values(nullif(current_setting('talent.org_actor',true),'')::uuid,to_jsonb(new)->>'company_id',tg_table_name,new.id,tg_op,coalesce(cols,'{}'));
 return new;
end $$;
create function talent_private.org_context_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if tg_op='UPDATE' and old.company_campaign_id is not null and new.company_campaign_id is distinct from old.company_campaign_id then raise exception 'TALENT_TRANSFER_PROCEDURE_REQUIRED'; end if;
 if new.company_campaign_id is not null and not exists(select 1 from talent_org.company_campaigns a join talent_org.global_campaigns c on c.id=a.global_campaign_id join talent.companies b on b.id=a.company_id where a.company_id=new.company_id and a.id=new.company_campaign_id and a.status='ACTIVA' and a.archived_at is null and b.status='ACTIVA' and b.archived_at is null and c.status='ACTIVA' and c.archived_at is null) then raise exception 'TALENT_CAMPAIGN_NOT_AUTHORIZED'; end if;
 if new.company_campaign_id is null and exists(select 1 from talent.companies where id=new.company_id and catalog_managed) then raise exception 'TALENT_COMPANY_CAMPAIGN_REQUIRED'; end if;
 return new;
end $$;
create function talent_private.org_person_guard() returns trigger language plpgsql as $$
begin
 if old.shared_identity_id is not null and new.shared_identity_id is distinct from old.shared_identity_id then raise exception 'TALENT_IDENTITY_IMMUTABLE'; end if;
 return new;
end $$;
create trigger org_person_identity_guard before update on talent.persons for each row execute function talent_private.org_person_guard();
create trigger org_campaign_guard before insert or update on talent.campaigns for each row execute function talent_private.org_context_guard();
create trigger org_capture_guard before insert or update on talent.capture_links for each row execute function talent_private.org_context_guard();
create function talent_private.org_application_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare assignment text;origin_assignment text;
begin
 if tg_op='UPDATE' and (new.person_id is distinct from old.person_id or new.campaign_id is distinct from old.campaign_id) then raise exception 'TALENT_TRANSFER_PROCEDURE_REQUIRED'; end if;
 select company_campaign_id into assignment from talent.campaigns where company_id=new.company_id and id=new.campaign_id;
 if new.capture_id is not null then
  select l.company_campaign_id into origin_assignment from talent.captures c join talent.capture_links l on l.company_id=c.company_id and l.id=c.link_id where c.company_id=new.company_id and c.id=new.capture_id;
  if origin_assignment is not null and origin_assignment is distinct from assignment then raise exception 'TALENT_CAPTURE_CAMPAIGN_MISMATCH'; end if;
 end if;
 return new;
end $$;
create constraint trigger org_application_context after insert or update on talent.applications deferrable initially immediate for each row execute function talent_private.org_application_guard();

do $$ declare t text;f record;begin
 foreach t in array array['global_campaigns','company_campaigns','global_admins','user_companies','user_campaigns','identity_registry','quality_reviews','audit_events'] loop
  execute format('alter table talent_org.%I enable row level security',t);
  execute format('revoke all on talent_org.%I from public,anon,authenticated,service_role',t);
  if t<>'audit_events' then
   execute format('create trigger org_guard before update or delete on talent_org.%I for each row execute function talent_private.org_guard()',t);
   execute format('create trigger org_audit after insert or update on talent_org.%I for each row execute function talent_private.org_audit()',t);
  end if;
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='talent_private'::regnamespace and proname like 'org_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
-- RLS preparada; solo lectura de configuración. Ninguna escritura desde el navegador.
grant usage on schema talent_org,talent_private to authenticated;
grant execute on function talent_private.org_global_admin(uuid),talent_private.org_company_access(uuid,text),talent_private.org_campaign_access(uuid,text,text) to authenticated;
grant select on talent_org.global_campaigns,talent_org.company_campaigns,talent_org.user_companies,talent_org.user_campaigns to authenticated;
create policy campaign_global_read on talent_org.global_campaigns for select to authenticated using(talent_private.org_global_admin(auth.uid()) or exists(select 1 from talent_org.company_campaigns a where a.global_campaign_id=global_campaigns.id and talent_private.org_campaign_access(auth.uid(),a.company_id,a.id)));
create policy campaign_company_read on talent_org.company_campaigns for select to authenticated using(talent_private.org_campaign_access(auth.uid(),company_id,id));
create policy own_company_membership on talent_org.user_companies for select to authenticated using(talent_private.org_global_admin(auth.uid()) or (auth_user_id=auth.uid() and talent_private.org_company_access(auth.uid(),company_id)));
create policy own_campaign_membership on talent_org.user_campaigns for select to authenticated using(talent_private.org_global_admin(auth.uid()) or (auth_user_id=auth.uid() and talent_private.org_campaign_access(auth.uid(),company_id,company_campaign_id)));

-- Agregación sin PII y sin sumar personas repetidas entre empresas.
-- Un consolidado global exige registro explícito de administrador global.
create function public.talent_org_summary(p_actor uuid,p_company text default null,p_assignment text default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare result jsonb;
begin
 if p_company is null then
  if p_assignment is not null or not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 elsif not talent_private.org_company_access(p_actor,p_company) or (p_assignment is not null and not talent_private.org_campaign_access(p_actor,p_company,p_assignment)) then raise insufficient_privilege; end if;
 with allowed as (
  select c.company_id,c.id from talent.campaigns c where c.archived_at is null and c.company_campaign_id is not null
   and (p_company is null or c.company_id=p_company) and (p_assignment is null or c.company_campaign_id=p_assignment)
   and talent_private.org_campaign_access(p_actor,c.company_id,c.company_campaign_id)
 ), apps as (
  select a.* from talent.applications a join allowed c on c.company_id=a.company_id and c.id=a.campaign_id where a.archived_at is null
 ), people as (
  select distinct coalesce(p.shared_identity_id,p.company_id||':'||p.id) as identity_key from apps a join talent.persons p on p.company_id=a.company_id and p.id=a.person_id where p.archived_at is null
 ), hires as (
  select h.company_id,h.id from talent.hiring h join apps a on a.company_id=h.company_id and a.id=h.application_id where h.status='CONTRATADO' and h.archived_at is null
 ), requests as (
  select r.company_id,r.id from talent.staff_requests r join allowed c on c.company_id=r.company_id and c.id=r.campaign_id where r.archived_at is null
 ) select jsonb_build_object('persons',(select count(*) from people),'applications',(select count(*) from apps),
  'hires',(select count(*) from hires),'requests',(select count(*) from requests),'campaigns',(select count(*) from allowed)) into result;
 return result;
end $$;
revoke all on function public.talent_org_summary(uuid,text,text) from public,anon,authenticated;
grant execute on function public.talent_org_summary(uuid,text,text) to service_role;

-- Configuración solicitada, no registros de ejemplo. No incluye usuarios ni procesos.
insert into talent.companies(id,name,catalog_managed) values('talent-up','Talent Up',true),('techcenter','Techcenter',true),('konectados','Konectados',true);
insert into talent_org.global_campaigns(id,name) values('bitel-portabilidad','Portabilidad Bitel'),('bitel-migraciones','Migraciones Bitel'),('win-internet','Internet Win'),('movistar-portabilidad','Portabilidad Movistar');
insert into talent_org.company_campaigns(company_id,id,global_campaign_id) values
 ('talent-up','talent-up:bitel-portabilidad','bitel-portabilidad'),('talent-up','talent-up:bitel-migraciones','bitel-migraciones'),('talent-up','talent-up:win-internet','win-internet'),
 ('techcenter','techcenter:bitel-portabilidad','bitel-portabilidad'),('techcenter','techcenter:bitel-migraciones','bitel-migraciones'),('techcenter','techcenter:movistar-portabilidad','movistar-portabilidad'),
 ('konectados','konectados:bitel-portabilidad','bitel-portabilidad'),('konectados','konectados:bitel-migraciones','bitel-migraciones');
commit;
