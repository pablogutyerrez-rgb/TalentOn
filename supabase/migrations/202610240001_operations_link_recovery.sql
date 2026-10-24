begin;

-- Only the Worker can seal/unseal the bearer token. Never expose it through
-- the public RQ functions or store it in plaintext.
alter table talent_ops.links add column token_sealed text;
alter table talent_ops.links add constraint links_token_sealed_format
  check (token_sealed is null or token_sealed ~ '^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{32,}$');

create function public.talent_ops_link_create_v2(p_actor uuid,p_company text,p_hash text,p_sealed text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare l talent_ops.links;
begin
 if not talent_ops.permitted(p_actor,p_company,true) then raise insufficient_privilege; end if;
 if p_hash !~ '^[a-f0-9]{64}$' or p_sealed !~ '^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{32,}$'
    or not exists(select 1 from talent_ops.gerencias where company_id=p_company and active) then raise exception 'GERENCIA_REQUIRED'; end if;
 insert into talent_ops.links(company_id,token_hash,token_sealed,created_by)
 values(p_company,p_hash,p_sealed,p_actor) returning * into l;
 return jsonb_build_object('id',l.id,'companyId',l.company_id);
end $$;

do $$
declare def text; patched text;
begin
 def := pg_get_functiondef('public.talent_ops_admin(uuid)'::regprocedure);
 patched := replace(def, '''createdAt'',l.created_at)', '''createdAt'',l.created_at,''sealedToken'',l.token_sealed)');
 if patched = def then raise exception 'OPS_ADMIN_LINK_PATCH_MISMATCH'; end if;
 execute patched;
end $$;

revoke all on function public.talent_ops_link_create_v2(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.talent_ops_link_create_v2(uuid,text,text,text) to service_role;

commit;
