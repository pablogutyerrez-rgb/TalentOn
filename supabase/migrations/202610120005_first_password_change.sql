begin;
alter table talent.profiles add column must_change_password boolean not null default false;
alter table talent.profiles add column password_changed_at timestamptz;
-- El bloqueo es del perfil servidor, no user_metadata editable desde el navegador.
create or replace function talent_private.actor_profile(p_auth uuid,p_company text) returns talent.profiles
language plpgsql security definer set search_path=pg_catalog,talent as $$
declare actor talent.profiles;
begin
 select * into actor from talent.profiles where auth_user_id=p_auth and company_id=p_company and status='ACTIVO' and enabled and archived_at is null;
 if not found then raise insufficient_privilege using message='TALENT_ACTOR_FORBIDDEN'; end if;
 if actor.must_change_password then raise insufficient_privilege using message='PASSWORD_CHANGE_REQUIRED'; end if;
 return actor;
end $$;
-- Solo servidor después de verificar el token. Permite cargar exclusivamente su perfil
-- durante el bloqueo; nunca listas de datos o usuarios.
create function public.talent_session_profile(p_auth uuid) returns jsonb
language sql security definer set search_path=pg_catalog,talent as $$
 select jsonb_build_object('id',p.id,'authUserId',p.auth_user_id,'companyId',p.company_id,
 'username',p.username,'name',p.display_name,'role',p.role,'nickname',p.nickname,'tagline',p.tagline,
 'status',p.status,'mustChangePassword',p.must_change_password,'version',p.version,
 'allowedModules',coalesce((select jsonb_agg(m.module order by m.module) from talent.user_modules m where m.company_id=p.company_id and m.user_id=p.id and m.archived_at is null),'[]'::jsonb))
 from talent.profiles p where auth_user_id=p_auth and status='ACTIVO' and enabled and archived_at is null;
$$;
-- Solo después de éxito confirmado de cambio de contraseña en Auth, desde servidor.
create function public.talent_password_change_complete(p_auth uuid,p_expected bigint) returns bigint
language plpgsql security definer set search_path=pg_catalog,talent as $$
declare p talent.profiles; revision bigint;
begin
 select * into p from talent.profiles where auth_user_id=p_auth and status='ACTIVO' and enabled and archived_at is null for update;
 if not found then raise insufficient_privilege; end if;
 if p_expected is null or p.version<>p_expected then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
 perform set_config('talent.actor_id',p.id,true);
 update talent.profiles set must_change_password=false,password_changed_at=clock_timestamp() where company_id=p.company_id and id=p.id returning version into revision;
 perform set_config('talent.actor_id','',true);
 return revision;
end $$;
revoke all on function public.talent_session_profile(uuid),public.talent_password_change_complete(uuid,bigint) from public,anon,authenticated;
grant execute on function public.talent_session_profile(uuid),public.talent_password_change_complete(uuid,bigint) to service_role;
revoke all on function talent_private.actor_profile(uuid,text) from public,anon,authenticated,service_role;
commit;
