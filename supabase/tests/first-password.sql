begin;
insert into auth.users(id) values ('30000000-0000-4000-8000-000000000001');
insert into talent.companies(id,name) values ('password-ci','CI');
insert into talent.profiles(company_id,id,auth_user_id,username,display_name,role,status,must_change_password) values
 ('password-ci','admin','30000000-0000-4000-8000-000000000001','password.ci','CI','ADMIN','ACTIVO',true);
set local role service_role;
do $$ begin
 begin
  perform public.talent_group_page('30000000-0000-4000-8000-000000000001','password-ci');
  raise exception 'PASSWORD_GATE_MISSING';
 exception when insufficient_privilege then if sqlerrm<>'PASSWORD_CHANGE_REQUIRED' then raise; end if; end;
 if not (public.talent_session_profile('30000000-0000-4000-8000-000000000001')->>'mustChangePassword')::boolean then raise exception 'PASSWORD_FLAG_MISSING'; end if;
end $$;
select public.talent_password_change_complete('30000000-0000-4000-8000-000000000001',1);
do $$ begin
 if (public.talent_session_profile('30000000-0000-4000-8000-000000000001')->>'mustChangePassword')::boolean then raise exception 'PASSWORD_FLAG_NOT_CLEARED'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin
  perform public.talent_password_change_complete('30000000-0000-4000-8000-000000000001',2);
  raise exception 'BROWSER_CAN_CLEAR_FLAG';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
