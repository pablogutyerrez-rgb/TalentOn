begin;

-- Preserve legacy locations; new RQs use an explicit modality instead.
alter table talent_ops.requests alter column location drop not null;
alter table talent_ops.requests drop constraint requests_location_check;
alter table talent_ops.requests add constraint requests_location_check check(location is null or length(btrim(location)) between 2 and 200);
alter table talent_ops.requests add column variable_bonus numeric(12,2) not null default 0 check(variable_bonus >= 0);
alter table talent_ops.requests add column mobility_bonus numeric(12,2) not null default 0 check(mobility_bonus >= 0);
alter table talent_ops.requests add column work_modality text check(work_modality in ('PRESENCIAL','REMOTA'));

do $$
declare def text; patched text;
begin
 def:=pg_get_functiondef('public.talent_ops_public_submit(text,uuid,text,jsonb)'::regprocedure);
 patched:=replace(def,
  ' insert into talent_ops.requests(company_id,gerencia_id,requester_auth_id,lookup_nonce,kind,company_campaign_id,profile_required,fts,salary,expected_start,criticality,schedule,location,observations)',
  ' if p_data->>''profileRequired'' not in (''Teleoperador de Ventas'',''Live Commerce'',''Streaming'') or p_data->>''modality'' not in (''PRESENCIAL'',''REMOTA'') then raise exception ''INVALID_RQ_DETAILS''; end if;
 if coalesce(p_data->>''variableBonus'','''') !~ ''^[0-9]{1,10}(\.[0-9]{1,2})?$'' or coalesce(p_data->>''mobilityBonus'','''') !~ ''^[0-9]{1,10}(\.[0-9]{1,2})?$'' then raise exception ''INVALID_BONUS''; end if;
 insert into talent_ops.requests(company_id,gerencia_id,requester_auth_id,lookup_nonce,kind,company_campaign_id,profile_required,fts,salary,variable_bonus,mobility_bonus,work_modality,expected_start,criticality,schedule,location,observations)');
 if patched=def then raise exception 'RQ_SUBMIT_PATCH_MISMATCH'; end if;
 def:=patched;
 patched:=replace(def,
  '(p_data->>''salary'')::numeric,(p_data->>''expectedStart'')::date',
  '(p_data->>''salary'')::numeric,(p_data->>''variableBonus'')::numeric,(p_data->>''mobilityBonus'')::numeric,p_data->>''modality'',(p_data->>''expectedStart'')::date');
 if patched=def then raise exception 'RQ_BONUS_PATCH_MISMATCH'; end if;
 def:=patched;
 patched:=replace(def,'btrim(p_data->>''location''),coalesce(p_data->>''observations''','null,coalesce(p_data->>''observations''');
 if patched=def then raise exception 'RQ_LOCATION_PATCH_MISMATCH'; end if;
 execute patched;

 def:=pg_get_functiondef('public.talent_ops_selection(uuid)'::regprocedure);
 patched:=replace(def,'''salary'',r.salary,','''salary'',r.salary,''variableBonus'',r.variable_bonus,''mobilityBonus'',r.mobility_bonus,');
 if patched=def then raise exception 'RQ_SELECTION_BONUS_PATCH_MISMATCH'; end if;
 def:=patched;
 patched:=replace(def,'''location'',r.location,','''location'',r.location,''modality'',r.work_modality,');
 if patched=def then raise exception 'RQ_SELECTION_MODALITY_PATCH_MISMATCH'; end if;
 execute patched;

 def:=pg_get_functiondef('public.talent_ops_admin(uuid)'::regprocedure);
 patched:=replace(def,'''salary'',r.salary,','''salary'',r.salary,''variableBonus'',r.variable_bonus,''mobilityBonus'',r.mobility_bonus,');
 if patched=def then raise exception 'RQ_ADMIN_BONUS_PATCH_MISMATCH'; end if;
 def:=patched;
 patched:=replace(def,'''location'',r.location,','''location'',r.location,''modality'',r.work_modality,');
 if patched=def then raise exception 'RQ_ADMIN_MODALITY_PATCH_MISMATCH'; end if;
 execute patched;
end $$;

commit;
