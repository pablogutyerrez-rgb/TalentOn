begin;
-- Contextos operativos por empresa: misma identidad Auth, sin duplicar cuentas.
alter table talent.profiles add column is_context boolean not null default false;
alter table talent.profiles alter column auth_user_id drop not null;
alter table talent.profiles drop constraint profiles_username_key;
create unique index profiles_canonical_username on talent.profiles(username) where not is_context;
alter table talent.profiles add constraint profile_context_identity check((is_context and auth_user_id is null) or (not is_context and auth_user_id is not null));

create function talent_private.org_sync_member() returns trigger language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare canonical talent.profiles;mods text[];
begin
 select * into canonical from talent.profiles where auth_user_id=new.auth_user_id and not is_context;
 if not found then raise insufficient_privilege; end if;
 if not exists(select 1 from talent.roles where code=new.role) then raise exception 'TALENT_ROLE_NOT_IMPLEMENTED'; end if;
 if canonical.company_id=new.company_id and nullif(current_setting('talent.org_actor',true),'') is not null then
  update talent.profiles set role=new.role where company_id=new.company_id and id=canonical.id and role<>new.role;
 end if;
 if canonical.company_id<>new.company_id then
  insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,enabled,must_change_password,is_context)
  values(new.company_id,canonical.id,null,canonical.username,canonical.display_name,new.role,case when new.enabled then 'ACTIVO' else 'INACTIVO' end,new.enabled,false,true)
  on conflict(company_id,id) do update set role=excluded.role,status=excluded.status,enabled=excluded.enabled;
 end if;
 mods:=case when new.role='ADMIN' then array['SELECCION','FORMACION','TALENTO','ANALITICA','ADMINISTRACION']
  when new.role in ('JEFE_SELECCION','ANALISTA_SELECCION','RECLUTADOR') then array['SELECCION']
  when new.role in ('JEFE_FORMACION','COORDINADOR_FORMACION','FORMADOR') then array['FORMACION'] else array['TALENTO'] end;
 if canonical.company_id<>new.company_id or nullif(current_setting('talent.org_actor',true),'') is not null then
  update talent.user_modules set archived_at=clock_timestamp() where company_id=new.company_id and user_id=canonical.id and not(module=any(mods)) and archived_at is null;
  insert into talent.user_modules(company_id,id,user_id,module)
   select new.company_id,canonical.id||':module:'||m,canonical.id,m from unnest(mods) m
   on conflict(company_id,user_id,module) do update set archived_at=null;
 end if;return new;
end $$;
create trigger sync_member after insert or update on talent_org.user_companies for each row execute function talent_private.org_sync_member();
create function talent_private.org_new_profile() returns trigger language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not new.is_context and exists(select 1 from talent.companies where id=new.company_id and catalog_managed) then
  insert into talent_org.user_companies(company_id,id,auth_user_id,role,enabled) values(new.company_id,new.id||':membership',new.auth_user_id,new.role,new.enabled);
 end if;return new;
end $$;
create trigger new_profile_membership after insert on talent.profiles for each row execute function talent_private.org_new_profile();
create function talent_private.org_profile_sync() returns trigger language plpgsql security definer set search_path=pg_catalog,talent_org as $$
begin
 if not new.is_context and nullif(current_setting('talent.org_actor',true),'') is null and (new.role is distinct from old.role or new.enabled is distinct from old.enabled or new.status is distinct from old.status) then
  update talent_org.user_companies set role=new.role,enabled=new.enabled and new.status='ACTIVO' where company_id=new.company_id and auth_user_id=new.auth_user_id and (role<>new.role or enabled is distinct from (new.enabled and new.status='ACTIVO'));
 end if;return new;
end $$;
create trigger profile_membership_sync after update on talent.profiles for each row execute function talent_private.org_profile_sync();

