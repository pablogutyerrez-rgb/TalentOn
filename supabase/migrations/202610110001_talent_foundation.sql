-- Preparación de Talent-On: aplicar en un proyecto Supabase nuevo.
-- No migra datos, no toca tablas existentes de la aplicación ni elimina información.
begin;
create schema if not exists talent_private;
revoke all on schema talent_private from public, anon, authenticated;

create table public.talent_documents (
  path text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  collection text generated always as (split_part(path, '/', 1)) stored,
  company_id text generated always as (nullif(data->>'companyId', '')) stored,
  owner_uid text generated always as (coalesce(nullif(data->>'ownerUid',''), nullif(data->>'recruiterId',''))) stored,
  campaign_id text generated always as (nullif(data->>'campaignId','')) stored,
  candidate_id text generated always as (nullif(data->>'candidateId','')) stored,
  constraint talent_document_path check (
    path ~ '^[A-Za-z][A-Za-z0-9]*/[A-Za-z0-9_-]{1,128}(/[A-Za-z][A-Za-z0-9]*/[A-Za-z0-9_-]{1,128})?$'
    and split_part(path,'/',1) in ('companies','users','campaigns','candidates','trainings','hiringProcesses','systemSettings','auditLogs','attendanceUnlockRequests','captureLinks','captations','captureIdentities','captureRequests','captureRateLimits','captureAudit','selectionApplications','selectionTemplates','selectionTemplateFamilies','selectionMessages')
    and (array_length(string_to_array(path,'/'),1) = 2 or
      (split_part(path,'/',1) = 'candidates' and split_part(path,'/',3) = 'documents') or
      (split_part(path,'/',1) = 'trainings' and split_part(path,'/',3) = 'participants'))
  )
);
alter table public.talent_documents enable row level security;
-- Sin políticas públicas: Auth por sí solo nunca concede acceso a datos de RRHH.
revoke all on public.talent_documents from public, anon, authenticated, service_role;
grant select on public.talent_documents to service_role;
create index talent_company_collection_idx on public.talent_documents(company_id,collection,path);
create index talent_owner_idx on public.talent_documents(owner_uid,collection,path);
create index talent_campaign_idx on public.talent_documents(campaign_id,collection,path);
create index talent_candidate_idx on public.talent_documents(candidate_id,collection,path);
create index talent_payload_idx on public.talent_documents using gin(data jsonb_path_ops);
create unique index talent_one_active_application on public.talent_documents(company_id,candidate_id)
  where collection = 'selectionApplications' and data->>'status' = 'ACTIVA';
create unique index talent_username_unique on public.talent_documents(lower(data->>'username'))
  where collection = 'users' and data->>'username' is not null;
create table talent_private.collection_versions (path text primary key, version bigint not null default 0);
revoke all on talent_private.collection_versions from public, anon, authenticated, service_role;

create function talent_private.validate_document() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, talent_private as $$
declare namespace text := split_part(new.path,'/',1); target jsonb; reference_path text; ref text;
begin
  if namespace in ('users','campaigns','candidates','trainings','captureLinks','captations','selectionApplications','selectionTemplates','selectionTemplateFamilies') then
    if coalesce(new.data->>'companyId','') = '' then raise exception 'TALENT_COMPANY_REQUIRED'; end if;
    select data into target from public.talent_documents where path = 'companies/' || (new.data->>'companyId');
    if target is null then raise exception 'TALENT_COMPANY_NOT_FOUND'; end if;
  end if;
  if namespace = 'users' then
    if new.data->>'role' not in ('ADMIN','JEFE_SELECCION','ANALISTA_SELECCION','RECLUTADOR','JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR','JEFE_TALENTO','ANALISTA_TALENTO') or new.data->>'role' is null then raise exception 'TALENT_INVALID_ROLE'; end if;
    if new.data->>'status' not in ('ACTIVO','INACTIVO') or new.data->>'status' is null then raise exception 'TALENT_INVALID_ACCOUNT_STATE'; end if;
    if new.data->>'uid' is distinct from split_part(new.path,'/',2) then raise exception 'TALENT_INVALID_AUTH_MAPPING'; end if;
    if not exists(select 1 from auth.users where id::text = new.data->>'uid') then raise exception 'TALENT_AUTH_USER_NOT_FOUND'; end if;
  end if;
  foreach ref in array array['campaignId','candidateId','ownerUid','recruiterId','trainerId'] loop
    if coalesce(new.data->>ref,'') <> '' and namespace not in ('auditLogs','captureAudit','captureRequests','captureRateLimits') then
      reference_path := case when ref = 'campaignId' then 'campaigns/' when ref = 'candidateId' then 'candidates/' else 'users/' end || (new.data->>ref);
      select data into target from public.talent_documents where path = reference_path;
      if target is null then raise exception 'TALENT_REFERENCE_NOT_FOUND: %', ref; end if;
      if new.data->>'companyId' is not null and target->>'companyId' is distinct from new.data->>'companyId' then raise exception 'TALENT_CROSS_COMPANY_REFERENCE'; end if;
    end if;
  end loop;
  if array_length(string_to_array(new.path,'/'),1) = 4 then
    select data into target from public.talent_documents where path = split_part(new.path,'/',1) || '/' || split_part(new.path,'/',2);
    if target is null then raise exception 'TALENT_PARENT_NOT_FOUND'; end if;
    if new.data->>'companyId' is not null and target->>'companyId' is distinct from new.data->>'companyId' then raise exception 'TALENT_CROSS_COMPANY_PARENT'; end if;
  end if;
  return new;
