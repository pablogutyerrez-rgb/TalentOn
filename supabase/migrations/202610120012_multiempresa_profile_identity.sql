begin;
-- Una identidad contextual jamás puede sobreescribir otro perfil con el mismo ID.
create function talent_private.org_context_identity_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare canonical talent.profiles;
begin
 select * into canonical from talent.profiles where auth_user_id=new.auth_user_id;
 if exists(select 1 from talent.profiles p where p.id=canonical.id
   and p.auth_user_id is not null and p.auth_user_id<>new.auth_user_id) then
   raise exception 'TALENT_PROFILE_ID_COLLISION';
 end if;
 return new;
end $$;
create trigger guard_context_identity before insert or update on talent_org.user_companies
 for each row execute function talent_private.org_context_identity_guard();
revoke all on function talent_private.org_context_identity_guard() from public,anon,authenticated,service_role;
-- Fallar cerrado si existen IDs canónicos ambiguos; jamás mezclar PII de dos empresas.
do $$ declare def text;replacement text;begin
 def:=pg_get_functiondef('public.talent_org_snapshot(uuid,text)'::regprocedure);
 replacement:=replace(def,
  'h.id=p->>''id'' and h.auth_user_id is not null left join',
  'h.id=p->>''id'' and h.auth_user_id is not null and ((not (p->>''is_context'')::boolean and h.company_id=p_company) or ((p->>''is_context'')::boolean and exists(select 1 from talent_org.user_companies member where member.company_id=p_company and member.auth_user_id=h.auth_user_id) and not exists(select 1 from talent.profiles other where other.id=h.id and other.auth_user_id is not null and other.auth_user_id<>h.auth_user_id))) left join');
 if replacement=def then raise exception 'TALENT_SNAPSHOT_PATCH_MISMATCH'; end if;
 execute replacement;
end $$;
commit;
