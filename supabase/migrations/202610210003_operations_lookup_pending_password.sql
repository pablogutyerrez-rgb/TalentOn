begin;

-- A public RQ does not require login. Password rotation gates authenticated sessions,
-- not the active employee lookup; company membership and Turnstile still apply.
create or replace function public.talent_ops_public_lookup(p_hash text,p_dni text,p_ip text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare l talent_ops.links; p talent.profiles; n uuid;
begin
 select * into l from talent_ops.links where token_hash=p_hash and active and revoked_at is null;
 if not found then return null; end if;
 perform talent_ops.limit_attempt(l.id,p_ip);
 if p_dni !~ '^[0-9]{8}$' then return jsonb_build_object('found',false); end if;
 select * into p from talent.profiles where document_number=p_dni and status='ACTIVO' and enabled and archived_at is null and not is_context;
 if not found or not (p.company_id=l.company_id and not coalesce((p.annotations->>'companyAccessManaged')::boolean,false)) and not exists(select 1 from talent_org.user_companies m where m.auth_user_id=p.auth_user_id and m.company_id=l.company_id and m.enabled and m.archived_at is null) then return jsonb_build_object('found',false); end if;
 insert into talent_ops.lookups(link_id,auth_user_id,ip_hash) values(l.id,p.auth_user_id,p_ip) returning nonce into n;
 return jsonb_build_object('found',true,'name',p.display_name,'nonce',n);
end $$;

commit;
