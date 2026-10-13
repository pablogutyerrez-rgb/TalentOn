-- Solo CI / base disposable. Sin llamadas externas ni datos reales.
begin;
create function pg_temp.org_expect_error(sql text) returns void language plpgsql as $$
begin
 begin execute sql; exception when others then return; end;
 raise exception 'EXPECTED_REJECTION: %',sql;
end $$;
insert into auth.users values('70000000-0000-4000-8000-000000000001');
insert into talent.companies(id,name) values('org-ci','CI');
insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,must_change_password)
 values('org-ci','org-ci-user','70000000-0000-4000-8000-000000000001','org.ci','CI','ADMIN','ACTIVO',false);
insert into talent_org.user_companies(company_id,id,auth_user_id,role) values('talent-up','ci-member','70000000-0000-4000-8000-000000000001','RECLUTADOR');
insert into talent_org.user_campaigns(company_id,id,auth_user_id,company_campaign_id)
 values('talent-up','ci-scope','70000000-0000-4000-8000-000000000001','talent-up:bitel-portabilidad');
select pg_temp.org_expect_error($q$insert into talent_org.user_campaigns(company_id,id,auth_user_id,company_campaign_id) values('talent-up','bad','70000000-0000-4000-8000-000000000001','techcenter:bitel-portabilidad')$q$);
select pg_temp.org_expect_error($q$select public.talent_org_summary('70000000-0000-4000-8000-000000000001')$q$);
select pg_temp.org_expect_error($q$insert into talent.campaigns(company_id,id,code,title,status,vacancies) values('talent-up','bad','BAD','CI','EN_PROCESO',1)$q$);
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from talent_org.company_campaigns)<>1 then raise exception 'RLS_COMPANY_SCOPE_FAILED'; end if;
 if exists(select 1 from talent_org.company_campaigns where company_id<>'talent-up') then raise exception 'RLS_CROSS_TENANT_FAILED'; end if;
 if (select count(*) from talent_org.global_campaigns)<>1 then raise exception 'RLS_GLOBAL_CAMPAIGN_FAILED'; end if;
end $$;
reset role;
rollback;
