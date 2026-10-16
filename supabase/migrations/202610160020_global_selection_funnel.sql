begin;

-- Keep the existing global metrics and expose only aggregate selection-stage counts.
create index if not exists talent_funnel_events_app on talent.contract_events(company_id,application_id) where archived_at is null and application_id is not null;
create index if not exists talent_funnel_contacts_app on talent.contacts(company_id,application_id) where archived_at is null and application_id is not null;
create index if not exists talent_funnel_interviews_app on talent.interviews(company_id,application_id) where archived_at is null;
create index if not exists talent_funnel_technical_app on talent.technical_verifications(company_id,application_id) where archived_at is null;
create index if not exists talent_funnel_evaluations_app on talent.evaluations(company_id,application_id) where archived_at is null and application_id is not null;
create index if not exists talent_funnel_participants_app on talent.participants(company_id,application_id) where archived_at is null;

create or replace function public.talent_org_dashboard(p_actor uuid,p_company text default null,p_campaign text default null,p_from date default null,p_to date default null) returns jsonb
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
 history_levels as (
  select e.company_id,e.application_id,max(case
   when e.new_state in ('APTO_CAPACITACION','CAPACITACION','OJT','APTO_ALTA','GESTION_TALENTO','CONTRATADO') then 5
   when e.new_state='EVALUACIONES' then 4
   when e.new_state='VERIFICACION_TECNICA' then 3
   when e.new_state='ENTREVISTA' then 2
   when e.new_state='CONTACTADO' then 1 else 0 end) as reached
  from talent.contract_events e join apps a on a.company_id=e.company_id and a.id=e.application_id
  where e.stream in ('selection','application') and e.archived_at is null
  group by e.company_id,e.application_id
 ),
 app_progress as (
  select greatest(
   case when a.stage in ('APTO_CAPACITACION','CAPACITACION','OJT','APTO_ALTA','GESTION_TALENTO','CONTRATADO') then 5
        when a.stage='EVALUACIONES' then 4 when a.stage='VERIFICACION_TECNICA' then 3
        when a.stage='ENTREVISTA' then 2 when a.stage='CONTACTADO' then 1 else 0 end,
   coalesce(h.reached,0),
   case when exists(select 1 from talent.contacts x where x.company_id=a.company_id and x.application_id=a.id and x.archived_at is null) then 1 else 0 end,
   case when exists(select 1 from talent.interviews x where x.company_id=a.company_id and x.application_id=a.id and x.archived_at is null and (x.performed_at is not null or x.result is not null)) then 2 else 0 end,
   case when exists(select 1 from talent.technical_verifications x where x.company_id=a.company_id and x.application_id=a.id and x.archived_at is null) then 3 else 0 end,
   case when exists(select 1 from talent.evaluations x where x.company_id=a.company_id and x.application_id=a.id and x.archived_at is null) then 4 else 0 end,
   case when exists(select 1 from talent.participants x where x.company_id=a.company_id and x.application_id=a.id and x.archived_at is null) or exists(select 1 from talent.hiring x where x.company_id=a.company_id and x.application_id=a.id and x.archived_at is null and x.status='CONTRATADO') then 5 else 0 end
  ) as reached from apps a left join history_levels h on h.company_id=a.company_id and h.application_id=a.id
 ),
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
 'totals',(select to_jsonb(t)||jsonb_build_object('dropout_rate',round(100.0*t.started_dropouts/nullif(t.started,0),2),'persons',(select count(distinct coalesce(p.shared_identity_id,'tenant:'||p.company_id||':'||p.id)) from talent.persons p join apps a on a.company_id=p.company_id and a.person_id=p.id where p.archived_at is null)) from totals t),
 'funnel',(select jsonb_build_object('postulantes',count(*),'contactados',count(*) filter(where reached>=1),'entrevistados',count(*) filter(where reached>=2),'verificacion',count(*) filter(where reached>=3),'evaluados',count(*) filter(where reached>=4),'aptos',count(*) filter(where reached>=5)) from app_progress)) into result;
 return result;
end $$;

commit;