end $$;
create constraint trigger talent_integrity after insert or update on public.talent_documents
  deferrable initially deferred for each row execute function talent_private.validate_document();

create function public.talent_get(p_path text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, talent_private as $$
declare result jsonb;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('talent-on:commit',0));
  select jsonb_build_object('path',path,'data',data,'version',version,'updatedAt',updated_at) into result from public.talent_documents where path = p_path;
  return coalesce(result,'null'::jsonb);
end $$;
create function public.talent_list(p_collection text, p_filter jsonb default '{}'::jsonb, p_after text default '', p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, talent_private as $$
declare rows jsonb; revision bigint;
begin
  if p_limit < 1 or p_limit > 1000 or jsonb_typeof(p_filter) <> 'object' or p_collection !~ '^[A-Za-z][A-Za-z0-9]*(/[A-Za-z0-9_-]+/[A-Za-z][A-Za-z0-9]*)?$' then raise exception 'TALENT_INVALID_QUERY'; end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('talent-on:commit',0));
  select coalesce(jsonb_agg(row order by row->>'path'),'[]'::jsonb) into rows from (
    select jsonb_build_object('path',path,'data',data,'version',version,'updatedAt',updated_at) row from public.talent_documents
    where regexp_replace(path,'/[^/]+$','') = p_collection and data @> p_filter and path > p_after order by path limit p_limit
  ) page;
  select version into revision from talent_private.collection_versions where path = p_collection;
  return jsonb_build_object('items',rows,'collectionVersion',coalesce(revision,0),'nextCursor',case when jsonb_array_length(rows) = p_limit then rows->(p_limit-1)->>'path' else null end);
end $$;
create function public.talent_commit(p_writes jsonb, p_expected jsonb default '{}'::jsonb, p_collections jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, talent_private as $$
declare condition record; actual bigint; item jsonb; previous jsonb; next_data jsonb; result jsonb := '[]'::jsonb; collection_path text; document_path text;
begin
  if jsonb_typeof(p_writes) <> 'array' or jsonb_array_length(p_writes) > 100 or jsonb_typeof(p_expected) <> 'object' or jsonb_typeof(p_collections) <> 'object' then raise exception 'TALENT_INVALID_COMMIT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('talent-on:commit',0));
  for condition in select * from jsonb_each(p_expected) loop
    select version into actual from public.talent_documents where path = condition.key;
    if condition.value = 'null'::jsonb then
      if actual is not null then raise sqlstate 'PT409' using message = 'TALENT_CONFLICT'; end if;
    elsif actual is distinct from (condition.value #>> '{}')::bigint then raise sqlstate 'PT409' using message = 'TALENT_CONFLICT'; end if;
  end loop;
  for condition in select * from jsonb_each_text(p_collections) loop
    select version into actual from talent_private.collection_versions where path = condition.key;
    if coalesce(actual,0) <> condition.value::bigint then raise sqlstate 'PT409' using message = 'TALENT_QUERY_CHANGED'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_writes) w group by w->>'path' having count(*) > 1) then raise exception 'TALENT_DUPLICATE_WRITE'; end if;
  for item in select * from jsonb_array_elements(p_writes) loop
    document_path := item->>'path';
    if document_path is null or jsonb_typeof(item->'data') <> 'object' or (item->>'mode') not in ('create','replace','merge') then raise exception 'TALENT_INVALID_WRITE'; end if;
    if not p_expected ? document_path then raise exception 'TALENT_PRECONDITION_REQUIRED'; end if;
    select data into previous from public.talent_documents where path = document_path;
    if item->>'mode' = 'create' and previous is not null then raise sqlstate 'PT409' using message = 'TALENT_ALREADY_EXISTS'; end if;
    if item->>'mode' = 'merge' and previous is null then raise exception 'TALENT_NOT_FOUND'; end if;
    next_data := case when item->>'mode' = 'merge' then previous || (item->'data') else item->'data' end;
    insert into public.talent_documents(path,data) values(document_path,next_data)
      on conflict(path) do update set data = excluded.data, version = talent_documents.version+1, updated_at = now();
    collection_path := regexp_replace(document_path,'/[^/]+$','');
    insert into talent_private.collection_versions(path,version) values(collection_path,1)
      on conflict(path) do update set version = collection_versions.version+1;
    select version into actual from public.talent_documents where path = document_path;
    result := result || jsonb_build_array(jsonb_build_object('path',document_path,'version',actual));
  end loop;
  return jsonb_build_object('writes',result);
end $$;
revoke all on function public.talent_get(text), public.talent_list(text,jsonb,text,integer), public.talent_commit(jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.talent_get(text), public.talent_list(text,jsonb,text,integer), public.talent_commit(jsonb,jsonb,jsonb) to service_role;
revoke all on function talent_private.validate_document() from public, anon, authenticated, service_role;
comment on table public.talent_documents is 'Contratos JSON Talent-On: datos solo mediante Worker autorizado; no contiene passwords ni secretos.';
commit;
