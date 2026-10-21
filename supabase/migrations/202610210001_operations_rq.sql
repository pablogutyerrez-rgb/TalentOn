begin;

-- Existing accounts remain valid; administrators must complete their DNI before public RQ use.
alter table talent.profiles add column document_number text;
alter table talent.profiles add constraint profile_dni_format check (document_number is null or document_number ~ '^[0-9]{8}$');
create unique index profile_dni_unique on talent.profiles(document_number) where document_number is not null and archived_at is null and not is_context;

create schema talent_ops;
revoke all on schema talent_ops from public, anon, authenticated;
create table talent_ops.gerencias (
 id uuid primary key default gen_random_uuid(), company_id text not null references talent.companies(id), name text not null check(length(btrim(name)) between 2 and 100), active boolean not null default true,
 created_at timestamptz not null default now(), unique(company_id,name), unique(company_id,id)
);
create table talent_ops.links (
 id uuid primary key default gen_random_uuid(), company_id text not null references talent.companies(id), token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'), active boolean not null default true,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), revoked_at timestamptz
);
create table talent_ops.lookups (
 nonce uuid primary key default gen_random_uuid(), link_id uuid not null references talent_ops.links(id), auth_user_id uuid not null references auth.users(id), ip_hash text not null,
 expires_at timestamptz not null default (now()+interval '15 minutes'), used_at timestamptz
);
create table talent_ops.attempts (
 link_id uuid not null references talent_ops.links(id), ip_hash text not null, window_start timestamptz not null, attempts integer not null default 0, primary key(link_id,ip_hash)
);
create table talent_ops.requests (
 id uuid primary key default gen_random_uuid(), company_id text not null references talent.companies(id), gerencia_id uuid not null, requester_auth_id uuid not null references auth.users(id), lookup_nonce uuid not null unique references talent_ops.lookups(nonce),
 kind text not null check(kind in ('MASIVA','STAFF')), company_campaign_id text, profile_required text not null check(length(btrim(profile_required)) between 2 and 200),
 fts integer not null check(fts between 1 and 10000), salary numeric(12,2) not null check(salary>=0), expected_start date not null,
 criticality text not null check(criticality in ('BAJA','MEDIA','ALTA','CRITICA')), schedule text not null check(length(btrim(schedule)) between 2 and 200),
 location text not null check(length(btrim(location)) between 2 and 200), observations text not null default '' check(length(observations)<=2000),
 status text not null default 'PENDIENTE' check(status in ('PENDIENTE','CONVOCATORIA_CREADA')), campaign_id text, created_at timestamptz not null default now(), linked_at timestamptz,
 foreign key(company_id,gerencia_id) references talent_ops.gerencias(company_id,id),
 foreign key(company_id,company_campaign_id) references talent_org.company_campaigns(company_id,id),
 foreign key(company_id,campaign_id) references talent.campaigns(company_id,id),
 check((kind='STAFF' and company_campaign_id is null) or (kind='MASIVA' and company_campaign_id is not null)),
 check((status='PENDIENTE' and campaign_id is null) or (status='CONVOCATORIA_CREADA' and campaign_id is not null))
);
create index ops_requests_pending on talent_ops.requests(company_id,created_at desc) where status='PENDIENTE';
create index ops_lookups_expiry on talent_ops.lookups(expires_at);

-- Staff uses the existing convocatoria/catalog flow; the public requester does not select a campaign.
insert into talent_org.global_campaigns(id,name) values('staff-rq','Staff') on conflict do nothing;
insert into talent_org.company_campaigns(company_id,id,global_campaign_id)
 select id,id||':staff-rq','staff-rq' from talent.companies where catalog_managed and archived_at is null
 on conflict do nothing;
create function talent_ops.ensure_staff_catalog() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.catalog_managed and new.archived_at is null then
  insert into talent_org.company_campaigns(company_id,id,global_campaign_id) values(new.id,new.id||':staff-rq','staff-rq') on conflict do nothing;
 end if;
 return new;
end $$;
create trigger ops_staff_catalog after insert or update of catalog_managed on talent.companies for each row execute function talent_ops.ensure_staff_catalog();

alter table talent_ops.gerencias enable row level security;
alter table talent_ops.links enable row level security;
alter table talent_ops.lookups enable row level security;
alter table talent_ops.attempts enable row level security;
alter table talent_ops.requests enable row level security;

