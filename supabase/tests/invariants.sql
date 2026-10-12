-- Datos ficticios SOLO en PostgreSQL desechable de CI. Todo se revierte al finalizar.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');
set local role service_role;
select public.talent_commit('[{"path":"companies/ci","mode":"create","data":{"name":"CI"}},{"path":"users/00000000-0000-4000-8000-000000000001","mode":"create","data":{"uid":"00000000-0000-4000-8000-000000000001","companyId":"ci","username":"ci.admin","role":"ADMIN","status":"ACTIVO"}}]', '{"companies/ci":null,"users/00000000-0000-4000-8000-000000000001":null}');
set constraints all immediate;
do $$ begin
  if public.talent_get('companies/ci')->>'version' <> '1' then raise exception 'VERSION_CHECK_FAILED'; end if;
  if jsonb_array_length(public.talent_list('users')->'items') <> 1 then raise exception 'LIST_CHECK_FAILED'; end if;
  begin
    perform public.talent_commit('[{"path":"companies/ci","mode":"merge","data":{"name":"Wrong"}}]', '{"companies/ci":99}');
    raise exception 'CAS_DID_NOT_REJECT';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.talent_commit('[{"path":"companies/ci","mode":"merge","data":{"name":"Wrong"}}]', '{}');
    raise exception 'MISSING_CAS_DID_NOT_REJECT';
  exception when raise_exception then if sqlerrm <> 'TALENT_PRECONDITION_REQUIRED' then raise; end if; end;
  begin
    perform public.talent_commit('[{"path":"candidates/orphan","mode":"create","data":{"companyId":"missing"}}]', '{"candidates/orphan":null}');
    raise exception 'ORPHAN_DID_NOT_REJECT';
  exception when raise_exception then if sqlerrm <> 'TALENT_COMPANY_NOT_FOUND' then raise; end if; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.talent_get('companies/ci'); raise exception 'ANON_RPC_EXPOSED'; exception when insufficient_privilege then null; end;
  begin perform data from public.talent_documents; raise exception 'ANON_DATA_EXPOSED'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$ begin
  begin perform public.talent_commit('[]','{}'); raise exception 'AUTH_MUTATION_EXPOSED'; exception when insufficient_privilege then null; end;
  begin perform data from public.talent_documents; raise exception 'AUTH_DATA_EXPOSED'; exception when insufficient_privilege then null; end;
end $$;
rollback;
