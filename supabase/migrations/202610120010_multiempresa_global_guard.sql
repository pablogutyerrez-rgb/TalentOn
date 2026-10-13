begin;
create function public.talent_org_user_edit_guard(p_actor uuid,p_user uuid) returns void language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not talent_private.org_live_actor(p_actor) then raise insufficient_privilege; end if;
 if exists(select 1 from talent_org.global_admins where auth_user_id=p_user and enabled and archived_at is null) and not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
end $$;
revoke all on function public.talent_org_user_edit_guard(uuid,uuid) from public,anon,authenticated;
grant execute on function public.talent_org_user_edit_guard(uuid,uuid) to service_role;
create function talent_private.org_last_global_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare principal uuid;remove_access boolean;
begin
 principal:=new.auth_user_id;
 if principal is null then return new; end if;
 if tg_table_schema='talent' then
  if not exists(select 1 from talent_org.global_admins where auth_user_id=principal and enabled and archived_at is null) then return new; end if;
  if new.role<>'ADMIN' then raise exception 'TALENT_GLOBAL_ADMIN_ROLE_REQUIRED'; end if;
  remove_access:=not new.enabled or new.status<>'ACTIVO' or new.archived_at is not null;
 else remove_access:=not new.enabled or new.archived_at is not null; end if;
 if remove_access and not exists(select 1 from talent_org.global_admins g join talent.profiles p on p.auth_user_id=g.auth_user_id where g.auth_user_id<>principal and g.enabled and g.archived_at is null and p.enabled and p.status='ACTIVO' and not p.must_change_password and p.archived_at is null) then raise exception 'TALENT_LAST_GLOBAL_ADMIN_REQUIRED'; end if;
 return new;
end $$;
create trigger last_global_profile before update on talent.profiles for each row execute function talent_private.org_last_global_guard();
create trigger last_global_access before update on talent_org.global_admins for each row execute function talent_private.org_last_global_guard();
revoke all on function talent_private.org_last_global_guard() from public,anon,authenticated,service_role;
commit;