create or replace function talent_private.actor_profile(p_auth uuid,p_company text) returns talent.profiles
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare canonical talent.profiles;actor talent.profiles;member talent_org.user_companies;managed boolean;
begin
 select * into canonical from talent.profiles where auth_user_id=p_auth and not is_context and status='ACTIVO' and enabled and archived_at is null;
 if not found then raise insufficient_privilege using message='TALENT_ACTOR_FORBIDDEN'; end if;
 if canonical.must_change_password then raise insufficient_privilege using message='PASSWORD_CHANGE_REQUIRED'; end if;
 select catalog_managed into managed from talent.companies where id=p_company and status='ACTIVA' and archived_at is null;
 if not found then raise insufficient_privilege; end if;
 if canonical.company_id=p_company and not managed then return canonical; end if;
 if not talent_private.org_company_access(p_auth,p_company) then raise insufficient_privilege; end if;
 select * into actor from talent.profiles where company_id=p_company and id=canonical.id and enabled and status='ACTIVO' and archived_at is null;
 if not found then raise insufficient_privilege; end if;
 actor.auth_user_id:=p_auth;actor.must_change_password:=canonical.must_change_password;
 if talent_private.org_global_admin(p_auth) then actor.role:='ADMIN';
 else select * into member from talent_org.user_companies where company_id=p_company and auth_user_id=p_auth and enabled and archived_at is null;actor.role:=member.role; end if;
 return actor;
end $$;

-- Memberships se administran solo por un global explícito y con CAS.
create function public.talent_org_member_save(p_actor uuid,p_user uuid,p_company text,p_role text,p_enabled boolean,p_all boolean,p_scopes text[],p_expected bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare v bigint;idval text;scope text;result jsonb;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 if p_enabled is null or p_all is null or p_scopes is null or not exists(select 1 from talent.roles where code=p_role) or not exists(select 1 from talent.companies where id=p_company and catalog_managed and status='ACTIVA') then raise exception 'TALENT_INVALID_MEMBERSHIP'; end if;
 if p_role='FORMADOR' and p_all then raise exception 'TALENT_TRAINER_SCOPE_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('org:member:'||p_company||':'||p_user,0));
 select version,id into v,idval from talent_org.user_companies where company_id=p_company and auth_user_id=p_user for update;
 if v is distinct from p_expected then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
 perform set_config('talent.org_actor',p_actor::text,true);
 insert into talent_org.user_companies(company_id,id,auth_user_id,role,enabled,all_campaigns)
 values(p_company,coalesce(idval,gen_random_uuid()::text),p_user,p_role,p_enabled,p_all)
 on conflict(company_id,auth_user_id) do update set role=excluded.role,enabled=excluded.enabled,all_campaigns=excluded.all_campaigns,archived_at=null
 returning to_jsonb(user_companies.*) into result;
 update talent_org.user_campaigns set enabled=false,archived_at=clock_timestamp() where company_id=p_company and auth_user_id=p_user and not(company_campaign_id=any(p_scopes));
 foreach scope in array p_scopes loop
  insert into talent_org.user_campaigns(company_id,id,auth_user_id,company_campaign_id) values(p_company,p_user||':'||scope,p_user,scope)
   on conflict(company_id,auth_user_id,company_campaign_id) do update set enabled=true,archived_at=null;
 end loop;
 -- Revoca snapshots ya tomados aun cuando solo cambiaron scopes en org.
 insert into talent.tenant_revisions(company_id,revision) values(p_company,1) on conflict(company_id) do update set revision=tenant_revisions.revision+1;
 perform set_config('talent.org_actor','',true);return result;
end $$;

create function public.talent_org_context(p_actor uuid,p_company text default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare home talent.profiles;actor talent.profiles;tenant text;available jsonb;data jsonb;scopes jsonb;
begin
 select * into home from talent.profiles where auth_user_id=p_actor and not is_context;
 if not found or not talent_private.org_live_actor(p_actor) then raise insufficient_privilege; end if;
 tenant:=coalesce(nullif(p_company,''),home.company_id);
 if nullif(p_company,'') is null and exists(select 1 from talent.companies where id=tenant and catalog_managed) and not talent_private.org_company_access(p_actor,tenant) then
  select m.company_id into tenant from talent_org.user_companies m join talent.companies c on c.id=m.company_id where m.auth_user_id=p_actor and m.enabled and m.archived_at is null and c.status='ACTIVA' and c.archived_at is null order by m.company_id limit 1;
 end if;
 actor:=talent_private.actor_profile(p_actor,tenant);
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'managed',c.catalog_managed) order by c.name),'[]') into available from talent.companies c
 where c.status='ACTIVA' and c.archived_at is null and (c.id=home.company_id or exists(select 1 from talent.profiles p where p.company_id=c.id and p.id=home.id and p.enabled and p.status='ACTIVO' and p.archived_at is null) and talent_private.org_company_access(p_actor,c.id));
 select coalesce(jsonb_agg(c.id),'[]') into scopes from talent.campaigns c where c.company_id=tenant and c.archived_at is null and talent_private.org_campaign_access(p_actor,tenant,c.company_campaign_id);
 data:=public.talent_session_profile(p_actor);
 data:=data||jsonb_build_object('companyId',tenant,'role',actor.role,'companies',available,'globalAdmin',talent_private.org_global_admin(p_actor),'managedCompany',(select catalog_managed from talent.companies where id=tenant),
 'scope',case when (select catalog_managed from talent.companies where id=tenant) then scopes else data->'scope' end,
 'companyCampaigns',coalesce((select jsonb_agg(id) from talent_org.company_campaigns where company_id=tenant and talent_private.org_campaign_access(p_actor,tenant,id)),'[]'),
 'allowedModules',coalesce((select jsonb_agg(module) from talent.user_modules where company_id=tenant and user_id=actor.id and archived_at is null),'[]'));
 return data;