create function talent_ops.permitted(p_actor uuid,p_company text,p_admin boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from talent.profiles p where p.auth_user_id=p_actor and p.enabled and p.status='ACTIVO' and p.archived_at is null and not p.must_change_password)
 and (talent_private.org_global_admin(p_actor) or exists(
  select 1 from talent_org.user_companies m where m.auth_user_id=p_actor and m.company_id=p_company and m.enabled and m.archived_at is null
   and m.role=any(case when p_admin then array['ADMIN'] else array['ADMIN','JEFE_SELECCION','ANALISTA_SELECCION'] end)
 ) or exists(select 1 from talent.profiles p where p.auth_user_id=p_actor and p.company_id=p_company and p.enabled and p.status='ACTIVO' and p.archived_at is null and p.role=any(case when p_admin then array['ADMIN'] else array['ADMIN','JEFE_SELECCION','ANALISTA_SELECCION'] end) and not coalesce((p.annotations->>'companyAccessManaged')::boolean,false)));
$$;

create function public.talent_ops_admin(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from talent.companies c where c.catalog_managed and c.archived_at is null and talent_ops.permitted(p_actor,c.id,true)) then raise insufficient_privilege; end if;
 return jsonb_build_object(
  'companies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from talent.companies c where c.catalog_managed and c.archived_at is null and talent_ops.permitted(p_actor,c.id,true)),'[]'::jsonb),
  'gerencias',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'companyId',g.company_id,'name',g.name,'active',g.active) order by g.name) from talent_ops.gerencias g where talent_ops.permitted(p_actor,g.company_id,true)),'[]'::jsonb),
  'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'companyId',l.company_id,'active',l.active,'createdAt',l.created_at) order by l.created_at desc) from talent_ops.links l where talent_ops.permitted(p_actor,l.company_id,true)),'[]'::jsonb)
 );
end $$;

