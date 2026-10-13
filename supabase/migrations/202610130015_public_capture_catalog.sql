begin;
-- Minimal public-form metadata, resolved using an active link. Server-only RPC.
create function public.talent_capture_catalog(p_hash text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,talent,talent_org as $$
declare tenant text; company_name text; managed boolean;
begin
 select l.company_id,c.name,c.catalog_managed into tenant,company_name,managed
 from talent.capture_links l join talent.companies c on c.id=l.company_id
 where l.token_hash=p_hash and l.active and l.archived_at is null
 and c.status='ACTIVA' and c.archived_at is null;
 if tenant is null then raise insufficient_privilege; end if;
 return jsonb_build_object('companyName',company_name,'campaigns',
 case when managed then coalesce((
  select jsonb_agg(jsonb_build_object('id',a.id,'name',g.name) order by g.name,a.id)
  from talent_org.company_campaigns a join talent_org.global_campaigns g on g.id=a.global_campaign_id
  where a.company_id=tenant and a.status='ACTIVA' and a.archived_at is null
  and g.status='ACTIVA' and g.archived_at is null
 ),'[]'::jsonb) else coalesce((
  select jsonb_agg(jsonb_build_object('id',c.id,'name',c.title) order by c.title,c.id)
  from talent.campaigns c where c.company_id=tenant and c.archived_at is null
  and c.status in ('PUBLICADO','ACTIVA','EN_PROCESO')
 ),'[]'::jsonb) end);
end $$;
revoke all on function public.talent_capture_catalog(text) from public,anon,authenticated;
grant execute on function public.talent_capture_catalog(text) to service_role;
commit;
