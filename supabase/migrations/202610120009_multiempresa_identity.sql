begin;
-- Reserva opaca sin datos personales; el enlace a la persona se confirma en su transacción.
create function public.talent_org_identity_reserve(p_actor uuid,p_company text,p_public_hash text,p_fingerprint text) returns text
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare actor talent.profiles;identity_id text;owner uuid;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'TALENT_INVALID_IDENTITY_FINGERPRINT'; end if;
 if p_actor is not null then
  actor:=talent_private.actor_profile(p_actor,p_company);
  if actor.role not in ('ADMIN','JEFE_SELECCION','ANALISTA_SELECCION','RECLUTADOR') then raise insufficient_privilege; end if;
 else
  select p.auth_user_id into owner from talent.capture_links l join talent.profiles p on p.id=l.owner_id and p.auth_user_id is not null
   where l.company_id=p_company and l.token_hash=p_public_hash and l.active and l.archived_at is null and talent_private.org_link_owner(l.company_id,l.owner_id,l.company_campaign_id);
  if owner is null then raise insufficient_privilege; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('identity:'||p_fingerprint,0));
 select id into identity_id from talent_org.identity_registry where fingerprint=p_fingerprint;
 if identity_id is null then
  perform set_config('talent.org_actor',coalesce(p_actor,owner)::text,true);
  insert into talent_org.identity_registry(fingerprint) values(p_fingerprint) returning id into identity_id;
  perform set_config('talent.org_actor','',true);
 end if;
 return identity_id;
end $$;
revoke all on function public.talent_org_identity_reserve(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.talent_org_identity_reserve(uuid,text,text,text) to service_role;
commit;
