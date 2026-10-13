begin;
-- Authorize form management without granting catalog, membership or company administration.
create function talent_private.capture_form_access(p_actor uuid,p_company text,p_id text) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare actor talent.profiles; managed boolean;
begin
 if not exists(select 1 from jsonb_array_elements(talent_private.capture_campaign_options(p_company)) v where v->>'id'=p_id) then return false; end if;
 if talent_private.org_global_admin(p_actor) then return true; end if;
 actor:=talent_private.actor_profile(p_actor,p_company);
 if actor.role not in ('RECLUTADOR','ANALISTA_SELECCION') or not exists(
  select 1 from talent.user_modules where company_id=p_company and user_id=actor.id and module='SELECCION' and archived_at is null
 ) then return false; end if;
 select catalog_managed into managed from talent.companies where id=p_company;
 if managed then return talent_private.org_campaign_access(p_actor,p_company,p_id); end if;
 return exists(select 1 from talent.campaign_assignments where company_id=p_company and user_id=actor.id and campaign_id=p_id and archived_at is null);
exception when insufficient_privilege then return false;
end $$;
revoke all on function talent_private.capture_form_access(uuid,text,text) from public,anon,authenticated,service_role;

create or replace function public.talent_org_capture_forms(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not talent_private.org_live_actor(p_actor) then raise insufficient_privilege; end if;
 return (select coalesce(jsonb_agg(v||jsonb_build_object('companyId',c.id,'companyName',c.name,
  'draft',f.draft,'published',f.published,'formVersion',f.version,'publishedRevision',f.published_revision)
  order by c.name,v->>'name'),'[]'::jsonb)
 from talent.companies c cross join lateral jsonb_array_elements(talent_private.capture_campaign_options(c.id)) v
 left join talent_org.capture_forms f on f.company_id=c.id and f.id=v->>'id'
 where talent_private.capture_form_access(p_actor,c.id,v->>'id'));
end $$;

-- Preserve validation, CAS, transactional publication and audit; change only authorization.
do $$ declare signature text;definition text;patched text;begin
 foreach signature in array array[
  'public.talent_org_capture_form_save(uuid,text,text,bigint,bigint,jsonb,boolean)',
  'public.talent_org_capture_settings_save(uuid,text,text,bigint,jsonb)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  patched:=replace(definition,
   'if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;',
   'if not talent_private.capture_form_access(p_actor,p_company,p_id) then raise insufficient_privilege; end if;');
  if definition=patched then raise exception 'TALENT_FORM_PERMISSION_PATCH_MISMATCH'; end if;
  execute patched;
 end loop;
end $$;
commit;