end $$;

-- Modificar por migración nueva el snapshot 006, no reescribir su historial.
create function talent_private.org_link_owner(p_company text,p_owner text,p_assignment text) returns boolean language sql stable security definer set search_path=pg_catalog,talent,talent_org as $$
 select exists(select 1 from talent.profiles h join talent.companies c on c.id=p_company where h.id=p_owner and h.auth_user_id is not null and h.enabled and h.status='ACTIVO' and not h.must_change_password and h.archived_at is null and c.status='ACTIVA' and c.archived_at is null and (not c.catalog_managed or talent_private.org_campaign_access(h.auth_user_id,p_company,p_assignment)))
$$;
do $$ declare def text;begin
 def:=pg_get_functiondef('public.talent_runtime_snapshot(uuid,text)'::regprocedure);
 def:=replace(def,'perform talent_private.actor_profile(p_actor,actor.company_id);tenant:=actor.company_id;',
  'actor:=talent_private.actor_profile(p_actor,coalesce(nullif(current_setting(''talent.org_company'',true),''''),actor.company_id));tenant:=actor.company_id;');
 def:=replace(def,'and not p.must_change_password;','and not p.must_change_password and talent_private.org_link_owner(l.company_id,l.owner_id,l.company_campaign_id);');
 execute def;
 def:=pg_get_functiondef('public.talent_runtime_commit(uuid,text,text,bigint,jsonb,text[])'::regprocedure);
 def:=replace(def,'and p.enabled and p.status=''ACTIVO'';','and p.enabled and p.status=''ACTIVO'' and talent_private.org_link_owner(l.company_id,l.owner_id,l.company_campaign_id);');
 execute def;
end $$;
create function public.talent_org_snapshot(p_actor uuid,p_company text) returns jsonb language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare data jsonb;context jsonb;canonical talent.profiles;entry jsonb;t text;list jsonb;campaign_ids text[];group_ids text[];app_ids text[];person_ids text[];participant_ids text[];capture_ids text[];link_ids text[];
begin
 context:=public.talent_org_context(p_actor,p_company);perform set_config('talent.org_company',p_company,true);
 data:=public.talent_runtime_snapshot(p_actor,null);perform set_config('talent.org_company','',true);
 select * into canonical from talent.profiles where auth_user_id=p_actor;
 -- Los contextos no son cuentas Auth nuevas. Resolver identidad canónica para el roster.
 select coalesce(jsonb_agg(p||jsonb_build_object('username',h.username,'display_name',h.display_name,'avatar_url',h.avatar_url,'nickname',h.nickname,'tagline',h.tagline,'must_change_password',h.must_change_password,'role',coalesce(m.role,p->>'role'),'enabled',case when m.id is not null then m.enabled and h.enabled else (p->>'enabled')::boolean end,'status',case when m.id is not null and not(m.enabled and h.enabled) then 'INACTIVO' else p->>'status' end,'annotations',coalesce(p->'annotations','{}')||jsonb_build_object('homeCompanyId',h.company_id,'canonicalAuthId',h.auth_user_id))),'[]') into list
 from jsonb_array_elements(data#>'{tables,profiles}') p join talent.profiles h on h.id=p->>'id' and h.auth_user_id is not null left join talent_org.user_companies m on m.company_id=p_company and m.auth_user_id=h.auth_user_id and m.archived_at is null;
 data:=jsonb_set(data,'{tables,profiles}',list);
 -- Restringir también a jefaturas: el rol no concede todas las campañas del tenant.
 if (context->>'managedCompany')::boolean then
  select coalesce(array_agg(c.id),'{}') into campaign_ids from talent.campaigns c where c.company_id=p_company and talent_private.org_campaign_access(p_actor,p_company,c.company_campaign_id);
  select coalesce(array_agg(g.id),'{}') into group_ids from talent.training_groups g where g.company_id=p_company and g.campaign_id=any(campaign_ids) and (context->>'role'<>'FORMADOR' or g.trainer_id=canonical.id or g.ojt_trainer_id=canonical.id);
  select coalesce(array_agg(l.id),'{}') into link_ids from talent.capture_links l where l.company_id=p_company and talent_private.org_campaign_access(p_actor,p_company,l.company_campaign_id) and (context->>'role'<>'RECLUTADOR' or l.owner_id=canonical.id);
  select coalesce(array_agg(c.id),'{}') into capture_ids from talent.captures c where c.company_id=p_company and c.link_id=any(link_ids);
  select coalesce(array_agg(a.id),'{}') into app_ids from talent.applications a where a.company_id=p_company and a.campaign_id=any(campaign_ids) and (context->>'role'<>'RECLUTADOR' or a.recruiter_id=canonical.id);
  select coalesce(array_agg(distinct id),'{}') into person_ids from (select a.person_id as id from talent.applications a where a.company_id=p_company and a.id=any(app_ids) union select c.person_id from talent.captures c where c.company_id=p_company and c.id=any(capture_ids)) q;
  select coalesce(array_agg(p.id),'{}') into participant_ids from talent.participants p where p.company_id=p_company and p.group_id=any(group_ids) and p.application_id=any(app_ids);
  for t,list in select key,value from jsonb_each(data->'tables') loop
   select coalesce(jsonb_agg(r),'[]') into list from jsonb_array_elements(list) r where
    (t<>'campaigns' or r->>'id'=any(campaign_ids)) and (t<>'training_groups' or r->>'id'=any(group_ids))
    and (t<>'applications' or r->>'id'=any(app_ids)) and (t<>'persons' or r->>'id'=any(person_ids))
    and (t<>'participants' or r->>'id'=any(participant_ids)) and (t<>'captures' or r->>'id'=any(capture_ids)) and (t<>'capture_links' or r->>'id'=any(link_ids))
    and (not(r?'campaign_id') or r->>'campaign_id' is null or r->>'campaign_id'=any(campaign_ids))
    and (not(r?'group_id') or r->>'group_id' is null or r->>'group_id'=any(group_ids))
    and (not(r?'application_id') or r->>'application_id' is null or r->>'application_id'=any(app_ids))
    and (not(r?'person_id') or r->>'person_id' is null or r->>'person_id'=any(person_ids))
    and (not(r?'participant_id') or r->>'participant_id' is null or r->>'participant_id'=any(participant_ids));
   data:=jsonb_set(data,array['tables',t],list);
  end loop;
 end if;
 return data||jsonb_build_object('context',context);
end $$;

create function public.talent_org_company_save(p_actor uuid,p_id text,p_name text,p_legal text,p_tax text,p_expected bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare v bigint;result jsonb;administrator record;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 if p_id is null or length(p_id) not between 1 and 100 or p_name is null or length(btrim(p_name)) not between 1 and 200 then raise exception 'TALENT_INVALID_COMPANY'; end if;
 perform pg_advisory_xact_lock(hashtextextended('org:company:'||p_id,0));
 select version into v from talent.companies where id=p_id and catalog_managed for update;
 if v is distinct from p_expected or (v is null and exists(select 1 from talent.companies where id=p_id)) then raise sqlstate 'PT409' using message='TALENT_VERSION_CONFLICT'; end if;
 perform set_config('talent.org_actor',p_actor::text,true);
 insert into talent.companies(id,name,legal_name,tax_id,catalog_managed) values(p_id,btrim(p_name),nullif(btrim(p_legal),''),nullif(btrim(p_tax),''),true)
 on conflict(id) do update set name=excluded.name,legal_name=excluded.legal_name,tax_id=excluded.tax_id returning to_jsonb(companies.*) into result;
 insert into talent_org.audit_events(actor_auth_id,company_id,table_name,entity_id,action,changed_columns) values(p_actor,p_id,'companies',p_id,case when v is null then 'INSERT' else 'UPDATE' end,array['name','legal_name','tax_id']);
 if v is null then
  for administrator in select auth_user_id from talent_org.global_admins where enabled and archived_at is null loop
   perform public.talent_org_member_save(p_actor,administrator.auth_user_id,p_id,'ADMIN',true,true,'{}',null);
  end loop;
 end if;
 perform set_config('talent.org_actor','',true);return result;
end $$;
revoke all on function public.talent_org_company_save(uuid,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.talent_org_company_save(uuid,text,text,text,text,bigint) to service_role;
create function public.talent_org_directory(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not talent_private.org_live_actor(p_actor) then raise insufficient_privilege; end if;
 return jsonb_build_object('globalAdmin',talent_private.org_global_admin(p_actor),
 'companies',coalesce((select jsonb_agg(to_jsonb(c)) from talent.companies c where talent_private.org_company_access(p_actor,c.id)),'[]'),
 'campaigns',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('name',g.name)) from talent_org.company_campaigns a join talent_org.global_campaigns g on g.id=a.global_campaign_id where talent_private.org_campaign_access(p_actor,a.company_id,a.id)),'[]'),
 'definitions',case when talent_private.org_global_admin(p_actor) then coalesce((select jsonb_agg(to_jsonb(g)) from talent_org.global_campaigns g),'[]') else '[]'::jsonb end,
 'users',case when talent_private.org_global_admin(p_actor) then coalesce((select jsonb_agg(jsonb_build_object('id',p.auth_user_id,'name',p.display_name,'username',p.username,'companyId',p.company_id)) from talent.profiles p where not p.is_context),'[]') else '[]'::jsonb end,
 'memberships',case when talent_private.org_global_admin(p_actor) then coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('scopes',coalesce((select jsonb_agg(u.company_campaign_id) from talent_org.user_campaigns u where u.company_id=m.company_id and u.auth_user_id=m.auth_user_id and u.enabled and u.archived_at is null),'[]'))) from talent_org.user_companies m),'[]') else '[]'::jsonb end);
end $$;
revoke all on function public.talent_org_context(uuid,text),public.talent_org_snapshot(uuid,text),public.talent_org_directory(uuid),public.talent_org_member_save(uuid,uuid,text,text,boolean,boolean,text[],bigint) from public,anon,authenticated;
grant execute on function public.talent_org_context(uuid,text),public.talent_org_snapshot(uuid,text),public.talent_org_directory(uuid),public.talent_org_member_save(uuid,uuid,text,text,boolean,boolean,text[],bigint) to service_role;
revoke all on function talent_private.org_sync_member() from public,anon,authenticated,service_role;
revoke all on function talent_private.org_new_profile() from public,anon,authenticated,service_role;
revoke all on function talent_private.org_profile_sync() from public,anon,authenticated,service_role;
revoke all on function talent_private.org_link_owner(text,text,text) from public,anon,authenticated,service_role;
commit;