create function public.talent_ops_gerencia_save(p_actor uuid,p_company text,p_name text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare g talent_ops.gerencias;
begin
 if not talent_ops.permitted(p_actor,p_company,true) then raise insufficient_privilege; end if;
 if length(btrim(p_name)) not between 2 and 100 then raise exception 'INVALID_GERENCIA'; end if;
 insert into talent_ops.gerencias(company_id,name) values(p_company,btrim(p_name)) on conflict(company_id,name) do update set active=true returning * into g;
 return jsonb_build_object('id',g.id,'companyId',g.company_id,'name',g.name);
end $$;

create function public.talent_ops_link_create(p_actor uuid,p_company text,p_hash text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare l talent_ops.links;
begin
 if not talent_ops.permitted(p_actor,p_company,true) then raise insufficient_privilege; end if;
 if p_hash !~ '^[a-f0-9]{64}$' or not exists(select 1 from talent_ops.gerencias where company_id=p_company and active) then raise exception 'GERENCIA_REQUIRED'; end if;
 insert into talent_ops.links(company_id,token_hash,created_by) values(p_company,p_hash,p_actor) returning * into l;
 return jsonb_build_object('id',l.id,'companyId',l.company_id);
end $$;

create function public.talent_ops_link_revoke(p_actor uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare l talent_ops.links;
begin
 select * into l from talent_ops.links where id=p_id for update;
 if not found then raise exception 'LINK_NOT_FOUND'; end if;
 if not talent_ops.permitted(p_actor,l.company_id,true) then raise insufficient_privilege; end if;
 update talent_ops.links set active=false,revoked_at=coalesce(revoked_at,now()) where id=p_id;
 return jsonb_build_object('ok',true);
end $$;

create function public.talent_ops_public_config(p_hash text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare l talent_ops.links;
begin
 select link_row.* into l from talent_ops.links link_row join talent.companies c on c.id=link_row.company_id where link_row.token_hash=p_hash and link_row.active and link_row.revoked_at is null and c.status='ACTIVA' and c.archived_at is null;
 if not found then return null; end if;
 return jsonb_build_object('companyId',l.company_id,'companyName',(select name from talent.companies where id=l.company_id),
  'gerencias',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name) from talent_ops.gerencias g where g.company_id=l.company_id and g.active),'[]'::jsonb),
  'campaigns',coalesce((select jsonb_agg(jsonb_build_object('id',cc.id,'name',gc.name) order by gc.name) from talent_org.company_campaigns cc join talent_org.global_campaigns gc on gc.id=cc.global_campaign_id where cc.company_id=l.company_id and cc.status='ACTIVA' and cc.archived_at is null and gc.status='ACTIVA' and gc.archived_at is null),'[]'::jsonb));
end $$;

create function talent_ops.limit_attempt(p_link uuid,p_ip text) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare n integer;
begin
 insert into talent_ops.attempts(link_id,ip_hash,window_start,attempts) values(p_link,p_ip,now(),1)
 on conflict(link_id,ip_hash) do update set attempts=case when talent_ops.attempts.window_start<now()-interval '1 hour' then 1 else talent_ops.attempts.attempts+1 end,
 window_start=case when talent_ops.attempts.window_start<now()-interval '1 hour' then now() else talent_ops.attempts.window_start end returning attempts into n;
 if n>20 then raise exception 'RATE_LIMITED'; end if;
 insert into talent_ops.attempts(link_id,ip_hash,window_start,attempts) values(p_link,'*',now(),1)
 on conflict(link_id,ip_hash) do update set attempts=case when talent_ops.attempts.window_start<now()-interval '1 hour' then 1 else talent_ops.attempts.attempts+1 end,
 window_start=case when talent_ops.attempts.window_start<now()-interval '1 hour' then now() else talent_ops.attempts.window_start end returning attempts into n;
 if n>200 then raise exception 'RATE_LIMITED'; end if;
end $$;

create function public.talent_ops_public_lookup(p_hash text,p_dni text,p_ip text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare l talent_ops.links; p talent.profiles; n uuid;
begin
 select * into l from talent_ops.links where token_hash=p_hash and active and revoked_at is null;
 if not found then return null; end if;
 perform talent_ops.limit_attempt(l.id,p_ip);
 if p_dni !~ '^[0-9]{8}$' then return jsonb_build_object('found',false); end if;
 select * into p from talent.profiles where document_number=p_dni and status='ACTIVO' and enabled and archived_at is null and not is_context and not must_change_password;
 if not found or not (p.company_id=l.company_id and not coalesce((p.annotations->>'companyAccessManaged')::boolean,false)) and not exists(select 1 from talent_org.user_companies m where m.auth_user_id=p.auth_user_id and m.company_id=l.company_id and m.enabled and m.archived_at is null) then return jsonb_build_object('found',false); end if;
 insert into talent_ops.lookups(link_id,auth_user_id,ip_hash) values(l.id,p.auth_user_id,p_ip) returning nonce into n;
 return jsonb_build_object('found',true,'name',p.display_name,'nonce',n);
end $$;

create function public.talent_ops_public_submit(p_hash text,p_nonce uuid,p_ip text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare l talent_ops.links; n talent_ops.lookups; g uuid; cc text; k text; created uuid;
begin
 select * into l from talent_ops.links where token_hash=p_hash and active and revoked_at is null for share;
 if not found then raise exception 'LINK_NOT_FOUND'; end if;
 perform talent_ops.limit_attempt(l.id,p_ip);
 select * into n from talent_ops.lookups where nonce=p_nonce and link_id=l.id and ip_hash=p_ip for update;
 if not found then raise exception 'LOOKUP_EXPIRED'; end if;
 if n.used_at is not null then return (select jsonb_build_object('id',id,'ok',true) from talent_ops.requests where lookup_nonce=p_nonce); end if;
 if n.expires_at<=now() then raise exception 'LOOKUP_EXPIRED'; end if;
 g:=nullif(p_data->>'gerenciaId','')::uuid; k:=p_data->>'kind'; cc:=nullif(p_data->>'companyCampaignId','');
 if not exists(select 1 from talent_ops.gerencias where id=g and company_id=l.company_id and active) then raise exception 'INVALID_GERENCIA'; end if;
 if k not in ('MASIVA','STAFF') or (k='STAFF' and cc is not null) or (k='MASIVA' and not exists(select 1 from talent_org.company_campaigns x where x.company_id=l.company_id and x.id=cc and x.status='ACTIVA' and x.archived_at is null)) then raise exception 'INVALID_CAMPAIGN'; end if;
 if not exists(select 1 from talent.profiles p where p.auth_user_id=n.auth_user_id and p.enabled and p.status='ACTIVO' and p.archived_at is null and p.document_number=p_data->>'dni' and
  ((p.company_id=l.company_id and not coalesce((p.annotations->>'companyAccessManaged')::boolean,false)) or exists(select 1 from talent_org.user_companies m where m.auth_user_id=p.auth_user_id and m.company_id=l.company_id and m.enabled and m.archived_at is null))) then raise exception 'INVALID_REQUESTER'; end if;
 insert into talent_ops.requests(company_id,gerencia_id,requester_auth_id,lookup_nonce,kind,company_campaign_id,profile_required,fts,salary,expected_start,criticality,schedule,location,observations)
 values(l.company_id,g,n.auth_user_id,p_nonce,k,cc,btrim(p_data->>'profileRequired'),(p_data->>'fts')::integer,(p_data->>'salary')::numeric,(p_data->>'expectedStart')::date,p_data->>'criticality',btrim(p_data->>'schedule'),btrim(p_data->>'location'),coalesce(p_data->>'observations','')) returning id into created;
 update talent_ops.lookups set used_at=now() where nonce=p_nonce;
 return jsonb_build_object('id',created,'ok',true);
end $$;

create function public.talent_ops_selection(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from talent.companies c where c.catalog_managed and c.archived_at is null and talent_ops.permitted(p_actor,c.id,false)) then raise insufficient_privilege; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'companyId',r.company_id,'companyName',c.name,'gerencia',g.name,'requesterName',p.display_name,
  'kind',r.kind,'companyCampaignId',r.company_campaign_id,'campaignName',gc.name,'profileRequired',r.profile_required,'fts',r.fts,'salary',r.salary,'expectedStart',r.expected_start,
  'criticality',r.criticality,'schedule',r.schedule,'location',r.location,'observations',r.observations,'status',r.status,'campaignId',r.campaign_id,'createdAt',r.created_at) order by r.created_at desc)
 from talent_ops.requests r join talent.companies c on c.id=r.company_id join talent_ops.gerencias g on g.id=r.gerencia_id join talent.profiles p on p.auth_user_id=r.requester_auth_id and not p.is_context
 left join talent_org.company_campaigns cc on cc.company_id=r.company_id and cc.id=r.company_campaign_id left join talent_org.global_campaigns gc on gc.id=cc.global_campaign_id
 where talent_ops.permitted(p_actor,r.company_id,false)),'[]'::jsonb);
