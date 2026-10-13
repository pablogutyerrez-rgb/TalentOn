begin;

-- Aggregate only in SQL. No cross-company personal records leave this endpoint.
create function public.talent_org_dashboard(p_actor uuid,p_company text default null,p_campaign text default null,p_from date default null,p_to date default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare result jsonb;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 if p_from>p_to then raise exception 'TALENT_INVALID_PERIOD'; end if;
 if p_company is not null and not exists(select 1 from talent.companies where id=p_company and catalog_managed and archived_at is null) then raise insufficient_privilege; end if;
 with companies as (select id,name from talent.companies where catalog_managed and archived_at is null and (p_company is null or id=p_company)),
 campaigns as (select c.* from talent.campaigns c join companies co on co.id=c.company_id join talent_org.company_campaigns cc on cc.company_id=c.company_id and cc.id=c.company_campaign_id where c.archived_at is null and (p_campaign is null or cc.global_campaign_id=p_campaign)),
 apps as (select a.* from talent.applications a join campaigns c on c.company_id=a.company_id and c.id=a.campaign_id where a.archived_at is null and (p_from is null or a.application_date>=p_from) and (p_to is null or a.application_date<p_to+1)),
 groups as (select g.* from talent.training_groups g join campaigns c on c.company_id=g.company_id and c.id=g.campaign_id where g.archived_at is null and g.status<>'CANCELADA' and (p_from is null or g.start_date>=p_from) and (p_to is null or g.start_date<=p_to)),
 participants as (select p.*,exists(select 1 from talent.dropouts d where d.company_id=p.company_id and d.participant_id=p.id and d.archived_at is null) as dropped from talent.participants p join groups g on g.company_id=p.company_id and g.id=p.group_id where p.archived_at is null),
 stats as (select co.id,co.name,
  (select count(*) from campaigns c where c.company_id=co.id) as campaigns,
  (select count(*) from apps a where a.company_id=co.id) as applications,
  (select count(*) from groups g where g.company_id=co.id) as groups,
  (select count(*) from groups g where g.company_id=co.id and g.status in ('EN_OJT','EXTENSION_OJT')) as ojt_groups,
  (select count(*) from participants p where p.company_id=co.id) as enrolled,
  (select count(*) from participants p where p.company_id=co.id and p.day1_at is not null) as started,
  (select count(*) from participants p where p.company_id=co.id and p.dropped) as dropouts,
  (select count(*) from participants p where p.company_id=co.id and p.dropped and p.day1_at is not null) as started_dropouts,
  (select count(*) from talent.hiring h join campaigns c on c.company_id=h.company_id and c.id=(select a.campaign_id from talent.applications a where a.company_id=h.company_id and a.id=h.application_id) where h.company_id=co.id and h.archived_at is null and h.status='CONTRATADO' and (p_from is null or h.official_start>=p_from) and (p_to is null or h.official_start<=p_to)) as hires
 from companies co),
 totals as (select coalesce(sum(campaigns),0) campaigns,coalesce(sum(applications),0) applications,coalesce(sum(groups),0) groups,coalesce(sum(ojt_groups),0) ojt_groups,coalesce(sum(enrolled),0) enrolled,coalesce(sum(started),0) started,coalesce(sum(dropouts),0) dropouts,coalesce(sum(started_dropouts),0) started_dropouts,coalesce(sum(hires),0) hires from stats)
 select jsonb_build_object('companies',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('dropout_rate',round(100.0*s.started_dropouts/nullif(s.started,0),2)) order by s.name) from stats s),'[]'),
 'totals',(select to_jsonb(t)||jsonb_build_object('dropout_rate',round(100.0*t.started_dropouts/nullif(t.started,0),2),'persons',(select count(distinct coalesce(p.shared_identity_id,'tenant:'||p.company_id||':'||p.id)) from talent.persons p join apps a on a.company_id=p.company_id and a.person_id=p.id where p.archived_at is null)) from totals t)) into result;
 return result;
end $$;

create function public.talent_org_users(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'authUserId',p.auth_user_id,'companyId',p.company_id,'email',p.username,'name',p.display_name,'role',p.role,'status',p.status,'avatarUrl',p.avatar_url,'nickname',p.nickname,'tagline',p.tagline,'phone',p.phone,'jobTitle',p.job_title,
 'allowedModules',coalesce((select jsonb_agg(module) from talent.user_modules where company_id=p.company_id and user_id=p.id and archived_at is null),'[]'),
 'scopeCampaignIds',coalesce((select jsonb_agg(campaign_id) from talent.campaign_assignments where company_id=p.company_id and user_id=p.id and assignment_kind='SCOPE' and archived_at is null),'[]'),
 'subordinateUserIds',coalesce((select jsonb_agg(subordinate_id) from talent.supervision where company_id=p.company_id and supervisor_id=p.id and archived_at is null),'[]'))) from talent.profiles p where not p.is_context and p.archived_at is null),'[]');
end $$;

create function public.talent_org_user_home(p_actor uuid,p_user text) returns text language plpgsql stable security definer set search_path=pg_catalog,talent as $$
declare home text;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 select company_id into home from talent.profiles where id=p_user and not is_context and archived_at is null;
 if not found then raise exception 'TALENT_USER_NOT_FOUND'; end if;
 return home;
