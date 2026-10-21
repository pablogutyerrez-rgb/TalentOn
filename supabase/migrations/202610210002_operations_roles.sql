begin;

insert into talent.roles(code) values ('JEFE_OPERACIONES'),('COORDINADOR_OPERACIONES') on conflict do nothing;
insert into talent.modules(code) values ('OPERACIONES') on conflict do nothing;
insert into talent.role_permissions(role,module,action) values
 ('JEFE_OPERACIONES','OPERACIONES','rq_manage'),
 ('COORDINADOR_OPERACIONES','OPERACIONES','rq_manage') on conflict do nothing;

alter table talent_org.user_companies drop constraint user_companies_role_check;
alter table talent_org.user_companies add constraint user_companies_role_check check(role in
 ('ADMIN','JEFE_SELECCION','ANALISTA_SELECCION','RECLUTADOR','JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR','JEFE_TALENTO','ANALISTA_TALENTO','JEFE_OPERACIONES','COORDINADOR_OPERACIONES','CALIDAD'));

-- Operations identities cannot receive a selection/analytics role in another company.
create function talent_ops.member_role_guard() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare home_role text;
begin
 select role into home_role from talent.profiles where auth_user_id=new.auth_user_id and not is_context;
 if (home_role in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES')) is distinct from
    (new.role in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES')) then raise exception 'OPERATIONS_ROLE_ONLY'; end if;
 if new.role in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES') and new.all_campaigns then raise exception 'OPERATIONS_CAMPAIGN_SCOPE_FORBIDDEN'; end if;
 return new;
end $$;
create trigger operations_member_role before insert or update on talent_org.user_companies for each row execute function talent_ops.member_role_guard();

do $$ declare def text;patched text;begin
 def:=pg_get_functiondef('talent_private.org_sync_member()'::regprocedure);
 patched:=replace(def,$old$when new.role='ADMIN' then array['SELECCION','FORMACION','TALENTO','ANALITICA','ADMINISTRACION']$old$, $new$when new.role='ADMIN' then array['SELECCION','FORMACION','TALENTO','ANALITICA','ADMINISTRACION','OPERACIONES']$new$);
 patched:=replace(patched,$old$when new.role in ('JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR') then array['FORMACION']$old$, $new$when new.role in ('JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR') then array['FORMACION'] when new.role in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES') then array['OPERACIONES']$new$);
 if patched=def or position($needle$array['OPERACIONES']$needle$ in patched)=0 then raise exception 'OPERATIONS_MODULE_PATCH_MISMATCH'; end if;
 execute patched;
 def:=pg_get_functiondef('public.talent_org_user_commit(uuid,text,bigint,jsonb,text[],text,jsonb)'::regprocedure);
 patched:=replace(def,$old$(g->>'enabled')::boolean and not (g->>'allCampaigns')::boolean and coalesce(jsonb_array_length(g->'scopes'),0)=0$old$, $new$(g->>'enabled')::boolean and (g->>'role') not in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES') and not (g->>'allCampaigns')::boolean and coalesce(jsonb_array_length(g->'scopes'),0)=0$new$);
 if patched=def then raise exception 'OPERATIONS_GRANT_PATCH_MISMATCH'; end if;
 execute patched;
 def:=pg_get_functiondef('public.talent_org_member_save(uuid,uuid,text,text,boolean,boolean,text[],bigint)'::regprocedure);
 patched:=replace(def,$old$if p_role='FORMADOR' and p_all then$old$, $new$if p_role in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES') and (p_all or cardinality(p_scopes)>0) then raise exception 'OPERATIONS_CAMPAIGN_SCOPE_FORBIDDEN'; end if; if p_role='FORMADOR' and p_all then$new$);
 if patched=def then raise exception 'OPERATIONS_SCOPE_PATCH_MISMATCH'; end if;
 execute patched;
end $$;

create or replace function talent_ops.permitted(p_actor uuid,p_company text,p_admin boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from talent.profiles p where p.auth_user_id=p_actor and p.enabled and p.status='ACTIVO' and p.archived_at is null and not p.must_change_password)
 and (talent_private.org_global_admin(p_actor) or exists(
  select 1 from talent_org.user_companies m join talent.profiles p on p.auth_user_id=m.auth_user_id and not p.is_context
  where m.auth_user_id=p_actor and m.company_id=p_company and m.enabled and m.archived_at is null
   and (case when p_admin then m.role in ('ADMIN','JEFE_OPERACIONES','COORDINADOR_OPERACIONES')
             else m.role in ('ADMIN','JEFE_SELECCION','ANALISTA_SELECCION') end)
   and (m.role not in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES') or exists(
      select 1 from talent.user_modules um where um.company_id=m.company_id and um.user_id=p.id and um.module='OPERACIONES' and um.archived_at is null))
 ) or exists(select 1 from talent.profiles p where p.auth_user_id=p_actor and p.company_id=p_company and p.enabled and p.status='ACTIVO' and p.archived_at is null
  and (case when p_admin then p.role in ('ADMIN','JEFE_OPERACIONES','COORDINADOR_OPERACIONES') else p.role in ('ADMIN','JEFE_SELECCION','ANALISTA_SELECCION') end)
  and not coalesce((p.annotations->>'companyAccessManaged')::boolean,false)
  and (p.role not in ('JEFE_OPERACIONES','COORDINADOR_OPERACIONES') or exists(
      select 1 from talent.user_modules um where um.company_id=p.company_id and um.user_id=p.id and um.module='OPERACIONES' and um.archived_at is null))));
$$;

create or replace function public.talent_ops_admin(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from talent.companies c where c.catalog_managed and c.archived_at is null and talent_ops.permitted(p_actor,c.id,true)) then raise insufficient_privilege; end if;
 return jsonb_build_object(
  'companies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from talent.companies c where c.catalog_managed and c.archived_at is null and talent_ops.permitted(p_actor,c.id,true)),'[]'::jsonb),
  'gerencias',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'companyId',g.company_id,'name',g.name,'active',g.active) order by g.name) from talent_ops.gerencias g where talent_ops.permitted(p_actor,g.company_id,true)),'[]'::jsonb),
  'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'companyId',l.company_id,'active',l.active,'createdAt',l.created_at) order by l.created_at desc) from talent_ops.links l where talent_ops.permitted(p_actor,l.company_id,true)),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'companyId',r.company_id,'companyName',c.name,'gerencia',g.name,'requesterName',p.display_name,
   'kind',r.kind,'companyCampaignId',r.company_campaign_id,'campaignName',gc.name,'profileRequired',r.profile_required,'fts',r.fts,'salary',r.salary,'expectedStart',r.expected_start,
   'criticality',r.criticality,'schedule',r.schedule,'location',r.location,'observations',r.observations,'status',r.status,'campaignId',r.campaign_id,'createdAt',r.created_at) order by r.created_at desc)
   from talent_ops.requests r join talent.companies c on c.id=r.company_id join talent_ops.gerencias g on g.id=r.gerencia_id join talent.profiles p on p.auth_user_id=r.requester_auth_id and not p.is_context
   left join talent_org.company_campaigns cc on cc.company_id=r.company_id and cc.id=r.company_campaign_id left join talent_org.global_campaigns gc on gc.id=cc.global_campaign_id
   where talent_ops.permitted(p_actor,r.company_id,true)),'[]'::jsonb)
 );
end $$;

commit;