end $$;

create function public.talent_ops_request_link(p_actor uuid,p_id uuid,p_company text,p_campaign text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r talent_ops.requests;
begin
 if not talent_ops.permitted(p_actor,p_company,false) then raise insufficient_privilege; end if;
 select * into r from talent_ops.requests where id=p_id and company_id=p_company for update;
 if not found then raise exception 'RQ_NOT_FOUND'; end if;
 if r.campaign_id=p_campaign then return jsonb_build_object('ok',true); end if;
 if r.campaign_id is not null then raise exception 'RQ_ALREADY_LINKED'; end if;
 if not exists(select 1 from talent.campaigns where company_id=p_company and id=p_campaign and archived_at is null) then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
 update talent_ops.requests set campaign_id=p_campaign,status='CONVOCATORIA_CREADA',linked_at=now() where id=p_id;
 return jsonb_build_object('ok',true);
end $$;

-- The existing campaign commit and its RQ link succeed or fail in the same transaction.
create function talent_ops.link_on_campaign_insert() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare rq uuid; r talent_ops.requests;
begin
 if not (new.annotations ? 'sourceRqId') then return new; end if;
 rq:=(new.annotations->>'sourceRqId')::uuid;
 select * into r from talent_ops.requests where id=rq and company_id=new.company_id for update;
 if not found or r.campaign_id is not null then raise exception 'RQ_ALREADY_LINKED'; end if;
 update talent_ops.requests set campaign_id=new.id,status='CONVOCATORIA_CREADA',linked_at=now() where id=rq;
 return new;
end $$;
create trigger ops_campaign_link after insert on talent.campaigns for each row execute function talent_ops.link_on_campaign_insert();

create or replace function public.talent_org_users(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'authUserId',p.auth_user_id,'companyId',p.company_id,'email',p.username,'name',p.display_name,'dni',p.document_number,'role',p.role,'status',p.status,'avatarUrl',p.avatar_url,'nickname',p.nickname,'tagline',p.tagline,'phone',p.phone,'jobTitle',p.job_title,
 'allowedModules',coalesce((select jsonb_agg(module) from talent.user_modules where company_id=p.company_id and user_id=p.id and archived_at is null),'[]'),
 'scopeCampaignIds',coalesce((select jsonb_agg(campaign_id) from talent.campaign_assignments where company_id=p.company_id and user_id=p.id and assignment_kind='SCOPE' and archived_at is null),'[]'),
 'subordinateUserIds',coalesce((select jsonb_agg(subordinate_id) from talent.supervision where company_id=p.company_id and supervisor_id=p.id and archived_at is null),'[]'))) from talent.profiles p where not p.is_context and p.archived_at is null),'[]');
end $$;

revoke all on function public.talent_ops_admin(uuid),public.talent_ops_gerencia_save(uuid,text,text),public.talent_ops_link_create(uuid,text,text),public.talent_ops_link_revoke(uuid,uuid),public.talent_ops_public_config(text),public.talent_ops_public_lookup(text,text,text),public.talent_ops_public_submit(text,uuid,text,jsonb),public.talent_ops_selection(uuid),public.talent_ops_request_link(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.talent_ops_admin(uuid),public.talent_ops_gerencia_save(uuid,text,text),public.talent_ops_link_create(uuid,text,text),public.talent_ops_link_revoke(uuid,uuid),public.talent_ops_public_config(text),public.talent_ops_public_lookup(text,text,text),public.talent_ops_public_submit(text,uuid,text,jsonb),public.talent_ops_selection(uuid),public.talent_ops_request_link(uuid,uuid,text,text) to service_role;
commit;
