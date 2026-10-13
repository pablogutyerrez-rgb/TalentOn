begin;
-- Independent form settings: never rewrite campaign business data or past applications.
create table talent_org.capture_settings(
 company_id text not null references talent.companies(id), id text not null,
 configuration jsonb not null, version bigint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(company_id,id));
alter table talent_org.capture_settings enable row level security;
revoke all on talent_org.capture_settings from public,anon,authenticated,service_role;
create trigger org_guard before update or delete on talent_org.capture_settings
 for each row execute function talent_private.org_guard();
create trigger org_audit after insert or update on talent_org.capture_settings
 for each row execute function talent_private.org_audit();

-- One authoritative list for public metadata and administration; no internal annotations.
create function talent_private.capture_campaign_options(p_company text) returns jsonb
language sql stable security definer set search_path=pg_catalog,talent,talent_org as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,
 'configuration',s.configuration,'version',s.version) order by c.name,c.id),'[]'::jsonb)
 from (
  select a.company_id,a.id,g.name from talent_org.company_campaigns a
  join talent_org.global_campaigns g on g.id=a.global_campaign_id
  join talent.companies b on b.id=a.company_id and b.catalog_managed
  where a.company_id=p_company and a.status='ACTIVA' and a.archived_at is null
   and g.status='ACTIVA' and g.archived_at is null and b.status='ACTIVA' and b.archived_at is null
  union all
  select a.company_id,a.id,a.title from talent.campaigns a
  join talent.companies b on b.id=a.company_id and not b.catalog_managed
  where a.company_id=p_company and a.archived_at is null and a.status in ('PUBLICADO','ACTIVA','EN_PROCESO')
   and b.status='ACTIVA' and b.archived_at is null
 ) c left join talent_org.capture_settings s on s.company_id=c.company_id and s.id=c.id
$$;
revoke all on function talent_private.capture_campaign_options(text) from public,anon,authenticated,service_role;

create or replace function public.talent_capture_catalog(p_hash text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare tenant text; company_name text;
begin
 select l.company_id,c.name into tenant,company_name
 from talent.capture_links l join talent.companies c on c.id=l.company_id
 where l.token_hash=p_hash and l.active and l.archived_at is null and c.status='ACTIVA' and c.archived_at is null;
 if tenant is null then raise insufficient_privilege; end if;
 return jsonb_build_object('companyName',company_name,'campaigns',
   (select coalesce(jsonb_agg(value-'version'),'[]'::jsonb) from jsonb_array_elements(talent_private.capture_campaign_options(tenant))));
end $$;

create function public.talent_org_capture_settings(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 return (select coalesce(jsonb_agg(v.value||jsonb_build_object('companyId',c.id,'companyName',c.name) order by c.name,v.value->>'name'),'[]'::jsonb)
 from talent.companies c cross join lateral jsonb_array_elements(talent_private.capture_campaign_options(c.id)) v
 where c.status='ACTIVA' and c.archived_at is null);
end $$;

create function public.talent_org_capture_settings_save(p_actor uuid,p_company text,p_id text,p_expected bigint,p_configuration jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare current_version bigint; result jsonb;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 -- Check membership of the campaign in the company's actual active catalog, not client input.
 if not exists(select 1 from jsonb_array_elements(talent_private.capture_campaign_options(p_company)) v where v->>'id'=p_id) then raise insufficient_privilege; end if;
 if p_configuration is null or jsonb_typeof(p_configuration)<>'object'
 or not(p_configuration ?& array['minAge','maxAge','workdays','schedules','modality'])
 or (p_configuration-array['minAge','maxAge','workdays','schedules','modality'])<>'{}'::jsonb
 or jsonb_typeof(p_configuration->'minAge')<>'number'
 or (p_configuration->>'minAge')!~'^[0-9]+$'
 or (p_configuration->>'minAge')::numeric not between 0 and 120
 or (p_configuration->'maxAge'<>'null'::jsonb and
   (jsonb_typeof(p_configuration->'maxAge')<>'number' or (p_configuration->>'maxAge')!~'^[0-9]+$'
    or (p_configuration->>'maxAge')::numeric not between (p_configuration->>'minAge')::numeric and 120))
 or jsonb_typeof(p_configuration->'workdays')<>'array'
 or jsonb_typeof(p_configuration->'schedules')<>'array'
 or jsonb_typeof(p_configuration->'modality')<>'string' or p_configuration->>'modality' not in ('Presencial','Remota')
 then raise exception 'TALENT_INVALID_CAPTURE_SETTINGS'; end if;
 if jsonb_array_length(p_configuration->'workdays') not between 1 and 3
 or exists(select 1 from jsonb_array_elements(p_configuration->'workdays') v where jsonb_typeof(v)<>'string' or v#>>'{}' not in ('Full time','Semi full','Part time'))
 or (select count(distinct v) from jsonb_array_elements(p_configuration->'workdays') v)<>jsonb_array_length(p_configuration->'workdays')
 or jsonb_array_length(p_configuration->'schedules') not between 1 and 20
 or exists(select 1 from jsonb_array_elements(p_configuration->'schedules') v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}')) not between 1 and 160)
 or (select count(distinct btrim(v#>>'{}')) from jsonb_array_elements(p_configuration->'schedules') v)<>jsonb_array_length(p_configuration->'schedules')
 then raise exception 'TALENT_INVALID_CAPTURE_SETTINGS'; end if;
 perform pg_advisory_xact_lock(hashtextextended('capture-settings:'||p_company||':'||p_id,0));
 select version into current_version from talent_org.capture_settings where company_id=p_company and id=p_id for update;
 if current_version is distinct from p_expected then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
 perform set_config('talent.org_actor',p_actor::text,true);
 insert into talent_org.capture_settings(company_id,id,configuration) values(p_company,p_id,p_configuration)
 on conflict(company_id,id) do update set configuration=excluded.configuration returning jsonb_build_object('version',version) into result;
 perform set_config('talent.org_actor','',true);
 return result;
end $$;
revoke all on function public.talent_org_capture_settings(uuid),public.talent_org_capture_settings_save(uuid,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.talent_org_capture_settings(uuid),public.talent_org_capture_settings_save(uuid,text,text,bigint,jsonb) to service_role;
commit;
