begin;
-- During initial profile creation the membership trigger must not pre-insert
-- module rows that the same version-checked runtime batch is about to create.
do $$ declare definition text;patched text;begin
 definition:=pg_get_functiondef('public.talent_org_user_commit(uuid,text,bigint,jsonb,text[],text,jsonb)'::regprocedure);
 patched:=replace(definition,
  'perform set_config(''talent.org_actor'',p_actor::text,true);',
  'perform set_config(''talent.org_actor'',case when creating then '''' else p_actor::text end,true);');
 if patched=definition then raise exception 'TALENT_USER_COMMIT_PATCH_MISMATCH'; end if;
 execute patched;
end $$;
commit;
