begin;
create table talent_org.capture_forms(
 company_id text not null references talent.companies(id),id text not null,
 draft jsonb not null,published jsonb,published_revision bigint,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(company_id,id),
 check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=131072),
 check(published is null or jsonb_typeof(published)='object'));
alter table talent_org.capture_forms enable row level security;
revoke all on talent_org.capture_forms from public,anon,authenticated,service_role;
create trigger org_guard before update or delete on talent_org.capture_forms for each row execute function talent_private.org_guard();
create trigger org_audit after insert or update on talent_org.capture_forms for each row execute function talent_private.org_audit();
create function public.talent_org_capture_forms(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 return (select coalesce(jsonb_agg(v||jsonb_build_object('draft',f.draft,'published',f.published,'formVersion',f.version,'publishedRevision',f.published_revision)),'[]'::jsonb)
 from jsonb_array_elements(public.talent_org_capture_settings(p_actor)) v
 left join talent_org.capture_forms f on f.company_id=v->>'companyId' and f.id=v->>'id');
end $$;
create function public.talent_org_capture_form_save(p_actor uuid,p_company text,p_id text,p_expected bigint,p_settings_expected bigint,p_bundle jsonb,p_publish boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare current_version bigint; result jsonb; settings_result jsonb;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 if not exists(select 1 from jsonb_array_elements(talent_private.capture_campaign_options(p_company)) v where v->>'id'=p_id) then raise insufficient_privilege; end if;
 if p_bundle is null or jsonb_typeof(p_bundle)<>'object' or octet_length(p_bundle::text)>131072
 or jsonb_typeof(p_bundle->'form') is distinct from 'object'
 or jsonb_typeof(p_bundle->'form'->'questions') is distinct from 'array'
 or jsonb_typeof(p_bundle->'configuration') is distinct from 'object'
 or p_publish is null then raise exception 'TALENT_INVALID_FORM'; end if;
 if jsonb_array_length(p_bundle->'form'->'questions') not between 1 and 60 then raise exception 'TALENT_INVALID_FORM'; end if;
 perform pg_advisory_xact_lock(hashtextextended('capture-form:'||p_company||':'||p_id,0));
 select version into current_version from talent_org.capture_forms where company_id=p_company and id=p_id for update;
 if current_version is distinct from p_expected then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
 if p_publish then
  settings_result=public.talent_org_capture_settings_save(p_actor,p_company,p_id,p_settings_expected,p_bundle->'configuration');
 end if;
 perform set_config('talent.org_actor',p_actor::text,true);
 insert into talent_org.capture_forms(company_id,id,draft,published,published_revision)
 values(p_company,p_id,p_bundle,case when p_publish then p_bundle else null end,case when p_publish then 1 else null end)
 on conflict(company_id,id) do update set draft=excluded.draft,
 published=case when p_publish then excluded.draft else capture_forms.published end,
 published_revision=case when p_publish then capture_forms.version+1 else capture_forms.published_revision end
 returning jsonb_build_object('formVersion',version,'publishedRevision',published_revision,'draft',draft,'published',published,
 'settingsVersion',settings_result->'version') into result;
 perform set_config('talent.org_actor','',true);return result;
end $$;
create or replace function public.talent_capture_catalog(p_hash text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare tenant text; company_name text;
begin
 select l.company_id,c.name into tenant,company_name from talent.capture_links l join talent.companies c on c.id=l.company_id
 where l.token_hash=p_hash and l.active and l.archived_at is null and c.status='ACTIVA' and c.archived_at is null;
 if tenant is null then raise insufficient_privilege; end if;
 return jsonb_build_object('companyName',company_name,'campaigns',
 (select coalesce(jsonb_agg((v-'version')||jsonb_build_object('form',f.published->'form','formRevision',f.published_revision)
 ||case when f.published is not null then jsonb_build_object('configuration',f.published->'configuration') else '{}'::jsonb end),'[]'::jsonb)
 from jsonb_array_elements(talent_private.capture_campaign_options(tenant)) v
 left join talent_org.capture_forms f on f.company_id=tenant and f.id=v->>'id'));
end $$;
revoke all on function public.talent_org_capture_forms(uuid),public.talent_org_capture_form_save(uuid,text,text,bigint,bigint,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.talent_org_capture_forms(uuid),public.talent_org_capture_form_save(uuid,text,text,bigint,bigint,jsonb,boolean) to service_role;
commit;
