begin;
-- Resolve ownership only. Existing operation-specific RBAC remains mandatory.
create function public.talent_org_record_company(p_actor uuid,p_kind text,p_id text,p_company text default null) returns text
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare item record; result text; profile talent.profiles;
begin
 if not talent_private.org_live_actor(p_actor) then raise insufficient_privilege; end if;
 for item in
  select company_id from talent.campaigns where p_kind='campaign' and id=p_id and archived_at is null
  union select company_id from talent.persons where p_kind='candidate' and id=p_id and archived_at is null
  union select company_id from talent.training_groups where p_kind='training' and id=p_id and archived_at is null
  union select company_id from talent.applications where p_kind='application' and id=p_id and archived_at is null
  union select company_id from talent.captures where p_kind='capture' and id=p_id and archived_at is null
  union select company_id from talent.capture_links where p_kind='link' and (id=p_id or annotations->>'publicToken'=p_id) and archived_at is null
 loop
  if p_company is not null and item.company_id<>p_company then continue; end if;
  begin profile:=talent_private.actor_profile(p_actor,item.company_id);
  exception when insufficient_privilege then continue; end;
  if result is not null and result<>item.company_id then raise sqlstate 'PT409' using message='COMPANY_CONTEXT_AMBIGUOUS'; end if;
  result:=item.company_id;
 end loop;
 if result is null then raise insufficient_privilege; end if;
 return result;
end $$;
revoke all on function public.talent_org_record_company(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.talent_org_record_company(uuid,text,text,text) to service_role;
commit;