end $$;

-- Canonical profile and all company grants commit or roll back together.
create function public.talent_org_user_commit(p_actor uuid,p_company text,p_revision bigint,p_rows jsonb,p_resets text[],p_user text,p_grants jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,talent,talent_org as $$
declare grant_row jsonb;target uuid;expected bigint;creating boolean;
begin
 if not talent_private.org_global_admin(p_actor) then raise insufficient_privilege; end if;
 if jsonb_typeof(p_grants)<>'array' or jsonb_array_length(p_grants)>100 then raise exception 'TALENT_INVALID_MEMBERSHIP'; end if;
 if not exists(select 1 from jsonb_array_elements(p_grants) g where (g->>'enabled')::boolean) or exists(select 1 from jsonb_array_elements(p_grants) g where (g->>'enabled')::boolean and not (g->>'allCampaigns')::boolean and coalesce(jsonb_array_length(g->'scopes'),0)=0) then raise exception 'TALENT_COMPANY_SCOPE_REQUIRED'; end if;
 if (select count(*) from jsonb_array_elements(p_grants))<>(select count(distinct x->>'companyId') from jsonb_array_elements(p_grants) x) then raise exception 'TALENT_INVALID_MEMBERSHIP'; end if;
 perform pg_advisory_xact_lock(hashtextextended('org:user:'||p_user,0));
 creating:=not exists(select 1 from talent.profiles where company_id=p_company and id=p_user);
 perform set_config('talent.org_actor',p_actor::text,true);
 perform public.talent_runtime_commit(p_actor,null,p_company,p_revision,p_rows,p_resets);
 select auth_user_id into target from talent.profiles where company_id=p_company and id=p_user and not is_context;
 if target is null then raise exception 'TALENT_USER_NOT_FOUND'; end if;
 if exists(select 1 from talent_org.user_companies m where m.auth_user_id=target and m.enabled and m.archived_at is null and not exists(select 1 from jsonb_array_elements(p_grants) g where g->>'companyId'=m.company_id)) then raise sqlstate 'PT409' using message='TALENT_MEMBERSHIP_LIST_CHANGED'; end if;
 for grant_row in select * from jsonb_array_elements(p_grants) order by value->>'companyId' loop
  expected:=(grant_row->>'version')::bigint;
  if creating and grant_row->>'companyId'=p_company and expected is null then select version into expected from talent_org.user_companies where company_id=p_company and auth_user_id=target; end if;
  perform public.talent_org_member_save(p_actor,target,grant_row->>'companyId',grant_row->>'role',(grant_row->>'enabled')::boolean,(grant_row->>'allCampaigns')::boolean,array(select jsonb_array_elements_text(grant_row->'scopes')),expected);
 end loop;
 -- These users enter only their explicitly assigned companies. Home stores identity.
 update talent.profiles set annotations=annotations||'{"companyAccessManaged":true}'::jsonb where company_id=p_company and id=p_user;
end $$;

-- Account-home is not an implicit additional company permission.
do $$ declare def text;patched text;begin
 def:=pg_get_functiondef('talent_private.actor_profile(uuid,text)'::regprocedure);
 patched:=replace(def,'if canonical.company_id=p_company and not managed then return canonical; end if;',
 'if canonical.company_id=p_company and not managed then if coalesce((canonical.annotations->>''companyAccessManaged'')::boolean,false) and not talent_private.org_global_admin(p_auth) then raise insufficient_privilege; end if; return canonical; end if;');
 if patched=def then raise exception 'TALENT_ACTOR_PATCH_MISMATCH'; end if;execute patched;
 def:=pg_get_functiondef('public.talent_org_context(uuid,text)'::regprocedure);
 patched:=replace(def,'if nullif(p_company,'''') is null and exists',
 'if nullif(p_company,'''') is null and coalesce((home.annotations->>''companyAccessManaged'')::boolean,false) and not talent_private.org_global_admin(p_actor) then select m.company_id into tenant from talent_org.user_companies m join talent.companies c on c.id=m.company_id where m.auth_user_id=p_actor and m.enabled and m.archived_at is null and c.status=''ACTIVA'' and c.archived_at is null order by m.company_id limit 1; end if; if nullif(p_company,'''') is null and exists');
 patched:=replace(patched,'c.id=home.company_id and (not c.catalog_managed',
 'c.id=home.company_id and (not coalesce((home.annotations->>''companyAccessManaged'')::boolean,false) or talent_private.org_global_admin(p_actor)) and (not c.catalog_managed');
 if patched=def then raise exception 'TALENT_CONTEXT_PATCH_MISMATCH'; end if;execute patched;
end $$;

revoke all on function public.talent_org_dashboard(uuid,text,text,date,date),public.talent_org_users(uuid),public.talent_org_user_home(uuid,text),public.talent_org_user_commit(uuid,text,bigint,jsonb,text[],text,jsonb) from public,anon,authenticated;
grant execute on function public.talent_org_dashboard(uuid,text,text,date,date),public.talent_org_users(uuid),public.talent_org_user_home(uuid,text),public.talent_org_user_commit(uuid,text,bigint,jsonb,text[],text,jsonb) to service_role;
commit;
