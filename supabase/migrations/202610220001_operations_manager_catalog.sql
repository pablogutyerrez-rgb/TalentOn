begin;

-- The public RQ chooses from the defined managers; historical RQs retain their original gerencia IDs.
create function talent_ops.allowed_manager(p_company text,p_name text) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select p_name in ('Jazmín Chavez (TI y Proyectos)','Efrain Pardo (Gerente General)','Danter Pardo (Director General)')
    or (p_company='talent-up' and p_name='David Ramirez')
    or (p_company='techcenter' and p_name='Manuel Vargas')
    or (p_company='konectados' and p_name='Dennys Marin');
$$;

with managers(company_id,name) as (values
 ('talent-up','David Ramirez'),('techcenter','Manuel Vargas'),('konectados','Dennys Marin'),
 ('talent-up','Jazmín Chavez (TI y Proyectos)'),('techcenter','Jazmín Chavez (TI y Proyectos)'),('konectados','Jazmín Chavez (TI y Proyectos)'),
 ('talent-up','Efrain Pardo (Gerente General)'),('techcenter','Efrain Pardo (Gerente General)'),('konectados','Efrain Pardo (Gerente General)'),
 ('talent-up','Danter Pardo (Director General)'),('techcenter','Danter Pardo (Director General)'),('konectados','Danter Pardo (Director General)')
)
insert into talent_ops.gerencias(company_id,name,active)
 select m.company_id,m.name,true from managers m join talent.companies c on c.id=m.company_id and c.archived_at is null
on conflict(company_id,name) do update set active=true;

do $$ declare def text; patched text; begin
 def:=pg_get_functiondef('public.talent_ops_public_config(text)'::regprocedure);
 patched:=replace(def,'where g.company_id=l.company_id and g.active','where g.company_id=l.company_id and g.active and talent_ops.allowed_manager(g.company_id,g.name)');
 if patched=def then raise exception 'RQ_MANAGER_CONFIG_PATCH_MISMATCH'; end if;
 execute patched;

 def:=pg_get_functiondef('public.talent_ops_public_submit(text,uuid,text,jsonb)'::regprocedure);
 patched:=replace(def,'where id=g and company_id=l.company_id and active','where id=g and company_id=l.company_id and active and talent_ops.allowed_manager(company_id,name)');
 if patched=def then raise exception 'RQ_MANAGER_SUBMIT_PATCH_MISMATCH'; end if;
 execute patched;

 def:=pg_get_functiondef('public.talent_ops_link_create(uuid,text,text)'::regprocedure);
 patched:=replace(def,'where company_id=p_company and active','where company_id=p_company and active and talent_ops.allowed_manager(company_id,name)');
 if patched=def then raise exception 'RQ_MANAGER_LINK_PATCH_MISMATCH'; end if;
 execute patched;
end $$;

commit;
