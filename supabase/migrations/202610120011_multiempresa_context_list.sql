begin;
-- No ofrecer en el selector una empresa hogar cuya membresía fue revocada.
do $$ declare def text;replacement text;begin
 def:=pg_get_functiondef('public.talent_org_context(uuid,text)'::regprocedure);
 replacement:=replace(def,'(c.id=home.company_id or exists',
  '((c.id=home.company_id and (not c.catalog_managed or talent_private.org_company_access(p_actor,c.id))) or exists');
 if replacement=def then raise exception 'TALENT_CONTEXT_PATCH_MISMATCH'; end if;
 execute replacement;
end $$;
commit;
